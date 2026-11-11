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
  Message01Icon,
  Mic01Icon,
  MicOff01Icon,
  PlayIcon,
  SentIcon,
  Settings02Icon,
  Share01Icon,
  StopCircleIcon,
  WebProtectionIcon,
} from 'hugeicons-react';
import { WebRTCManager, NetworkQuality, NetworkStats } from '../services/webrtc';
import { WebRTCState, MatchPreferences, ChatMessage, UserProfile, ChatMode } from '../types';
import { api } from '../services/api';
import { COUNTRIES } from '../data/constants';
import { ThreeDMaleAvatar, ThreeDFemaleAvatar, ThreeDOtherAvatar, ThreeDGlobeIcon } from './ThreeDIcons';
import { CountryFilterModal } from './CountryFilterModal';

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
  const managerRef = useRef<WebRTCManager | null>(null);
  const stageRef = useRef<HTMLDivElement>(null);
  const chatEndRef = useRef<HTMLDivElement>(null);
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

  const isSearching = SEARCHING_STATES.includes(state);
  const isConnected = state === 'connected';
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
        setMessages((prev) => [...prev, msg]);
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

    if (user.isAdultVerified) {
      manager.initMedia().catch(() => {});
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
    if (!user.isAdultVerified || selfGender === 'unspecified') {
      if (onOpenOnboarding) onOpenOnboarding();
      else onRequireAgeVerification();
      return false;
    }
    return true;
  };

  const resetConversation = () => {
    setMessages([]);
    setUnreadCount(0);
    setPeerTyping(false);
    setLatestMessageToast(null);
  };

  const handleStartSearch = async () => {
    if (!managerRef.current || !requireVerifiedUser()) return;
    resetConversation();
    setPartner(null);
    setNetwork(null);
    setMobileTab('video');
    try {
      await managerRef.current.findMatch(
        user.id,
        selfGender,
        user.country,
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
    if (!text || !managerRef.current) return;
    managerRef.current.setTyping(false);
    if (typingClearRef.current) clearTimeout(typingClearRef.current);
    if (managerRef.current.sendChatMessage(text, user.id)) {
      setChatInput('');
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
        handleStop();
        setStopPhase('new');
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

  /* ---------------- Chat panel ---------------- */
  const chatBody = (
    <div className="flex min-h-0 flex-1 flex-col font-sans">
      <div className="min-h-0 flex-1 space-y-1.5 overflow-y-auto p-3 text-[13px]">
        {/* Omegle system greeting */}
        <div className="mb-2 rounded-xl border border-white/[0.06] bg-white/[0.02] p-2.5 text-xs text-neutral-400">
          <p className="font-medium text-neutral-300">You're now chatting with a random stranger. Say hi!</p>
          <p className="mt-1 text-[11px] text-neutral-500">Video &amp; text are encrypted peer-to-peer. Keep it clean and respectful.</p>
        </div>

        {/* Shared interests notification */}
        {partner?.sharedInterests && partner.sharedInterests.length > 0 && (
          <div className="mb-3 flex items-center gap-2 rounded-xl border border-amber-400/30 bg-amber-500/15 px-3 py-2 text-xs font-semibold text-amber-200">
            <span className="text-amber-400 shrink-0 text-sm">★</span>
            <span>You both like: {partner.sharedInterests.join(', ')}</span>
          </div>
        )}

        {/* Messages list with classic Omegle You / Stranger styling */}
        {messages.map((msg) => (
          <div key={msg.id} className="leading-relaxed break-words py-0.5">
            {msg.isLocal ? (
              <>
                <strong className="font-bold text-sky-400 mr-1.5 select-none">You:</strong>
                <span className="text-neutral-100">{msg.text}</span>
              </>
            ) : (
              <>
                <strong className="font-bold text-rose-500 mr-1.5 select-none">Stranger:</strong>
                <span className="text-neutral-100">{msg.text}</span>
              </>
            )}
          </div>
        ))}

        {peerTyping && (
          <div className="py-1 text-xs italic text-neutral-400 select-none animate-pulse">
            Stranger is typing…
          </div>
        )}

        {/* Disconnect banners */}
        {state === 'remote_disconnected' && (
          <div className="my-3 rounded-2xl border border-rose-500/30 bg-rose-500/10 p-3.5 text-center">
            <p className="text-sm font-bold text-rose-300">Stranger has disconnected.</p>
            <p className="mt-1 text-xs text-neutral-400">
              Click <strong className="text-white">New</strong> or press{' '}
              <kbd className="rounded bg-black/50 px-1.5 py-0.5 font-mono text-[10px] text-white">Esc</kbd> to find someone new.
            </p>
          </div>
        )}

        {state === 'local_disconnected' && (
          <div className="my-3 rounded-2xl border border-white/10 bg-white/[0.04] p-3.5 text-center">
            <p className="text-sm font-semibold text-neutral-300">You ended the chat.</p>
            <p className="mt-1 text-xs text-neutral-400">
              Click <strong className="text-white">New</strong> or press{' '}
              <kbd className="rounded bg-black/50 px-1.5 py-0.5 font-mono text-[10px] text-white">Esc</kbd> to start another session.
            </p>
          </div>
        )}

        <div ref={chatEndRef} />
      </div>

      <form
        onSubmit={handleSendMessage}
        className="flex shrink-0 items-center gap-2 border-t border-white/[0.08] bg-[#090812] p-2.5"
      >
        <input
          value={chatInput}
          onChange={(e) => handleChatInput(e.target.value)}
          disabled={!isConnected}
          placeholder={isConnected ? 'Type your message and press Enter...' : 'Waiting for connection...'}
          className="h-10 min-w-0 flex-1 rounded-xl border border-white/10 bg-white/[0.04] px-3.5 text-[13px] text-white placeholder:text-neutral-500 outline-none transition focus:border-red-500/50 focus:ring-1 focus:ring-red-500/25 disabled:cursor-not-allowed disabled:opacity-50"
        />
        <button
          type="submit"
          disabled={!isConnected || !chatInput.trim()}
          aria-label="Send message"
          className="flex h-10 px-4 items-center justify-center gap-1 rounded-xl bg-gradient-to-r from-red-600 to-rose-600 font-bold text-xs text-white transition hover:brightness-110 active:scale-95 disabled:cursor-not-allowed disabled:opacity-40"
        >
          <span>Send</span>
          <SentIcon size={14} />
        </button>
      </form>
    </div>
  );

  return (
    <div className="relative flex h-full min-h-0 flex-1 flex-col bg-[#07060d] text-neutral-100">
      {/* ---------- Status strip ---------- */}
      <div className="flex shrink-0 items-center justify-between gap-2 border-b border-white/[0.06] bg-[#0a0812]/70 px-3 py-2 sm:px-4">
        <div className="flex min-w-0 items-center gap-2">
          <span className={`h-2 w-2 shrink-0 rounded-full ${dotClass}`} />
          <span
            className="truncate text-[11px] font-semibold text-neutral-300 sm:text-xs"
            role="status"
            aria-live="polite"
          >
            {statusMessage}
          </span>
          {(isSearching || isConnected) && (
            <span className="inline-flex shrink-0 items-center gap-1 rounded-full border border-white/10 bg-white/[0.04] px-2 py-0.5 font-mono text-[10px] text-neutral-400">
              <Clock01Icon size={11} />
              {formatDuration(displaySeconds)}
            </span>
          )}
        </div>

        <div className="flex shrink-0 items-center gap-1.5">
          {othersWaiting !== null && (
            <span className="hidden items-center gap-1 rounded-full border border-white/10 bg-white/[0.04] px-2 py-1 text-[10px] font-medium text-neutral-400 sm:inline-flex">
              <Globe02Icon size={11} />
              {othersWaiting} waiting
            </span>
          )}
          {user.isAdultVerified && (
            <span className="hidden items-center gap-1 rounded-full border border-emerald-400/25 bg-emerald-500/10 px-2 py-1 text-[10px] font-semibold text-emerald-300 md:inline-flex">
              <CheckmarkCircle01Icon size={11} />
              18+
            </span>
          )}
          <button
            type="button"
            onClick={() => setShowSettingsModal(true)}
            title="Audio and video settings"
            aria-label="Audio and video settings"
            className="inline-flex h-7 w-7 items-center justify-center rounded-full border border-white/10 bg-white/[0.04] text-neutral-300 transition hover:bg-white/[0.1] lg:hidden"
          >
            <Settings02Icon size={12} />
          </button>
          {onChangeMode && (
            <button
              type="button"
              onClick={() => onChangeMode(mode === 'video' ? 'text' : 'video')}
              className="inline-flex h-7 items-center gap-1 rounded-full border border-white/10 bg-white/[0.04] px-2.5 text-[10px] font-semibold text-neutral-300 transition hover:bg-white/[0.1]"
            >
              {mode === 'video' ? (
                <>
                  <Message01Icon size={12} className="text-sky-400" />
                  <span>Switch to Text</span>
                </>
              ) : (
                <>
                  <CameraVideoIcon size={12} className="text-red-400" />
                  <span>Switch to Video</span>
                </>
              )}
            </button>
          )}
          <button
            type="button"
            onClick={handleInvite}
            title="Invite a friend"
            aria-label="Invite a friend"
            className="inline-flex h-7 items-center gap-1 rounded-full border border-white/10 bg-white/[0.04] px-2 text-[10px] font-semibold text-neutral-300 transition hover:bg-white/[0.1]"
          >
            <Share01Icon size={12} />
            <span className="hidden sm:inline">{inviteState === 'copied' ? 'Link copied' : 'Invite'}</span>
          </button>
          <button
            type="button"
            onClick={() => setMobileTab((tab) => (tab === 'chat' ? 'video' : 'chat'))}
            aria-label="Toggle chat"
            className="relative inline-flex h-7 items-center gap-1 rounded-full border border-white/10 bg-white/[0.04] px-2 text-[10px] font-semibold text-neutral-300 transition hover:bg-white/[0.1] lg:hidden"
          >
            <Message01Icon size={12} />
            Chat
            {unreadCount > 0 && (
              <span className="absolute -right-1 -top-1 flex h-4 min-w-4 items-center justify-center rounded-full bg-rose-500 px-1 text-[9px] font-bold text-white">
                {unreadCount > 9 ? '9+' : unreadCount}
              </span>
            )}
          </button>
        </div>
      </div>

      {/* ---------- Workspace ---------- */}
      {mode === 'text' ? (
        <div className="mx-auto flex min-h-0 w-full max-w-4xl flex-1 flex-col gap-3 p-3 sm:p-4">
          <div className="surface-strong flex min-h-0 flex-1 flex-col overflow-hidden rounded-2xl border border-white/10 shadow-2xl">
            <div className="flex shrink-0 items-center justify-between border-b border-white/[0.06] bg-black/40 px-4 py-2.5">
              <div className="flex items-center gap-2">
                <span className="h-2 w-2 rounded-full bg-sky-400 animate-pulse" />
                <span className="text-xs font-bold uppercase tracking-wider text-neutral-300">
                  Omegle Text Mode
                </span>
                {interests && interests.length > 0 && (
                  <span className="ml-2 hidden sm:inline-flex items-center gap-1 rounded-md bg-white/[0.05] px-2 py-0.5 text-[10px] text-neutral-400">
                    Looking for: {interests.slice(0, 3).map((i) => `#${i}`).join(', ')}
                  </span>
                )}
              </div>
              <span className="max-w-[180px] truncate text-xs font-semibold text-neutral-400">
                {partner?.name || (isSearching ? 'Looking for stranger...' : 'Stranger disconnected')}
              </span>
            </div>
            {chatBody}
          </div>

          {/* Primary controls */}
          <div className="grid shrink-0 grid-cols-2 gap-2 sm:grid-cols-4">
            <button
              type="button"
              onClick={handleOmegleStop}
              className={`flex h-12 items-center justify-center gap-1.5 rounded-xl border text-xs font-extrabold transition active:scale-[0.98] ${
                stopPhase === 'really'
                  ? 'border-amber-400 bg-amber-400 text-black shadow-[0_0_20px_rgba(251,191,36,0.6)] animate-pulse'
                  : stopPhase === 'new'
                    ? 'border-sky-400 bg-sky-500 text-white shadow-[0_0_20px_rgba(56,189,248,0.4)] hover:bg-sky-400'
                    : 'border-rose-500/40 bg-rose-600/20 text-rose-200 hover:bg-rose-600/30'
              }`}
            >
              <StopCircleIcon size={16} />
              <span>
                {stopPhase === 'really'
                  ? 'Really?'
                  : stopPhase === 'new'
                    ? isSearching
                      ? 'Stop'
                      : 'New'
                    : 'Stop'}
              </span>
              <kbd className="rounded bg-black/40 px-1 py-0.5 text-[10px] font-mono opacity-80">
                Esc
              </kbd>
            </button>

            <button
              type="button"
              onClick={handlePrimaryAction}
              disabled={isSearching}
              className="flex h-12 items-center justify-center gap-2 rounded-xl border border-emerald-400/30 bg-emerald-500/15 text-xs font-bold text-emerald-200 transition hover:bg-emerald-500/25 active:scale-[0.98] disabled:cursor-not-allowed disabled:opacity-60"
            >
              {isSearching ? (
                <>
                  <span className="h-4 w-4 animate-spin rounded-full border-2 border-emerald-300/25 border-t-emerald-300" />
                  <span>Searching…</span>
                </>
              ) : (
                <>
                  {isConnected ? (
                    <ArrowRight01Icon size={17} />
                  ) : (
                    <PlayIcon size={17} />
                  )}
                  <span>{primaryLabel}</span>
                  <kbd className="hidden sm:inline-block rounded bg-black/40 px-1 py-0.5 text-[10px] font-mono opacity-70">
                    Space
                  </kbd>
                </>
              )}
            </button>

            <button
              type="button"
              onClick={() => setShowCountryModal(true)}
              className="flex h-12 min-w-0 items-center justify-center gap-2 rounded-xl border border-white/10 bg-white/[0.045] px-2 text-xs font-semibold text-neutral-200 transition hover:bg-white/[0.09]"
            >
              <span className="text-base leading-none">{currentCountryObj.flag}</span>
              <span className="truncate">{currentCountryObj.name}</span>
            </button>

            <button
              type="button"
              onClick={() => setShowGenderSheet(true)}
              className="flex h-12 min-w-0 items-center justify-center gap-2 rounded-xl border border-white/10 bg-white/[0.045] px-2 text-xs font-semibold text-neutral-200 transition hover:bg-white/[0.09]"
            >
              {genderAvatar(selfGender, 'h-6 w-6 shrink-0')}
              <span className="truncate">{genderLabel(selfGender)}</span>
            </button>
          </div>
        </div>
      ) : (
        <div className="mx-auto flex min-h-0 w-full max-w-[1440px] flex-1 flex-col gap-3 p-3 sm:p-4 lg:flex-row">
        <div
          className={`flex min-h-0 flex-1 flex-col gap-3 ${
            mobileTab === 'chat' ? 'hidden lg:flex' : ''
          }`}
        >
          {/* Video stage */}
          <div
            ref={stageRef}
            className="relative min-h-0 flex-1 overflow-hidden rounded-2xl border border-white/10 bg-[#050409]"
          >
            <StreamVideo stream={remoteStream} className="h-full w-full object-cover" />

            {/* Partner chip + actions while connected */}
            {partner && isConnected && (
              <>
                <div className="absolute left-3 top-3 z-20 flex max-w-[70%] items-center gap-2 rounded-full border border-white/10 bg-black/55 px-2.5 py-1.5 backdrop-blur">
                  <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-gradient-to-br from-[#7c3aed] to-[#06b6d4] text-[10px] font-bold text-white">
                    {partner.name?.charAt(0).toUpperCase() || '?'}
                  </span>
                  <div className="min-w-0">
                    <p className="truncate text-[11px] font-semibold text-white">{partner.name}</p>
                    <p className="truncate text-[10px] text-neutral-400">
                      {partnerCountryObj.flag} {partnerCountryObj.name}
                    </p>
                  </div>
                </div>
                <button
                  type="button"
                  onClick={() => onOpenReportModal(partner.id, partner.name)}
                  title="Report this person"
                  aria-label="Report this person"
                  className="absolute right-3 top-3 z-20 inline-flex items-center gap-1 rounded-full border border-white/10 bg-black/55 px-2.5 py-1.5 text-[10px] font-semibold text-neutral-300 backdrop-blur transition hover:text-rose-300"
                >
                  <AlertCircleIcon size={13} />
                  Report
                </button>
              </>
            )}

            {/* Network quality */}
            {network && isConnected && (
              <div
                className={`absolute bottom-3 left-3 z-20 inline-flex items-center gap-1.5 rounded-full border border-white/10 bg-black/55 px-2.5 py-1 text-[10px] font-semibold backdrop-blur ${QUALITY_META[network.quality].className}`}
              >
                <QualityBars quality={network.quality} />
                {QUALITY_META[network.quality].label}
              </div>
            )}

            {/* Message toast */}
            <span className="sr-only" role="status" aria-live="polite">
              {latestMessageToast ? `Stranger: ${latestMessageToast.text}` : ''}
            </span>
            {latestMessageToast && (
              <button
                type="button"
                onClick={() => setMobileTab('chat')}
                className="absolute bottom-3 left-1/2 z-30 max-w-[80%] -translate-x-1/2 truncate rounded-full border border-white/15 bg-black/75 px-3 py-1.5 text-[11px] backdrop-blur transition hover:bg-black/85"
              >
                <span className="font-semibold text-[#c4b5fd]">Stranger: </span>
                <span className="text-neutral-200">{latestMessageToast.text}</span>
              </button>
            )}

            {/* Mobile self preview */}
            <div className="pip-frame absolute bottom-3 right-3 z-20 w-24 overflow-hidden rounded-xl bg-black lg:hidden">
              <div className="relative aspect-video">
                <StreamVideo stream={localStream} muted mirrored className="h-full w-full object-cover" />
                <span className="absolute left-1 top-1 rounded bg-black/60 px-1 text-[8px] font-semibold text-white/80">
                  You
                </span>
                {!isCamOn && (
                  <div className="absolute inset-0 flex items-center justify-center bg-black/70">
                    <CameraOff01Icon size={16} className="text-neutral-400" />
                  </div>
                )}
              </div>
              <div className="flex items-center justify-center gap-2 border-t border-white/10 bg-black/60 py-1">
                <button
                  type="button"
                  onClick={handleToggleMic}
                  aria-label={isMicOn ? 'Mute microphone' : 'Unmute microphone'}
                  className={`flex h-6 w-6 items-center justify-center rounded-full ${
                    isMicOn ? 'bg-white/10 text-white' : 'bg-rose-500/25 text-rose-200'
                  }`}
                >
                  {isMicOn ? <Mic01Icon size={12} /> : <MicOff01Icon size={12} />}
                </button>
                <button
                  type="button"
                  onClick={handleToggleCam}
                  aria-label={isCamOn ? 'Turn camera off' : 'Turn camera on'}
                  className={`flex h-6 w-6 items-center justify-center rounded-full ${
                    isCamOn ? 'bg-white/10 text-white' : 'bg-rose-500/25 text-rose-200'
                  }`}
                >
                  {isCamOn ? <CameraVideoIcon size={12} /> : <CameraOff01Icon size={12} />}
                </button>
              </div>
            </div>

            {/* ---------- Stage overlays ---------- */}
            {state === 'failed' && (
              <div className="absolute inset-0 z-10 flex flex-col items-center justify-center gap-3 bg-[#08060f]/90 px-6 text-center">
                <span className="flex h-12 w-12 items-center justify-center rounded-full bg-rose-500/15 text-rose-300">
                  <AlertCircleIcon size={22} />
                </span>
                <p className="max-w-xs text-sm font-semibold text-white">Could not connect</p>
                <p className="max-w-xs text-[11px] leading-relaxed text-neutral-400">
                  {statusMessage}
                </p>
                <button
                  type="button"
                  onClick={handleStartSearch}
                  className="inline-flex h-9 items-center gap-2 rounded-full border border-white/15 bg-white/[0.06] px-4 text-xs font-semibold text-white transition hover:bg-white/[0.12]"
                >
                  <PlayIcon size={14} />
                  Try again
                </button>
              </div>
            )}

            {state === 'camera_unavailable' && (
              <div className="absolute inset-0 z-10 flex flex-col items-center justify-center gap-3 bg-[#08060f]/90 px-6 text-center">
                <span className="flex h-12 w-12 items-center justify-center rounded-full bg-amber-500/15 text-amber-300">
                  <CameraOff01Icon size={22} />
                </span>
                <p className="max-w-xs text-sm font-semibold text-white">Camera unavailable</p>
                <p className="max-w-xs text-[11px] leading-relaxed text-neutral-400">
                  {statusMessage}
                </p>
                <button
                  type="button"
                  onClick={handleStartSearch}
                  className="inline-flex h-9 items-center gap-2 rounded-full border border-white/15 bg-white/[0.06] px-4 text-xs font-semibold text-white transition hover:bg-white/[0.12]"
                >
                  <PlayIcon size={14} />
                  Retry
                </button>
              </div>
            )}

            {isSearching && !remoteStream && (
              <div className="absolute inset-0 z-10 flex flex-col items-center justify-center gap-4 bg-[#08060f]/85 px-6 text-center">
                <div className="relative flex h-32 w-32 items-center justify-center">
                  <span className="absolute inset-0 rounded-full border border-red-500/25 animate-radar-1" />
                  <span className="absolute inset-0 rounded-full border border-rose-500/25 animate-radar-2" />
                  <span className="absolute inset-0 rounded-full border border-red-400/20 animate-radar-3" />
                  <div className="relative flex h-16 w-16 items-center justify-center rounded-2xl bg-[#0b0914] border border-white/10 shadow-[0_0_40px_-5px_rgba(239,68,68,0.7)] p-2">
                    <img src="/logo-icon.png" alt="UR Live" className="h-full w-full object-contain" />
                  </div>
                </div>
                <div>
                  <p className="text-sm font-semibold text-white">
                    {state === 'requesting_permissions' ? 'Getting you ready…' : 'Looking for someone new…'}
                  </p>
                  <p className="mt-1 text-[11px] text-neutral-400">
                    {othersWaiting !== null && othersWaiting > 0
                      ? `${othersWaiting} more ${othersWaiting === 1 ? 'person' : 'people'} in the queue`
                      : 'You are first in line'}
                    {' · '}
                    {formatDuration(searchSeconds)}
                  </p>
                </div>
                <p className="max-w-[260px] text-[10px] leading-relaxed text-neutral-500">
                  Stay on this screen. You will connect automatically as soon as someone joins.
                </p>
              </div>
            )}

            {(state === 'match_found' || state === 'connecting') && !remoteStream && (
              <div className="absolute inset-0 z-10 flex flex-col items-center justify-center gap-3 bg-[#08060f]/85 px-6 text-center">
                <span className="h-10 w-10 animate-spin rounded-full border-2 border-white/10 border-t-[#67e8f9]" />
                <p className="text-sm font-semibold text-white">
                  {partner ? `Connecting to ${partner.name}…` : 'Match found…'}
                </p>
                <p className="text-[11px] text-neutral-400">Setting up the encrypted stream</p>
              </div>
            )}

            {state === 'remote_disconnected' && (
              <div className="absolute inset-0 z-10 flex flex-col items-center justify-center gap-3 bg-[#08060f]/88 px-6 text-center">
                <span className="flex h-12 w-12 items-center justify-center rounded-full bg-white/[0.06] text-neutral-300">
                  <ArrowLeft01Icon size={22} />
                </span>
                <p className="text-sm font-semibold text-white">Your partner left</p>
                <p className="max-w-xs text-[11px] leading-relaxed text-neutral-400">
                  Press Next to meet someone new right away.
                </p>
                <button
                  type="button"
                  onClick={handleNext}
                  className="inline-flex h-9 items-center gap-2 rounded-full bg-emerald-500/90 px-4 text-xs font-bold text-emerald-950 transition hover:bg-emerald-400"
                >
                  Next
                  <ArrowRight01Icon size={14} />
                </button>
              </div>
            )}

            {(state === 'idle' || state === 'local_disconnected') && !remoteStream && (
              <div className="absolute inset-0 z-10 flex flex-col items-center justify-center gap-4 bg-[#08060f]/80 px-6 text-center">
                <div className="flex h-16 w-16 items-center justify-center rounded-2xl bg-[#0b0914] border border-white/10 shadow-[0_0_35px_-8px_rgba(239,68,68,0.5)] p-2.5">
                  <img src="/logo-icon.png" alt="UR Live" className="h-full w-full object-contain" />
                </div>
                <div>
                  <p className="text-base font-semibold text-white">Meet someone new</p>
                  <p className="mt-1 max-w-[280px] text-[11px] leading-relaxed text-neutral-400">
                    Press Start to join the live queue. Conversations are encrypted end to end.
                  </p>
                </div>
                {othersWaiting !== null && (
                  <span className="inline-flex items-center gap-1 rounded-full border border-white/10 bg-white/[0.04] px-2.5 py-1 text-[10px] font-medium text-neutral-400">
                    <Globe02Icon size={11} />
                    {othersWaiting > 0
                      ? `${othersWaiting} ${othersWaiting === 1 ? 'person' : 'people'} waiting right now`
                      : 'You would be first in the queue'}
                  </span>
                )}
                <button
                  type="button"
                  onClick={handleStartSearch}
                  className="inline-flex h-10 items-center gap-2 rounded-full bg-emerald-500 px-5 text-xs font-bold text-emerald-950 transition hover:bg-emerald-400"
                >
                  <PlayIcon size={15} />
                  Start
                </button>
              </div>
            )}
          </div>

          {/* Media fallback notice */}
          {mediaFallback && (
            <div className="flex shrink-0 items-start gap-2 rounded-xl border border-amber-400/25 bg-amber-500/[0.08] px-3 py-2 text-[11px] text-amber-100/85">
              <AlertCircleIcon size={14} className="mt-0.5 shrink-0" />
              <p className="flex-1 leading-relaxed">{mediaFallback}</p>
              <button
                type="button"
                onClick={() => setMediaFallback(null)}
                aria-label="Dismiss notice"
                className="text-amber-200/70 transition hover:text-amber-100"
              >
                <Cancel01Icon size={13} />
              </button>
            </div>
          )}

          {/* Primary controls with Omegle Stop / Really / New */}
          <div className="grid shrink-0 grid-cols-2 gap-2 sm:grid-cols-4">
            <button
              type="button"
              onClick={handleOmegleStop}
              className={`flex h-12 items-center justify-center gap-1.5 rounded-xl border text-xs font-extrabold transition active:scale-[0.98] ${
                stopPhase === 'really'
                  ? 'border-amber-400 bg-amber-400 text-black shadow-[0_0_20px_rgba(251,191,36,0.6)] animate-pulse'
                  : stopPhase === 'new'
                    ? 'border-sky-400 bg-sky-500 text-white shadow-[0_0_20px_rgba(56,189,248,0.4)] hover:bg-sky-400'
                    : 'border-rose-500/40 bg-rose-600/20 text-rose-200 hover:bg-rose-600/30'
              }`}
            >
              <StopCircleIcon size={16} />
              <span>
                {stopPhase === 'really'
                  ? 'Really?'
                  : stopPhase === 'new'
                    ? isSearching
                      ? 'Stop'
                      : 'New'
                    : 'Stop'}
              </span>
              <kbd className="rounded bg-black/40 px-1 py-0.5 text-[10px] font-mono opacity-80">
                Esc
              </kbd>
            </button>

            <button
              type="button"
              onClick={handlePrimaryAction}
              disabled={isSearching}
              className="flex h-12 items-center justify-center gap-2 rounded-xl border border-emerald-400/30 bg-emerald-500/15 text-xs font-bold text-emerald-200 transition hover:bg-emerald-500/25 active:scale-[0.98] disabled:cursor-not-allowed disabled:opacity-60"
            >
              {isSearching ? (
                <>
                  <span className="h-4 w-4 animate-spin rounded-full border-2 border-emerald-300/25 border-t-emerald-300" />
                  <span>Searching…</span>
                </>
              ) : (
                <>
                  {primaryLabel === 'Next' ? (
                    <ArrowRight01Icon size={17} />
                  ) : (
                    <PlayIcon size={17} />
                  )}
                  <span>{primaryLabel}</span>
                  <kbd className="hidden sm:inline-block rounded bg-black/40 px-1 py-0.5 text-[10px] font-mono opacity-70">
                    Space
                  </kbd>
                </>
              )}
            </button>

            <button
              type="button"
              onClick={() => setShowCountryModal(true)}
              className="flex h-12 min-w-0 items-center justify-center gap-2 rounded-xl border border-white/10 bg-white/[0.045] px-2 text-xs font-semibold text-neutral-200 transition hover:bg-white/[0.09]"
            >
              <span className="text-base leading-none">{currentCountryObj.flag}</span>
              <span className="truncate">{currentCountryObj.name}</span>
            </button>

            <button
              type="button"
              onClick={() => setShowGenderSheet(true)}
              className="flex h-12 min-w-0 items-center justify-center gap-2 rounded-xl border border-white/10 bg-white/[0.045] px-2 text-xs font-semibold text-neutral-200 transition hover:bg-white/[0.09]"
            >
              {genderAvatar(selfGender, 'h-6 w-6 shrink-0')}
              <span className="truncate">{genderLabel(selfGender)}</span>
            </button>
          </div>
        </div>

        {/* ---------- Desktop rail ---------- */}
        <aside className="hidden w-[320px] shrink-0 flex-col gap-3 lg:flex xl:w-[360px]">
          <div className="relative aspect-video shrink-0 overflow-hidden rounded-2xl border border-white/10 bg-black">
            <StreamVideo stream={localStream} muted mirrored className="h-full w-full object-cover" />
            {!localStream && (
              <div className="absolute inset-0 flex flex-col items-center justify-center gap-2 bg-[#0b0a14] text-center">
                <CameraOff01Icon size={22} className="text-neutral-600" />
                <p className="text-[10px] text-neutral-500">Camera preview</p>
              </div>
            )}
            {!isCamOn && (
              <div className="absolute inset-0 flex items-center justify-center bg-black/70">
                <CameraOff01Icon size={24} className="text-neutral-400" />
              </div>
            )}
            <span className="absolute left-2 top-2 rounded-md bg-black/60 px-1.5 py-0.5 text-[10px] font-semibold text-white/85">
              You
            </span>
            <div className="absolute bottom-2 left-2 flex items-center gap-1.5">
              <button
                type="button"
                onClick={handleToggleMic}
                aria-label={isMicOn ? 'Mute microphone' : 'Unmute microphone'}
                className={`flex h-8 w-8 items-center justify-center rounded-full border backdrop-blur transition ${
                  isMicOn
                    ? 'border-white/15 bg-black/50 text-white hover:bg-black/70'
                    : 'border-rose-400/40 bg-rose-500/25 text-rose-100'
                }`}
              >
                {isMicOn ? <Mic01Icon size={14} /> : <MicOff01Icon size={14} />}
              </button>
              <button
                type="button"
                onClick={handleToggleCam}
                aria-label={isCamOn ? 'Turn camera off' : 'Turn camera on'}
                className={`flex h-8 w-8 items-center justify-center rounded-full border backdrop-blur transition ${
                  isCamOn
                    ? 'border-white/15 bg-black/50 text-white hover:bg-black/70'
                    : 'border-rose-400/40 bg-rose-500/25 text-rose-100'
                }`}
              >
                {isCamOn ? <CameraVideoIcon size={14} /> : <CameraOff01Icon size={14} />}
              </button>
            </div>
          </div>

          <div className="grid shrink-0 grid-cols-2 gap-2">
            <button
              type="button"
              onClick={toggleFullscreen}
              className="flex h-10 items-center justify-center gap-2 rounded-lg border border-white/10 bg-white/[0.05] text-[11px] font-semibold text-neutral-200 transition hover:bg-white/[0.1]"
            >
              <FullScreenIcon size={14} />
              {isFullscreen ? 'Exit' : 'Full Screen'}
            </button>
            <button
              type="button"
              onClick={() => setShowSettingsModal(true)}
              className="flex h-10 items-center justify-center gap-2 rounded-lg border border-white/10 bg-white/[0.05] text-[11px] font-semibold text-neutral-200 transition hover:bg-white/[0.1]"
            >
              <Settings02Icon size={14} />
              Settings
            </button>
          </div>

          <button
            type="button"
            onClick={() => setShowSettingsModal(true)}
            className="flex h-9 w-full shrink-0 items-center gap-2 rounded-lg border border-white/10 bg-white/[0.035] px-3 text-[11px] text-neutral-300 transition hover:bg-white/[0.08]"
          >
            <Mic01Icon size={13} className="shrink-0 text-[#67e8f9]" />
            <span className="min-w-0 flex-1 truncate text-left">{micLabel}</span>
            <Settings02Icon size={12} className="shrink-0 text-neutral-500" />
          </button>

          <div className="surface-strong flex min-h-0 flex-1 flex-col overflow-hidden rounded-2xl">
            <div className="flex shrink-0 items-center justify-between border-b border-white/[0.06] px-3 py-2">
              <div className="flex items-center gap-2">
                <span className="h-1.5 w-1.5 rounded-full bg-emerald-400" />
                <span className="text-[11px] font-bold uppercase tracking-wide text-neutral-300">
                  Chat
                </span>
              </div>
              <span className="max-w-[140px] truncate text-[10px] text-neutral-500">
                {partner?.name || 'No one yet'}
              </span>
            </div>
            {chatBody}
          </div>
        </aside>

        {/* ---------- Mobile chat ---------- */}
        {mobileTab === 'chat' && (
          <div className="surface-strong flex min-h-0 flex-1 flex-col overflow-hidden rounded-2xl lg:hidden">
            <div className="flex shrink-0 items-center gap-2 border-b border-white/[0.06] px-2.5 py-2">
              <button
                type="button"
                onClick={() => setMobileTab('video')}
                aria-label="Back to video"
                className="flex h-7 w-7 items-center justify-center rounded-full border border-white/10 bg-white/[0.05] text-neutral-300"
              >
                <ArrowLeft01Icon size={14} />
              </button>
              <span className="text-xs font-bold text-white">Chat</span>
              <span className="ml-auto max-w-[140px] truncate text-[10px] text-neutral-500">
                {partner?.name || 'No one yet'}
              </span>
            </div>
            {chatBody}
          </div>
        )}
      </div>
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
                <Settings02Icon size={16} className="text-[#c4b5fd]" />
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
                        ? 'border-[#8b5cf6]/60 bg-[#8b5cf6]/15'
                        : 'border-white/10 bg-white/[0.04] hover:bg-white/[0.08]'
                    }`}
                  >
                    {genderAvatar(option.value, 'h-11 w-11')}
                    <span className="text-[11px] font-semibold text-neutral-100">{option.label}</span>
                    {active && (
                      <span className="inline-flex items-center gap-0.5 text-[9px] font-semibold text-[#c4b5fd]">
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
