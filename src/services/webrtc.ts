/**
 * WebRTC and WebSocket Signaling Client for U-R-LIVE
 * Manages media devices, RTCPeerConnection lifecycle and matchmaking events.
 */
import { WebRTCState, MatchPreferences, ChatMessage } from '../types';
import {
  getStoredSessionToken,
  ensureSessionToken,
  clearStoredSessionToken,
} from './api';

export type NetworkQuality = 'excellent' | 'good' | 'fair' | 'poor';

export interface NetworkStats {
  rttMs: number | null;
  packetLossPct: number | null;
  bitrateKbps: number | null;
}

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
  }) => void;
  onPeerDisconnected: (reason: string) => void;
  onError: (errorMsg: string) => void;
  onMediaFallback?: (reason: string) => void;
  onQueueUpdate?: (queueLength: number) => void;
  onNetworkQuality?: (quality: NetworkQuality, stats: NetworkStats) => void;
  onPeerTyping?: (isTyping: boolean) => void;
}

interface MatchRequest {
  userId: string;
  gender: string;
  country: string;
  preferences: MatchPreferences;
}

export class WebRTCManager {
  private ws: WebSocket | null = null;
  private peerConnection: RTCPeerConnection | null = null;
  private localStream: MediaStream | null = null;
  private remoteStream: MediaStream | null = null;
  private iceServers: RTCIceServer[] = [
    { urls: 'stun:stun.l.google.com:19302' },
    { urls: 'stun:stun1.l.google.com:19302' },
    { urls: 'stun:stun2.l.google.com:19302' },
    { urls: 'stun:stun3.l.google.com:19302' },
    { urls: 'stun:stun.cloudflare.com:3478' },
  ];
  private currentMatchId: string | null = null;
  private pendingCandidates: RTCIceCandidateInit[] = [];
  private events: WebRTCEvents;
  private state: WebRTCState = 'idle';
  private pingInterval: any = null;

  private isAudioEnabled = true;
  private isVideoEnabled = true;

  private sessionToken: string | null = null;
  private lastMatchRequest: MatchRequest | null = null;
  private authRetried = false;
  private reconnectAttempts = 0;
  private reconnectTimer: any = null;
  private rotationTimer: any = null;
  private intentionalClose = false;
  private statsInterval: any = null;
  private iceRestartAttempts = 0;
  private mediaConnectedSent = false;

  public isUsingPlaceholderMedia = false;

  // Placeholder media resources
  private placeholderCanvas: HTMLCanvasElement | null = null;
  private placeholderAnimFrame: number | null = null;
  private placeholderAudioCtx: AudioContext | null = null;

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
   * Acquire local camera & microphone streams. If the device or permission is
   * unavailable, a generated placeholder stream keeps matchmaking usable.
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
      this.isUsingPlaceholderMedia = false;
      this.events.onLocalStream(stream);
      this.setState('idle');
      return stream;
    } catch (err: any) {
      let errorMsg = 'Camera and microphone are unavailable on this device.';
      if (err.name === 'NotAllowedError' || err.name === 'PermissionDeniedError') {
        errorMsg =
          'Camera and microphone permission was denied. You can still match and chat with a placeholder preview.';
      } else if (err.name === 'NotFoundError' || err.name === 'DevicesNotFoundError') {
        errorMsg = 'No camera or microphone found. You can still match with a placeholder preview.';
      } else if (err.name === 'NotReadableError') {
        errorMsg = 'Your camera is already in use by another application.';
      }

      try {
        const placeholder = this.createPlaceholderStream();
        this.localStream = placeholder;
        this.isUsingPlaceholderMedia = true;
        this.events.onLocalStream(placeholder);
        this.events.onMediaFallback?.(errorMsg);
        this.setState('idle');
        return placeholder;
      } catch (fallbackErr) {
        console.warn('Placeholder media fallback failed:', fallbackErr);
        this.setState('camera_unavailable', errorMsg);
        this.events.onError(errorMsg);
        throw new Error(errorMsg);
      }
    }
  }

  private createPlaceholderStream(): MediaStream {
    const canvas = document.createElement('canvas');
    canvas.width = 640;
    canvas.height = 480;
    const ctx = canvas.getContext('2d');
    if (!ctx) throw new Error('Canvas 2D context unavailable');

    this.placeholderCanvas = canvas;
    let tick = 0;

    const draw = () => {
      tick++;
      const t = tick * 0.02;

      const grad = ctx.createLinearGradient(0, 0, 640, 480);
      grad.addColorStop(0, '#0b0a14');
      grad.addColorStop(0.5, '#141026');
      grad.addColorStop(1, '#0a1420');
      ctx.fillStyle = grad;
      ctx.fillRect(0, 0, 640, 480);

      // Aurora blobs
      const blobs = [
        { x: 180 + Math.sin(t) * 30, y: 160 + Math.cos(t * 0.8) * 26, r: 150, c: 'rgba(124,58,237,0.30)' },
        { x: 470 + Math.cos(t * 0.7) * 34, y: 300 + Math.sin(t * 0.9) * 24, r: 170, c: 'rgba(6,182,212,0.22)' },
        { x: 340 + Math.sin(t * 0.5) * 50, y: 210 + Math.cos(t * 0.6) * 34, r: 110, c: 'rgba(236,72,153,0.18)' },
      ];
      for (const b of blobs) {
        const g = ctx.createRadialGradient(b.x, b.y, 0, b.x, b.y, b.r);
        g.addColorStop(0, b.c);
        g.addColorStop(1, 'rgba(0,0,0,0)');
        ctx.fillStyle = g;
        ctx.fillRect(0, 0, 640, 480);
      }

      // Orbital rings
      for (let i = 0; i < 3; i++) {
        const r = 82 + i * 22 + Math.sin(t * 1.2 + i) * 4;
        ctx.beginPath();
        ctx.arc(320, 226, r, 0, Math.PI * 2);
        ctx.strokeStyle = `rgba(139,92,246,${0.34 - i * 0.08})`;
        ctx.lineWidth = 1.5;
        ctx.stroke();
      }

      // Core medallion
      const coreGrad = ctx.createLinearGradient(260, 170, 380, 290);
      coreGrad.addColorStop(0, '#7c3aed');
      coreGrad.addColorStop(0.5, '#4f46e5');
      coreGrad.addColorStop(1, '#06b6d4');
      ctx.beginPath();
      ctx.arc(320, 226, 62, 0, Math.PI * 2);
      ctx.fillStyle = coreGrad;
      ctx.fill();

      ctx.fillStyle = 'rgba(255,255,255,0.95)';
      ctx.font = '600 34px "Plus Jakarta Sans", system-ui, sans-serif';
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillText('U', 320, 222);

      ctx.beginPath();
      ctx.arc(320, 226, 72, 0, Math.PI * 2);
      ctx.strokeStyle = 'rgba(255,255,255,0.22)';
      ctx.lineWidth = 1;
      ctx.stroke();

      // Labels
      ctx.textAlign = 'center';
      ctx.fillStyle = 'rgba(255,255,255,0.94)';
      ctx.font = '700 22px "Plus Jakarta Sans", system-ui, sans-serif';
      ctx.fillText('Camera preview unavailable', 320, 352);

      ctx.fillStyle = 'rgba(196,181,253,0.8)';
      ctx.font = '500 14px "Plus Jakarta Sans", system-ui, sans-serif';
      ctx.fillText('Live placeholder feed · Your partner can still see you here', 320, 382);

      ctx.fillStyle = 'rgba(52,211,153,0.9)';
      ctx.beginPath();
      ctx.arc(255, 415, 4, 0, Math.PI * 2);
      ctx.fill();
      ctx.textAlign = 'left';
      ctx.font = '600 13px "Plus Jakarta Sans", system-ui, sans-serif';
      ctx.fillText('U-R-LIVE secure session', 267, 419);

      this.placeholderAnimFrame = requestAnimationFrame(draw);
    };
    draw();

    const stream: MediaStream = (canvas as any).captureStream
      ? (canvas as any).captureStream(18)
      : new MediaStream();

    // Add a silent audio track so peer negotiation stays symmetric
    try {
      const AudioCtx =
        (window as any).AudioContext || (window as any).webkitAudioContext;
      if (AudioCtx) {
        const audioCtx: AudioContext = new AudioCtx();
        const destination = audioCtx.createMediaStreamDestination();
        const oscillator = audioCtx.createOscillator();
        const gain = audioCtx.createGain();
        gain.gain.value = 0;
        oscillator.connect(gain);
        gain.connect(destination);
        oscillator.start();
        destination.stream.getAudioTracks().forEach((track) => stream.addTrack(track));
        audioCtx.resume().catch(() => {});
        this.placeholderAudioCtx = audioCtx;
      }
    } catch (e) {
      console.warn('Silent audio track unavailable for placeholder stream:', e);
    }

    return stream;
  }

  /**
   * Connect WebSocket signaling channel
   */
  public connectSignaling(): Promise<void> {
    return new Promise((resolve) => {
      if (
        this.ws &&
        (this.ws.readyState === WebSocket.OPEN || this.ws.readyState === WebSocket.CONNECTING)
      ) {
        resolve();
        return;
      }

      this.intentionalClose = false;
      const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
      const wsUrl = `${protocol}//${window.location.host}/ws`;

      let hasResolved = false;
      let stallTimer = 0;
      const settle = () => {
        if (hasResolved) return;
        hasResolved = true;
        if (stallTimer) clearTimeout(stallTimer);
        resolve();
      };

      try {
        this.ws = new WebSocket(wsUrl);

        this.ws.onopen = () => {
          this.reconnectAttempts = 0;
          this.scheduleSocketRotation();

          // Setup keepalive ping
          if (this.pingInterval) clearInterval(this.pingInterval);
          this.pingInterval = setInterval(() => {
            if (this.ws && this.ws.readyState === WebSocket.OPEN) {
              this.ws.send(JSON.stringify({ type: 'ping' }));
            }
          }, 20000);

          settle();
        };

        this.ws.onmessage = async (event) => {
          try {
            const msg = JSON.parse(event.data);
            await this.handleSignalingMessage(msg);
          } catch (err) {
            console.error('Failed to parse signaling message:', err);
          }
        };

        this.ws.onerror = () => {
          settle();
        };

        this.ws.onclose = () => {
          if (this.pingInterval) {
            clearInterval(this.pingInterval);
            this.pingInterval = null;
          }
          if (this.intentionalClose) return;

          const wasSearching =
            this.state === 'waiting_for_match' ||
            this.state === 'match_found' ||
            this.state === 'connecting';

          if (wasSearching && this.lastMatchRequest) {
            this.scheduleReconnect();
          } else if (this.state === 'connected') {
            // Peer-to-peer media survives a signaling drop; surface a soft warning.
            this.events.onError('Signaling connection lost. Your call may continue.');
          }
        };

        // Never leave the UI hanging if the socket stalls without firing open/error.
        stallTimer = window.setTimeout(settle, 8000);
      } catch {
        settle();
      }
    });
  }

  /**
   * Cloud Run caps a WebSocket at ~60 minutes. Rotate the socket before the
   * platform closes it, so reconnects happen on our schedule rather than a
   * silent cut mid-search. Established calls are never interrupted because
   * media is peer-to-peer and a rotation would drop signaling for the call.
   */
  private scheduleSocketRotation() {
    if (this.rotationTimer) clearTimeout(this.rotationTimer);
    this.rotationTimer = setTimeout(() => {
      this.rotationTimer = null;
      if (!this.ws || this.ws.readyState !== WebSocket.OPEN) return;

      if (this.state === 'connected') {
        this.scheduleSocketRotation();
        return;
      }

      // Closing while searching triggers scheduleReconnect(), which re-joins.
      this.ws.close(4000, 'socket_rotation');
    }, 55 * 60 * 1000);
  }

  private scheduleReconnect() {
    if (this.reconnectTimer) return;
    if (this.reconnectAttempts >= 3) {
      this.setState('failed', 'Could not reach the live network. Check your connection and try again.');
      return;
    }

    this.reconnectAttempts += 1;
    const delay = 700 * this.reconnectAttempts;
    this.reconnectTimer = setTimeout(async () => {
      this.reconnectTimer = null;
      await this.connectSignaling();

      const ws = this.ws;
      if (!ws || ws.readyState !== WebSocket.OPEN) {
        this.scheduleReconnect();
        return;
      }
      this.reconnectAttempts = 0;

      if (this.lastMatchRequest) {
        const token = await this.ensureQueueAuth();
        if (token) {
          this.sendJoinQueueRequest(token);
        } else {
          this.setState('failed', 'Could not authenticate your session. Refresh and try again.');
        }
      }
    }, delay);
  }

  private async ensureQueueAuth(forceRefresh = false): Promise<string | null> {
    if (!forceRefresh && this.sessionToken) return this.sessionToken;
    this.sessionToken = forceRefresh
      ? await ensureSessionToken(true)
      : getStoredSessionToken() || (await ensureSessionToken());
    return this.sessionToken;
  }

  private sendJoinQueueRequest(token: string) {
    const req = this.lastMatchRequest;
    if (!req) return;
    this.setState('waiting_for_match');
    this.sendSignalingMessage({
      type: 'join_queue',
      payload: {
        userId: req.userId,
        sessionToken: token,
        gender: req.gender,
        country: req.country,
        preferences: req.preferences,
      },
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
    this.lastMatchRequest = { userId, gender, country, preferences };
    this.authRetried = false;
    this.reconnectAttempts = 0;

    if (!this.localStream) {
      try {
        await this.initMedia();
      } catch {
        this.setState('failed', 'Camera and microphone are unavailable. Allow access and try again.');
        return;
      }
    }
    await this.connectSignaling();

    if (!this.ws || this.ws.readyState !== WebSocket.OPEN) {
      this.setState('failed', 'Could not reach the live matchmaking server. Check your connection and try again.');
      return;
    }

    this.cleanupPeerConnection();
    this.setState('waiting_for_match');

    const token = await this.ensureQueueAuth();
    if (!token) {
      this.setState('failed', 'Could not authenticate your session. Refresh and try again.');
      return;
    }

    this.sendJoinQueueRequest(token);
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

    if (!this.lastMatchRequest) {
      this.lastMatchRequest = {
        userId,
        gender: 'unspecified',
        country: 'GLOBAL',
        preferences,
      };
    } else {
      this.lastMatchRequest.preferences = preferences;
    }

    if (!this.ws || this.ws.readyState !== WebSocket.OPEN) {
      this.setState('failed', 'Lost the live connection. Press Start to reconnect.');
      return;
    }

    this.setState('waiting_for_match');
    this.sendSignalingMessage({
      type: 'skip_match',
      payload: {
        findNext: true,
        preferences,
      },
    });
  }

  private pendingOffer: any = null;

  /**
   * Completely disconnect video session
   */
  public disconnect() {
    this.lastMatchRequest = null;
    this.cleanupPeerConnection();
    this.leaveQueue();
    this.setState('local_disconnected');
  }

  /**
   * Handle incoming signaling messages
   */
  private async handleSignalingMessage(msg: any) {
    switch (msg.type) {
      case 'queue_status': {
        const queueLength = Number(msg.payload?.queueLength || 0);
        this.events.onQueueUpdate?.(queueLength);
        if (msg.payload?.status === 'waiting' && this.state !== 'connected') {
          this.setState('waiting_for_match');
        }
        break;
      }

      case 'match_found': {
        const { isInitiator, peerUserId, peerName, peerCountry, sharedInterests, sharedLanguages } =
          msg.payload || {};
        this.currentMatchId = msg.matchId;
        this.pendingOffer = null;
        this.pendingCandidates = [];
        this.iceRestartAttempts = 0;
        this.mediaConnectedSent = false;
        this.setState('match_found');
        this.events.onMatchFound({
          peerUserId,
          peerName,
          peerCountry,
          sharedInterests: sharedInterests || [],
          sharedLanguages: sharedLanguages || [],
        });

        await this.setupPeerConnection(isInitiator);
        break;
      }

      case 'offer': {
        if (msg.matchId !== this.currentMatchId) {
          console.warn('[WebRTC] Ignored offer: matchId mismatch or stale', msg.matchId, 'vs current:', this.currentMatchId);
          return;
        }

        if (!this.peerConnection) {
          console.log('[WebRTC] Storing early-arriving offer until peerConnection is ready');
          this.pendingOffer = msg;
          return;
        }

        await this.handleIncomingOffer(msg.payload);
        break;
      }

      case 'answer': {
        if (msg.matchId !== this.currentMatchId || !this.peerConnection) {
          console.warn('[WebRTC] Ignored answer: matchId mismatch or peerConnection not initialized');
          return;
        }
        try {
          await this.peerConnection.setRemoteDescription(new RTCSessionDescription(msg.payload));
          await this.drainPendingCandidates();
        } catch (err) {
          console.error('[WebRTC] Failed to set remote description from answer:', err);
        }
        break;
      }

      case 'ice_candidate': {
        if (msg.matchId !== this.currentMatchId) return;
        if (this.peerConnection && this.peerConnection.remoteDescription) {
          try {
            await this.peerConnection.addIceCandidate(new RTCIceCandidate(msg.payload));
          } catch (e) {
            console.warn('[WebRTC] Error adding received ICE candidate:', e);
          }
        } else {
          this.pendingCandidates.push(msg.payload);
        }
        break;
      }

      case 'chat_message': {
        if (msg.matchId !== this.currentMatchId) return;
        this.events.onPeerTyping?.(false);
        this.events.onChatMessage({
          id: 'msg_rem_' + Date.now(),
          senderId: msg.payload.senderId || 'stranger',
          isLocal: false,
          text: msg.payload.text,
          timestamp: Date.now(),
        });
        break;
      }

      case 'typing': {
        if (msg.matchId !== this.currentMatchId) return;
        this.events.onPeerTyping?.(Boolean(msg.payload?.isTyping));
        break;
      }

      case 'match_ended': {
        if (this.state === 'connected') {
          this.cleanupPeerConnection();
          this.setState('waiting_for_match');
        }
        break;
      }

      case 'peer_disconnected':
      case 'partner_disconnected': {
        const reason = msg.payload?.reason || 'Stranger disconnected.';
        this.cleanupPeerConnection();
        this.setState('remote_disconnected', reason);
        this.events.onPeerDisconnected(reason);
        break;
      }

      case 'error': {
        const code = msg.payload?.code;
        const message = msg.payload?.message || 'Server signaling error';

        if ((code === 'AUTH_REQUIRED' || code === 'INVALID_TOKEN') && !this.authRetried) {
          this.authRetried = true;
          clearStoredSessionToken();
          this.sessionToken = null;
          const token = await this.ensureQueueAuth(true);
          if (token) {
            this.sendJoinQueueRequest(token);
            return;
          }
          this.setState('failed', 'Could not authenticate your session. Refresh and try again.');
          return;
        }

        this.events.onError(message);

        if (code === 'COOLDOWN_ACTIVE') {
          this.setState('remote_disconnected', message);
        } else if (code === 'RATE_LIMIT_EXCEEDED' || code === 'ACCOUNT_BANNED') {
          this.setState('idle', message);
        }
        break;
      }
    }
  }

  private async handleIncomingOffer(offerSdp: RTCSessionDescriptionInit) {
    if (!this.peerConnection || !this.currentMatchId) return;

    try {
      this.setState('connecting');
      await this.peerConnection.setRemoteDescription(new RTCSessionDescription(offerSdp));
      await this.drainPendingCandidates();

      const answer = await this.peerConnection.createAnswer();
      await this.peerConnection.setLocalDescription(answer);

      this.sendSignalingMessage({
        type: 'answer',
        matchId: this.currentMatchId,
        payload: answer,
      });
    } catch (err) {
      console.error('[WebRTC] Error handling incoming offer:', err);
    }
  }

  private async drainPendingCandidates() {
    if (!this.peerConnection) return;
    while (this.pendingCandidates.length > 0) {
      const candidate = this.pendingCandidates.shift();
      if (candidate) {
        try {
          await this.peerConnection.addIceCandidate(new RTCIceCandidate(candidate));
        } catch (e) {
          console.warn('[WebRTC] Error adding buffered ICE candidate:', e);
        }
      }
    }
  }

  private async setupPeerConnection(isInitiator: boolean) {
    // Crucial: Only close previous connection resources; preserve currentMatchId!
    this.closePeerConnectionOnly();

    const pc = new RTCPeerConnection({
      iceServers: this.iceServers,
      iceCandidatePoolSize: 4,
    });
    this.peerConnection = pc;

    if (this.localStream) {
      this.localStream.getTracks().forEach((track) => {
        pc.addTrack(track, this.localStream!);
      });
    } else {
      pc.addTransceiver('audio', { direction: 'sendrecv' });
      pc.addTransceiver('video', { direction: 'sendrecv' });
    }

    const remote = new MediaStream();
    this.remoteStream = remote;
    this.events.onRemoteStream(remote);

    pc.ontrack = (event) => {
      let added = false;
      if (event.streams && event.streams[0]) {
        event.streams[0].getTracks().forEach((track) => {
          if (!remote.getTracks().some((t) => t.id === track.id)) {
            remote.addTrack(track);
            added = true;
          }
        });
      }
      if (event.track && !remote.getTracks().some((t) => t.id === event.track.id)) {
        remote.addTrack(event.track);
        added = true;
      }
      if (added) {
        this.events.onRemoteStream(remote);
      }
      this.setState('connected');
      this.sendMediaState(true);
      this.startStatsPolling();
    };

    pc.onicecandidate = (event) => {
      if (event.candidate && this.currentMatchId) {
        this.sendSignalingMessage({
          type: 'ice_candidate',
          matchId: this.currentMatchId,
          payload: event.candidate.toJSON(),
        });
      }
    };

    pc.onconnectionstatechange = () => {
      switch (pc.connectionState) {
        case 'connected':
          this.setState('connected');
          this.sendMediaState(true);
          this.startStatsPolling();
          break;
        case 'connecting':
          this.setState('connecting');
          break;
        case 'disconnected':
          this.setState('reconnecting', 'Network unstable — reconnecting peer-to-peer...');
          break;
        case 'failed':
          if (this.iceRestartAttempts < 2) {
            this.iceRestartAttempts += 1;
            this.setState('reconnecting', 'Connection dropped. Retrying direct link...');
            try {
              pc.restartIce();
            } catch {}
          } else {
            this.cleanupPeerConnection();
            this.setState('remote_disconnected', 'Could not establish a stable connection.');
            this.events.onPeerDisconnected('connection_failed');
          }
          break;
        case 'closed':
          break;
      }
    };

    pc.oniceconnectionstatechange = () => {
      if (pc.iceConnectionState === 'failed') {
        try {
          pc.restartIce();
        } catch {}
      }
    };

    if (isInitiator) {
      this.setState('connecting');
      try {
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
      } catch (err) {
        console.error('[WebRTC] Error creating or sending offer:', err);
      }
    } else if (this.pendingOffer) {
      // Process buffered offer if it arrived while setting up connection
      const offerToProcess = this.pendingOffer;
      this.pendingOffer = null;
      await this.handleIncomingOffer(offerToProcess.payload);
    }
  }

  private sendMediaState(connected: boolean) {
    if (!connected || this.mediaConnectedSent) return;
    this.mediaConnectedSent = true;
    if (this.currentMatchId && this.ws && this.ws.readyState === WebSocket.OPEN) {
      this.sendSignalingMessage({
        type: 'media_state',
        matchId: this.currentMatchId,
        payload: { connected: true },
      });
    }
  }

  private startStatsPolling() {
    this.stopStatsPolling();
    let lastBytes = 0;
    let lastTs = Date.now();

    this.statsInterval = setInterval(async () => {
      const pc = this.peerConnection;
      if (!pc || pc.connectionState !== 'connected') return;

      try {
        const report = await pc.getStats();
        let rttMs: number | null = null;
        let packetLossPct: number | null = null;
        let totalBytes = 0;

        report.forEach((stat: any) => {
          if (stat.type === 'candidate-pair' && stat.state === 'succeeded' && typeof stat.currentRoundTripTime === 'number') {
            rttMs = Math.round(stat.currentRoundTripTime * 1000);
          }
          if (stat.type === 'inbound-rtp' && stat.kind === 'video') {
            const received = stat.packetsReceived || 0;
            const lost = stat.packetsLost || 0;
            if (received + lost > 0) {
              packetLossPct = Math.max(0, Math.round((lost / (received + lost)) * 1000) / 10);
            }
            totalBytes += stat.bytesReceived || 0;
          }
        });

        const now = Date.now();
        const elapsed = (now - lastTs) / 1000;
        const bitrateKbps =
          elapsed > 0 && lastBytes > 0
            ? Math.max(0, Math.round(((totalBytes - lastBytes) * 8) / elapsed / 1000))
            : null;
        lastBytes = totalBytes;
        lastTs = now;

        let quality: NetworkQuality = 'good';
        const rtt = rttMs ?? 120;
        const loss = packetLossPct ?? 0;
        if (rtt < 150 && loss < 1) quality = 'excellent';
        else if (rtt < 300 && loss < 3) quality = 'good';
        else if (rtt < 600 && loss < 8) quality = 'fair';
        else quality = 'poor';

        this.events.onNetworkQuality?.(quality, { rttMs, packetLossPct, bitrateKbps });
      } catch {
        // Stats can transiently fail while ICE restarts
      }
    }, 2000);
  }

  private stopStatsPolling() {
    if (this.statsInterval) {
      clearInterval(this.statsInterval);
      this.statsInterval = null;
    }
  }

  public setTyping(isTyping: boolean) {
    if (!this.ws || this.ws.readyState !== WebSocket.OPEN || !this.currentMatchId) {
      return;
    }
    this.sendSignalingMessage({
      type: 'typing',
      matchId: this.currentMatchId,
      payload: { isTyping },
    });
  }

  public sendChatMessage(text: string, currentUserId: string): boolean {
    const trimmed = text.trim();
    if (!trimmed || !this.ws || this.ws.readyState !== WebSocket.OPEN || !this.currentMatchId) {
      return false;
    }

    this.sendSignalingMessage({
      type: 'chat_message',
      matchId: this.currentMatchId,
      payload: {
        text: trimmed,
        senderId: currentUserId,
      },
    });
    this.setTyping(false);

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

  /**
   * Swap the outgoing microphone for a different input device without renegotiating.
   */
  public async switchAudioInput(deviceId: string): Promise<boolean> {
    if (!navigator.mediaDevices?.getUserMedia) return false;
    try {
      const replacement = await navigator.mediaDevices.getUserMedia({
        audio: {
          deviceId: deviceId === 'default' ? undefined : { exact: deviceId },
          echoCancellation: true,
          noiseSuppression: true,
        },
      });
      const newTrack = replacement.getAudioTracks()[0];
      if (!newTrack) return false;

      const oldTracks = this.localStream?.getAudioTracks() ?? [];
      if (this.localStream) {
        oldTracks.forEach((track) => this.localStream!.removeTrack(track));
        this.localStream.addTrack(newTrack);
      } else {
        this.localStream = new MediaStream([newTrack]);
      }

      if (this.peerConnection) {
        const sender = this.peerConnection.getSenders().find((s) => s.track?.kind === 'audio');
        if (sender) {
          await sender.replaceTrack(newTrack);
        } else {
          this.peerConnection.addTrack(newTrack, this.localStream);
        }
      }

      newTrack.enabled = this.isAudioEnabled;
      oldTracks.forEach((track) => track.stop());
      this.events.onLocalStream(this.localStream);
      return true;
    } catch (err) {
      console.warn('[WebRTC] Could not switch microphone:', err);
      return false;
    }
  }

  private sendSignalingMessage(msg: any) {
    if (this.ws && this.ws.readyState === WebSocket.OPEN) {
      this.ws.send(JSON.stringify(msg));
    }
  }

  /**
   * Safely closes peer connection resources without wiping the active match ID
   */
  private closePeerConnectionOnly() {
    if (this.peerConnection) {
      try {
        this.peerConnection.onicecandidate = null;
        this.peerConnection.ontrack = null;
        this.peerConnection.onconnectionstatechange = null;
        this.peerConnection.oniceconnectionstatechange = null;
        this.peerConnection.close();
      } catch (e) {
        console.warn('[WebRTC] PeerConnection close note:', e);
      }
      this.peerConnection = null;
    }
    const hadRemote = Boolean(this.remoteStream);
    this.remoteStream = null;
    this.pendingCandidates = [];
    this.pendingOffer = null;
    this.mediaConnectedSent = false;
    this.iceRestartAttempts = 0;
    this.stopStatsPolling();
    if (hadRemote) {
      this.events.onRemoteStream(null);
    }
  }

  /**
   * Completely tears down peer connection and wipes active match state
   */
  private cleanupPeerConnection() {
    this.closePeerConnectionOnly();
    this.currentMatchId = null;
  }

  public getLocalStream(): MediaStream | null {
    return this.localStream;
  }

  public getRemoteStream(): MediaStream | null {
    return this.remoteStream;
  }

  public destroy() {
    this.intentionalClose = true;
    this.cleanupPeerConnection();
    if (this.reconnectTimer) {
      clearTimeout(this.reconnectTimer);
      this.reconnectTimer = null;
    }
    if (this.rotationTimer) {
      clearTimeout(this.rotationTimer);
      this.rotationTimer = null;
    }
    if (this.placeholderAnimFrame) {
      cancelAnimationFrame(this.placeholderAnimFrame);
      this.placeholderAnimFrame = null;
    }
    if (this.placeholderAudioCtx) {
      try {
        this.placeholderAudioCtx.close();
      } catch {}
      this.placeholderAudioCtx = null;
    }
    if (this.localStream) {
      this.localStream.getTracks().forEach((t) => t.stop());
      this.localStream = null;
    }
    if (this.ws) {
      this.ws.close();
      this.ws = null;
    }
    if (this.pingInterval) {
      clearInterval(this.pingInterval);
      this.pingInterval = null;
    }
  }
}
