/**
 * WebRTC and WebSocket Signaling Client for U-R-LIVE
 * Manages media devices, RTCPeerConnection lifecycle and matchmaking events.
 */
import { WebRTCState, MatchPreferences, ChatMessage } from '../types';
import {
  getStoredSessionToken,
  ensureSessionToken,
  clearStoredSessionToken,
  API_BASE_URL,
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
  private currentFacingMode: 'user' | 'environment' = 'user';

  // Real Cross-Tab P2P Signaling via BroadcastChannel
  private p2pChannel: BroadcastChannel | null = null;
  private p2pTabId = 'tab_' + Math.random().toString(36).slice(2, 9);
  private p2pPartnerTabId: string | null = null;
  private p2pAnnounceInterval: any = null;

  // HTTP Signaling & Matchmaking (for Vercel serverless)
  private isHttpSignalingActive = false;
  private httpPollInterval: any = null;
  private currentUserId = '';

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
   * Acquire local camera & microphone streams. Real webcam video only.
   */
  public async initMedia(): Promise<MediaStream> {
    if (
      this.localStream &&
      this.localStream.active &&
      this.localStream.getVideoTracks().some((t) => t.readyState === 'live')
    ) {
      return this.localStream;
    }

    this.setState('requesting_permissions');
    if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
      this.setState('camera_unavailable', 'Your browser does not support WebRTC media capture.');
      throw new Error('Your browser does not support WebRTC media capture.');
    }

    let stream: MediaStream | null = null;
    let lastErr: any = null;

    // 1. Attempt preferred constraints with facingMode + audio
    try {
      stream = await navigator.mediaDevices.getUserMedia({
        video: {
          facingMode: this.currentFacingMode,
          width: { ideal: 1280 },
          height: { ideal: 720 },
        },
        audio: {
          echoCancellation: true,
          noiseSuppression: true,
        },
      });
    } catch (err: any) {
      lastErr = err;
    }

    // 2. Attempt basic unconstrained video + audio
    if (!stream) {
      try {
        stream = await navigator.mediaDevices.getUserMedia({
          video: { facingMode: this.currentFacingMode },
          audio: true,
        });
      } catch (err: any) {
        lastErr = err;
      }
    }

    // 3. Attempt simple fallback video + audio
    if (!stream) {
      try {
        stream = await navigator.mediaDevices.getUserMedia({
          video: true,
          audio: true,
        });
      } catch (err: any) {
        lastErr = err;
      }
    }

    // 4. Attempt video only (if microphone device is absent or in use)
    if (!stream) {
      try {
        stream = await navigator.mediaDevices.getUserMedia({
          video: true,
          audio: false,
        });
      } catch (err: any) {
        lastErr = err;
      }
    }

    if (stream) {
      // Add silent audio track if only video was granted, ensuring symmetric WebRTC SDP
      if (stream.getAudioTracks().length === 0) {
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
            destination.stream.getAudioTracks().forEach((track) => stream!.addTrack(track));
            audioCtx.resume().catch(() => {});
          }
        } catch {}
      }

      this.localStream = stream;
      this.isUsingPlaceholderMedia = false;
      this.events.onLocalStream(stream);
      this.setState('idle');
      return stream;
    }

    // Never generate fake canvas stream
    this.localStream = null;
    this.isUsingPlaceholderMedia = false;
    this.events.onLocalStream(null as any);
    this.setState('camera_unavailable', lastErr?.message || 'Camera permission denied or camera unavailable');
    throw lastErr || new Error('Could not access camera.');
  }

  public getFacingMode(): 'user' | 'environment' {
    return this.currentFacingMode;
  }

  /**
   * Switch between front (user) and rear (environment) cameras on mobile/tablets.
   */
  public async switchCamera(): Promise<MediaStream> {
    const nextMode = this.currentFacingMode === 'user' ? 'environment' : 'user';
    this.currentFacingMode = nextMode;

    if (this.localStream) {
      this.localStream.getVideoTracks().forEach((track) => track.stop());
    }

    let newStream: MediaStream | null = null;
    try {
      newStream = await navigator.mediaDevices.getUserMedia({
        video: {
          facingMode: nextMode,
          width: { ideal: 1280 },
          height: { ideal: 720 },
        },
        audio: {
          echoCancellation: true,
          noiseSuppression: true,
        },
      });
    } catch {
      try {
        newStream = await navigator.mediaDevices.getUserMedia({
          video: { facingMode: nextMode },
          audio: true,
        });
      } catch {
        newStream = await navigator.mediaDevices.getUserMedia({ video: true, audio: true });
      }
    }

    if (newStream) {
      // Replace video track in peer connection if active
      const newVideoTrack = newStream.getVideoTracks()[0];
      if (this.pc && newVideoTrack) {
        const sender = this.pc.getSenders().find((s) => s.track && s.track.kind === 'video');
        if (sender) {
          sender.replaceTrack(newVideoTrack).catch(() => {});
        }
      }

      this.localStream = newStream;
      this.events.onLocalStream(newStream);
      return newStream;
    }

    throw new Error('Failed to switch camera device');
  }

  public cleanupP2PChannel() {
    if (this.p2pAnnounceInterval) {
      clearInterval(this.p2pAnnounceInterval);
      this.p2pAnnounceInterval = null;
    }
    if (this.p2pChannel) {
      if (this.p2pPartnerTabId && this.currentMatchId) {
        try {
          this.p2pChannel.postMessage({
            type: 'p2p_signal',
            matchId: this.currentMatchId,
            targetTabId: this.p2pPartnerTabId,
            message: { type: 'peer_disconnected' },
          });
        } catch {}
      }
      try {
        this.p2pChannel.close();
      } catch {}
      this.p2pChannel = null;
    }
    this.p2pPartnerTabId = null;
  }

  public cleanupHttpSignaling() {
    this.isHttpSignalingActive = false;
    if (this.httpPollInterval) {
      clearInterval(this.httpPollInterval);
      this.httpPollInterval = null;
    }
    if (this.currentUserId) {
      fetch(`${API_BASE_URL}/api/match/leave`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ userId: this.currentUserId }),
      }).catch(() => {});
    }
  }

  private async startHttpMatchmaking(
    userId: string,
    country: string = 'GLOBAL',
    preferences: MatchPreferences
  ) {
    this.currentUserId = userId;
    this.cleanupPeerConnection();
    this.cleanupHttpSignaling();
    this.setState('waiting_for_match');

    // Also activate cross-tab BroadcastChannel for instant local tab pairing
    this.startP2PMatchmaking(userId, country, preferences);
    this.isHttpSignalingActive = true;

    try {
      const res = await fetch(`${API_BASE_URL}/api/match/join`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          userId,
          country,
          gender: this.lastMatchRequest?.gender || 'unspecified',
          preferences,
        }),
      });
      const data = await res.json();

      if (data.status === 'matched') {
        this.currentMatchId = data.matchId;
        await this.handleSignalingMessage({
          type: 'match_found',
          matchId: data.matchId,
          payload: {
            isInitiator: data.isInitiator,
            peerUserId: data.peerUserId,
            peerName: 'Stranger',
            peerCountry: data.peerCountry || 'Global',
            sharedInterests: data.sharedInterests || [],
            sharedLanguages: ['English'],
          },
        });
      }
    } catch (err) {
      console.warn('[WebRTC] HTTP join note:', err);
    }

    // Start HTTP polling
    const poll = async () => {
      if (!this.isHttpSignalingActive) return;
      if (
        this.state !== 'waiting_for_match' &&
        this.state !== 'connecting' &&
        this.state !== 'connected' &&
        this.state !== 'match_found'
      ) {
        return;
      }

      try {
        const res = await fetch(`${API_BASE_URL}/api/match/poll?userId=${encodeURIComponent(userId)}`);
        const data = await res.json();

        if (data.status === 'in_match') {
          // If not matched yet on client side, initialize match
          if (!this.currentMatchId || this.currentMatchId !== data.matchId) {
            this.currentMatchId = data.matchId;
            await this.handleSignalingMessage({
              type: 'match_found',
              matchId: data.matchId,
              payload: {
                isInitiator: data.isInitiator,
                peerUserId: data.peerUserId,
                peerName: 'Stranger',
                peerCountry: data.peerCountry || 'Global',
                sharedInterests: data.sharedInterests || [],
                sharedLanguages: ['English'],
              },
            });
          }

          // Process any buffered signaling messages (offer, answer, ice_candidate, etc.)
          if (Array.isArray(data.messages) && data.messages.length > 0) {
            for (const msg of data.messages) {
              await this.handleSignalingMessage(msg);
            }
          }
        }
      } catch (err) {
        // Poll warning ignored
      }
    };

    this.httpPollInterval = setInterval(poll, 1200);
  }

  private startP2PMatchmaking(userId: string, country: string, preferences: MatchPreferences) {
    this.cleanupPeerConnection();
    this.cleanupP2PChannel();
    this.setState('waiting_for_match');

    if (typeof BroadcastChannel === 'undefined') {
      return;
    }

    try {
      const channel = new BroadcastChannel('ur_live_p2p_channel');
      this.p2pChannel = channel;

      channel.onmessage = async (e) => {
        const data = e.data;
        if (!data || data.senderTabId === this.p2pTabId) return;

        // 1. Another real peer announces it's searching in the queue
        if (data.type === 'p2p_queue_announce' && this.state === 'waiting_for_match') {
          // Higher tab ID becomes initiator to avoid double pairing
          if (this.p2pTabId > data.senderTabId) {
            const matchId = 'p2p_' + Date.now() + '_' + Math.random().toString(36).slice(2, 6);
            this.currentMatchId = matchId;
            this.p2pPartnerTabId = data.senderTabId;
            if (this.p2pAnnounceInterval) {
              clearInterval(this.p2pAnnounceInterval);
              this.p2pAnnounceInterval = null;
            }

            // Notify partner of match
            channel.postMessage({
              type: 'p2p_match_paired',
              matchId,
              targetTabId: data.senderTabId,
              initiatorTabId: this.p2pTabId,
              initiatorUser: {
                userId,
                name: 'Stranger',
                country,
                preferences,
              },
            });

            // Start peer connection as initiator
            await this.handleSignalingMessage({
              type: 'match_found',
              matchId,
              payload: {
                isInitiator: true,
                peerUserId: data.userId,
                peerName: 'Stranger',
                peerCountry: data.country || 'Global',
                sharedInterests: data.preferences?.interests || [],
                sharedLanguages: ['English'],
              },
            });
          }
        }

        // 2. We are notified that another real peer paired with us
        if (data.type === 'p2p_match_paired' && data.targetTabId === this.p2pTabId && this.state === 'waiting_for_match') {
          this.currentMatchId = data.matchId;
          this.p2pPartnerTabId = data.initiatorTabId;
          if (this.p2pAnnounceInterval) {
            clearInterval(this.p2pAnnounceInterval);
            this.p2pAnnounceInterval = null;
          }

          // Start peer connection as receiver
          await this.handleSignalingMessage({
            type: 'match_found',
            matchId: data.matchId,
            payload: {
              isInitiator: false,
              peerUserId: data.initiatorUser?.userId,
              peerName: 'Stranger',
              peerCountry: data.initiatorUser?.country || 'Global',
              sharedInterests: data.initiatorUser?.preferences?.interests || [],
              sharedLanguages: ['English'],
            },
          });
        }

        // 3. Forward real WebRTC signaling messages (offer, answer, ice_candidate, chat, typing, disconnect)
        if (data.type === 'p2p_signal' && data.targetTabId === this.p2pTabId && data.matchId === this.currentMatchId) {
          await this.handleSignalingMessage(data.message);
        }
      };

      // Broadcast presence in queue immediately and periodically while waiting for a real peer
      const announce = () => {
        if (this.state === 'waiting_for_match' && this.p2pChannel) {
          this.p2pChannel.postMessage({
            type: 'p2p_queue_announce',
            senderTabId: this.p2pTabId,
            userId,
            country,
            preferences,
          });
        }
      };
      announce();
      this.p2pAnnounceInterval = setInterval(announce, 1500);
    } catch (err) {
      console.warn('[WebRTC] P2P channel init note:', err);
    }
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
      // Split deploys signal through the configured API origin; same-origin otherwise.
      const wsUrl = API_BASE_URL
        ? `${API_BASE_URL.replace(/^http/, 'ws')}/ws`
        : `${window.location.protocol === 'https:' ? 'wss:' : 'ws:'}//${window.location.host}/ws`;

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

          // If already running HTTP or P2P signaling, do not attempt WebSocket reconnect
          if (this.isHttpSignalingActive || this.p2pChannel) return;

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
      this.reconnectAttempts = 0;
      // WebSocket is unavailable on this host (e.g. Vercel serverless).
      // Seamlessly switch to HTTP / P2P matchmaking without failing or showing an error!
      if (this.lastMatchRequest) {
        this.startHttpMatchmaking(
          this.lastMatchRequest.userId,
          this.lastMatchRequest.country,
          this.lastMatchRequest.preferences
        );
      }
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
      // Connect real peer-to-peer across tabs and devices
      this.startHttpMatchmaking(userId, country, preferences);
      return;
    }

    this.cleanupPeerConnection();
    this.cleanupHttpSignaling();
    this.cleanupP2PChannel();
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
    this.cleanupHttpSignaling();
    this.cleanupP2PChannel();
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
    this.cleanupHttpSignaling();
    this.cleanupP2PChannel();
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
      this.startHttpMatchmaking(userId, this.lastMatchRequest.country, preferences);
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
    this.cleanupHttpSignaling();
    this.cleanupP2PChannel();
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
    if (!this.currentMatchId) {
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
    if (!trimmed || !this.currentMatchId) return false;

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
    } else {
      if (this.isHttpSignalingActive && this.currentMatchId && this.currentUserId) {
        fetch(`${API_BASE_URL}/api/match/signal`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            matchId: this.currentMatchId,
            senderId: this.currentUserId,
            message: msg,
          }),
        }).catch(() => {});
      }
      if (this.p2pChannel && this.p2pPartnerTabId && this.currentMatchId) {
        this.p2pChannel.postMessage({
          type: 'p2p_signal',
          matchId: this.currentMatchId,
          targetTabId: this.p2pPartnerTabId,
          message: msg,
        });
      }
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
    this.cleanupHttpSignaling();
    this.cleanupP2PChannel();
    this.cleanupPeerConnection();
    if (this.reconnectTimer) {
      clearTimeout(this.reconnectTimer);
      this.reconnectTimer = null;
    }
    if (this.rotationTimer) {
      clearTimeout(this.rotationTimer);
      this.rotationTimer = null;
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
