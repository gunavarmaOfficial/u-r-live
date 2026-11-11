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
    setMobileTab('video');
    setStopPhase('stop');
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

  /* ---------------- Chat pane (Umingle layout matching Image 2) ---------------- */
  const chatPane = (
    <div className="flex min-h-0 flex-1 flex-col font-sans bg-white dark:bg-[#12111f] rounded-2xl border border-neutral-200/80 dark:border-white/10 shadow-sm overflow-hidden">
      {/* Welcome & Community Rules Header (matching Image 2) */}
      <div className="shrink-0 p-5 sm:p-6 border-b border-neutral-100 dark:border-white/[0.06] bg-neutral-50/50 dark:bg-white/[0.01]">
        <h2 className="text-xl sm:text-2xl font-extrabold text-neutral-900 dark:text-white">
          Welcome to U-R-LIVE.
        </h2>
        <div className="mt-2.5 flex items-center gap-2">
          <span className="rounded bg-red-600 px-2 py-0.5 text-xs font-black text-white">18+</span>
          <span className="text-sm font-bold text-[#6d28d9] dark:text-[#a78bfa]">You must be 18 or older</span>
        </div>
        <ul className="mt-2 space-y-1 text-xs sm:text-sm font-medium text-neutral-700 dark:text-neutral-300">
          <li>No nudity, hate speech, or harassment</li>
          <li>Your camera must show you, live</li>
          <li>Do not ask for gender — this is not a dating site</li>
        </ul>
        <p className="mt-2 text-xs sm:text-sm font-black text-neutral-900 dark:text-white">
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
                <strong className="font-bold text-[#6d28d9] dark:text-[#a78bfa] mr-1.5 select-none">You:</strong>
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
      <div className="shrink-0 border-t border-neutral-200/80 dark:border-white/[0.08] bg-neutral-50/60 dark:bg-[#0d0c18] p-3 space-y-2.5">
        {/* Quick options strip: Smart Match & Get Premium */}
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={() => setShowCountryModal(true)}
            className="flex items-center gap-1.5 rounded-lg border border-neutral-200 dark:border-white/10 bg-white dark:bg-white/[0.05] px-3 py-1.5 text-xs font-semibold text-neutral-700 dark:text-neutral-300 hover:bg-neutral-100 dark:hover:bg-white/[0.08] transition cursor-pointer"
          >
            <span>🌍</span>
            <span>Smart Match</span>
            <span className="text-[10px] text-neutral-400">▾</span>
          </button>

          <button
            type="button"
            onClick={() => setShowSettingsModal(true)}
            className="flex items-center gap-1 rounded-lg bg-[#6d28d9] px-3 py-1.5 text-xs font-bold text-white shadow-sm hover:bg-[#5b21b6] transition cursor-pointer"
          >
            <span>⚡</span>
            <span>Get Premium</span>
          </button>

          {onChangeMode && (
            <button
              type="button"
              onClick={() => onChangeMode(mode === 'video' ? 'text' : 'video')}
              className="ml-auto inline-flex items-center gap-1 text-[11px] font-semibold text-purple-600 dark:text-purple-400 hover:underline cursor-pointer"
            >
              {mode === 'video' ? 'Switch to Text' : 'Switch to Video'}
            </button>
          )}
        </div>

        {/* Main Start / Stop button and text input (Image 2 style) */}
        <div className="flex items-center gap-2.5">
          <button
            type="button"
            onClick={handleOmegleStop}
            className={`flex h-12 w-24 shrink-0 flex-col items-center justify-center rounded-xl font-extrabold text-xs text-white transition active:scale-95 shadow-md cursor-pointer ${
              stopPhase === 'really'
                ? 'bg-amber-500 hover:bg-amber-600 animate-pulse'
                : stopPhase === 'new'
                  ? 'bg-[#6d28d9] hover:bg-[#5b21b6]'
                  : isConnected
                    ? 'bg-rose-600 hover:bg-rose-700'
                    : 'bg-[#6d28d9] hover:bg-[#5b21b6]'
            }`}
          >
            <span className="leading-tight">
              {stopPhase === 'really'
                ? 'Really?'
                : stopPhase === 'new'
                  ? isSearching
                    ? 'Stop'
                    : 'Start'
                  : isConnected
                    ? 'Stop'
                    : 'Start'}
            </span>
            <span className="text-[10px] font-mono opacity-80 leading-tight">Esc</span>
          </button>

          <form onSubmit={handleSendMessage} className="flex flex-1 items-center gap-2">
            <div className="relative flex-1">
              <input
                value={chatInput}
                onChange={(e) => handleChatInput(e.target.value)}
                disabled={!isConnected}
                placeholder={isConnected ? 'Type your message and press Enter...' : 'Waiting for connection...'}
                className="h-12 w-full rounded-xl border border-neutral-200 dark:border-white/10 bg-white dark:bg-white/[0.04] pl-4 pr-10 text-sm text-neutral-900 dark:text-white placeholder:text-neutral-400 dark:placeholder:text-neutral-500 outline-none focus:border-[#6d28d9] focus:ring-2 focus:ring-[#6d28d9]/20 transition disabled:cursor-not-allowed disabled:opacity-50"
              />
              <button
                type="submit"
                disabled={!isConnected || !chatInput.trim()}
                aria-label="Send message"
                className="absolute right-3 top-1/2 -translate-y-1/2 text-neutral-400 hover:text-[#6d28d9] dark:hover:text-purple-400 disabled:opacity-30 disabled:hover:text-neutral-400 transition cursor-pointer"
              >
                <svg className="h-5 w-5 rotate-45 -translate-y-0.5" viewBox="0 0 24 24" fill="currentColor">
                  <path d="M2.01 21L23 12 2.01 3 2 10l15 2-15 2z" />
                </svg>
              </button>
            </div>
          </form>
        </div>
      </div>
    </div>
  );

  return (
    <div className="relative flex h-full min-h-0 flex-1 flex-col bg-[#f8f7ff] dark:bg-[#07060d] text-neutral-900 dark:text-neutral-100 transition-colors">
      {/* Workspace */}
      {mode === 'text' ? (
        <div className="mx-auto flex min-h-0 w-full max-w-4xl flex-1 flex-col p-3 sm:p-4">
          {chatPane}
        </div>
      ) : (
        <div className="mx-auto flex min-h-0 w-full max-w-[1600px] flex-1 flex-col lg:flex-row gap-4 p-3 sm:p-4">
          {/* Left Column: Stacked dual video boxes (Image 2 style) */}
          <div className="flex w-full lg:w-[480px] xl:w-[520px] flex-col gap-3 shrink-0">
            {/* Top Box: Stranger Video */}
            <div
              ref={stageRef}
              className="relative flex-1 min-h-[220px] sm:min-h-[260px] rounded-2xl overflow-hidden bg-[#1e1d24] border border-neutral-200/80 dark:border-white/10 shadow-sm"
            >
              <StreamVideo stream={remoteStream} className="h-full w-full object-cover" />

              {!remoteStream && (
                <div className="absolute inset-0 flex flex-col items-center justify-center gap-2 text-center p-4">
                  {isSearching ? (
                    <>
                      <div className="h-10 w-10 animate-spin rounded-full border-3 border-purple-500/20 border-t-purple-500" />
                      <p className="text-xs font-semibold text-neutral-400">Looking for someone to chat with…</p>
                    </>
                  ) : (
                    <>
                      <CameraOff01Icon size={28} className="text-neutral-500" />
                      <p className="text-xs font-medium text-neutral-400">Press Start to connect with a stranger</p>
                      <button
                        type="button"
                        onClick={handleStartSearch}
                        className="mt-2 inline-flex items-center gap-1.5 rounded-xl bg-[#6d28d9] hover:bg-[#5b21b6] px-4 py-2 text-xs font-bold text-white shadow-md transition active:scale-95 cursor-pointer"
                      >
                        <PlayIcon size={14} />
                        <span>Start</span>
                      </button>
                    </>
                  )}
                </div>
              )}

              {/* Watermark badge (Image 2 style) */}
              <div className="absolute bottom-3 left-3 z-10 flex items-center gap-1.5 rounded-lg bg-black/60 backdrop-blur px-2.5 py-1 text-[11px] font-bold text-white shadow-sm">
                <span className="text-purple-400">💬</span>
                <span>u-r-live.com</span>
              </div>

              {/* Report button (Image 2 style) */}
              {isConnected && (
                <button
                  type="button"
                  onClick={() => partner && onOpenReportModal(partner.id, partner.name)}
                  aria-label="Report stranger"
                  title="Report stranger"
                  className="absolute bottom-3 right-3 z-10 flex h-8 w-8 items-center justify-center rounded-lg bg-black/60 backdrop-blur text-neutral-300 hover:text-rose-400 transition cursor-pointer shadow-sm"
                >
                  <svg className="h-4 w-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                    <path d="M4 15s1-1 4-1 5 2 8 2 4-1 4-1V3s-1 1-4 1-5-2-8-2-4 1-4 1z" />
                    <line x1="4" y1="22" x2="4" y2="15" />
                  </svg>
                </button>
              )}
            </div>

            {/* Bottom Box: Self preview (Your Camera) */}
            <div className="relative flex-1 min-h-[220px] sm:min-h-[260px] rounded-2xl overflow-hidden bg-black border border-neutral-200/80 dark:border-white/10 shadow-sm">
              <StreamVideo stream={localStream} muted mirrored className="h-full w-full object-cover" />

              {!localStream && (
                <div className="absolute inset-0 flex flex-col items-center justify-center gap-2 bg-[#0b0a14] text-center">
                  <CameraOff01Icon size={24} className="text-neutral-600" />
                  <p className="text-xs text-neutral-500">Camera preview</p>
                </div>
              )}
              {!isCamOn && (
                <div className="absolute inset-0 flex items-center justify-center bg-black/80">
                  <CameraOff01Icon size={26} className="text-neutral-400" />
                </div>
              )}

              {/* You badge */}
              <span className="absolute left-3 top-3 rounded-md bg-black/60 px-2 py-0.5 text-[10px] font-bold text-white">
                You
              </span>

              {/* Floating controls */}
              <div className="absolute bottom-3 left-3 flex items-center gap-2 z-10">
                <button
                  type="button"
                  onClick={handleToggleMic}
                  aria-label={isMicOn ? 'Mute microphone' : 'Unmute microphone'}
                  className={`flex h-8 w-8 items-center justify-center rounded-full border backdrop-blur transition cursor-pointer ${
                    isMicOn
                      ? 'border-white/20 bg-black/60 text-white hover:bg-black/80'
                      : 'border-rose-400/40 bg-rose-500/30 text-rose-100'
                  }`}
                >
                  {isMicOn ? <Mic01Icon size={14} /> : <MicOff01Icon size={14} />}
                </button>
                <button
                  type="button"
                  onClick={handleToggleCam}
                  aria-label={isCamOn ? 'Turn camera off' : 'Turn camera on'}
                  className={`flex h-8 w-8 items-center justify-center rounded-full border backdrop-blur transition cursor-pointer ${
                    isCamOn
                      ? 'border-white/20 bg-black/60 text-white hover:bg-black/80'
                      : 'border-rose-400/40 bg-rose-500/30 text-rose-100'
                  }`}
                >
                  {isCamOn ? <CameraVideoIcon size={14} /> : <CameraOff01Icon size={14} />}
                </button>
              </div>
            </div>
          </div>

          {/* Right Column: Chat Box */}
          {chatPane}
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
