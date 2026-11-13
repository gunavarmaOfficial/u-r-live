import React, { useCallback, useEffect, useRef, useState } from 'react';
import {
  AlertCircleIcon,
  ArrowLeft01Icon,
  ArrowRight01Icon,
  CameraOff01Icon,
  CameraVideoIcon,
  Cancel01Icon,
  CheckmarkCircle01Icon,
  Clock01Icon,
  FullScreenIcon,
  Globe02Icon,
  LockIcon,
  Message01Icon,
  Mic01Icon,
  MicOff01Icon,
  PlayIcon,
  RefreshIcon,
  SentIcon,
  Settings02Icon,
  Share01Icon,
  SparklesIcon,
  StopCircleIcon,
  Sun02Icon,
  Moon02Icon,
  WebProtectionIcon,
} from 'hugeicons-react';
import { useApp } from '../context/AppContext';
import { WebRTCManager, NetworkQuality, NetworkStats } from '../services/webrtc';
import { WebRTCState, MatchPreferences, ChatMessage, UserProfile, ChatMode } from '../types';
import { api } from '../services/api';
import { COUNTRIES } from '../data/constants';
import { ThreeDMaleAvatar, ThreeDFemaleAvatar, ThreeDOtherAvatar, ThreeDGlobeIcon } from './ThreeDIcons';
import { CountryFilterModal } from './CountryFilterModal';
import { ProPaymentModal } from './ProPaymentModal';
import { PermissionModal, PermissionErrorType } from './PermissionModal';
import { Link } from 'react-router-dom';

const PREVIEW_STREAMS = [
  { id: 1, src: '/previews/stream-1.jpg', name: 'Simran', viewers: '2.4k' },
  { id: 2, src: '/previews/stream-2.png', name: 'Ananya', viewers: '1.9k' },
  { id: 3, src: '/previews/stream-3.jpg', name: 'Priya', viewers: '3.1k' },
  { id: 4, src: '/previews/stream-4.jpg', name: 'Kavya', viewers: '1.7k' },
  { id: 5, src: '/previews/stream-5.jpg', name: 'Ritu', viewers: '2.8k' },
  { id: 6, src: '/previews/stream-6.jpg', name: 'Sneha', viewers: '3.5k' },
];

interface VideoChatViewProps {
  user: UserProfile;
  onOpenReportModal: (partnerId: string, partnerName: string) => void;
  onRequireAgeVerification: () => void;
  onOpenOnboarding?: () => void;
  preferredGender?: 'any' | 'male' | 'female';
  onChangePreferredGender?: (gender: 'any' | 'male' | 'female') => void;
  mode?: ChatMode;
  onChangeMode?: (mode: ChatMode) => void;
  interests?: string[];
  onChangeInterests?: (interests: string[]) => void;
  onUserUpdated?: (user: UserProfile) => void;
  onOpenSafetyCentre?: () => void;
}

type SelfGender = 'male' | 'female' | 'non-binary';

const SEARCHING_STATES: WebRTCState[] = [
  'requesting_permissions',
  'waiting_for_match',
  'match_found',
  'connecting',
  'reconnecting',
];

const getCountryMeta = (value?: string) => {
  if (!value) return { code: 'GLOBAL', name: 'Global', flag: '🌐' };
  const match = COUNTRIES.find(
    (c) => c.code === value || c.name.toLowerCase() === value.toLowerCase()
  );
  return match || { code: value, name: value, flag: '🌐' };
};

const formatDuration = (totalSeconds: number) => {
  const minutes = Math.floor(totalSeconds / 60);
  const seconds = totalSeconds % 60;
  return `${String(minutes).padStart(2, '0')}:${String(seconds).padStart(2, '0')}`;
};

const QUALITY_META: Record<NetworkQuality, { label: string; className: string; bars: number }> = {
  excellent: { label: 'Excellent', className: 'text-emerald-300', bars: 4 },
  good: { label: 'Good', className: 'text-[#67e8f9]', bars: 3 },
  fair: { label: 'Fair', className: 'text-amber-300', bars: 2 },
  poor: { label: 'Poor', className: 'text-rose-300', bars: 1 },
};

const QualityBars: React.FC<{ quality: NetworkQuality }> = ({ quality }) => {
  const meta = QUALITY_META[quality];
  return (
    <span className="flex items-end gap-[2px]" aria-hidden="true">
      {[1, 2, 3, 4].map((bar) => (
        <span
          key={bar}
          className={`w-[3px] rounded-sm transition-colors ${
            bar <= meta.bars ? 'bg-current' : 'bg-white/15'
          }`}
          style={{ height: `${3 + bar * 2}px` }}
        />
      ))}
    </span>
  );
};

const StreamVideo: React.FC<{
  stream: MediaStream | null;
  muted?: boolean;
  mirrored?: boolean;
  className?: string;
}> = ({ stream, muted = false, mirrored = false, className = '' }) => {
  const videoRef = useRef<HTMLVideoElement>(null);

  useEffect(() => {
    const el = videoRef.current;
    if (!el) return;
    if (el.srcObject !== stream) {
      el.srcObject = stream;
    }
    if (stream) {
      el.play().catch(() => {});
    }
  }, [stream]);

  return (
    <video
      ref={videoRef}
      autoPlay
      playsInline
      muted={muted}
      className={`${className} ${mirrored ? '-scale-x-100' : ''}`}
    />
  );
};

const GENDER_OPTIONS: { value: SelfGender; label: string; hint: string }[] = [
  { value: 'female', label: 'Female', hint: 'Match with anyone' },
  { value: 'male', label: 'Male', hint: 'Match with anyone' },
  { value: 'non-binary', label: 'Non-binary', hint: 'Match with anyone' },
];

const genderAvatar = (gender: string, className: string) => {
  if (gender === 'female') return <ThreeDFemaleAvatar className={className} />;
  if (gender === 'male') return <ThreeDMaleAvatar className={className} />;
  return <ThreeDOtherAvatar className={className} />;
};

const genderLabel = (gender: string) => {
  if (gender === 'female') return 'Female';
  if (gender === 'male') return 'Male';
  if (gender === 'non-binary') return 'Non-binary';
  return 'Select';
};

export const VideoChatView: React.FC<VideoChatViewProps> = ({
  user,
  onOpenReportModal,
  onRequireAgeVerification,
  onOpenOnboarding,
  preferredGender = 'any',
  mode = 'video',
  onChangeMode,
  interests = [],
  onChangeInterests,
  onUserUpdated,
  onOpenSafetyCentre,
}) => {
  const { theme, toggleTheme } = useApp();
  const managerRef = useRef<WebRTCManager | null>(null);
  const stageRef = useRef<HTMLDivElement>(null);
  const chatEndRef = useRef<HTMLDivElement>(null);
  const mobileChatEndRef = useRef<HTMLDivElement>(null);
  const toastTimerRef = useRef<number | null>(null);
  const typingClearRef = useRef<number | null>(null);
  const inviteTimerRef = useRef<number | null>(null);
  const mobileTabRef = useRef<'video' | 'chat'>('video');
  const stopTimeoutRef = useRef<number | null>(null);

  const [stopPhase, setStopPhase] = useState<'stop' | 'really' | 'new'>('new');

  const [state, setState] = useState<WebRTCState>('idle');
  const [statusMessage, setStatusMessage] = useState<string>('Ready when you are.');
  const [partner, setPartner] = useState<{
    id: string;
    name: string;
    country: string;
    sharedInterests?: string[];
    sharedLanguages?: string[];
  } | null>(null);

  const [localStream, setLocalStream] = useState<MediaStream | null>(null);
  const [remoteStream, setRemoteStream] = useState<MediaStream | null>(null);

  const [isMicOn, setIsMicOn] = useState(true);
  const [isCamOn, setIsCamOn] = useState(true);

  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [chatInput, setChatInput] = useState('');
  const [peerTyping, setPeerTyping] = useState(false);
  const [unreadCount, setUnreadCount] = useState(0);
  const [mobileTab, setMobileTab] = useState<'video' | 'chat'>('video');
  const [latestMessageToast, setLatestMessageToast] = useState<{ text: string } | null>(null);

  const [selectedCountry, setSelectedCountry] = useState<string>(user.country || 'GLOBAL');
  const [selectedCountries, setSelectedCountries] = useState<string[]>([user.country || 'GLOBAL']);
  const [selectedLanguage, setSelectedLanguage] = useState<string>('en');
  const [selectedLanguages, setSelectedLanguages] = useState<string[]>(['en']);
  const [isMultipleCountries, setIsMultipleCountries] = useState(false);

  const [selfGender, setSelfGender] = useState<SelfGender | 'unspecified'>(
    (user.gender as SelfGender | 'unspecified') || 'unspecified'
  );
  const [genderSaving, setGenderSaving] = useState(false);

  const [mediaFallback, setMediaFallback] = useState<string | null>(null);
  const [queueLength, setQueueLength] = useState<number | null>(null);
  const [network, setNetwork] = useState<{ quality: NetworkQuality; stats: NetworkStats } | null>(null);
  const [connectedAt, setConnectedAt] = useState<number | null>(null);
  const [elapsedSeconds, setElapsedSeconds] = useState(0);
  const [searchSeconds, setSearchSeconds] = useState(0);

  const [showCountryModal, setShowCountryModal] = useState(false);
  const [showSettingsModal, setShowSettingsModal] = useState(false);
  const [showGenderSheet, setShowGenderSheet] = useState(false);
  const [audioInputs, setAudioInputs] = useState<MediaDeviceInfo[]>([]);
  const [selectedAudioInput, setSelectedAudioInput] = useState('default');
  const [settingsError, setSettingsError] = useState<string | null>(null);

  const [isFullscreen, setIsFullscreen] = useState(false);
  const [inviteState, setInviteState] = useState<'idle' | 'copied'>('idle');

  const [previewIndex, setPreviewIndex] = useState(0);
  const [isPro, setIsPro] = useState(() => {
    try {
      return localStorage.getItem('ur_live_is_pro') === 'true';
    } catch {
      return false;
    }
  });
  const [showProModal, setShowProModal] = useState(false);
  const [proModalStep, setProModalStep] = useState<'promo' | 'payment'>('promo');

  const [showPermissionModal, setShowPermissionModal] = useState(false);
  const [permissionErrorType, setPermissionErrorType] = useState<PermissionErrorType>('prompt');
  const [permissionErrorMessage, setPermissionErrorMessage] = useState<string>('');

  const handleRequestPermissions = async (triggerOrigin = 'manual') => {
    if (!managerRef.current) return;
    try {
      const stream = await managerRef.current.initMedia();
      if (stream) {
        setLocalStream(stream);
        setIsCamOn(true);
        setIsMicOn(true);
        setShowPermissionModal(false);
      }
    } catch (err: any) {
      console.warn('Camera request error:', err);
      let type: PermissionErrorType = 'denied';
      let msg = 'Camera and microphone access was denied.';
      if (err?.name === 'NotAllowedError' || err?.name === 'PermissionDeniedError') {
        type = 'denied';
        msg = 'Permission was blocked in your browser. Please allow camera and mic permissions to continue.';
      } else if (err?.name === 'NotFoundError' || err?.name === 'DevicesNotFoundError') {
        type = 'not_found';
        msg = 'No camera or microphone hardware found on your device.';
      } else if (err?.name === 'NotReadableError' || err?.name === 'TrackStartError') {
        type = 'in_use';
        msg = 'Your camera is already in use by another application.';
      } else if (err?.message?.includes('WebRTC')) {
        type = 'unsupported';
        msg = 'WebRTC media capture is not supported by your browser or connection.';
      }
      setPermissionErrorType(type);
      setPermissionErrorMessage(msg);
      if (triggerOrigin === 'user_action') {
        setShowPermissionModal(true);
      }
    }
  };

  const handleFlipCamera = async () => {
    if (!managerRef.current) return;
    try {
      const newStream = await managerRef.current.switchCamera();
      if (newStream) {
        setLocalStream(newStream);
      }
    } catch (err) {
      console.warn('Failed to switch camera:', err);
    }
  };

  // When user clicks any in-app payment/upgrade button, go directly to payment view (do not show promo banner)
  const handleOpenPaymentDirectly = (e?: React.MouseEvent) => {
    if (e) {
      e.stopPropagation();
      e.preventDefault();
    }
    setProModalStep('payment');
    setShowProModal(true);
  };

  useEffect(() => {
    if (remoteStream) return;
    const interval = setInterval(() => {
      setPreviewIndex((prev) => (prev + 1) % PREVIEW_STREAMS.length);
    }, 3800);
    return () => clearInterval(interval);
  }, [remoteStream]);

  const isSearching = SEARCHING_STATES.includes(state);
  const isConnected = state === 'connected' || Boolean(partner) || state === 'connecting' || state === 'match_found';
  const currentCountryObj = getCountryMeta(selectedCountry);
  const partnerCountryObj = getCountryMeta(partner?.country);

  const othersWaiting =
    queueLength === null ? null : Math.max(queueLength - (isSearching ? 1 : 0), 0);

  useEffect(() => {
    mobileTabRef.current = mobileTab;
    if (mobileTab === 'chat') setUnreadCount(0);
  }, [mobileTab]);

  useEffect(() => {
    setSelfGender((user.gender as SelfGender | 'unspecified') || 'unspecified');
  }, [user.gender]);

  /* ---------------- Preferences hydration ---------------- */
  useEffect(() => {
    api
      .getUserPreferences()
      .then((res) => {
        if (res && res.preferences) {
          const p = res.preferences;
          if (p.preferredCountry) setSelectedCountry(p.preferredCountry);
          if (Array.isArray(p.preferredCountries) && p.preferredCountries.length > 0) {
            setSelectedCountries(p.preferredCountries);
          }
          if (typeof p.isMultipleCountries === 'boolean') {
            setIsMultipleCountries(p.isMultipleCountries);
          }
          if (Array.isArray(p.languages) && p.languages.length > 0) {
            setSelectedLanguages(p.languages);
            setSelectedLanguage(p.languages[0]);
          } else if (Array.isArray(p.preferredLanguages) && p.preferredLanguages.length > 0) {
            setSelectedLanguages(p.preferredLanguages);
            setSelectedLanguage(p.preferredLanguages[0]);
          }
        }
      })
      .catch(() => {});
  }, []);

  const persistPreferences = useCallback(
    (overrides: {
      preferredCountry?: string;
      preferredCountries?: string[];
      isMultipleCountries?: boolean;
      languages?: string[];
    }) => {
      api
        .saveUserPreferences({
          preferredCountry: overrides.preferredCountry ?? selectedCountry,
          preferredCountries: overrides.preferredCountries ?? selectedCountries,
          isMultipleCountries: overrides.isMultipleCountries ?? isMultipleCountries,
          languages: overrides.languages ?? selectedLanguages,
          preferredLanguages: overrides.languages ?? selectedLanguages,
          preferredGender,
        })
        .catch((err) => console.warn('Could not save preferences:', err));
    },
    [
      selectedCountry,
      selectedCountries,
      isMultipleCountries,
      selectedLanguages,
      preferredGender,
    ]
  );

  const handleApplyCountries = useCallback(
    (countries: string[]) => {
      const next = countries.length > 0 ? countries : ['GLOBAL'];
      setSelectedCountries(next);
      setSelectedCountry(next[0] || 'GLOBAL');
      persistPreferences({ preferredCountry: next[0] || 'GLOBAL', preferredCountries: next });
    },
    [persistPreferences]
  );

  const handleApplyLanguages = useCallback(
    (langs: string[]) => {
      const next = langs.length > 0 ? langs : ['en'];
      setSelectedLanguages(next);
      setSelectedLanguage(next[0] || 'en');
      persistPreferences({ languages: next });
    },
    [persistPreferences]
  );

  const handleResetFilters = useCallback(() => {
    setSelectedCountry('GLOBAL');
    setSelectedCountries(['GLOBAL']);
    setSelectedLanguage('en');
    setSelectedLanguages(['en']);
    setIsMultipleCountries(false);
    api.resetUserPreferences().catch(() => {});
  }, []);

  const buildCurrentPreferences = useCallback((): MatchPreferences => {
    return {
      mode: mode || 'video',
      interests: interests || [],
      interestMatchingEnabled: Boolean(interests && interests.length > 0),
      preferredCountry: selectedCountry,
      preferredCountries: selectedCountries,
      isMultipleCountries: isMultipleCountries,
      preferredGender,
      languages: selectedLanguages,
      preferredLanguages: selectedLanguages,
      primaryLanguage: selectedLanguage,
    };
  }, [
    mode,
    interests,
    selectedCountry,
    selectedCountries,
    isMultipleCountries,
    preferredGender,
    selectedLanguage,
    selectedLanguages,
  ]);

  /* ---------------- State / status ---------------- */
  const handleStateChange = useCallback((newState: WebRTCState, details?: string) => {
    setState(newState);

    if (newState === 'connected') {
      setConnectedAt(Date.now());
      setStopPhase('stop');
    } else if (
      newState === 'idle' ||
      newState === 'local_disconnected' ||
      newState === 'remote_disconnected' ||
      newState === 'failed' ||
      newState === 'waiting_for_match'
    ) {
      setConnectedAt(null);
      setNetwork(null);
      if (newState === 'remote_disconnected' || newState === 'local_disconnected' || newState === 'idle') {
        setStopPhase('new');
      }
    }
    if (newState !== 'connected') {
      setPeerTyping(false);
    }

    if (details) {
      setStatusMessage(details);
      return;
    }

    switch (newState) {
      case 'idle':
        setStatusMessage('Ready when you are.');
        break;
      case 'requesting_permissions':
        setStatusMessage('Requesting camera & microphone…');
        break;
      case 'waiting_for_match':
        setStatusMessage('Looking for someone new…');
        break;
      case 'match_found':
        setStatusMessage('Match found — connecting…');
        break;
      case 'connecting':
        setStatusMessage('Connecting the secure stream…');
        break;
      case 'connected':
        setStatusMessage('Connected · live now');
        break;
      case 'reconnecting':
        setStatusMessage('Reconnecting…');
        break;
      case 'remote_disconnected':
        setStatusMessage('Your partner left the conversation.');
        break;
      case 'local_disconnected':
        setStatusMessage('You ended the session.');
        break;
      case 'camera_unavailable':
        setStatusMessage('Camera unavailable.');
        break;
      case 'failed':
        setStatusMessage('Connection failed. Please try again.');
        break;
      default:
        break;
    }
  }, []);

  /* ---------------- WebRTC manager ---------------- */
  useEffect(() => {
    const manager = new WebRTCManager({
      onStateChange: handleStateChange,
      onLocalStream: (stream) => setLocalStream(stream),
      onRemoteStream: (stream) => setRemoteStream(stream),
      onChatMessage: (msg) => {
        setMessages((prev) => {
          if (
            prev.some(
              (m) =>
                m.id === msg.id ||
                (m.text === msg.text &&
                  m.isLocal === msg.isLocal &&
                  Math.abs(m.timestamp - msg.timestamp) < 2000)
            )
          ) {
            return prev;
          }
          return [...prev, msg];
        });
        if (!msg.isLocal) {
          setLatestMessageToast({ text: msg.text });
          if (toastTimerRef.current) clearTimeout(toastTimerRef.current);
          toastTimerRef.current = window.setTimeout(() => setLatestMessageToast(null), 4200);
          const chatVisible =
            window.matchMedia('(min-width: 1024px)').matches || mobileTabRef.current === 'chat';
          if (!chatVisible) setUnreadCount((count) => count + 1);
          setPeerTyping(false);
        }
      },
      onMatchFound: (peer) => {
        setPartner({
          id: peer.peerUserId,
          name: peer.peerName,
          country: peer.peerCountry,
          sharedInterests: peer.sharedInterests,
          sharedLanguages: peer.sharedLanguages,
        });
        setMessages([]);
        setUnreadCount(0);
        setPeerTyping(false);
        setMobileTab('video');
      },
      onPeerDisconnected: (reason) => {
        setPartner(null);
        setPeerTyping(false);
        setNetwork(null);
        if (reason) setStatusMessage(reason);
      },
      onError: (err) => console.warn('WebRTC:', err),
      onMediaFallback: (reason) => setMediaFallback(reason),
      onQueueUpdate: (length) => setQueueLength(length),
      onNetworkQuality: (quality, stats) => setNetwork({ quality, stats }),
      onPeerTyping: (typing) => setPeerTyping(typing),
    });

    managerRef.current = manager;

    api.getIceServers().then((res) => {
      if (res.iceServers) manager.updateIceServers(res.iceServers);
    });

    if (user.isAdultVerified && mode !== 'text') {
      manager
        .initMedia()
        .then((stream) => {
          setLocalStream(stream);
        })
        .catch((err) => {
          let type: PermissionErrorType = 'denied';
          if (err?.name === 'NotFoundError' || err?.name === 'DevicesNotFoundError') type = 'not_found';
          else if (err?.name === 'NotReadableError' || err?.name === 'TrackStartError') type = 'in_use';
          setPermissionErrorType(type);
          setPermissionErrorMessage(err?.message || 'Camera permission required.');
        });
    }

    return () => {
      manager.destroy();
      managerRef.current = null;
      if (toastTimerRef.current) clearTimeout(toastTimerRef.current);
      if (typingClearRef.current) clearTimeout(typingClearRef.current);
      if (inviteTimerRef.current) clearTimeout(inviteTimerRef.current);
    };
  }, [handleStateChange, user.isAdultVerified]);

  /* ---------------- Live queue count ---------------- */
  useEffect(() => {
    let cancelled = false;
    const load = () => {
      api
        .getSystemHealth()
        .then((res) => {
          if (!cancelled) setQueueLength(res.queueLength);
        })
        .catch(() => {});
    };
    load();
    const interval = window.setInterval(load, 20000);
    return () => {
      cancelled = true;
      clearInterval(interval);
    };
  }, []);

  /* ---------------- Streams reattachment ---------------- */
  useEffect(() => {
    if (!managerRef.current) return;
    const local = managerRef.current.getLocalStream();
    const remote = managerRef.current.getRemoteStream();
    if (local) setLocalStream(local);
    if (remote) setRemoteStream(remote);
  }, [mobileTab, state]);

  useEffect(() => {
    chatEndRef.current?.scrollIntoView({ behavior: 'smooth' });
    mobileChatEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages, peerTyping, mobileTab]);

  /* ---------------- Timers ---------------- */
  useEffect(() => {
    if (!isSearching) {
      setSearchSeconds(0);
      return;
    }
    setSearchSeconds(0);
    const interval = window.setInterval(() => setSearchSeconds((s) => s + 1), 1000);
    return () => clearInterval(interval);
  }, [isSearching]);

  useEffect(() => {
    if (!connectedAt) {
      setElapsedSeconds(0);
      return;
    }
    const tick = () => setElapsedSeconds(Math.floor((Date.now() - connectedAt) / 1000));
    tick();
    const interval = window.setInterval(tick, 1000);
    return () => clearInterval(interval);
  }, [connectedAt]);

  /* ---------------- Fullscreen ---------------- */
  useEffect(() => {
    const onChange = () => setIsFullscreen(Boolean(document.fullscreenElement));
    document.addEventListener('fullscreenchange', onChange);
    return () => document.removeEventListener('fullscreenchange', onChange);
  }, []);

  /* ---------------- Audio devices ---------------- */
  useEffect(() => {
    if (!navigator.mediaDevices?.enumerateDevices) return;
    navigator.mediaDevices
      .enumerateDevices()
      .then((devices) => setAudioInputs(devices.filter((d) => d.kind === 'audioinput')))
      .catch(() => {});
  }, []);

  useEffect(() => {
    if (!showSettingsModal) {
      setSettingsError(null);
      return;
    }
    if (!navigator.mediaDevices?.enumerateDevices) return;
    navigator.mediaDevices
      .enumerateDevices()
      .then((devices) => {
        const inputs = devices.filter((d) => d.kind === 'audioinput');
        setAudioInputs(inputs);
        const activeId = localStream?.getAudioTracks()[0]?.getSettings().deviceId;
        setSelectedAudioInput((prev) => {
          if (activeId && inputs.some((d) => d.deviceId === activeId)) return activeId;
          if (inputs.some((d) => d.deviceId === prev)) return prev;
          return inputs[0]?.deviceId || 'default';
        });
      })
      .catch(() => {});
  }, [showSettingsModal, localStream]);

  /* ---------------- Actions ---------------- */
  const requireVerifiedUser = () => {
    return true;
  };

  const resetConversation = () => {
    setMessages([]);
    setUnreadCount(0);
    setPeerTyping(false);
    setLatestMessageToast(null);
  };

  const handleStartSearch = async () => {
    if (!managerRef.current) return;
    resetConversation();
    setPartner(null);
    setNetwork(null);
    setMobileTab(mode === 'text' ? 'chat' : 'video');
    setStopPhase('stop');
    setState('waiting_for_match');
    setStatusMessage('Looking for someone to chat with…');

    // Ensure camera is started during user gesture ONLY for video mode
    if (mode !== 'text' && !localStream && managerRef.current) {
      try {
        const stream = await managerRef.current.initMedia();
        if (stream) setLocalStream(stream);
      } catch (err: any) {
        console.warn('Camera request during search:', err);
        let type: PermissionErrorType = 'denied';
        if (err?.name === 'NotFoundError' || err?.name === 'DevicesNotFoundError') type = 'not_found';
        else if (err?.name === 'NotReadableError' || err?.name === 'TrackStartError') type = 'in_use';
        setPermissionErrorType(type);
        setPermissionErrorMessage(err?.message || 'Camera and microphone access is required to connect.');
        setShowPermissionModal(true);
        setState('idle');
        setStatusMessage('Camera access needed to start.');
        return;
      }
    }

    try {
      await managerRef.current.findMatch(
        user.id,
        selfGender || 'unspecified',
        user.country || 'GLOBAL',
        buildCurrentPreferences()
      );
    } catch (err) {
      console.warn('Start search error:', err);
    }
  };

  const handleNext = () => {
    if (!managerRef.current || !requireVerifiedUser()) return;
    managerRef.current.setTyping(false);
    resetConversation();
    setPartner(null);
    setNetwork(null);
    managerRef.current.skipMatch(user.id, buildCurrentPreferences());
  };

  const handleStop = () => {
    const manager = managerRef.current;
    if (!manager) return;
    manager.setTyping(false);
    manager.disconnect();
    resetConversation();
    setPartner(null);
    setNetwork(null);
  };

  const handleToggleMic = () => {
    const manager = managerRef.current;
    if (!manager) return;
    setIsMicOn(manager.toggleAudio());
  };

  const handleToggleCam = () => {
    const manager = managerRef.current;
    if (!manager) return;
    setIsCamOn(manager.toggleVideo());
  };

  const handleSendMessage = (event: React.FormEvent) => {
    event.preventDefault();
    const text = chatInput.trim();
    if (!text) return;

    const msgId = 'msg_' + Date.now() + '_' + Math.random().toString(36).slice(2, 7);
    const newMsg: ChatMessage = {
      id: msgId,
      senderId: user.id,
      isLocal: true,
      text,
      timestamp: Date.now(),
    };

    // Optimistic UI delivery: instant message display in chat
    setMessages((prev) => [...prev, newMsg]);
    setChatInput('');

    if (typingClearRef.current) clearTimeout(typingClearRef.current);
    const manager = managerRef.current;
    if (manager) {
      manager.setTyping(false);
      manager.sendChatMessage(text, user.id, msgId);
    }
  };

  const handleChatInput = (value: string) => {
    setChatInput(value);
    const manager = managerRef.current;
    if (!manager) return;
    if (value.trim()) {
      manager.setTyping(true);
      if (typingClearRef.current) clearTimeout(typingClearRef.current);
      typingClearRef.current = window.setTimeout(() => manager.setTyping(false), 1400);
    } else {
      manager.setTyping(false);
    }
  };

  const handleSelectGender = (gender: SelfGender) => {
    setSelfGender(gender);
    setShowGenderSheet(false);
    setGenderSaving(true);
    api
      .updateProfile({ gender })
      .then((res) => {
        if (res?.user) onUserUpdated?.(res.user);
      })
      .catch(() => {})
      .finally(() => setGenderSaving(false));
  };

  const handleAudioInputChange = async (deviceId: string) => {
    setSelectedAudioInput(deviceId);
    setSettingsError(null);
    const ok = await managerRef.current?.switchAudioInput(deviceId);
    if (ok === false) setSettingsError('Could not switch microphone. Try another device.');
  };

  const toggleFullscreen = async () => {
    const stage = stageRef.current;
    if (!stage) return;
    try {
      if (document.fullscreenElement) {
        await document.exitFullscreen();
      } else if (stage.requestFullscreen) {
        await stage.requestFullscreen();
      } else if ((stage as HTMLDivElement & { webkitRequestFullscreen?: () => void }).webkitRequestFullscreen) {
        (stage as HTMLDivElement & { webkitRequestFullscreen?: () => void }).webkitRequestFullscreen?.();
      }
    } catch {
      /* fullscreen can be blocked by the browser */
    }
  };

  const handleInvite = async () => {
    const url = window.location.origin;
    try {
      if (navigator.share) {
        await navigator.share({
          title: 'U-R-LIVE',
          text: 'Meet new people on live video chat.',
          url,
        });
      } else {
        await navigator.clipboard.writeText(url);
      }
      setInviteState('copied');
      if (inviteTimerRef.current) clearTimeout(inviteTimerRef.current);
      inviteTimerRef.current = window.setTimeout(() => setInviteState('idle'), 2200);
    } catch {
      setInviteState('idle');
    }
  };

  const handlePrimaryAction = () => {
    if (isSearching) return;
    if (isConnected || state === 'remote_disconnected' || state === 'match_found' || state === 'connecting') {
      handleNext();
      return;
    }
    handleStartSearch();
  };

  const handleOmegleStop = useCallback(() => {
    // If not connected and not searching, clicking Start always begins searching immediately
    if (!isConnected && !isSearching && state !== 'match_found' && state !== 'connecting') {
      if (stopTimeoutRef.current) clearTimeout(stopTimeoutRef.current);
      handleStartSearch();
      setStopPhase('stop');
      return;
    }

    if (stopPhase === 'stop') {
      if (isConnected || state === 'match_found' || state === 'connecting') {
        setStopPhase('really');
        if (stopTimeoutRef.current) clearTimeout(stopTimeoutRef.current);
        stopTimeoutRef.current = window.setTimeout(() => {
          setStopPhase('stop');
        }, 3500);
      } else if (isSearching) {
        handleStop();
        setStopPhase('new');
      } else {
        handleStartSearch();
        setStopPhase('stop');
      }
    } else if (stopPhase === 'really') {
      if (stopTimeoutRef.current) clearTimeout(stopTimeoutRef.current);
      handleStop();
      setStopPhase('new');
    } else if (stopPhase === 'new') {
      if (stopTimeoutRef.current) clearTimeout(stopTimeoutRef.current);
      handleStartSearch();
      setStopPhase('stop');
    }
  }, [stopPhase, isConnected, state, isSearching, handleStop, handleStartSearch]);

  const handleOmegleStopRef = useRef(handleOmegleStop);
  handleOmegleStopRef.current = handleOmegleStop;

  const handleStartSearchRef = useRef(handleStartSearch);
  handleStartSearchRef.current = handleStartSearch;

  // Auto-start matchmaking when landing on live view
  useEffect(() => {
    const timer = setTimeout(() => {
      if (managerRef.current && state === 'idle') {
        handleStartSearchRef.current();
      }
    }, 400);
    return () => clearTimeout(timer);
  }, []);

  // Space starts a search or skips to the next partner; Esc triggers Omegle Stop/Really/New.
  const primaryActionRef = useRef(handlePrimaryAction);
  primaryActionRef.current = handlePrimaryAction;

  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      if (document.querySelector('[role="dialog"][aria-modal="true"]')) return;

      if (event.key === 'Escape') {
        event.preventDefault();
        handleOmegleStopRef.current();
        return;
      }

      const target = event.target as HTMLElement | null;
      const isTyping =
        !!target &&
        (target.tagName === 'INPUT' || target.tagName === 'TEXTAREA' || target.isContentEditable);
      if (isTyping || event.metaKey || event.ctrlKey || event.altKey) return;

      if (event.code === 'Space' || event.key === ' ') {
        if (event.repeat) return;
        event.preventDefault();
        primaryActionRef.current();
        return;
      }
    };

    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, []);

  const canStop =
    state !== 'idle' &&
    state !== 'local_disconnected' &&
    state !== 'failed' &&
    state !== 'camera_unavailable';

  const primaryLabel = isSearching
    ? 'Searching…'
    : isConnected || state === 'remote_disconnected'
      ? 'Next'
      : 'Start';

  const displaySeconds = isConnected ? elapsedSeconds : searchSeconds;
  const dotClass = isConnected
    ? 'bg-emerald-400 shadow-[0_0_10px_2px_rgba(52,211,153,0.6)]'
    : isSearching
      ? 'bg-[#67e8f9] animate-pulse'
      : state === 'failed' || state === 'camera_unavailable'
        ? 'bg-rose-400'
        : 'bg-neutral-600';

  const activeMic = audioInputs.find((device) => device.deviceId === selectedAudioInput) || audioInputs[0];
  const micLabel = activeMic?.label || (isMicOn ? 'Default microphone' : 'Microphone muted');
  const usableAudioInputs = audioInputs.filter((device) => Boolean(device.deviceId));

  const formatTimer = (seconds: number) => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
  };

  /* ---------------- Chat pane (Umingle layout matching Image 2) ---------------- */
  const chatPane = (
    <div className="flex min-h-0 flex-1 flex-col font-sans bg-white dark:bg-[#12111f] rounded-2xl border border-neutral-200/80 dark:border-white/10 shadow-sm overflow-hidden">
      {/* Welcome & Community Rules Header (matching Image 2) */}
      <div className="shrink-0 p-2.5 sm:p-5 lg:p-6 border-b border-neutral-100 dark:border-white/[0.06] bg-neutral-50/50 dark:bg-white/[0.01]">
        <div className="flex items-center justify-between">
          <h2 className="text-sm sm:text-xl lg:text-2xl font-extrabold text-neutral-900 dark:text-white">
            Welcome to U-R-LIVE.
          </h2>
          <div className="flex items-center gap-1.5">
            <span className="rounded bg-[#ef4444] px-1.5 py-0.5 text-[10px] font-black text-white">18+</span>
            <span className="text-xs font-bold text-[#ef4444] dark:text-[#f87171] hidden sm:inline">You must be 18 or older</span>
          </div>
        </div>
        <ul className="mt-1 sm:mt-2 hidden sm:block space-y-1 text-xs sm:text-sm font-medium text-neutral-700 dark:text-neutral-300">
          <li>No nudity, hate speech, or harassment</li>
          <li>Your camera must show you, live</li>
          <li>Do not ask for gender — this is not a dating site</li>
        </ul>
        <p className="mt-1 sm:mt-2 text-[11px] sm:text-sm font-black text-neutral-900 dark:text-white">
          Violators will be banned
        </p>
      </div>

      {/* Scrollable messages history */}
      <div className="min-h-0 flex-1 space-y-2 overflow-y-auto p-4 text-[13px]">
        {partner?.sharedInterests && partner.sharedInterests.length > 0 && (
          <div className="mb-2 flex items-center gap-2 rounded-xl border border-amber-400/30 bg-amber-500/15 px-3 py-2 text-xs font-semibold text-amber-300">
            <span className="text-amber-400 text-sm">★</span>
            <span>You both like: {partner.sharedInterests.join(', ')}</span>
          </div>
        )}

        {messages.map((msg) => (
          <div key={msg.id} className="leading-relaxed break-words py-0.5">
            {msg.isLocal ? (
              <>
                <strong className="font-bold text-[#ef4444] dark:text-[#f87171] mr-1.5 select-none">You:</strong>
                <span className="text-neutral-800 dark:text-neutral-200">{msg.text}</span>
              </>
            ) : (
              <>
                <strong className="font-bold text-rose-500 mr-1.5 select-none">Stranger:</strong>
                <span className="text-neutral-800 dark:text-neutral-200">{msg.text}</span>
              </>
            )}
          </div>
        ))}

        {peerTyping && (
          <div className="py-1 text-xs italic text-neutral-400 select-none animate-pulse">
            Stranger is typing…
          </div>
        )}

        {state === 'remote_disconnected' && (
          <div className="my-3 rounded-2xl border border-rose-500/30 bg-rose-500/10 p-3.5 text-center">
            <p className="text-sm font-bold text-rose-500 dark:text-rose-400">Stranger has disconnected.</p>
            <p className="mt-1 text-xs text-neutral-500 dark:text-neutral-400">
              Press <strong className="text-neutral-900 dark:text-white">New</strong> or press{' '}
              <kbd className="rounded bg-black/10 dark:bg-black/50 px-1 py-0.5 font-mono text-[10px] text-neutral-800 dark:text-white">
                Esc
              </kbd>{' '}
              to find someone new.
            </p>
          </div>
        )}

        <div ref={chatEndRef} />
      </div>

      {/* Bottom options and input row (matching Image 2) */}
      <div className="shrink-0 border-t border-neutral-200/80 dark:border-white/[0.08] bg-neutral-50/60 dark:bg-[#0d0c18] p-2 sm:p-3 space-y-1.5 sm:space-y-2.5">
        {/* Quick options strip: Smart Match & Get Premium */}
        <div className="flex items-center gap-1.5 sm:gap-2">
          <button
            type="button"
            onClick={() => setShowCountryModal(true)}
            className="flex items-center gap-1 sm:gap-1.5 rounded-lg border border-neutral-200 dark:border-white/10 bg-white dark:bg-white/[0.05] px-2.5 sm:px-3 py-1 sm:py-1.5 text-[11px] sm:text-xs font-semibold text-neutral-700 dark:text-neutral-300 hover:bg-neutral-100 dark:hover:bg-white/[0.08] transition cursor-pointer"
          >
            <span>🌍</span>
            <span>Smart Match</span>
            <span className="text-[10px] text-neutral-400">▾</span>
          </button>

          <button
            type="button"
            onClick={handleOpenPaymentDirectly}
            className="flex items-center gap-1 rounded-lg bg-gradient-to-r from-[#dc2626] to-[#ef4444] hover:from-[#b91c1c] hover:to-[#dc2626] px-2.5 sm:px-3 py-1 sm:py-1.5 text-[11px] sm:text-xs font-bold text-white shadow-sm transition cursor-pointer"
          >
            <span>⚡</span>
            <span>Get Premium</span>
          </button>

          {onChangeMode && (
            <button
              type="button"
              onClick={() => onChangeMode(mode === 'video' ? 'text' : 'video')}
              className="ml-auto inline-flex items-center gap-1 text-[10px] sm:text-[11px] font-semibold text-[#ef4444] dark:text-[#f87171] hover:underline cursor-pointer"
            >
              {mode === 'video' ? 'Switch to Text' : 'Switch to Video'}
            </button>
          )}
        </div>

        {/* Main Start / Stop button, Skip button, and text input */}
        <div className="flex items-center gap-2">
          {/* Start / Stop Button */}
          <button
            type="button"
            onClick={handleOmegleStop}
            className={`flex h-11 sm:h-12 w-20 sm:w-24 shrink-0 flex-col items-center justify-center rounded-xl font-extrabold text-xs text-white transition active:scale-95 shadow-md shadow-red-600/25 cursor-pointer ${
              stopPhase === 'really'
                ? 'bg-amber-500 hover:bg-amber-600 animate-pulse'
                : isConnected
                  ? 'bg-rose-600 hover:bg-rose-700'
                  : isSearching
                    ? 'bg-neutral-800 hover:bg-neutral-700 border border-white/20'
                    : 'bg-gradient-to-r from-[#dc2626] to-[#ef4444] hover:from-[#b91c1c] hover:to-[#dc2626]'
            }`}
          >
            <span className="leading-tight">
              {stopPhase === 'really'
                ? 'Really?'
                : isSearching
                  ? 'Stop'
                  : isConnected
                    ? 'Stop'
                    : 'Start'}
            </span>
            <span className="text-[9px] sm:text-[10px] font-mono opacity-80 leading-tight">Esc</span>
          </button>

          {/* Skip Button */}
          <button
            type="button"
            onClick={handleNext}
            disabled={!isConnected && !isSearching}
            className="flex h-11 sm:h-12 px-3 sm:px-4 shrink-0 items-center justify-center gap-1.5 rounded-xl font-extrabold text-xs text-neutral-800 dark:text-white bg-neutral-100 hover:bg-neutral-200 dark:bg-white/10 dark:hover:bg-white/20 border border-neutral-200 dark:border-white/10 transition active:scale-95 disabled:opacity-40 disabled:cursor-not-allowed cursor-pointer"
            title="Skip to next stranger"
          >
            <svg className="h-4 w-4" viewBox="0 0 24 24" fill="currentColor">
              <path d="M5.05 5.05a1 1 0 0 1 1.41 0l7.07 7.07-7.07 7.07a1 1 0 0 1-1.41-1.41L10.71 12 5.05 6.46a1 1 0 0 1 0-1.41zm8 0a1 1 0 0 1 1.41 0l7.07 7.07-7.07 7.07a1 1 0 0 1-1.41-1.41L18.71 12l-5.66-5.54a1 1 0 0 1 0-1.41z" />
            </svg>
            <span>Skip</span>
          </button>

          <form onSubmit={handleSendMessage} className="flex flex-1 items-center gap-2">
            <div className="relative flex-1">
              <input
                value={chatInput}
                onChange={(e) => handleChatInput(e.target.value)}
                placeholder={isConnected ? 'Type your message and press Enter...' : isSearching ? 'Looking for match… you can type here' : 'Start chat to message…'}
                className="h-11 sm:h-12 w-full rounded-xl border border-neutral-200 dark:border-white/10 bg-white dark:bg-white/[0.04] pl-3 sm:pl-4 pr-10 text-xs sm:text-sm text-neutral-900 dark:text-white placeholder:text-neutral-400 dark:placeholder:text-neutral-500 outline-none focus:border-[#ef4444] focus:ring-2 focus:ring-[#ef4444]/20 transition"
              />
              <button
                type="submit"
                disabled={!chatInput.trim()}
                aria-label="Send message"
                className="absolute right-2 sm:right-2.5 top-1/2 -translate-y-1/2 flex h-8 w-8 items-center justify-center rounded-lg bg-red-600 hover:bg-red-700 text-white disabled:opacity-30 disabled:bg-neutral-300 dark:disabled:bg-white/10 dark:disabled:text-neutral-500 transition cursor-pointer"
              >
                <svg className="h-4 w-4 rotate-45 -translate-y-0.5 -translate-x-0.5" viewBox="0 0 24 24" fill="currentColor">
                  <path d="M2.01 21L23 12 2.01 3 2 10l15 2-15 2z" />
                </svg>
              </button>
            </div>
          </form>
        </div>
      </div>
    </div>
  );

  /* ---------------- Mobile Immersive Video Layout (< lg) ---------------- */
  const mobileVideoLayout = (
    <div className="relative flex lg:hidden h-full min-h-0 flex-1 w-full overflow-hidden bg-black select-none">
      {/* 1. Main Background Video (Stranger or Live Preview) */}
      <div
        onClick={() => {
          if (!isPro && !remoteStream) {
            handleOpenPaymentDirectly();
          }
        }}
        className={`absolute inset-0 h-full w-full overflow-hidden bg-black ${
          !isPro && !remoteStream ? 'cursor-pointer' : ''
        }`}
      >
        <StreamVideo stream={remoteStream} className="h-full w-full object-cover" />

        {!remoteStream && (
          <div className="absolute inset-0 overflow-hidden bg-black select-none">
            {/* Rotating live stream preview images */}
            {PREVIEW_STREAMS.map((item, idx) => (
              <div
                key={item.id}
                className={`absolute inset-0 transition-opacity duration-1000 ${
                  idx === previewIndex ? 'opacity-100' : 'opacity-0 pointer-events-none'
                }`}
              >
                <img
                  src={item.src}
                  alt={`Live video stream ${item.id}`}
                  className={`h-full w-full object-cover transition-transform duration-3000 ${
                    isPro
                      ? 'filter-none scale-100'
                      : 'filter blur-[16px] brightness-75 contrast-125 scale-110'
                  }`}
                />
              </div>
            ))}

            {/* Central Overlay Actions (Searching / Locked / Failed) */}
            <div className="absolute inset-0 z-10 flex flex-col items-center justify-center p-4 text-center">
              {isSearching ? (
                <div className="flex flex-col items-center gap-2.5 rounded-3xl bg-black/85 backdrop-blur-md p-5 border border-white/15 shadow-2xl max-w-xs">
                  <div className="h-9 w-9 animate-spin rounded-full border-3 border-red-500/20 border-t-red-500" />
                  <p className="text-xs font-bold text-white leading-tight">Looking for someone to chat with…</p>
                  <p className="text-[10px] text-neutral-400">Searching matching queue…</p>
                  {!isPro && (
                    <button
                      type="button"
                      onClick={(e) => handleOpenPaymentDirectly(e)}
                      className="mt-1 inline-flex items-center gap-1.5 rounded-xl bg-gradient-to-r from-red-600 to-rose-600 hover:from-red-700 hover:to-rose-700 px-3.5 py-1.5 text-xs font-black text-white shadow-md shadow-red-600/30 transition cursor-pointer"
                    >
                      <SparklesIcon size={13} />
                      <span>Upgrade for Pro Plan — ₹299</span>
                    </button>
                  )}
                </div>
              ) : state === 'failed' ? (
                <div className="flex flex-col items-center gap-2 rounded-2xl bg-black/85 backdrop-blur-md p-4 border border-rose-500/30 max-w-xs">
                  <CameraOff01Icon size={24} className="text-rose-400" />
                  <p className="text-xs font-bold text-rose-400">{statusMessage || 'Camera access needed'}</p>
                  <div className="flex items-center gap-2 mt-1">
                    <button
                      type="button"
                      onClick={(e) => {
                        e.stopPropagation();
                        handleRequestPermissions('user_action');
                      }}
                      className="inline-flex items-center gap-1 rounded-xl bg-gradient-to-r from-[#dc2626] to-[#ef4444] px-3.5 py-1.5 text-xs font-bold text-white shadow-md transition cursor-pointer"
                    >
                      <RefreshIcon size={14} />
                      <span>Enable Camera</span>
                    </button>
                    {onChangeMode && (
                      <button
                        type="button"
                        onClick={(e) => {
                          e.stopPropagation();
                          onChangeMode('text');
                        }}
                        className="inline-flex items-center gap-1 rounded-xl border border-white/20 bg-white/10 px-3 py-1.5 text-xs font-bold text-white transition cursor-pointer"
                      >
                        <span>Text Chat</span>
                      </button>
                    )}
                  </div>
                </div>
              ) : !isPro ? (
                <div className="flex flex-col items-center gap-2 rounded-3xl bg-black/85 backdrop-blur-md p-5 border border-white/15 shadow-2xl max-w-xs">
                  <div className="flex h-11 w-11 items-center justify-center rounded-2xl bg-gradient-to-br from-red-500 to-rose-600 text-white shadow-md">
                    <LockIcon size={22} />
                  </div>

                  <div className="space-y-0.5">
                    <h3 className="text-sm font-black text-white tracking-tight leading-tight">
                      Live Video Blurred
                    </h3>
                    <p className="text-[11px] text-neutral-300 leading-tight">
                      Upgrade to Pro Plan to unlock clear HD live video of girls.
                    </p>
                  </div>

                  <button
                    type="button"
                    onClick={(e) => handleOpenPaymentDirectly(e)}
                    className="mt-1 w-full flex items-center justify-center gap-1.5 rounded-xl bg-gradient-to-r from-red-600 via-rose-600 to-red-500 px-4 py-2.5 text-xs font-black text-white shadow-md transition active:scale-95 cursor-pointer"
                  >
                    <SparklesIcon size={14} />
                    <span>Unlock with Pro — ₹299</span>
                  </button>

                  <button
                    type="button"
                    onClick={(e) => {
                      e.stopPropagation();
                      handleStartSearch();
                    }}
                    className="inline-flex items-center gap-1 text-[11px] font-semibold text-neutral-400 hover:text-white transition cursor-pointer"
                  >
                    <PlayIcon size={12} />
                    <span>Start Match</span>
                  </button>
                </div>
              ) : (
                <div className="flex flex-col items-center gap-2 rounded-2xl bg-black/75 backdrop-blur-md p-4 border border-emerald-500/30 text-center max-w-xs">
                  <span className="text-xs font-bold text-emerald-400">👑 Pro HD Active</span>
                  <button
                    type="button"
                    onClick={(e) => {
                      e.stopPropagation();
                      handleStartSearch();
                    }}
                    className="mt-1 inline-flex items-center gap-1 rounded-xl bg-gradient-to-r from-red-600 to-rose-600 px-4 py-2 text-xs font-bold text-white shadow-md transition cursor-pointer"
                  >
                    <PlayIcon size={14} />
                    <span>Start Match</span>
                  </button>
                </div>
              )}
            </div>
          </div>
        )}

        {/* Gradient Scrims for text readability */}
        <div className="absolute inset-x-0 top-0 h-28 bg-gradient-to-b from-black/80 via-black/30 to-transparent pointer-events-none z-10" />
        <div className="absolute inset-x-0 bottom-0 h-48 bg-gradient-to-t from-black/95 via-black/60 to-transparent pointer-events-none z-10" />

        {/* Watermark badge */}
        <div className="absolute bottom-28 right-3 z-20 flex items-center gap-1 rounded-full bg-black/60 backdrop-blur-md px-2 py-0.5 text-[10px] font-bold text-white/80 border border-white/10 shadow-sm">
          <span className="text-[#ef4444]">●</span>
          <span>u-r-live.com</span>
        </div>
      </div>

      {/* 2. Floating Self-Camera PiP ("You") in Top-Right Corner */}
      <div className="absolute top-14 right-3 z-30 w-28 sm:w-32 h-38 sm:h-44 rounded-3xl overflow-hidden border-2 border-white/30 bg-black/90 shadow-2xl backdrop-blur-md select-none">
        {localStream ? (
          <StreamVideo stream={localStream} muted mirrored className="h-full w-full object-cover" />
        ) : (
          <div className="h-full w-full flex flex-col items-center justify-center p-2 text-center bg-[#100e19]">
            <CameraOff01Icon size={20} className="text-neutral-500 mb-1" />
            <span className="text-[10px] font-bold text-white/70">Cam Off</span>
            <button
              type="button"
              onClick={() => handleRequestPermissions('user_action')}
              className="mt-1.5 rounded-full bg-gradient-to-r from-red-600 to-rose-600 px-2.5 py-1 text-[9px] font-black text-white shadow-md cursor-pointer active:scale-95"
            >
              Turn On
            </button>
          </div>
        )}

        {!isCamOn && localStream && (
          <div className="absolute inset-0 flex flex-col items-center justify-center bg-black/85 backdrop-blur-sm">
            <CameraOff01Icon size={22} className="text-white/60 mb-0.5" />
            <span className="text-[9px] font-bold text-white/70">Cam Off</span>
          </div>
        )}

        {/* Top Badge: "You" matching screenshot */}
        <div className="absolute top-2 left-2 flex items-center gap-1.5 rounded-full bg-black/75 backdrop-blur-md px-2 py-0.5 text-[10px] font-black text-white shadow-md border border-white/15">
          <span className="h-2 w-2 rounded-full bg-emerald-400 shadow-sm shadow-emerald-400/50" />
          <span>You</span>
          <span>{currentCountryObj.flag || '🇮🇳'}</span>
        </div>

        {/* Bottom Quick Controls (Mic & Cam toggles) */}
        <div className="absolute bottom-2 right-2 flex items-center gap-1.5">
          <button
            type="button"
            onClick={handleToggleMic}
            className={`flex h-6 w-6 items-center justify-center rounded-full backdrop-blur-md text-[11px] shadow-md transition cursor-pointer active:scale-90 ${
              isMicOn ? 'bg-black/75 text-white border border-white/15' : 'bg-red-600 text-white'
            }`}
            title={isMicOn ? 'Mute' : 'Unmute'}
          >
            {isMicOn ? <Mic01Icon size={11} /> : <MicOff01Icon size={11} />}
          </button>
          <button
            type="button"
            onClick={handleToggleCam}
            className={`flex h-6 w-6 items-center justify-center rounded-full backdrop-blur-md text-[11px] shadow-md transition cursor-pointer active:scale-90 ${
              isCamOn ? 'bg-black/75 text-white border border-white/15' : 'bg-red-600 text-white'
            }`}
            title={isCamOn ? 'Turn off camera' : 'Turn on camera'}
          >
            {isCamOn ? <CameraVideoIcon size={11} /> : <CameraOff01Icon size={11} />}
          </button>
        </div>
      </div>

      {/* 3. Top Header Bar Overlay (Mobbin Style matching reference) */}
      <div className="absolute top-2.5 left-3 right-3 z-30 flex items-center justify-between pointer-events-auto select-none">
        {/* Left: Home link + Stranger Info Capsule + Viewer Count */}
        <div className="flex items-center gap-1.5 sm:gap-2">
          <Link
            to="/"
            className="flex h-9 w-9 items-center justify-center rounded-full bg-black/60 backdrop-blur-2xl border border-white/20 text-white hover:text-white transition active:scale-90 shadow-xl cursor-pointer"
            title="Leave / Return to Home"
          >
            <ArrowLeft01Icon size={18} />
          </Link>

          <div className="flex items-center gap-2 rounded-full bg-black/60 backdrop-blur-2xl border border-white/20 pl-1.5 pr-3 py-1 shadow-xl">
            <div className="relative flex h-7 w-7 items-center justify-center rounded-full bg-gradient-to-tr from-rose-500 via-red-500 to-amber-500 text-white text-xs font-black shadow-inner ring-1 ring-white/30">
              {partner?.name ? partner.name.charAt(0).toUpperCase() : '👤'}
              <span className={`absolute -bottom-0.5 -right-0.5 h-2 w-2 rounded-full border border-black ${isConnected ? 'bg-emerald-400' : isSearching ? 'bg-amber-400' : 'bg-neutral-500'}`} />
            </div>
            <div className="flex flex-col">
              <div className="flex items-center gap-1">
                <span className="text-xs font-black text-white leading-tight">
                  {partner?.name || (isConnected ? 'Stranger' : isSearching ? 'Matching…' : 'UR Live')}
                </span>
                <span className="text-xs leading-none">
                  {partnerCountryObj.flag || (partner?.country ? '' : '🌍')}
                </span>
              </div>
              <span className="text-[9px] font-semibold text-neutral-300 leading-tight">
                {isConnected ? 'Connected' : isSearching ? 'Looking for match…' : 'Ready'}
              </span>
            </div>
          </div>

          {/* Live Viewers Chip */}
          <div className="hidden xs:flex items-center gap-1 rounded-full bg-black/50 backdrop-blur-xl border border-white/15 px-2.5 py-1 text-[10px] font-bold text-white/90 shadow-lg">
            <span className="text-red-500">🔥</span>
            <span>15.4K</span>
          </div>
        </div>

        {/* Right: Timer & Hangup Pill + Controls */}
        <div className="flex items-center gap-1.5">
          {/* Flip camera */}
          {localStream && (
            <button
              type="button"
              onClick={handleFlipCamera}
              className="flex h-9 w-9 items-center justify-center rounded-full bg-black/60 backdrop-blur-2xl border border-white/20 text-white shadow-xl transition active:scale-90 cursor-pointer"
              title="Flip camera"
            >
              <RefreshIcon size={15} />
            </button>
          )}

          {/* Theme toggle */}
          <button
            type="button"
            onClick={toggleTheme}
            className="flex h-9 w-9 items-center justify-center rounded-full bg-black/60 backdrop-blur-2xl border border-white/20 text-white shadow-xl transition active:scale-90 cursor-pointer"
            title="Toggle light or dark theme"
          >
            {theme === 'dark' ? <Sun02Icon size={15} /> : <Moon02Icon size={15} />}
          </button>

          {/* Timer capsule + End Call button (Exact screenshot match) */}
          {isConnected && (
            <div className="flex items-center gap-1.5 rounded-full bg-black/60 backdrop-blur-2xl border border-white/20 pl-2.5 pr-1 py-1 shadow-xl">
              <div className="flex items-center gap-1 text-xs font-mono font-black text-white">
                <span className="h-2 w-2 rounded-full bg-red-500 animate-ping" />
                <span>{formatTimer(elapsedSeconds)}</span>
              </div>
              <button
                type="button"
                onClick={handleOmegleStop}
                className="flex h-7 w-7 items-center justify-center rounded-full bg-rose-600 hover:bg-rose-700 text-white shadow transition active:scale-90 cursor-pointer"
                title="End video call"
              >
                <svg className="h-3.5 w-3.5" viewBox="0 0 24 24" fill="currentColor">
                  <path d="M12 2C6.47 2 2 6.47 2 12s4.47 10 10 10 10-4.47 10-10S17.53 2 12 2zm4.3 14.3a.996.996 0 01-1.41 0L12 13.41 9.11 16.3a.996.996 0 11-1.41-1.41L10.59 12 7.7 9.11A.996.996 0 119.11 7.7L12 10.59l2.89-2.89a.996.996 0 111.41 1.41L13.41 12l2.89 2.89c.38.38.38 1.02 0 1.41z" />
                </svg>
              </button>
            </div>
          )}

          {!isPro && (
            <button
              type="button"
              onClick={handleOpenPaymentDirectly}
              className="flex items-center gap-1 rounded-full bg-gradient-to-r from-red-600 to-rose-600 px-2.5 py-1 text-[11px] font-black text-white shadow-xl shadow-red-600/30 transition active:scale-95 cursor-pointer"
            >
              <SparklesIcon size={12} />
              <span>₹299</span>
            </button>
          )}
        </div>
      </div>

      {/* Floating Stranger Disconnected Banner */}
      {state === 'remote_disconnected' && (
        <div className="absolute top-20 inset-x-4 z-30 mx-auto max-w-xs rounded-3xl bg-black/90 backdrop-blur-xl p-4 border border-rose-500/40 text-center shadow-2xl animate-in fade-in zoom-in-95">
          <p className="text-xs font-bold text-rose-400">Stranger has disconnected.</p>
          <button
            type="button"
            onClick={handleNext}
            className="mt-2 inline-flex items-center gap-1.5 rounded-full bg-gradient-to-r from-red-600 to-rose-600 px-4 py-1.5 text-xs font-black text-white shadow-lg active:scale-95 cursor-pointer"
          >
            <span>Tap Skip for next match</span>
            <span>➔</span>
          </button>
        </div>
      )}

      {/* 4. Floating Live Text Chat (Overlaid on Bottom-Left - Screenshot Style) */}
      <div className="absolute bottom-[120px] left-3 max-w-[82%] z-20 pointer-events-none flex flex-col justify-end">
        <div className="pointer-events-auto max-h-48 overflow-y-auto space-y-1.5 pr-1 scrollbar-none flex flex-col justify-end">
          {messages.length === 0 ? (
            <div className="inline-flex items-center gap-2 rounded-2xl bg-black/55 backdrop-blur-xl px-3 py-1.5 border border-white/15 text-white/80 text-xs shadow-xl">
              <span>👋 Say hello to start chatting!</span>
            </div>
          ) : (
            messages.slice(-8).map((msg) => (
              <div
                key={msg.id}
                className="inline-flex items-center gap-2 rounded-2xl bg-black/55 backdrop-blur-xl px-3 py-1.5 border border-white/15 text-white shadow-xl text-xs leading-snug break-words max-w-full animate-in fade-in slide-in-from-bottom-2 duration-150"
              >
                <div
                  className={`flex h-5 w-5 shrink-0 items-center justify-center rounded-full text-[10px] font-black ${
                    msg.isLocal ? 'bg-red-500 text-white' : 'bg-amber-400 text-black'
                  }`}
                >
                  {msg.isLocal ? 'Y' : (partner?.name ? partner.name.charAt(0).toUpperCase() : 'S')}
                </div>
                <div className="flex items-baseline gap-1.5 flex-wrap">
                  <span className={`font-bold shrink-0 ${msg.isLocal ? 'text-red-400' : 'text-amber-300'}`}>
                    {msg.isLocal ? 'You:' : (partner?.name || 'Stranger') + ':'}
                  </span>
                  <span className="text-white/95 font-medium">{msg.text}</span>
                </div>
              </div>
            ))
          )}

          {peerTyping && (
            <div className="inline-flex items-center gap-2 rounded-full bg-black/60 backdrop-blur-xl px-3 py-1 border border-white/15 text-white/90 text-xs shadow-lg animate-pulse">
              <span className="flex h-2 w-2 rounded-full bg-emerald-400 animate-ping" />
              <span className="text-[11px] font-semibold">{partner?.name || 'Stranger'} is typing…</span>
            </div>
          )}

          <div ref={mobileChatEndRef} />
        </div>
      </div>

      {/* 5. Bottom Action Controls: Start/Stop, Skip, Smart Match, and Text Input */}
      <div className="absolute bottom-0 inset-x-0 z-30 p-3 pt-2 pb-[max(0.75rem,env(safe-area-inset-bottom))] bg-gradient-to-t from-black via-black/85 to-transparent flex flex-col gap-2 pointer-events-auto">
        {/* Row 1: Start / Stop Button + Skip Button + Smart Match Filter */}
        <div className="flex items-center gap-2">
          {/* Start / Stop Button */}
          <button
            type="button"
            onClick={handleOmegleStop}
            className={`flex-1 flex items-center justify-center gap-2 rounded-full py-2.5 px-4 text-xs font-black text-white shadow-xl transition active:scale-95 cursor-pointer ${
              stopPhase === 'really'
                ? 'bg-amber-500 hover:bg-amber-600 animate-pulse'
                : isConnected
                  ? 'bg-gradient-to-r from-red-600 to-rose-600 hover:from-red-700 hover:to-rose-700 shadow-red-600/40'
                  : isSearching
                    ? 'bg-neutral-800 hover:bg-neutral-700 border border-white/20'
                    : 'bg-gradient-to-r from-red-600 via-rose-600 to-red-500 hover:from-red-700 hover:to-rose-700 shadow-red-600/40'
            }`}
          >
            {isConnected || isSearching ? (
              <>
                <span className="flex h-2 w-2 rounded-full bg-white animate-pulse" />
                <span>{stopPhase === 'really' ? 'Really Stop?' : 'Stop'}</span>
              </>
            ) : (
              <>
                <PlayIcon size={14} />
                <span>Start Video</span>
              </>
            )}
          </button>

          {/* Skip Button */}
          <button
            type="button"
            onClick={handleNext}
            disabled={!isConnected && !isSearching}
            className="flex-1 flex items-center justify-center gap-1.5 rounded-full bg-white/20 hover:bg-white/30 backdrop-blur-xl border border-white/30 py-2.5 px-4 text-xs font-black text-white shadow-xl transition active:scale-95 disabled:opacity-40 disabled:cursor-not-allowed cursor-pointer"
          >
            <svg className="h-4 w-4" viewBox="0 0 24 24" fill="currentColor">
              <path d="M5.05 5.05a1 1 0 0 1 1.41 0l7.07 7.07-7.07 7.07a1 1 0 0 1-1.41-1.41L10.71 12 5.05 6.46a1 1 0 0 1 0-1.41zm8 0a1 1 0 0 1 1.41 0l7.07 7.07-7.07 7.07a1 1 0 0 1-1.41-1.41L18.71 12l-5.66-5.54a1 1 0 0 1 0-1.41z" />
            </svg>
            <span>Skip</span>
          </button>

          {/* Smart Match Filter */}
          <button
            type="button"
            onClick={() => setShowCountryModal(true)}
            className="flex h-10 w-10 items-center justify-center rounded-full bg-white/15 hover:bg-white/25 backdrop-blur-xl border border-white/25 text-white shadow-xl transition active:scale-95 cursor-pointer shrink-0"
            title="Filter Country"
          >
            <span className="text-base">{currentCountryObj.flag || '🌍'}</span>
          </button>
        </div>

        {/* Row 2: Text UI Input (Matching screenshot glass pill + send button) */}
        <form onSubmit={handleSendMessage} className="flex items-center gap-2 w-full">
          <div className="relative flex-1 flex items-center">
            <input
              value={chatInput}
              onChange={(e) => handleChatInput(e.target.value)}
              placeholder={isConnected ? 'Type here…' : isSearching ? 'Connecting… type here' : 'Type here…'}
              className="h-11 sm:h-12 w-full rounded-full border border-white/25 bg-black/60 backdrop-blur-2xl pl-4 pr-12 text-xs sm:text-sm text-white placeholder-white/50 focus:border-red-500 focus:ring-2 focus:ring-red-500/30 outline-none shadow-2xl transition"
            />
            <button
              type="submit"
              disabled={!chatInput.trim()}
              aria-label="Send message"
              className="absolute right-1.5 top-1/2 -translate-y-1/2 flex h-8 w-8 items-center justify-center rounded-full bg-white text-black hover:bg-red-500 hover:text-white disabled:opacity-30 disabled:hover:bg-white disabled:hover:text-black transition active:scale-90 cursor-pointer shadow-md"
            >
              <svg className="h-4 w-4 rotate-45 -translate-y-0.5 -translate-x-0.5" viewBox="0 0 24 24" fill="currentColor">
                <path d="M2.01 21L23 12 2.01 3 2 10l15 2-15 2z" />
              </svg>
            </button>
          </div>
        </form>
      </div>
    </div>
  );

  return (
    <div className="relative flex h-full min-h-0 flex-1 flex-col bg-[#faf8f8] dark:bg-[#0c0809] text-neutral-900 dark:text-neutral-100 transition-colors">
      {/* Workspace */}
      {mode === 'text' ? (
        <div className="mx-auto flex min-h-0 w-full max-w-4xl flex-1 flex-col p-2 sm:p-4">
          {/* Top Bar for Text Mode on both Mobile & Desktop */}
          <div className="mb-2 flex items-center justify-between px-1 shrink-0 select-none">
            <div className="flex items-center gap-2">
              <Link
                to="/"
                className="flex h-9 w-9 items-center justify-center rounded-xl border border-neutral-200 dark:border-white/10 bg-white dark:bg-white/[0.04] text-neutral-700 dark:text-neutral-200 hover:bg-neutral-100 dark:hover:bg-white/[0.08] transition active:scale-95 shadow-sm cursor-pointer"
                title="Return to Home"
              >
                <ArrowLeft01Icon size={16} />
              </Link>
              <div className="flex items-center gap-2">
                <span className="font-extrabold text-sm sm:text-base text-neutral-900 dark:text-white">
                  Text Chat
                </span>
                <span className={`inline-flex items-center gap-1.5 rounded-full px-2.5 py-0.5 text-[11px] font-bold ${
                  isConnected
                    ? 'bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border border-emerald-500/20'
                    : isSearching
                      ? 'bg-amber-500/10 text-amber-600 dark:text-amber-400 border border-amber-500/20 animate-pulse'
                      : 'bg-neutral-500/10 text-neutral-600 dark:text-neutral-400'
                }`}>
                  <span className={`h-1.5 w-1.5 rounded-full ${isConnected ? 'bg-emerald-500 animate-ping' : isSearching ? 'bg-amber-500' : 'bg-neutral-400'}`} />
                  <span>{isConnected ? 'Connected' : isSearching ? 'Searching…' : 'Idle'}</span>
                </span>
              </div>
            </div>

            <div className="flex items-center gap-2">
              {onChangeMode && (
                <button
                  type="button"
                  onClick={() => onChangeMode('video')}
                  className="flex items-center gap-1.5 rounded-xl border border-red-500/30 bg-red-500/10 hover:bg-red-500/20 px-3 py-1.5 text-xs font-bold text-red-600 dark:text-red-400 transition active:scale-95 cursor-pointer shadow-sm"
                >
                  <CameraVideoIcon size={14} />
                  <span>Switch to Video</span>
                </button>
              )}
              <button
                type="button"
                onClick={toggleTheme}
                className="flex h-9 w-9 items-center justify-center rounded-xl border border-neutral-200 dark:border-white/10 bg-white dark:bg-white/[0.04] text-neutral-600 dark:text-neutral-300 hover:bg-neutral-100 dark:hover:bg-white/[0.08] transition active:scale-95 shadow-sm cursor-pointer"
                aria-label="Toggle theme"
              >
                {theme === 'dark' ? <Sun02Icon size={16} /> : <Moon02Icon size={16} />}
              </button>
            </div>
          </div>

          {chatPane}
        </div>
      ) : (
        <>
          {mobileVideoLayout}

          <div className="hidden lg:flex mx-auto min-h-0 w-full max-w-[1600px] flex-1 flex-row gap-4 p-4">
            {/* Video Container: stacked column on desktop */}
            <div className="h-full w-[480px] xl:w-[520px] flex flex-col gap-3 shrink-0">
            {/* Box 1: Stranger Video */}
            <div
              ref={stageRef}
              onClick={() => {
                if (!isPro && !remoteStream) {
                  handleOpenPaymentDirectly();
                }
              }}
              className={`relative h-full lg:flex-1 lg:min-h-[240px] xl:min-h-[280px] rounded-2xl overflow-hidden bg-[#1e1d24] border border-neutral-200/80 dark:border-white/10 shadow-sm ${
                !isPro && !remoteStream ? 'cursor-pointer' : ''
              }`}
            >
              <StreamVideo stream={remoteStream} className="h-full w-full object-cover" />

              {!remoteStream && (
                <div className="absolute inset-0 overflow-hidden bg-black select-none">
                  {/* Rotating live stream preview images */}
                  {PREVIEW_STREAMS.map((item, idx) => (
                    <div
                      key={item.id}
                      className={`absolute inset-0 transition-opacity duration-1000 ${
                        idx === previewIndex ? 'opacity-100' : 'opacity-0 pointer-events-none'
                      }`}
                    >
                      <img
                        src={item.src}
                        alt={`Live video stream ${item.id}`}
                        className={`h-full w-full object-cover transition-transform duration-3000 ${
                          isPro
                            ? 'filter-none scale-100'
                            : 'filter blur-[16px] brightness-75 contrast-125 scale-110'
                        }`}
                      />
                    </div>
                  ))}

                  {/* Top Overlay: Live badge & viewer count */}
                  <div className="absolute top-2 left-2 right-2 sm:top-3 sm:left-3 sm:right-3 z-20 flex items-center justify-between pointer-events-none">
                    <div className="flex items-center gap-1 sm:gap-2">
                      <span className="flex items-center gap-1 sm:gap-1.5 rounded-full bg-red-600/90 backdrop-blur px-1.5 sm:px-2.5 py-0.5 text-[9px] sm:text-[10px] font-black uppercase tracking-wider text-white shadow-md">
                        <span className="h-1.5 w-1.5 rounded-full bg-white animate-ping" />
                        LIVE
                      </span>
                      <span className="rounded-full bg-black/60 backdrop-blur px-1.5 sm:px-2 py-0.5 text-[9px] sm:text-[10px] font-semibold text-neutral-300">
                        {PREVIEW_STREAMS[previewIndex].viewers}
                      </span>
                    </div>

                    {isPro ? (
                      <span className="flex items-center gap-1 rounded-full bg-amber-500/95 backdrop-blur px-1.5 sm:px-2.5 py-0.5 text-[9px] sm:text-[10px] font-black text-black shadow-md">
                        <SparklesIcon size={10} className="sm:size-[12px]" />
                        PRO
                      </span>
                    ) : (
                      <span className="rounded-full bg-black/60 backdrop-blur px-2 py-0.5 text-[9px] sm:text-[10px] font-bold text-neutral-300">
                        1080p
                      </span>
                    )}
                  </div>

                  {/* Central Overlay Actions */}
                  <div className="absolute inset-0 z-20 flex flex-col items-center justify-center p-2 sm:p-4 text-center">
                    {isSearching ? (
                      <div className="flex flex-col items-center gap-1.5 sm:gap-2.5 rounded-2xl sm:rounded-3xl bg-black/85 backdrop-blur-md p-2.5 sm:p-5 border border-white/15 shadow-2xl max-w-[95%] sm:max-w-xs">
                        <div className="h-6 w-6 sm:h-9 sm:w-9 animate-spin rounded-full border-2 sm:border-3 border-red-500/20 border-t-red-500" />
                        <p className="text-[11px] sm:text-xs font-bold text-white leading-tight">Searching…</p>
                        <p className="text-[10px] text-neutral-400 hidden sm:block">Matching queue…</p>
                        {!isPro && (
                          <button
                            type="button"
                            onClick={(e) => handleOpenPaymentDirectly(e)}
                            className="mt-1 inline-flex items-center gap-1 rounded-lg sm:rounded-xl bg-gradient-to-r from-red-600 to-rose-600 hover:from-red-700 hover:to-rose-700 px-2 sm:px-3.5 py-1 sm:py-1.5 text-[10px] sm:text-[11px] font-black text-white shadow-md shadow-red-600/30 transition cursor-pointer"
                          >
                            <SparklesIcon size={11} className="sm:size-[13px]" />
                            <span>Upgrade ₹299</span>
                          </button>
                        )}
                      </div>
                    ) : state === 'failed' ? (
                      <div className="flex flex-col items-center gap-1.5 sm:gap-2 rounded-2xl bg-black/85 backdrop-blur-md p-2.5 sm:p-4 border border-rose-500/30 max-w-[95%] sm:max-w-xs">
                        <CameraOff01Icon size={20} className="text-rose-400 sm:size-[26px]" />
                        <p className="text-[11px] sm:text-xs font-bold text-rose-400">{statusMessage || 'Camera access needed'}</p>
                        <div className="flex items-center gap-2 mt-1">
                          <button
                            type="button"
                            onClick={(e) => {
                              e.stopPropagation();
                              handleRequestPermissions('user_action');
                            }}
                            className="inline-flex items-center gap-1 rounded-lg sm:rounded-xl bg-gradient-to-r from-[#dc2626] to-[#ef4444] px-2.5 sm:px-4 py-1 sm:py-2 text-[10px] sm:text-xs font-bold text-white shadow-md transition cursor-pointer"
                          >
                            <RefreshIcon size={12} className="sm:size-[14px]" />
                            <span>Enable Camera</span>
                          </button>
                          {onChangeMode && (
                            <button
                              type="button"
                              onClick={(e) => {
                                e.stopPropagation();
                                onChangeMode('text');
                              }}
                              className="inline-flex items-center gap-1 rounded-lg sm:rounded-xl border border-white/20 bg-white/10 px-2.5 sm:px-3 py-1 sm:py-2 text-[10px] sm:text-xs font-bold text-white transition cursor-pointer"
                            >
                              <span>Text Chat</span>
                            </button>
                          )}
                        </div>
                      </div>
                    ) : !isPro ? (
                      <div className="flex flex-col items-center gap-1 sm:gap-2 rounded-2xl sm:rounded-3xl bg-black/85 backdrop-blur-md p-2.5 sm:p-5 border border-white/15 shadow-2xl max-w-[95%] sm:max-w-sm">
                        <div className="flex h-7 w-7 sm:h-11 sm:w-11 items-center justify-center rounded-xl sm:rounded-2xl bg-gradient-to-br from-red-500 to-rose-600 text-white shadow-md">
                          <LockIcon size={14} className="sm:hidden" />
                          <LockIcon size={22} className="hidden sm:block" />
                        </div>

                        <div className="space-y-0.5">
                          <h3 className="text-[11px] sm:text-base font-black text-white tracking-tight leading-tight">
                            Live Blurred
                          </h3>
                          <p className="text-[9px] sm:text-[11px] text-neutral-300 leading-tight hidden sm:block">
                            Click below to upgrade for Pro Plan to unlock clear HD live video.
                          </p>
                        </div>

                        <button
                          type="button"
                          onClick={(e) => handleOpenPaymentDirectly(e)}
                          className="mt-0.5 w-full flex items-center justify-center gap-1 rounded-lg sm:rounded-xl bg-gradient-to-r from-red-600 via-rose-600 to-red-500 px-2 sm:px-4 py-1 sm:py-2.5 text-[10px] sm:text-xs font-black text-white shadow-md transition active:scale-95 cursor-pointer"
                        >
                          <SparklesIcon size={11} className="sm:size-[14px]" />
                          <span>Upgrade ₹299</span>
                        </button>

                        <button
                          type="button"
                          onClick={(e) => {
                            e.stopPropagation();
                            handleStartSearch();
                          }}
                          className="inline-flex items-center gap-1 text-[9px] sm:text-[11px] font-semibold text-neutral-400 hover:text-white transition cursor-pointer"
                        >
                          <PlayIcon size={10} className="sm:size-[12px]" />
                          <span>Start Match</span>
                        </button>
                      </div>
                    ) : (
                      <div className="flex flex-col items-center gap-1.5 sm:gap-2 rounded-2xl bg-black/75 backdrop-blur-md p-2.5 sm:p-4 border border-emerald-500/30 text-center max-w-[95%] sm:max-w-xs">
                        <span className="text-[10px] sm:text-xs font-bold text-emerald-400">👑 Pro HD Active</span>
                        <button
                          type="button"
                          onClick={(e) => {
                            e.stopPropagation();
                            handleStartSearch();
                          }}
                          className="mt-1 inline-flex items-center gap-1 rounded-lg sm:rounded-xl bg-gradient-to-r from-red-600 to-rose-600 px-2.5 sm:px-4 py-1 sm:py-2 text-[10px] sm:text-xs font-bold text-white shadow-md transition cursor-pointer"
                        >
                          <PlayIcon size={12} className="sm:size-[14px]" />
                          <span>Start Match</span>
                        </button>
                      </div>
                    )}
                  </div>
                </div>
              )}

              {/* Watermark badge (Image 2 style) */}
              <div className="absolute bottom-2 left-2 sm:bottom-3 sm:left-3 z-10 flex items-center gap-1 rounded-md bg-black/60 backdrop-blur px-1.5 sm:px-2.5 py-0.5 sm:py-1 text-[9px] sm:text-[11px] font-bold text-white shadow-sm">
                <span className="text-[#ef4444]">💬</span>
                <span>u-r-live.com</span>
              </div>

              {/* Report button (Image 2 style) */}
              {isConnected && (
                <button
                  type="button"
                  onClick={() => partner && onOpenReportModal(partner.id, partner.name)}
                  aria-label="Report stranger"
                  title="Report stranger"
                  className="absolute bottom-2 right-2 sm:bottom-3 sm:right-3 z-10 flex h-7 w-7 sm:h-8 sm:w-8 items-center justify-center rounded-lg bg-black/60 backdrop-blur text-neutral-300 hover:text-rose-400 transition cursor-pointer shadow-sm"
                >
                  <svg className="h-3.5 w-3.5 sm:h-4 sm:w-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                    <path d="M4 15s1-1 4-1 5 2 8 2 4-1 4-1V3s-1 1-4 1-5-2-8-2-4 1-4 1z" />
                    <line x1="4" y1="22" x2="4" y2="15" />
                  </svg>
                </button>
              )}
            </div>

            {/* Box 2: Self preview (Your Camera) */}
            <div className="relative h-full lg:flex-1 lg:min-h-[220px] xl:min-h-[260px] rounded-2xl overflow-hidden bg-black border border-neutral-200/80 dark:border-white/10 shadow-sm">
              {localStream ? (
                <StreamVideo stream={localStream} muted mirrored className="h-full w-full object-cover" />
              ) : (
                <div className="absolute inset-0 flex flex-col items-center justify-center gap-1.5 sm:gap-2.5 bg-[#0b0a14] p-2 sm:p-4 text-center">
                  <div className="flex h-8 w-8 sm:h-12 sm:w-12 items-center justify-center rounded-xl sm:rounded-2xl bg-white/5 border border-white/10 text-neutral-400">
                    <CameraVideoIcon size={16} className="sm:size-[24px]" />
                  </div>
                  <div>
                    <p className="text-[10px] sm:text-xs font-bold text-white">Camera off</p>
                  </div>
                  <button
                    type="button"
                    onClick={() => {
                      handleRequestPermissions('user_action');
                    }}
                    className="inline-flex items-center gap-1 rounded-lg sm:rounded-xl bg-gradient-to-r from-red-600 to-rose-600 px-2.5 sm:px-4 py-1 sm:py-2 text-[10px] sm:text-xs font-bold text-white shadow-md transition cursor-pointer"
                  >
                    <CameraVideoIcon size={12} className="sm:size-[14px]" />
                    <span>Turn On</span>
                  </button>
                </div>
              )}

              {!isCamOn && localStream && (
                <div className="absolute inset-0 flex flex-col items-center justify-center gap-1.5 bg-black/85 backdrop-blur-sm">
                  <CameraOff01Icon size={20} className="text-neutral-400 sm:size-[28px]" />
                  <span className="text-[10px] sm:text-xs font-medium text-neutral-400">Camera Off</span>
                </div>
              )}

              {/* You badge */}
              <span className="absolute left-2 top-2 sm:left-3 sm:top-3 z-10 rounded-md bg-black/60 backdrop-blur px-1.5 sm:px-2 py-0.5 text-[9px] sm:text-[10px] font-bold text-white">
                You
              </span>

              {/* Floating controls */}
              <div className="absolute bottom-2 left-2 sm:bottom-3 sm:left-3 flex items-center gap-1 sm:gap-2 z-10">
                <button
                  type="button"
                  onClick={handleToggleMic}
                  aria-label={isMicOn ? 'Mute microphone' : 'Unmute microphone'}
                  className={`flex h-7 w-7 sm:h-8 sm:w-8 items-center justify-center rounded-full border backdrop-blur transition cursor-pointer ${
                    isMicOn
                      ? 'border-white/20 bg-black/60 text-white hover:bg-black/80'
                      : 'border-rose-400/40 bg-rose-500/30 text-rose-100'
                  }`}
                >
                  {isMicOn ? <Mic01Icon size={12} className="sm:size-[14px]" /> : <MicOff01Icon size={12} className="sm:size-[14px]" />}
                </button>
                <button
                  type="button"
                  onClick={handleToggleCam}
                  aria-label={isCamOn ? 'Turn camera off' : 'Turn camera on'}
                  className={`flex h-7 w-7 sm:h-8 sm:w-8 items-center justify-center rounded-full border backdrop-blur transition cursor-pointer ${
                    isCamOn
                      ? 'border-white/20 bg-black/60 text-white hover:bg-black/80'
                      : 'border-rose-400/40 bg-rose-500/30 text-rose-100'
                  }`}
                >
                  {isCamOn ? <CameraVideoIcon size={12} className="sm:size-[14px]" /> : <CameraOff01Icon size={12} className="sm:size-[14px]" />}
                </button>
              </div>
            </div>
          </div>

          {/* Right Column: Chat Box */}
          {chatPane}
        </div>
      </>
      )}

      {/* ---------- Country / language ---------- */}
      <CountryFilterModal
        isOpen={showCountryModal}
        onClose={() => setShowCountryModal(false)}
        selectedCountry={selectedCountry}
        selectedCountries={selectedCountries}
        onApplyCountries={handleApplyCountries}
        selectedLanguage={selectedLanguage}
        selectedLanguages={selectedLanguages}
        onApplyLanguages={handleApplyLanguages}
        isMultipleEnabled={isMultipleCountries}
        onToggleMultiple={setIsMultipleCountries}
        onReset={handleResetFilters}
      />

      {/* ---------- Pro Plan UPI Payment Modal ---------- */}
      <ProPaymentModal
        isOpen={showProModal}
        initialStep={proModalStep}
        onClose={() => setShowProModal(false)}
        onSuccess={() => {
          setIsPro(true);
        }}
        upiId={import.meta.env.VITE_UPI_ID || 'urlive@slc'}
        amount={Number(import.meta.env.VITE_PRO_PLAN_PRICE) || 299}
      />

      {/* ---------- Camera & Microphone Permission Modal ---------- */}
      <PermissionModal
        isOpen={showPermissionModal}
        errorType={permissionErrorType}
        errorMessage={permissionErrorMessage}
        onClose={() => setShowPermissionModal(false)}
        onRetry={() => handleRequestPermissions('user_action')}
        onSwitchToText={onChangeMode ? () => onChangeMode('text') : undefined}
      />

      {/* ---------- Settings ---------- */}
      {showSettingsModal && (
        <div
          className="fixed inset-0 z-[80] flex items-end justify-center bg-black/75 backdrop-blur-sm sm:items-center sm:p-4"
          onClick={() => setShowSettingsModal(false)}
          role="dialog"
          aria-modal="true"
          aria-label="Audio and video settings"
        >
          <div
            className="surface-strong w-full max-w-md rounded-t-2xl border border-white/10 p-4 sm:rounded-2xl"
            onClick={(event) => event.stopPropagation()}
          >
            <div className="mb-3 flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Settings02Icon size={16} className="text-[#ef4444]" />
                <h2 className="text-sm font-bold text-white">Audio & video</h2>
              </div>
              <button
                type="button"
                onClick={() => setShowSettingsModal(false)}
                aria-label="Close settings"
                className="flex h-7 w-7 items-center justify-center rounded-full border border-white/10 bg-white/[0.05] text-neutral-400 transition hover:text-white"
              >
                <Cancel01Icon size={14} />
              </button>
            </div>

            <label className="mb-1 block text-[10px] font-semibold uppercase tracking-wide text-neutral-500">
              Microphone
            </label>
            <select
              value={selectedAudioInput}
              onChange={(e) => handleAudioInputChange(e.target.value)}
              className="mb-1 h-10 w-full rounded-lg border border-white/10 bg-[#12101c] px-3 text-xs text-neutral-200 outline-none transition focus:border-[#8b5cf6]/50"
            >
              {usableAudioInputs.length === 0 && <option value="default">Default microphone</option>}
              {usableAudioInputs.map((device, index) => (
                <option key={device.deviceId} value={device.deviceId}>
                  {device.label || `Microphone ${index + 1}`}
                </option>
              ))}
            </select>
            {settingsError && (
              <p className="mb-2 text-[10px] text-rose-300">{settingsError}</p>
            )}

            <div className="mt-3 grid grid-cols-2 gap-2">
              <button
                type="button"
                onClick={handleToggleMic}
                className={`flex h-10 items-center justify-center gap-2 rounded-lg border text-[11px] font-semibold transition ${
                  isMicOn
                    ? 'border-white/10 bg-white/[0.05] text-neutral-200 hover:bg-white/[0.1]'
                    : 'border-rose-400/35 bg-rose-500/15 text-rose-200'
                }`}
              >
                {isMicOn ? <Mic01Icon size={14} /> : <MicOff01Icon size={14} />}
                {isMicOn ? 'Mute' : 'Unmute'}
              </button>
              <button
                type="button"
                onClick={handleToggleCam}
                className={`flex h-10 items-center justify-center gap-2 rounded-lg border text-[11px] font-semibold transition ${
                  isCamOn
                    ? 'border-white/10 bg-white/[0.05] text-neutral-200 hover:bg-white/[0.1]'
                    : 'border-rose-400/35 bg-rose-500/15 text-rose-200'
                }`}
              >
                {isCamOn ? <CameraVideoIcon size={14} /> : <CameraOff01Icon size={14} />}
                {isCamOn ? 'Camera off' : 'Camera on'}
              </button>
            </div>

            <p className="mt-3 flex items-start gap-1.5 text-[10px] leading-relaxed text-neutral-500">
              <WebProtectionIcon size={12} className="mt-0.5 shrink-0" />
              Microphone changes apply instantly without dropping the call.
            </p>
          </div>
        </div>
      )}

      {/* ---------- I am ---------- */}
      {showGenderSheet && (
        <div
          className="fixed inset-0 z-[80] flex items-end justify-center bg-black/75 backdrop-blur-sm sm:items-center sm:p-4"
          onClick={() => setShowGenderSheet(false)}
          role="dialog"
          aria-modal="true"
          aria-label="Select your gender"
        >
          <div
            className="surface-strong w-full max-w-md rounded-t-2xl border border-white/10 p-4 sm:rounded-2xl"
            onClick={(event) => event.stopPropagation()}
          >
            <div className="mb-3 flex items-center justify-between">
              <h2 className="text-sm font-bold text-white">I am</h2>
              <button
                type="button"
                onClick={() => setShowGenderSheet(false)}
                aria-label="Close gender selection"
                className="flex h-7 w-7 items-center justify-center rounded-full border border-white/10 bg-white/[0.05] text-neutral-400 transition hover:text-white"
              >
                <Cancel01Icon size={14} />
              </button>
            </div>
            <p className="mb-3 text-[11px] leading-relaxed text-neutral-500">
              This is how you appear to the person you match with. It does not change who you meet.
            </p>
            <div className="grid grid-cols-3 gap-2">
              {GENDER_OPTIONS.map((option) => {
                const active = selfGender === option.value;
                return (
                  <button
                    key={option.value}
                    type="button"
                    disabled={genderSaving}
                    onClick={() => handleSelectGender(option.value)}
                    className={`flex flex-col items-center gap-1.5 rounded-xl border p-2.5 text-center transition disabled:opacity-60 ${
                      active
                        ? 'border-[#ef4444]/60 bg-[#ef4444]/15'
                        : 'border-white/10 bg-white/[0.04] hover:bg-white/[0.08]'
                    }`}
                  >
                    {genderAvatar(option.value, 'h-11 w-11')}
                    <span className="text-[11px] font-semibold text-neutral-100">{option.label}</span>
                    {active && (
                      <span className="inline-flex items-center gap-0.5 text-[9px] font-semibold text-[#f87171]">
                        <CheckmarkCircle01Icon size={10} />
                        Selected
                      </span>
                    )}
                  </button>
                );
              })}
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
