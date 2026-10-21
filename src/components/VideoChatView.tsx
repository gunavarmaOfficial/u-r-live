import React, { useEffect, useRef, useState, useCallback } from 'react';
import {
  CameraVideoIcon,
  CameraOff01Icon,
  Mic01Icon,
  MicOff01Icon,
  CallEnd01Icon,
  ArrowRight01Icon,
  SparklesIcon,
  WebProtectionIcon,
  SentIcon,
  Cancel01Icon,
  AlertCircleIcon,
  Search01Icon,
  Globe02Icon,
  Tag01Icon,
  Tick02Icon,
  UserCircleIcon,
  Message01Icon,
  ViewIcon,
  ViewOffSlashIcon,
} from 'hugeicons-react';
import { WebRTCManager } from '../services/webrtc';
import { WebRTCState, MatchPreferences, ChatMessage, UserProfile, ChatMode } from '../types';
import { api } from '../services/api';
import { Logo } from './Logo';
import { COUNTRIES, POPULAR_INTERESTS, SUPPORTED_LANGUAGES } from '../data/constants';
import { ThreeDMaleAvatar, ThreeDFemaleAvatar, ThreeDGlobeIcon } from './ThreeDIcons';

interface VideoChatViewProps {
  user: UserProfile;
  isPro: boolean;
  onOpenUpgradeModal: (reason?: string) => void;
  onOpenReportModal: (partnerId: string, partnerName: string) => void;
  onRequireAgeVerification: () => void;
  onOpenOnboarding?: () => void;
  preferredGender?: 'any' | 'male' | 'female';
  onChangePreferredGender?: (gender: 'any' | 'male' | 'female') => void;
}

export const VideoChatView: React.FC<VideoChatViewProps> = ({
  user,
  isPro,
  onOpenUpgradeModal,
  onOpenReportModal,
  onRequireAgeVerification,
  onOpenOnboarding,
  preferredGender: externalPreferredGender,
  onChangePreferredGender,
}) => {
  const localVideoRef = useRef<HTMLVideoElement>(null);
  const remoteVideoRef = useRef<HTMLVideoElement>(null);
  const chatMessagesEndRef = useRef<HTMLDivElement>(null);
  const messageInputRef = useRef<HTMLInputElement>(null);

  const [state, setState] = useState<WebRTCState>('idle');
  const [statusMessage, setStatusMessage] = useState<string>('Ready. Click START or press Spacebar.');
  const [partner, setPartner] = useState<{
    id: string;
    name: string;
    country: string;
    sharedInterests?: string[];
  } | null>(null);

  const [isMicOn, setIsMicOn] = useState(true);
  const [isCamOn, setIsCamOn] = useState(true);

  // Mobile layout state
  const [mobileTab, setMobileTab] = useState<'video' | 'chat'>('video');
  const [unreadCount, setUnreadCount] = useState<number>(0);
  const [latestMessageToast, setLatestMessageToast] = useState<{ text: string; sender: string } | null>(null);
  const [isPipMinimized, setIsPipMinimized] = useState<boolean>(false);
  const [isSwappedVideos, setIsSwappedVideos] = useState<boolean>(false);

  // In-call text messages
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [chatInput, setChatInput] = useState('');

  // Match preferences
  const [chatMode, setChatMode] = useState<ChatMode>('video');
  const [selectedCountry, setSelectedCountry] = useState<string>(user.country || 'GLOBAL');
  const [selectedLanguage, setSelectedLanguage] = useState<string>('en');
  const [selectedInterests, setSelectedInterests] = useState<string[]>([]);
  const [customInterestInput, setCustomInterestInput] = useState('');
  const [showInterestsModal, setShowInterestsModal] = useState(false);
  const [showGenderFilterModal, setShowGenderFilterModal] = useState(false);
  const [internalPreferredGender, setInternalPreferredGender] = useState<'any' | 'male' | 'female'>('any');
  const preferredGender = externalPreferredGender !== undefined ? externalPreferredGender : internalPreferredGender;
  const setPreferredGender = useCallback(
    (g: 'any' | 'male' | 'female') => {
      if (onChangePreferredGender) {
        onChangePreferredGender(g);
      } else {
        setInternalPreferredGender(g);
      }
    },
    [onChangePreferredGender]
  );

  const interestsPopoverRef = useRef<HTMLDivElement>(null);
  const genderPopoverRef = useRef<HTMLDivElement>(null);
  const managerRef = useRef<WebRTCManager | null>(null);

  // Close popovers on click outside (desktop)
  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (
        interestsPopoverRef.current &&
        !interestsPopoverRef.current.contains(e.target as Node)
      ) {
        setShowInterestsModal(false);
      }
      if (
        genderPopoverRef.current &&
        !genderPopoverRef.current.contains(e.target as Node)
      ) {
        setShowGenderFilterModal(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const buildCurrentPreferences = useCallback((): MatchPreferences => {
    return {
      mode: chatMode,
      preferredCountry: selectedCountry,
      preferredGender: isPro ? preferredGender : 'any',
      interests: selectedInterests,
      interestMatchingEnabled: selectedInterests.length > 0,
      languages: [selectedLanguage],
      primaryLanguage: selectedLanguage,
    };
  }, [chatMode, selectedCountry, isPro, preferredGender, selectedInterests, selectedLanguage]);

  const handleStateChange = useCallback((newState: WebRTCState, details?: string) => {
    setState(newState);
    if (details) {
      setStatusMessage(details);
    } else {
      switch (newState) {
        case 'idle':
          setStatusMessage('Ready. Click START or press Spacebar.');
          break;
        case 'requesting_permissions':
          setStatusMessage('Requesting camera & microphone access...');
          break;
        case 'waiting_for_match':
          setStatusMessage('Looking for a partner on U-R-LIVE...');
          break;
        case 'match_found':
          setStatusMessage('Partner found! Connecting peer-to-peer...');
          break;
        case 'connecting':
          setStatusMessage('Connecting direct WebRTC stream...');
          break;
        case 'connected':
          setStatusMessage('Connected. Live chat in progress.');
          break;
        case 'reconnecting':
          setStatusMessage('Reconnecting...');
          break;
        case 'remote_disconnected':
          setStatusMessage('Stranger disconnected.');
          break;
        case 'local_disconnected':
          setStatusMessage('You stopped the chat session.');
          break;
        default:
          break;
      }
    }
  }, []);

  // WebRTC initialization and event handlers
  useEffect(() => {
    const manager = new WebRTCManager({
      onStateChange: handleStateChange,
      onLocalStream: (stream) => {
        if (localVideoRef.current) {
          localVideoRef.current.srcObject = stream;
        }
      },
      onRemoteStream: (stream) => {
        if (remoteVideoRef.current) {
          remoteVideoRef.current.srcObject = stream;
        }
      },
      onChatMessage: (msg) => {
        setMessages((prev) => [...prev, msg]);
        if (!msg.isLocal) {
          // Show brief floating toast on mobile if in video tab
          setLatestMessageToast({ text: msg.text, sender: 'Stranger' });
          setTimeout(() => {
            setLatestMessageToast(null);
          }, 4000);
          setUnreadCount((c) => c + 1);
        }
      },
      onMatchFound: (peer) => {
        setPartner({
          id: peer.peerUserId,
          name: peer.peerName,
          country: peer.peerCountry,
          sharedInterests: peer.sharedInterests,
        });
        setMessages([]);
        setUnreadCount(0);
      },
      onPeerDisconnected: (_reason) => {
        setPartner(null);
        if (remoteVideoRef.current) {
          remoteVideoRef.current.srcObject = null;
        }
      },
      onError: (err) => {
        console.error('WebRTC error event:', err);
      },
    });

    managerRef.current = manager;

    api.getIceServers().then((res) => {
      if (res.iceServers) {
        manager.updateIceServers(res.iceServers);
      }
    });

    // If user has already verified age, initialize camera preview right away
    if (user.isAdultVerified && chatMode === 'video') {
      manager.initMedia().catch(() => {});
    }

    return () => {
      manager.destroy();
      managerRef.current = null;
    };
  }, [handleStateChange, user.isAdultVerified, chatMode]);

  // Ensure streams stay attached if DOM elements or tabs change
  useEffect(() => {
    if (managerRef.current) {
      const localStream = managerRef.current.getLocalStream();
      const remoteStream = managerRef.current.getRemoteStream();
      if (localVideoRef.current && localStream && localVideoRef.current.srcObject !== localStream) {
        localVideoRef.current.srcObject = localStream;
      }
      if (remoteVideoRef.current && remoteStream && remoteVideoRef.current.srcObject !== remoteStream) {
        remoteVideoRef.current.srcObject = remoteStream;
      }
    }
  }, [mobileTab, isSwappedVideos]);

  // Auto-scroll chat to latest message
  useEffect(() => {
    chatMessagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages, mobileTab]);

  const handleStartSearch = async () => {
    if (!user.isAdultVerified || user.gender === 'unspecified') {
      if (onOpenOnboarding) {
        onOpenOnboarding();
      } else {
        onRequireAgeVerification();
      }
      return;
    }

    if (!managerRef.current) return;
    setMessages([]);
    setUnreadCount(0);
    const prefs = buildCurrentPreferences();
    try {
      await managerRef.current.findMatch(user.id, user.gender, user.country, prefs);
    } catch (err: any) {
      console.warn('Start search error:', err);
    }
  };

  const handleNext = () => {
    if (!user.isAdultVerified || user.gender === 'unspecified') {
      if (onOpenOnboarding) {
        onOpenOnboarding();
      } else {
        onRequireAgeVerification();
      }
      return;
    }
    if (!managerRef.current) return;
    setMessages([]);
    setUnreadCount(0);
    setPartner(null);
    if (remoteVideoRef.current) {
      remoteVideoRef.current.srcObject = null;
    }
    const prefs = buildCurrentPreferences();
    managerRef.current.skipMatch(user.id, prefs);
  };

  const handleStop = () => {
    if (!managerRef.current) return;
    managerRef.current.disconnect();
    setPartner(null);
    setMessages([]);
    setUnreadCount(0);
    if (remoteVideoRef.current) {
      remoteVideoRef.current.srcObject = null;
    }
  };

  const handleToggleMic = () => {
    if (!managerRef.current) return;
    const enabled = managerRef.current.toggleAudio();
    setIsMicOn(enabled);
  };

  const handleToggleCam = () => {
    if (!managerRef.current) return;
    const enabled = managerRef.current.toggleVideo();
    setIsCamOn(enabled);
  };

  const handleSendMessage = (e: React.FormEvent) => {
    e.preventDefault();
    if (!chatInput.trim() || !managerRef.current) return;
    const sent = managerRef.current.sendChatMessage(chatInput, user.id);
    if (sent) {
      setChatInput('');
    }
  };

  const handleBlockCurrentPartner = async () => {
    if (!partner) return;
    const partnerId = partner.id;
    try {
      await api.blockUser(partnerId);
      handleNext();
    } catch (err: any) {
      console.error('Block user error:', err);
      handleNext();
    }
  };

  const toggleInterest = (interestId: string) => {
    setSelectedInterests((prev) =>
      prev.includes(interestId)
        ? prev.filter((id) => id !== interestId)
        : [...prev, interestId]
    );
  };

  const addCustomInterest = (e: React.FormEvent) => {
    e.preventDefault();
    const clean = customInterestInput.trim().toLowerCase().replace(/[^a-z0-9_]/g, '');
    if (clean && !selectedInterests.includes(clean)) {
      setSelectedInterests((prev) => [...prev, clean]);
      setCustomInterestInput('');
    }
  };

  // Keyboard shortcuts: Space for Start/Next, Esc for Stop
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (
        e.target instanceof HTMLInputElement ||
        e.target instanceof HTMLTextAreaElement ||
        e.target instanceof HTMLSelectElement
      ) {
        return;
      }

      if (e.code === 'Space') {
        e.preventDefault();
        if (state === 'connected' || state === 'remote_disconnected') {
          handleNext();
        } else if (state === 'idle' || state === 'local_disconnected') {
          handleStartSearch();
        }
      } else if (e.code === 'Escape') {
        e.preventDefault();
        handleStop();
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [state, user, buildCurrentPreferences]);

  const isSearching =
    state === 'waiting_for_match' || state === 'match_found' || state === 'connecting';
  const isConnected = state === 'connected';

  const currentCountryObj =
    COUNTRIES.find((c) => c.code === selectedCountry) || COUNTRIES[0];

  return (
    <div className="flex-1 flex flex-col h-full bg-[#111215] text-neutral-100 overflow-hidden select-none">
      {/* ======================================================== */}
      {/* 1. TOP VIDEO WORKSPACE (Responsive Desktop & Mobile)     */}
      {/* ======================================================== */}
      {/*
        On Desktop (md:): Side-by-side equal grid columns.
        On Mobile (<md):
          - In 'video' tab: Remote is full/prominent, Local is floating Picture-in-Picture.
          - In 'chat' tab: Compact top video preview bar (h-32) showing both streams live.
      */}
      <div
        className={`relative transition-all duration-200 overflow-hidden ${
          mobileTab === 'chat'
            ? 'h-32 xs:h-36 shrink-0 grid grid-cols-2 gap-1.5 p-2 bg-[#090a0c] border-b border-neutral-800 md:h-auto md:shrink md:flex-1 md:min-h-0 md:grid md:grid-cols-2 md:gap-3 md:p-3 md:border-b-0 md:bg-transparent'
            : 'flex-1 min-h-0 p-2 sm:p-3 md:grid md:grid-cols-2 md:gap-3'
        }`}
      >
        {/* ---------------------------------------------------- */}
        {/* PANEL A: Remote Participant Video / Stranger        */}
        {/* ---------------------------------------------------- */}
        <div
          className={`relative rounded-xl sm:rounded-2xl bg-[#090a0c] border border-neutral-800/90 overflow-hidden flex flex-col items-center justify-center transition-all ${
            mobileTab === 'video'
              ? 'w-full h-full min-h-0'
              : 'w-full h-full'
          }`}
        >
          <video
            ref={isSwappedVideos ? localVideoRef : remoteVideoRef}
            autoPlay
            playsInline
            muted={isSwappedVideos}
            className={`w-full h-full object-cover transition-opacity duration-200 ${
              isSwappedVideos ? '-scale-x-100' : ''
            } ${
              (isSwappedVideos ? isCamOn : isConnected) ? 'opacity-100' : 'opacity-0'
            }`}
          />

          {/* Placeholders when remote video is not active */}
          {!isConnected && !isSwappedVideos && (
            <div className="absolute inset-0 flex flex-col items-center justify-center p-3 sm:p-4 text-center bg-[#090a0c] z-10">
              {isSearching ? (
                <div className="space-y-2 sm:space-y-3 flex flex-col items-center max-w-xs px-2">
                  <div className="w-11 h-11 sm:w-14 sm:h-14 rounded-full bg-emerald-500/10 border-2 border-emerald-500/40 border-t-emerald-500 flex items-center justify-center text-emerald-400 animate-spin">
                    <Search01Icon className="w-5 h-5 sm:w-6 sm:h-6 animate-pulse" />
                  </div>
                  <div>
                    <p className="text-xs sm:text-sm font-bold text-white tracking-wide">
                      Looking for someone...
                    </p>
                    <p className="text-[11px] sm:text-xs text-neutral-400 mt-0.5">
                      Searching active users in {currentCountryObj.name}
                    </p>
                  </div>
                  <div className="pt-1">
                    <button
                      onClick={handleStop}
                      className="text-[11px] sm:text-xs px-3 sm:px-4 py-1 sm:py-1.5 rounded-lg bg-neutral-800 hover:bg-neutral-700 text-neutral-300 transition-colors"
                    >
                      Cancel Search
                    </button>
                  </div>
                </div>
              ) : state === 'remote_disconnected' ? (
                <div className="space-y-2 sm:space-y-3 flex flex-col items-center max-w-xs px-2">
                  <div className="w-10 h-10 sm:w-12 sm:h-12 rounded-full bg-neutral-900 border border-neutral-800 flex items-center justify-center text-neutral-400">
                    <ArrowRight01Icon className="w-5 h-5 sm:w-6 sm:h-6" />
                  </div>
                  <div>
                    <p className="text-xs sm:text-sm font-bold text-white">Stranger disconnected</p>
                    <p className="text-[10px] sm:text-xs text-neutral-400 mt-0.5">
                      Click START or NEXT to find next stranger
                    </p>
                  </div>
                  <button
                    onClick={handleNext}
                    className="px-5 py-2 sm:px-6 sm:py-2.5 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white font-extrabold text-xs uppercase tracking-wide shadow-md transition-all active:scale-95"
                  >
                    Next Stranger
                  </button>
                </div>
              ) : (
                <div className="space-y-2 sm:space-y-3 flex flex-col items-center max-w-sm px-2">
                  <Logo size="md" showText={false} />
                  <div>
                    <p className="text-xs sm:text-sm font-bold text-white">Stranger Screen</p>
                    <p className="text-[11px] sm:text-xs text-neutral-400 mt-1 max-w-xs">
                      Press <strong className="text-emerald-400">START</strong> below to connect with a random stranger live.
                    </p>
                  </div>
                </div>
              )}
            </div>
          )}

          {/* Connected Stranger Info Bar */}
          {isConnected && partner && !isSwappedVideos && (
            <div className="absolute top-2 left-2 right-2 flex items-center justify-between text-xs pointer-events-none z-10">
              <div className="flex items-center gap-1.5 bg-black/80 backdrop-blur-md px-2.5 py-1 sm:px-3 sm:py-1.5 rounded-lg border border-neutral-700/80 pointer-events-auto max-w-[75%] truncate">
                <span className="font-bold text-white text-[11px] sm:text-xs truncate">{partner.name}</span>
                <span className="text-neutral-500">·</span>
                <span className="text-neutral-300 flex items-center gap-1 font-medium text-[11px] sm:text-xs shrink-0">
                  <Globe02Icon className="w-3 h-3 text-emerald-400" />
                  <span>{partner.country}</span>
                </span>
                {partner.sharedInterests && partner.sharedInterests.length > 0 && (
                  <>
                    <span className="text-neutral-500 hidden xs:inline">·</span>
                    <span className="text-amber-400 text-[10px] uppercase font-bold hidden xs:flex items-center gap-0.5 shrink-0">
                      <Tag01Icon className="w-2.5 h-2.5" />
                      <span>{partner.sharedInterests[0]}</span>
                    </span>
                  </>
                )}
              </div>

              {/* Safety: Report & Block */}
              <div className="flex items-center gap-1.5 pointer-events-auto shrink-0">
                <button
                  onClick={() => onOpenReportModal(partner.id, partner.name)}
                  className="p-1.5 bg-black/80 hover:bg-rose-950/90 text-neutral-300 hover:text-rose-400 border border-neutral-700/80 rounded-lg transition-colors"
                  title="Report user"
                >
                  <AlertCircleIcon className="w-3.5 h-3.5 sm:w-4 sm:h-4" />
                </button>
                <button
                  onClick={handleBlockCurrentPartner}
                  className="p-1.5 bg-black/80 hover:bg-neutral-800 text-neutral-300 hover:text-white border border-neutral-700/80 rounded-lg transition-colors"
                  title="Block and skip"
                >
                  <Cancel01Icon className="w-3.5 h-3.5 sm:w-4 sm:h-4" />
                </button>
              </div>
            </div>
          )}

          {/* Floating Incoming Message Toast on Mobile Video tab */}
          {latestMessageToast && mobileTab === 'video' && (
            <div className="absolute bottom-3 left-3 right-3 sm:left-4 sm:right-auto sm:max-w-xs z-30 animate-in slide-in-from-bottom-2 duration-200">
              <div className="flex items-center justify-between gap-2 bg-neutral-900/95 border border-emerald-500/60 shadow-2xl p-2.5 rounded-xl backdrop-blur-md">
                <div className="flex items-center gap-2 overflow-hidden text-xs">
                  <span className="w-2 h-2 rounded-full bg-emerald-400 shrink-0" />
                  <span className="text-white font-medium truncate">
                    <strong className="text-emerald-300">{latestMessageToast.sender}:</strong> {latestMessageToast.text}
                  </span>
                </div>
                <button
                  onClick={() => {
                    setMobileTab('chat');
                    setUnreadCount(0);
                  }}
                  className="px-2.5 py-1 bg-emerald-600 hover:bg-emerald-500 text-white font-bold text-[11px] rounded-lg shrink-0"
                >
                  Reply
                </button>
              </div>
            </div>
          )}
        </div>

        {/* ---------------------------------------------------- */}
        {/* PANEL B: Local User Camera (PiP on Mobile, Grid on Desktop) */}
        {/* ---------------------------------------------------- */}
        <div
          className={`transition-all ${
            // Desktop: normal grid cell
            'md:relative md:rounded-2xl md:bg-[#090a0c] md:border md:border-neutral-800/90 md:overflow-hidden md:flex md:flex-col md:items-center md:justify-center md:w-full md:h-full md:bottom-auto md:right-auto md:z-auto'
          } ${
            // Mobile Chat tab: half of top bar
            mobileTab === 'chat'
              ? 'relative rounded-xl bg-[#090a0c] border border-neutral-800/90 overflow-hidden flex flex-col items-center justify-center w-full h-full'
              : // Mobile Video tab: sleek Picture-in-Picture floating card
              isPipMinimized
              ? 'absolute top-3 right-3 z-30 md:static'
              : 'absolute bottom-3 right-3 z-30 w-28 h-36 xs:w-32 xs:h-44 rounded-xl sm:rounded-2xl bg-[#090a0c] border-2 border-neutral-700/90 shadow-2xl overflow-hidden flex flex-col items-center justify-center md:static md:w-full md:h-full'
          }`}
        >
          {/* Minimized local preview pill on mobile */}
          {isPipMinimized && mobileTab === 'video' ? (
            <button
              onClick={() => setIsPipMinimized(false)}
              className="md:hidden flex items-center gap-1.5 px-3 py-1.5 bg-black/85 border border-emerald-500/50 rounded-xl text-xs font-bold text-emerald-400 shadow-xl backdrop-blur-md"
            >
              <CameraVideoIcon className="w-3.5 h-3.5" />
              <span>Show You</span>
            </button>
          ) : (
            <>
              <video
                ref={isSwappedVideos ? remoteVideoRef : localVideoRef}
                autoPlay
                playsInline
                muted={!isSwappedVideos}
                className={`w-full h-full object-cover transition-opacity duration-200 ${
                  !isSwappedVideos ? '-scale-x-100' : ''
                } ${
                  (isSwappedVideos ? isConnected : isCamOn) ? 'opacity-100' : 'opacity-0'
                }`}
              />

              {/* Camera Disabled State */}
              {!isCamOn && !isSwappedVideos && (
                <div className="absolute inset-0 flex flex-col items-center justify-center p-2 text-center space-y-1 bg-[#090a0c]">
                  <CameraOff01Icon className="w-5 h-5 text-neutral-500" />
                  <p className="text-[10px] sm:text-xs font-bold text-white">Camera Off</p>
                </div>
              )}

              {/* Local User Badge */}
              <div className="absolute top-1.5 left-1.5 sm:top-2.5 sm:left-2.5 flex items-center gap-1 bg-black/80 backdrop-blur-md px-2 py-0.5 sm:px-2.5 sm:py-1 rounded-md sm:rounded-lg border border-neutral-700/80 text-[10px] sm:text-xs z-10 pointer-events-none">
                <span className="font-bold text-emerald-400">You</span>
                <span className="text-neutral-500 hidden sm:inline">·</span>
                <span className="text-neutral-200 font-medium truncate max-w-[80px] sm:max-w-[120px] hidden sm:inline">
                  {user.displayName}
                </span>
              </div>

              {/* Local Video Quick Controls */}
              <div className="absolute top-1.5 right-1.5 sm:top-2.5 sm:right-2.5 flex items-center gap-1 z-10">
                {/* Mobile Minimize / Swap Button */}
                <div className="flex md:hidden items-center gap-1">
                  {mobileTab === 'video' && (
                    <>
                      <button
                        onClick={() => setIsSwappedVideos(!isSwappedVideos)}
                        className="p-1 rounded-md bg-black/80 text-neutral-300 hover:text-white border border-neutral-700/80"
                        title="Swap camera views"
                      >
                        <ViewIcon className="w-3 h-3" />
                      </button>
                      <button
                        onClick={() => setIsPipMinimized(true)}
                        className="p-1 rounded-md bg-black/80 text-neutral-300 hover:text-white border border-neutral-700/80"
                        title="Minimize preview"
                      >
                        <ViewOffSlashIcon className="w-3 h-3" />
                      </button>
                    </>
                  )}
                </div>

                {/* Desktop Device Toggles: Mic & Camera */}
                <div className="hidden md:flex items-center gap-1.5">
                  <button
                    onClick={handleToggleMic}
                    className={`p-2 rounded-lg border transition-colors shadow-md ${
                      isMicOn
                        ? 'bg-black/75 hover:bg-neutral-800 border-neutral-700/80 text-neutral-200'
                        : 'bg-rose-900/90 border-rose-700 text-rose-200'
                    }`}
                    title={isMicOn ? 'Mute microphone' : 'Unmute microphone'}
                  >
                    {isMicOn ? <Mic01Icon className="w-4 h-4" /> : <MicOff01Icon className="w-4 h-4" />}
                  </button>

                  <button
                    onClick={handleToggleCam}
                    className={`p-2 rounded-lg border transition-colors shadow-md ${
                      isCamOn
                        ? 'bg-black/75 hover:bg-neutral-800 border-neutral-700/80 text-neutral-200'
                        : 'bg-rose-900/90 border-rose-700 text-rose-200'
                    }`}
                    title={isCamOn ? 'Turn camera off' : 'Turn camera on'}
                  >
                    {isCamOn ? <CameraVideoIcon className="w-4 h-4" /> : <CameraOff01Icon className="w-4 h-4" />}
                  </button>
                </div>
              </div>
            </>
          )}
        </div>
      </div>

      {/* ======================================================== */}
      {/* 2. OmeTV CONTROL BAR (Responsive Desktop & Mobile)        */}
      {/* ======================================================== */}
      <div className="bg-[#17181c] border-y border-neutral-800 px-2.5 sm:px-4 py-2 shrink-0 flex flex-col gap-2">
        {/* ROW 1: Primary Action Buttons, Mobile View Tabs & Hardware Mutes */}
        <div className="flex items-center justify-between gap-2">
          {/* Action Buttons: START / NEXT / STOP */}
          <div className="flex items-center gap-1.5 sm:gap-2">
            {/* Big Green START / NEXT Button */}
            {isConnected || state === 'remote_disconnected' ? (
              <button
                onClick={handleNext}
                className="bg-emerald-600 hover:bg-emerald-500 active:bg-emerald-700 text-white font-black text-xs sm:text-sm px-4 sm:px-8 py-2.5 rounded-xl uppercase tracking-wider shadow-md transition-all flex items-center gap-1.5 sm:gap-2 active:scale-95 min-h-[42px]"
                title="Next Stranger (Spacebar)"
              >
                <ArrowRight01Icon className="w-4 h-4" />
                <span>Next</span>
                <kbd className="hidden sm:inline px-1.5 py-0.5 text-[10px] bg-emerald-800/80 rounded font-mono">
                  Space
                </kbd>
              </button>
            ) : isSearching ? (
              <button
                onClick={handleStop}
                className="bg-amber-600 hover:bg-amber-500 active:bg-amber-700 text-white font-black text-xs sm:text-sm px-4 sm:px-8 py-2.5 rounded-xl uppercase tracking-wider shadow-md transition-all flex items-center gap-1.5 sm:gap-2 active:scale-95 min-h-[42px]"
              >
                <span className="w-3.5 h-3.5 rounded-full border-2 border-white/40 border-t-white animate-spin" />
                <span>Searching...</span>
              </button>
            ) : (
              <button
                onClick={handleStartSearch}
                className="bg-emerald-600 hover:bg-emerald-500 active:bg-emerald-700 text-white font-black text-xs sm:text-sm px-5 sm:px-8 py-2.5 rounded-xl uppercase tracking-wider shadow-md transition-all flex items-center gap-1.5 sm:gap-2 active:scale-95 min-h-[42px]"
                title="Start Random Video Chat (Spacebar)"
              >
                <Search01Icon className="w-4 h-4" />
                <span>Start</span>
                <kbd className="hidden sm:inline px-1.5 py-0.5 text-[10px] bg-emerald-800/80 rounded font-mono">
                  Space
                </kbd>
              </button>
            )}

            {/* Big Red STOP Button */}
            <button
              onClick={handleStop}
              disabled={state === 'idle' || state === 'local_disconnected'}
              className="bg-rose-600 hover:bg-rose-500 active:bg-rose-700 disabled:bg-neutral-800 disabled:text-neutral-500 disabled:cursor-not-allowed text-white font-black text-xs sm:text-sm px-3.5 sm:px-6 py-2.5 rounded-xl uppercase tracking-wider shadow-md transition-all flex items-center gap-1 sm:gap-1.5 active:scale-95 min-h-[42px]"
              title="Stop Chat (Esc)"
            >
              <CallEnd01Icon className="w-4 h-4" />
              <span>Stop</span>
              <kbd className="hidden sm:inline px-1.5 py-0.5 text-[10px] bg-black/30 rounded font-mono text-neutral-300">
                Esc
              </kbd>
            </button>
          </div>

          {/* Mobile Right: View Mode Tab Switcher & Mic/Cam quick toggles */}
          <div className="flex md:hidden items-center gap-1.5">
            {/* Mic / Cam Toggles on Mobile Action Bar */}
            <button
              onClick={handleToggleMic}
              className={`p-2 rounded-xl border transition-colors ${
                isMicOn
                  ? 'bg-[#232429] border-neutral-700/60 text-neutral-300'
                  : 'bg-rose-900/90 border-rose-700 text-rose-200'
              }`}
              title={isMicOn ? 'Mute' : 'Unmute'}
            >
              {isMicOn ? <Mic01Icon className="w-4 h-4" /> : <MicOff01Icon className="w-4 h-4" />}
            </button>
            <button
              onClick={handleToggleCam}
              className={`p-2 rounded-xl border transition-colors ${
                isCamOn
                  ? 'bg-[#232429] border-neutral-700/60 text-neutral-300'
                  : 'bg-rose-900/90 border-rose-700 text-rose-200'
              }`}
              title={isCamOn ? 'Cam off' : 'Cam on'}
            >
              {isCamOn ? <CameraVideoIcon className="w-4 h-4" /> : <CameraOff01Icon className="w-4 h-4" />}
            </button>

            {/* Mobile Tab Switcher [Video] [Chat] */}
            <div className="flex items-center bg-[#232429] p-0.5 rounded-xl border border-neutral-700/60">
              <button
                onClick={() => setMobileTab('video')}
                className={`px-2.5 py-1.5 rounded-lg font-bold text-xs flex items-center gap-1 transition-all ${
                  mobileTab === 'video'
                    ? 'bg-neutral-800 text-white shadow-sm'
                    : 'text-neutral-400'
                }`}
              >
                <CameraVideoIcon className="w-3.5 h-3.5" />
                <span>Video</span>
              </button>
              <button
                onClick={() => {
                  setMobileTab('chat');
                  setUnreadCount(0);
                }}
                className={`px-2.5 py-1.5 rounded-lg font-bold text-xs flex items-center gap-1 transition-all relative ${
                  mobileTab === 'chat'
                    ? 'bg-neutral-800 text-white shadow-sm'
                    : 'text-neutral-400'
                }`}
              >
                <Message01Icon className="w-3.5 h-3.5" />
                <span>Chat</span>
                {unreadCount > 0 && (
                  <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
                )}
              </button>
            </div>
          </div>
        </div>

        {/* ROW 2: Preferences Filter Bar (Horizontal Smooth Scroll on Mobile, Flex on Desktop) */}
        <div className="flex items-center gap-2 overflow-x-auto no-scrollbar py-0.5 text-xs whitespace-nowrap scroll-smooth">
          {/* Chat Mode Toggle: Video / Text (Desktop & Mobile) */}
          <div className="flex items-center bg-[#232429] p-0.5 rounded-xl border border-neutral-700/60 shrink-0">
            <button
              onClick={() => setChatMode('video')}
              className={`px-2.5 sm:px-3 py-1.5 rounded-lg font-bold flex items-center gap-1.5 transition-colors ${
                chatMode === 'video'
                  ? 'bg-neutral-800 text-white shadow-sm'
                  : 'text-neutral-400 hover:text-white'
              }`}
            >
              <CameraVideoIcon className="w-3.5 h-3.5" />
              <span>Video</span>
            </button>
            <button
              onClick={() => setChatMode('text')}
              className={`px-2.5 sm:px-3 py-1.5 rounded-lg font-bold flex items-center gap-1.5 transition-colors ${
                chatMode === 'text'
                  ? 'bg-neutral-800 text-white shadow-sm'
                  : 'text-neutral-400 hover:text-white'
              }`}
            >
              <Message01Icon className="w-3.5 h-3.5" />
              <span>Text</span>
            </button>
          </div>

          {/* Country Selector Dropdown */}
          <div className="flex items-center bg-[#232429] rounded-xl border border-neutral-700/60 px-2 py-1 shrink-0">
            <span className="text-sm sm:text-base mr-1.5">{currentCountryObj.flag}</span>
            <select
              value={selectedCountry}
              onChange={(e) => setSelectedCountry(e.target.value)}
              className="bg-transparent text-white font-semibold text-xs focus:outline-none cursor-pointer pr-1"
            >
              {COUNTRIES.map((c) => (
                <option key={c.code} value={c.code} className="bg-[#1e1f24] text-white">
                  {c.flag} {c.name}
                </option>
              ))}
            </select>
          </div>

          {/* Interests Popover Button */}
          <div className="relative shrink-0" ref={interestsPopoverRef}>
            <button
              onClick={() => setShowInterestsModal(!showInterestsModal)}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-xl border font-semibold transition-colors ${
                selectedInterests.length > 0
                  ? 'bg-emerald-600/15 border-emerald-500/50 text-emerald-400'
                  : 'bg-[#232429] border-neutral-700/60 text-neutral-300 hover:text-white'
              }`}
            >
              <Tag01Icon className="w-3.5 h-3.5" />
              <span>Interests</span>
              {selectedInterests.length > 0 && (
                <span className="px-1.5 py-0.2 bg-emerald-500 text-black font-extrabold text-[10px] rounded-full">
                  {selectedInterests.length}
                </span>
              )}
            </button>

            {/* Interests Dialog (Centered Sheet on Mobile, Popover on Desktop) */}
            {showInterestsModal && (
              <div className="fixed inset-0 z-50 flex items-center justify-center p-3 bg-black/70 backdrop-blur-xs md:absolute md:inset-auto md:bg-transparent md:backdrop-blur-none md:p-0 md:left-0 md:mt-2">
                <div className="w-full max-w-sm rounded-2xl border border-neutral-700 bg-[#1c1d22] shadow-2xl p-4 space-y-3 animate-in fade-in zoom-in-95 duration-100">
                  <div className="flex items-center justify-between pb-2 border-b border-neutral-800">
                    <span className="font-bold text-white text-xs sm:text-sm">Matching Interests</span>
                    <div className="flex items-center gap-2">
                      <button
                        onClick={() => setSelectedInterests([])}
                        className="text-[11px] text-neutral-400 hover:text-rose-400"
                      >
                        Clear All
                      </button>
                      <button
                        onClick={() => setShowInterestsModal(false)}
                        className="p-1 rounded-md text-neutral-400 hover:text-white hover:bg-neutral-800"
                      >
                        ✕
                      </button>
                    </div>
                  </div>

                  <div className="flex flex-wrap gap-1.5 max-h-52 overflow-y-auto pr-1">
                    {POPULAR_INTERESTS.map((item) => {
                      const isSelected = selectedInterests.includes(item.id);
                      return (
                        <button
                          key={item.id}
                          onClick={() => toggleInterest(item.id)}
                          className={`px-2.5 py-1.5 rounded-lg text-xs font-medium flex items-center gap-1 transition-all ${
                            isSelected
                              ? 'bg-emerald-500 text-black font-bold'
                              : 'bg-neutral-800 text-neutral-300 hover:bg-neutral-700 hover:text-white'
                          }`}
                        >
                          <span>{item.emoji}</span>
                          <span>{item.label}</span>
                          {isSelected && <Tick02Icon className="w-3 h-3 stroke-2" />}
                        </button>
                      );
                    })}
                  </div>

                  {/* Add Custom Tag */}
                  <form onSubmit={addCustomInterest} className="pt-2 border-t border-neutral-800 flex gap-1.5">
                    <input
                      type="text"
                      value={customInterestInput}
                      onChange={(e) => setCustomInterestInput(e.target.value)}
                      placeholder="Add custom interest..."
                      className="flex-1 bg-neutral-900 border border-neutral-700 rounded-lg px-2.5 py-1 text-xs text-white placeholder-neutral-500 focus:outline-none focus:border-emerald-500"
                    />
                    <button
                      type="submit"
                      className="px-3 py-1 bg-emerald-600 hover:bg-emerald-500 text-white font-bold rounded-lg text-xs"
                    >
                      Add
                    </button>
                  </form>
                </div>
              </div>
            )}
          </div>

          {/* Language Selector Dropdown */}
          <div className="flex items-center bg-[#232429] rounded-xl border border-neutral-700/60 px-2.5 py-1.5 shrink-0">
            <span className="text-neutral-400 mr-1 text-[11px]">Lang:</span>
            <select
              value={selectedLanguage}
              onChange={(e) => setSelectedLanguage(e.target.value)}
              className="bg-transparent text-white font-semibold text-xs focus:outline-none cursor-pointer"
            >
              {SUPPORTED_LANGUAGES.map((lang) => (
                <option key={lang.code} value={lang.code} className="bg-[#1e1f24] text-white">
                  {lang.name} ({lang.native})
                </option>
              ))}
            </select>
          </div>

          {/* Pro Gender Filter Button / Status */}
          <div className="relative shrink-0" ref={genderPopoverRef}>
            <button
              onClick={() => setShowGenderFilterModal(!showGenderFilterModal)}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-xl border font-bold transition-all ${
                preferredGender === 'female'
                  ? 'bg-pink-500/15 border-pink-500/50 text-pink-300 ring-1 ring-pink-500/40 shadow-sm'
                  : preferredGender === 'male'
                  ? 'bg-blue-500/15 border-blue-500/50 text-blue-300 ring-1 ring-blue-500/40 shadow-sm'
                  : isPro
                  ? 'bg-amber-500/10 border-amber-500/40 text-amber-300'
                  : 'bg-[#232429] border-neutral-700/60 text-neutral-300 hover:text-white'
              }`}
              title="Filter by partner gender"
            >
              <SparklesIcon className="w-3.5 h-3.5 text-amber-400" />
              <span>
                {preferredGender === 'female'
                  ? 'Female Alone'
                  : preferredGender === 'male'
                  ? 'Male Alone'
                  : isPro
                  ? 'Any Gender'
                  : 'Gender (Pro)'}
              </span>
            </button>

            {/* Gender Filter Dropdown (Pro Gate for Female Alone) */}
            {showGenderFilterModal && (
              <div className="fixed inset-0 z-50 flex items-center justify-center p-3 bg-black/70 backdrop-blur-xs md:absolute md:inset-auto md:bg-transparent md:backdrop-blur-none md:p-0 md:right-0 md:mt-2">
                <div className="w-68 rounded-2xl border border-neutral-700 bg-[#1c1d22] shadow-2xl p-3 space-y-2 text-xs animate-in fade-in zoom-in-95 duration-100">
                  <div className="flex items-center justify-between pb-2 border-b border-neutral-800">
                    <div>
                      <span className="font-bold text-white text-xs">Filter Partner Gender</span>
                      <p className="text-[10px] text-neutral-400">Who do you want to meet?</p>
                    </div>
                    <button
                      onClick={() => setShowGenderFilterModal(false)}
                      className="p-1 rounded-md text-neutral-400 hover:text-white"
                    >
                      ✕
                    </button>
                  </div>

                  {/* Option 1: Any Gender (Free) */}
                  <button
                    onClick={() => {
                      setPreferredGender('any');
                      setShowGenderFilterModal(false);
                    }}
                    className={`w-full text-left p-2 rounded-xl transition-all flex items-center justify-between ${
                      preferredGender === 'any'
                        ? 'bg-emerald-500/20 text-emerald-300 font-bold border border-emerald-500/30'
                        : 'text-neutral-300 hover:bg-neutral-800'
                    }`}
                  >
                    <div className="flex items-center gap-2.5">
                      <div className="w-7 h-7 rounded-lg bg-emerald-500/20 p-0.5 shrink-0">
                        <ThreeDGlobeIcon className="w-full h-full" />
                      </div>
                      <div>
                        <p className="font-bold">Any Gender (Fastest)</p>
                        <p className="text-[10px] text-neutral-400">100% Free · Instant match</p>
                      </div>
                    </div>
                    {preferredGender === 'any' && <span className="text-emerald-400 font-bold">✓</span>}
                  </button>

                  {/* Option 2: Female Alone (PRO) */}
                  <button
                    onClick={() => {
                      if (isPro) {
                        setPreferredGender('female');
                        setShowGenderFilterModal(false);
                      } else {
                        setShowGenderFilterModal(false);
                        onOpenUpgradeModal(
                          'Connecting with Female partners alone requires U-R-LIVE Pro (₹299/month).'
                        );
                      }
                    }}
                    className={`w-full text-left p-2 rounded-xl transition-all flex items-center justify-between ${
                      preferredGender === 'female'
                        ? 'bg-pink-500/20 text-pink-300 font-bold border border-pink-500/30'
                        : 'text-neutral-300 hover:bg-neutral-800'
                    }`}
                  >
                    <div className="flex items-center gap-2.5">
                      <div className="w-7 h-7 rounded-lg bg-pink-500/20 p-0.5 shrink-0">
                        <ThreeDFemaleAvatar className="w-full h-full" />
                      </div>
                      <div>
                        <div className="flex items-center gap-1.5">
                          <span className="font-bold">Female Alone</span>
                          <span className="text-[9px] font-extrabold bg-gradient-to-r from-amber-500 to-pink-500 text-white px-1.5 py-0.2 rounded-full">
                            PRO
                          </span>
                        </div>
                        <p className="text-[10px] text-neutral-400">Verified female strangers</p>
                      </div>
                    </div>
                    {isPro ? (
                      preferredGender === 'female' && <span className="text-pink-400 font-bold">✓</span>
                    ) : (
                      <span className="text-[10px] text-amber-400 font-bold">₹299</span>
                    )}
                  </button>

                  {/* Option 3: Male Alone (PRO) */}
                  <button
                    onClick={() => {
                      if (isPro) {
                        setPreferredGender('male');
                        setShowGenderFilterModal(false);
                      } else {
                        setShowGenderFilterModal(false);
                        onOpenUpgradeModal(
                          'Connecting with Male partners alone requires U-R-LIVE Pro (₹299/month).'
                        );
                      }
                    }}
                    className={`w-full text-left p-2 rounded-xl transition-all flex items-center justify-between ${
                      preferredGender === 'male'
                        ? 'bg-blue-500/20 text-blue-300 font-bold border border-blue-500/30'
                        : 'text-neutral-300 hover:bg-neutral-800'
                    }`}
                  >
                    <div className="flex items-center gap-2.5">
                      <div className="w-7 h-7 rounded-lg bg-blue-500/20 p-0.5 shrink-0">
                        <ThreeDMaleAvatar className="w-full h-full" />
                      </div>
                      <div>
                        <div className="flex items-center gap-1.5">
                          <span className="font-bold">Male Alone</span>
                          <span className="text-[9px] font-extrabold bg-gradient-to-r from-amber-500 to-blue-500 text-white px-1.5 py-0.2 rounded-full">
                            PRO
                          </span>
                        </div>
                        <p className="text-[10px] text-neutral-400">Verified male strangers</p>
                      </div>
                    </div>
                    {isPro ? (
                      preferredGender === 'male' && <span className="text-blue-400 font-bold">✓</span>
                    ) : (
                      <span className="text-[10px] text-amber-400 font-bold">₹299</span>
                    )}
                  </button>
                </div>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* ======================================================== */}
      {/* 3. CHAT WORKSPACE (Responsive Desktop & Mobile)          */}
      {/* ======================================================== */}
      {/*
        Desktop (md:): Always visible at bottom with fixed height.
        Mobile (<md): Visible when mobileTab === 'chat', fills remaining height.
      */}
      <div
        className={`flex-col bg-[#141519] border-t border-neutral-800 ${
          mobileTab === 'chat'
            ? 'flex flex-1 min-h-0'
            : 'hidden md:flex md:shrink-0 md:h-52 lg:h-56'
        }`}
      >
        {/* Chat Header Status */}
        <div className="py-1.5 px-3 bg-[#18191e] border-b border-neutral-800/80 flex items-center justify-between text-[11px] text-neutral-400 shrink-0">
          <div className="flex items-center gap-2 truncate">
            <span
              className={`w-2 h-2 rounded-full shrink-0 ${
                isConnected
                  ? 'bg-emerald-400'
                  : isSearching
                  ? 'bg-amber-400 animate-pulse'
                  : 'bg-neutral-600'
              }`}
            />
            <span className="font-semibold text-neutral-300 truncate">
              {isConnected && partner
                ? `Chatting with ${partner.name} from ${partner.country}`
                : statusMessage}
            </span>
          </div>

          <div className="hidden sm:flex items-center gap-3 text-neutral-500 shrink-0">
            <span>Enter to Send</span>
            <span>·</span>
            <span>Space: Next</span>
            <span>·</span>
            <span>Esc: Stop</span>
          </div>
        </div>

        {/* Message Stream */}
        <div className="flex-1 min-h-0 overflow-y-auto p-3 space-y-2 text-xs">
          {messages.length === 0 ? (
            <div className="h-full flex flex-col items-center justify-center text-center text-neutral-500 text-xs py-4">
              {isConnected ? (
                <p>Say hello to your partner! 👋 Start typing below.</p>
              ) : (
                <p>Chat will activate when connected to a live partner.</p>
              )}
            </div>
          ) : (
            messages.map((m) => (
              <div
                key={m.id}
                className={`flex flex-col ${m.isLocal ? 'items-end' : 'items-start'}`}
              >
                <div
                  className={`px-3 py-1.5 rounded-xl max-w-[85%] sm:max-w-[70%] break-words ${
                    m.isLocal
                      ? 'bg-emerald-600 text-white rounded-tr-xs'
                      : 'bg-[#22242a] text-neutral-100 rounded-tl-xs border border-neutral-700/60'
                  }`}
                >
                  {m.text}
                </div>
              </div>
            ))
          )}
          <div ref={chatMessagesEndRef} />
        </div>

        {/* Message Composer (Input + Send button with Safe-area padding) */}
        <form
          onSubmit={handleSendMessage}
          className="p-2 sm:p-2.5 bg-[#17181c] border-t border-neutral-800 flex items-center gap-2 shrink-0 pb-safe"
        >
          <input
            ref={messageInputRef}
            type="text"
            value={chatInput}
            onChange={(e) => setChatInput(e.target.value)}
            placeholder={
              isConnected
                ? 'Type a message and press Enter...'
                : 'Connect to stranger to start messaging...'
            }
            disabled={!isConnected}
            className="flex-1 bg-[#0f1013] border border-neutral-700/80 rounded-xl px-3.5 py-2 text-sm sm:text-xs text-white placeholder-neutral-500 focus:outline-none focus:border-emerald-500 disabled:opacity-50 disabled:cursor-not-allowed"
          />
          <button
            type="submit"
            disabled={!isConnected || !chatInput.trim()}
            className="bg-emerald-600 hover:bg-emerald-500 active:bg-emerald-700 disabled:bg-neutral-800 disabled:text-neutral-500 text-white font-bold px-4 py-2 rounded-xl text-xs flex items-center gap-1.5 transition-all active:scale-95 shrink-0 min-h-[38px]"
          >
            <SentIcon className="w-3.5 h-3.5" />
            <span className="hidden sm:inline">Send</span>
          </button>
        </form>
      </div>
    </div>
  );
};
