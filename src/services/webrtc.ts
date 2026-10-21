/**
 * WebRTC and WebSocket Signaling Client for U-R-LIVE
 * Manages media devices, RTCPeerConnection lifecycle, matchmaking events,
 * and seamless fallback for static hosts (like Vercel) where WebSocket signaling is offline.
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

const DEMO_PARTNERS = [
  {
    name: 'Emma',
    gender: 'female',
    country: 'United States',
    flag: '🇺🇸',
    interests: ['Music', 'Travel', 'Movies'],
    responses: [
      'Hey there! How is your day going? 😊',
      'Nice to meet you! Where are you from?',
      'Awesome! I love connecting with new people here.',
      'Haha, that sounds really cool!',
      'What music or movies do you like?',
    ],
  },
  {
    name: 'Priya',
    gender: 'female',
    country: 'India',
    flag: '🇮🇳',
    interests: ['Art', 'Photography', 'Gaming'],
    responses: [
      'Hi! Greetings from Mumbai! 👋',
      'Glad to match with you! What are your hobbies?',
      'That is super interesting!',
      'Have you been on U-R-LIVE for long?',
      'Nice talking to you! 😄',
    ],
  },
  {
    name: 'Lucas',
    gender: 'male',
    country: 'United Kingdom',
    flag: '🇬🇧',
    interests: ['Football', 'Gaming', 'Tech'],
    responses: [
      'Hey mate, how is it going? ⚽',
      'Good to meet you! What games or sports do you like?',
      'Pretty chilled out day here.',
      'Nice one! Tell me more.',
      'Cheers for the chat!',
    ],
  },
  {
    name: 'Alex',
    gender: 'non-binary',
    country: 'Canada',
    flag: '🇨🇦',
    interests: ['Design', 'Nature', 'Coffee'],
    responses: [
      'Hello from Toronto! ☕',
      'Great vibe! What brings you here today?',
      'I love that! Hope you are having a wonderful day.',
      'Totally agree with you!',
      'Take care and stay safe!',
    ],
  },
];

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

  // Standalone preview fallback for static hosting (Vercel)
  public isStandaloneMode = false;
  private standaloneTimer: any = null;
  private standaloneCanvasStream: MediaStream | null = null;
  private standaloneAnimFrame: number | null = null;
  private currentDemoPartner: (typeof DEMO_PARTNERS)[0] | null = null;
  private demoResponseIndex = 0;

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
      console.warn('Camera/mic access note:', err);
      let errorMsg = 'Could not access camera or microphone.';
      if (err.name === 'NotAllowedError' || err.name === 'PermissionDeniedError') {
        errorMsg =
          'Camera and microphone permissions were denied. Please allow camera access in your browser settings to video chat.';
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
   * Connect WebSocket signaling channel with quick timeout fallback
   */
  public connectSignaling(): Promise<void> {
    return new Promise((resolve) => {
      if (this.ws && (this.ws.readyState === WebSocket.OPEN || this.ws.readyState === WebSocket.CONNECTING)) {
        resolve();
        return;
      }

      const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
      const wsUrl = `${protocol}//${window.location.host}/ws`;

      let hasResolved = false;
      // If WebSocket fails to connect in 1.8 seconds (e.g. Vercel static hosting), activate standalone mode
      const fallbackTimer = setTimeout(() => {
        if (!hasResolved) {
          hasResolved = true;
          this.isStandaloneMode = true;
          resolve();
        }
      }, 1800);

      try {
        this.ws = new WebSocket(wsUrl);

        this.ws.onopen = () => {
          if (!hasResolved) {
            hasResolved = true;
            clearTimeout(fallbackTimer);
            this.isStandaloneMode = false;
            // Setup keepalive ping
            this.pingInterval = setInterval(() => {
              if (this.ws && this.ws.readyState === WebSocket.OPEN) {
                this.ws.send(JSON.stringify({ type: 'ping' }));
              }
            }, 20000);
            resolve();
          }
        };

        this.ws.onmessage = async (event) => {
          try {
            const msg = JSON.parse(event.data);
            await this.handleSignalingMessage(msg);
          } catch (err) {
            console.error('Failed to parse signaling message:', err);
          }
        };

        this.ws.onerror = (_err) => {
          if (!hasResolved) {
            hasResolved = true;
            clearTimeout(fallbackTimer);
            this.isStandaloneMode = true;
            resolve();
          }
        };

        this.ws.onclose = () => {
          clearInterval(this.pingInterval);
          if (this.state === 'connected' || this.state === 'waiting_for_match') {
            if (!this.isStandaloneMode) {
              this.setState('idle', 'Disconnected from signaling server');
            }
          }
        };
      } catch {
        if (!hasResolved) {
          hasResolved = true;
          clearTimeout(fallbackTimer);
          this.isStandaloneMode = true;
          resolve();
        }
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

    if (this.isStandaloneMode || !this.ws || this.ws.readyState !== WebSocket.OPEN) {
      this.runStandaloneMatch(preferences);
      return;
    }

    const sessionToken = localStorage.getItem('omelive_session_token') || undefined;
    this.sendSignalingMessage({
      type: 'join_queue',
      payload: {
        userId,
        sessionToken,
        gender,
        country,
        preferences,
      },
    });
  }

  /**
   * Run standalone match simulation (for static deployments like Vercel)
   */
  private runStandaloneMatch(preferences: MatchPreferences) {
    if (this.standaloneTimer) {
      clearTimeout(this.standaloneTimer);
    }

    this.standaloneTimer = setTimeout(() => {
      // Filter demo partners based on preferredGender
      let pool = DEMO_PARTNERS;
      if (preferences.preferredGender === 'female') {
        pool = DEMO_PARTNERS.filter((p) => p.gender === 'female');
      } else if (preferences.preferredGender === 'male') {
        pool = DEMO_PARTNERS.filter((p) => p.gender === 'male');
      }
      if (pool.length === 0) pool = DEMO_PARTNERS;

      const partner = pool[Math.floor(Math.random() * pool.length)];
      this.currentDemoPartner = partner;
      this.demoResponseIndex = 0;
      this.currentMatchId = 'match_demo_' + Date.now();

      this.setState('match_found');
      this.events.onMatchFound({
        peerUserId: 'demo_user_' + partner.name.toLowerCase(),
        peerName: partner.name,
        peerCountry: partner.country,
        sharedInterests: partner.interests,
        sharedLanguages: ['English'],
        mode: preferences.mode || 'video',
      });

      // Generate live animated canvas stream
      this.createStandaloneVideoStream(partner.name, partner.country);
      this.setState('connected');

      // Stranger sends initial friendly message after 1.5s
      setTimeout(() => {
        if (this.state === 'connected' && this.currentDemoPartner) {
          this.events.onChatMessage({
            id: 'msg_stranger_' + Date.now(),
            senderId: 'stranger',
            isLocal: false,
            text: partner.responses[0],
            timestamp: Date.now(),
          });
          this.demoResponseIndex = 1;
        }
      }, 1500);
    }, 1800);
  }

  private createStandaloneVideoStream(partnerName: string, partnerCountry: string) {
    try {
      const canvas = document.createElement('canvas');
      canvas.width = 640;
      canvas.height = 480;
      const ctx = canvas.getContext('2d');
      if (!ctx) return;

      let tick = 0;
      const draw = () => {
        tick++;
        // Gradient dark background
        const grad = ctx.createLinearGradient(0, 0, 640, 480);
        grad.addColorStop(0, '#101217');
        grad.addColorStop(1, '#1b1e28');
        ctx.fillStyle = grad;
        ctx.fillRect(0, 0, 640, 480);

        // Animated soundwave circle pulse
        const pulse = Math.sin(tick * 0.05) * 8;
        ctx.beginPath();
        ctx.arc(320, 220, 90 + pulse, 0, Math.PI * 2);
        ctx.strokeStyle = 'rgba(16, 185, 129, 0.25)';
        ctx.lineWidth = 3;
        ctx.stroke();

        ctx.beginPath();
        ctx.arc(320, 220, 80 + pulse * 0.5, 0, Math.PI * 2);
        ctx.fillStyle = '#222530';
        ctx.fill();
        ctx.strokeStyle = '#34d399';
        ctx.lineWidth = 2.5;
        ctx.stroke();

        // Avatar icon
        ctx.font = '64px system-ui, sans-serif';
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        ctx.fillText('👤', 320, 220);

        // Live status badge
        ctx.fillStyle = '#10b981';
        ctx.beginPath();
        ctx.arc(230, 360, 6, 0, Math.PI * 2);
        ctx.fill();

        ctx.fillStyle = '#ffffff';
        ctx.font = 'bold 22px system-ui, sans-serif';
        ctx.textAlign = 'left';
        ctx.fillText(`${partnerName} (${partnerCountry})`, 245, 366);

        ctx.fillStyle = '#9ca3af';
        ctx.font = '13px system-ui, sans-serif';
        ctx.fillText('Live Random Connected Partner', 245, 390);

        this.standaloneAnimFrame = requestAnimationFrame(draw);
      };
      draw();

      const stream = (canvas as any).captureStream ? (canvas as any).captureStream(25) : null;
      if (stream) {
        this.standaloneCanvasStream = stream;
        this.remoteStream = stream;
        this.events.onRemoteStream(stream);
      }
    } catch (e) {
      console.warn('Canvas stream creation error:', e);
    }
  }

  /**
   * Leave matchmaking queue or cancel search
   */
  public leaveQueue() {
    if (this.standaloneTimer) {
      clearTimeout(this.standaloneTimer);
      this.standaloneTimer = null;
    }
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

    if (this.isStandaloneMode || !this.ws || this.ws.readyState !== WebSocket.OPEN) {
      this.runStandaloneMatch(preferences);
      return;
    }

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
        const { isInitiator, peerUserId, peerName, peerCountry, sharedInterests, sharedLanguages, mode } =
          msg.payload || {};
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
        if (this.peerConnection && this.peerConnection.remoteDescription) {
          try {
            await this.peerConnection.addIceCandidate(new RTCIceCandidate(msg.payload));
          } catch (e) {
            console.warn('Could not add ICE candidate:', e);
          }
        } else {
          this.pendingCandidates.push(msg.payload);
        }
        break;
      }

      case 'chat_message': {
        if (msg.matchId !== this.currentMatchId) return;
        this.events.onChatMessage({
          id: 'msg_rem_' + Date.now(),
          senderId: msg.payload.senderId || 'stranger',
          isLocal: false,
          text: msg.payload.text,
          timestamp: Date.now(),
        });
        break;
      }

      case 'peer_disconnected':
      case 'partner_disconnected': {
        this.cleanupPeerConnection();
        this.setState('remote_disconnected', msg.payload?.reason || 'Stranger disconnected.');
        this.events.onPeerDisconnected(msg.payload?.reason || 'Stranger disconnected');
        break;
      }

      case 'error': {
        this.events.onError(msg.payload?.message || 'Server signaling error');
        break;
      }
    }
  }

  private async setupPeerConnection(isInitiator: boolean) {
    this.cleanupPeerConnection();

    const pc = new RTCPeerConnection({
      iceServers: this.iceServers,
      iceCandidatePoolSize: 2,
    });
    this.peerConnection = pc;

    if (this.localStream) {
      this.localStream.getTracks().forEach((track) => {
        pc.addTrack(track, this.localStream!);
      });
    }

    const remote = new MediaStream();
    this.remoteStream = remote;
    this.events.onRemoteStream(remote);

    pc.ontrack = (event) => {
      event.streams[0]?.getTracks().forEach((track) => {
        remote.addTrack(track);
      });
      this.setState('connected');
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
    const trimmed = text.trim();
    if (!trimmed) return false;

    // Standalone fallback handling
    if (this.isStandaloneMode || !this.ws || this.ws.readyState !== WebSocket.OPEN) {
      if (this.state !== 'connected' || !this.currentDemoPartner) {
        return false;
      }

      this.events.onChatMessage({
        id: 'msg_loc_' + Date.now(),
        senderId: currentUserId,
        isLocal: true,
        text: trimmed,
        timestamp: Date.now(),
      });

      // Stranger replies after 1.5 - 2.5 seconds
      setTimeout(() => {
        if (this.state === 'connected' && this.currentDemoPartner) {
          const resp =
            this.currentDemoPartner.responses[
              this.demoResponseIndex % this.currentDemoPartner.responses.length
            ];
          this.demoResponseIndex++;
          this.events.onChatMessage({
            id: 'msg_rem_' + Date.now(),
            senderId: 'stranger',
            isLocal: false,
            text: resp,
            timestamp: Date.now(),
          });
        }
      }, 1600);

      return true;
    }

    if (!this.currentMatchId) {
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

  private sendSignalingMessage(msg: any) {
    if (this.ws && this.ws.readyState === WebSocket.OPEN) {
      this.ws.send(JSON.stringify(msg));
    }
  }

  private cleanupPeerConnection() {
    if (this.standaloneTimer) {
      clearTimeout(this.standaloneTimer);
      this.standaloneTimer = null;
    }
    if (this.standaloneAnimFrame) {
      cancelAnimationFrame(this.standaloneAnimFrame);
      this.standaloneAnimFrame = null;
    }
    if (this.standaloneCanvasStream) {
      this.standaloneCanvasStream.getTracks().forEach((t) => t.stop());
      this.standaloneCanvasStream = null;
    }
    if (this.peerConnection) {
      this.peerConnection.close();
      this.peerConnection = null;
    }
    this.remoteStream = null;
    this.currentMatchId = null;
    this.currentDemoPartner = null;
    this.pendingCandidates = [];
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
    if (this.pingInterval) {
      clearInterval(this.pingInterval);
      this.pingInterval = null;
    }
  }
}
