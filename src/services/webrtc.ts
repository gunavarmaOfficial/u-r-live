/**
 * WebRTC and WebSocket Signaling Client for OmeLive
 * Manages media devices, RTCPeerConnection lifecycle, and matchmaking events
 */
import { WebRTCState, MatchPreferences, ChatMessage } from '../types';

export interface WebRTCEvents {
  onStateChange: (state: WebRTCState, details?: string) => void;
  onLocalStream: (stream: MediaStream) => void;
  onRemoteStream: (stream: MediaStream | null) => void;
  onChatMessage: (message: ChatMessage) => void;
  onMatchFound: (peerInfo: {
    peerUserId: string;
    peerName: string;
    peerCountry: string;
    sharedInterests?: string[];
    sharedLanguages?: string[];
    mode?: string;
  }) => void;
  onPeerDisconnected: (reason: string) => void;
  onError: (errorMsg: string) => void;
}

export class WebRTCManager {
  private ws: WebSocket | null = null;
  private peerConnection: RTCPeerConnection | null = null;
  private localStream: MediaStream | null = null;
  private remoteStream: MediaStream | null = null;
  private iceServers: RTCIceServer[] = [
    { urls: 'stun:stun.l.google.com:19302' },
    { urls: 'stun:stun1.l.google.com:19302' },
  ];
  private currentMatchId: string | null = null;
  private pendingCandidates: RTCIceCandidateInit[] = [];
  private events: WebRTCEvents;
  private state: WebRTCState = 'idle';
  private pingInterval: any = null;

  private isAudioEnabled = true;
  private isVideoEnabled = true;

  constructor(events: WebRTCEvents, customIceServers?: RTCIceServer[]) {
    this.events = events;
    if (customIceServers && customIceServers.length > 0) {
      this.iceServers = customIceServers;
    }
  }

  public updateIceServers(servers: RTCIceServer[]) {
    if (servers && servers.length > 0) {
      this.iceServers = servers;
    }
  }

  public getState(): WebRTCState {
    return this.state;
  }

  private setState(newState: WebRTCState, details?: string) {
    this.state = newState;
    this.events.onStateChange(newState, details);
  }

  /**
   * Acquire local camera & microphone streams
   */
  public async initMedia(): Promise<MediaStream> {
    if (this.localStream) {
      return this.localStream;
    }

    this.setState('requesting_permissions');
    try {
      if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
        throw new Error('Your browser does not support WebRTC media capture.');
      }

      const stream = await navigator.mediaDevices.getUserMedia({
        video: {
          width: { ideal: 1280 },
          height: { ideal: 720 },
          facingMode: 'user',
        },
        audio: {
          echoCancellation: true,
          noiseSuppression: true,
        },
      });

      this.localStream = stream;
      this.events.onLocalStream(stream);
      this.setState('idle');
      return stream;
    } catch (err: any) {
      console.error('Camera/mic access error:', err);
      let errorMsg = 'Could not access camera or microphone.';
      if (err.name === 'NotAllowedError' || err.name === 'PermissionDeniedError') {
        errorMsg = 'Camera and microphone permissions were denied. Please allow camera access in your browser settings to video chat.';
      } else if (err.name === 'NotFoundError' || err.name === 'DevicesNotFoundError') {
        errorMsg = 'No camera or microphone found on your device.';
      } else if (err.name === 'NotReadableError') {
        errorMsg = 'Your camera or microphone is already in use by another application.';
      }

      this.setState('camera_unavailable', errorMsg);
      this.events.onError(errorMsg);
      throw new Error(errorMsg);
    }
  }

  /**
   * Connect WebSocket signaling channel
   */
  public connectSignaling(): Promise<void> {
    return new Promise((resolve, reject) => {
      if (this.ws && (this.ws.readyState === WebSocket.OPEN || this.ws.readyState === WebSocket.CONNECTING)) {
        resolve();
        return;
      }

      const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
      const wsUrl = `${protocol}//${window.location.host}/ws`;

      try {
        this.ws = new WebSocket(wsUrl);

        this.ws.onopen = () => {
          // Setup keepalive ping
          this.pingInterval = setInterval(() => {
            if (this.ws && this.ws.readyState === WebSocket.OPEN) {
              this.ws.send(JSON.stringify({ type: 'ping' }));
            }
          }, 20000);
          resolve();
        };

        this.ws.onmessage = async (event) => {
          try {
            const msg = JSON.parse(event.data);
            await this.handleSignalingMessage(msg);
          } catch (err) {
            console.error('Failed to parse signaling message:', err);
          }
        };

        this.ws.onerror = (err) => {
          console.warn('Signaling socket error:', err);
        };

        this.ws.onclose = () => {
          clearInterval(this.pingInterval);
          if (this.state === 'connected' || this.state === 'waiting_for_match') {
            this.setState('idle', 'Disconnected from signaling server');
          }
        };
      } catch (err: any) {
        reject(err);
      }
    });
  }

  /**
   * Join matchmaking queue
   */
  public async findMatch(
    userId: string,
    gender: string,
    country: string,
    preferences: MatchPreferences
  ) {
    if (!this.localStream) {
      await this.initMedia();
    }
    await this.connectSignaling();

    this.cleanupPeerConnection();
    this.setState('waiting_for_match');

    this.sendSignalingMessage({
      type: 'join_queue',
      payload: {
        userId,
        gender,
        country,
        preferences,
      },
    });
  }

  /**
   * Leave matchmaking queue or cancel search
   */
  public leaveQueue() {
    if (this.ws && this.ws.readyState === WebSocket.OPEN) {
      this.sendSignalingMessage({ type: 'leave_queue' });
    }
    this.cleanupPeerConnection();
    this.setState('idle');
  }

  /**
   * Skip current partner and immediately find next match
   */
  public skipMatch(userId: string, preferences: MatchPreferences) {
    this.cleanupPeerConnection();
    this.setState('waiting_for_match');

    this.sendSignalingMessage({
      type: 'skip_match',
      payload: {
        findNext: true,
        preferences,
      },
    });
  }

  /**
   * Completely disconnect video session
   */
  public disconnect() {
    this.cleanupPeerConnection();
    this.leaveQueue();
    this.setState('local_disconnected');
  }

  /**
   * Handle incoming signaling messages
   */
  private async handleSignalingMessage(msg: any) {
    switch (msg.type) {
      case 'match_found': {
        const { isInitiator, peerUserId, peerName, peerCountry, sharedInterests, sharedLanguages, mode } = msg.payload || {};
        this.currentMatchId = msg.matchId;
        this.setState('match_found');
        this.events.onMatchFound({
          peerUserId,
          peerName,
          peerCountry,
          sharedInterests: sharedInterests || [],
          sharedLanguages: sharedLanguages || [],
          mode: mode || 'video',
        });

        if (mode === 'text') {
          this.setState('connected');
        } else {
          await this.setupPeerConnection(isInitiator);
        }
        break;
      }

      case 'offer': {
        if (msg.matchId !== this.currentMatchId || !this.peerConnection) return;
        this.setState('connecting');
        await this.peerConnection.setRemoteDescription(new RTCSessionDescription(msg.payload));

        // Drain any ICE candidates received before remote description was ready
        while (this.pendingCandidates.length > 0) {
          const candidate = this.pendingCandidates.shift();
          if (candidate) {
            await this.peerConnection.addIceCandidate(new RTCIceCandidate(candidate));
          }
        }

        const answer = await this.peerConnection.createAnswer();
        await this.peerConnection.setLocalDescription(answer);

        this.sendSignalingMessage({
          type: 'answer',
          matchId: this.currentMatchId,
          payload: answer,
        });
        break;
      }

      case 'answer': {
        if (msg.matchId !== this.currentMatchId || !this.peerConnection) return;
        await this.peerConnection.setRemoteDescription(new RTCSessionDescription(msg.payload));

        while (this.pendingCandidates.length > 0) {
          const candidate = this.pendingCandidates.shift();
          if (candidate) {
            await this.peerConnection.addIceCandidate(new RTCIceCandidate(candidate));
          }
        }
        break;
      }

      case 'ice_candidate': {
        if (msg.matchId !== this.currentMatchId) return;
        const candidate = msg.payload;
        if (this.peerConnection && this.peerConnection.remoteDescription) {
          await this.peerConnection.addIceCandidate(new RTCIceCandidate(candidate));
        } else {
          this.pendingCandidates.push(candidate);
        }
        break;
      }

      case 'chat_message': {
        if (msg.matchId === this.currentMatchId) {
          this.events.onChatMessage({
            id: 'msg_' + Date.now() + Math.random().toString(36).substring(2, 6),
            senderId: msg.payload.senderId,
            isLocal: false,
            text: msg.payload.text,
            timestamp: msg.payload.timestamp || Date.now(),
          });
        }
        break;
      }

      case 'peer_disconnected': {
        this.cleanupPeerConnection();
        this.setState('remote_disconnected', msg.payload?.reason || 'Stranger disconnected');
        this.events.onPeerDisconnected(msg.payload?.reason || 'Stranger disconnected');
        break;
      }

      case 'error': {
        this.events.onError(msg.payload?.message || 'Matchmaking error');
        this.setState('failed', msg.payload?.message);
        break;
      }

      default:
        break;
    }
  }

  /**
   * Set up RTCPeerConnection
   */
  private async setupPeerConnection(isInitiator: boolean) {
    this.cleanupPeerConnection(false);

    const pc = new RTCPeerConnection({
      iceServers: this.iceServers,
      iceCandidatePoolSize: 2,
    });
    this.peerConnection = pc;

    // Add local tracks
    if (this.localStream) {
      this.localStream.getTracks().forEach((track) => {
        pc.addTrack(track, this.localStream!);
      });
    }

    // Handle remote tracks
    pc.ontrack = (event) => {
      if (event.streams && event.streams[0]) {
        this.remoteStream = event.streams[0];
        this.events.onRemoteStream(this.remoteStream);
      }
    };

    // Forward ICE candidates to signaling server
    pc.onicecandidate = (event) => {
      if (event.candidate && this.currentMatchId) {
        this.sendSignalingMessage({
          type: 'ice_candidate',
          matchId: this.currentMatchId,
          payload: event.candidate.toJSON(),
        });
      }
    };

    // Monitor connection state
    pc.onconnectionstatechange = () => {
      switch (pc.connectionState) {
        case 'connected':
          this.setState('connected');
          break;
        case 'connecting':
          this.setState('connecting');
          break;
        case 'disconnected':
        case 'failed':
          this.setState('reconnecting');
          break;
        case 'closed':
          this.setState('idle');
          break;
      }
    };

    pc.oniceconnectionstatechange = () => {
      if (pc.iceConnectionState === 'failed') {
        pc.restartIce();
      }
    };

    if (isInitiator) {
      this.setState('connecting');
      const offer = await pc.createOffer({
        offerToReceiveAudio: true,
        offerToReceiveVideo: true,
      });
      await pc.setLocalDescription(offer);

      this.sendSignalingMessage({
        type: 'offer',
        matchId: this.currentMatchId!,
        payload: offer,
      });
    }
  }

  public sendChatMessage(text: string, currentUserId: string): boolean {
    if (!this.currentMatchId || !this.ws || this.ws.readyState !== WebSocket.OPEN) {
      return false;
    }

    const trimmed = text.trim();
    if (!trimmed) return false;

    this.sendSignalingMessage({
      type: 'chat_message',
      matchId: this.currentMatchId,
      payload: {
        text: trimmed,
        senderId: currentUserId,
      },
    });

    this.events.onChatMessage({
      id: 'msg_loc_' + Date.now(),
      senderId: currentUserId,
      isLocal: true,
      text: trimmed,
      timestamp: Date.now(),
    });

    return true;
  }

  public toggleAudio(): boolean {
    if (!this.localStream) return false;
    this.isAudioEnabled = !this.isAudioEnabled;
    this.localStream.getAudioTracks().forEach((track) => {
      track.enabled = this.isAudioEnabled;
    });
    return this.isAudioEnabled;
  }

  public toggleVideo(): boolean {
    if (!this.localStream) return false;
    this.isVideoEnabled = !this.isVideoEnabled;
    this.localStream.getVideoTracks().forEach((track) => {
      track.enabled = this.isVideoEnabled;
    });
    return this.isVideoEnabled;
  }

  public isMuted(): boolean {
    return !this.isAudioEnabled;
  }

  public isVideoMuted(): boolean {
    return !this.isVideoEnabled;
  }

  private sendSignalingMessage(msg: any) {
    if (this.ws && this.ws.readyState === WebSocket.OPEN) {
      this.ws.send(JSON.stringify(msg));
    }
  }

  private cleanupPeerConnection(resetMatchId = true) {
    if (this.peerConnection) {
      this.peerConnection.ontrack = null;
      this.peerConnection.onicecandidate = null;
      this.peerConnection.onconnectionstatechange = null;
      this.peerConnection.close();
      this.peerConnection = null;
    }
    this.pendingCandidates = [];
    this.remoteStream = null;
    this.events.onRemoteStream(null);
    if (resetMatchId) {
      this.currentMatchId = null;
    }
  }

  public getLocalStream(): MediaStream | null {
    return this.localStream;
  }

  public getRemoteStream(): MediaStream | null {
    return this.remoteStream;
  }

  public destroy() {
    this.cleanupPeerConnection();
    if (this.localStream) {
      this.localStream.getTracks().forEach((t) => t.stop());
      this.localStream = null;
    }
    if (this.ws) {
      this.ws.close();
      this.ws = null;
    }
    clearInterval(this.pingInterval);
  }
}
