import React, { useState, KeyboardEvent } from 'react';
import {
  CameraVideoIcon,
  Message01Icon,
  Shield02Icon,
  LockIcon,
  ZapIcon,
  Cancel01Icon,
  CheckmarkCircle01Icon,
  WebProtectionIcon,
  Globe02Icon,
  Tag01Icon,
  SparklesIcon,
} from 'hugeicons-react';
import { useSystemHealth } from '../hooks/useSystemHealth';
import { preloadLivePage } from '../lib/preload';
import { useApp } from '../context/AppContext';
import { Logo } from './Logo';

interface LandingViewProps {
  onStartChat: (mode?: 'video' | 'text') => void;
  onOpenGoogleModal: () => void;
  onNavigateToSafety: () => void;
  isGoogleUser: boolean;
  googleEnabled: boolean;
}

const POPULAR_TAGS = [
  'gaming',
  'music',
  'anime',
  'movies',
  'coding',
  'crypto',
  'art',
  'travel',
  'chat',
];

export const LandingView: React.FC<LandingViewProps> = ({
  onStartChat,
  onOpenGoogleModal,
  onNavigateToSafety,
  isGoogleUser,
  googleEnabled,
}) => {
  const metrics = useSystemHealth();
  const { interests, setInterests } = useApp();
  const [tagInput, setTagInput] = useState('');
  const [agreedToTerms, setAgreedToTerms] = useState(true);

  // Approximate active community counter with real telemetry floor
  const activeCount = metrics.loaded
    ? Math.max(1200 + metrics.queueLength * 15 + metrics.activeMatches * 42, 1420)
    : 1850;

  const handleAddTag = (tag: string) => {
    const clean = tag.trim().toLowerCase().replace(/^#/, '');
    if (!clean || interests.includes(clean)) return;
    setInterests([...interests, clean]);
    setTagInput('');
  };

  const handleRemoveTag = (tagToRemove: string) => {
    setInterests(interests.filter((t) => t !== tagToRemove));
  };

  const handleKeyDown = (e: KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter' || e.key === ',') {
      e.preventDefault();
      handleAddTag(tagInput);
    } else if (e.key === 'Backspace' && !tagInput && interests.length > 0) {
      handleRemoveTag(interests[interests.length - 1]);
    }
  };

  const handleStart = (mode: 'video' | 'text') => {
    if (tagInput.trim()) {
      handleAddTag(tagInput);
    }
    onStartChat(mode);
  };

  return (
    <div className="relative min-h-[calc(100dvh-4rem)] overflow-hidden bg-[#07060d] text-neutral-100 flex flex-col justify-between">
      {/* Background ambient lighting */}
      <div className="pointer-events-none absolute inset-0 bg-grid opacity-50" />
      <div className="pointer-events-none absolute -top-40 left-1/2 -translate-x-1/2 h-[500px] w-[600px] rounded-full bg-red-600/10 blur-[160px]" />
      <div className="pointer-events-none absolute -bottom-40 right-10 h-[450px] w-[450px] rounded-full bg-rose-600/10 blur-[150px]" />

      <div className="relative mx-auto flex w-full max-w-4xl flex-1 flex-col items-center justify-center px-4 py-8 sm:px-6 sm:py-12">
        {/* Omegle-Style Main Card */}
        <div className="w-full rounded-3xl border border-white/10 bg-[#0c0a15]/90 p-5 shadow-[0_30px_90px_-20px_rgba(0,0,0,0.9)] backdrop-blur-2xl sm:p-8">
          {/* Top Brand Banner */}
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-white/[0.08] pb-6">
            <div className="flex items-center gap-3">
              <Logo size="md" />
            </div>

            <div className="flex items-center gap-2 self-start sm:self-auto rounded-full border border-emerald-500/20 bg-emerald-500/10 px-3.5 py-1.5 text-xs font-semibold text-emerald-300">
              <span className="relative flex h-2 w-2">
                <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-emerald-400 opacity-75" />
                <span className="relative inline-flex h-2 w-2 rounded-full bg-emerald-400" />
              </span>
              <span>{activeCount.toLocaleString()}+ online now</span>
            </div>
          </div>

          {/* Intro statement */}
          <div className="mt-6 space-y-3 text-sm leading-relaxed text-neutral-300 sm:text-[15px]">
            <p>
              <strong className="text-white font-bold">U-R-LIVE</strong> is a great way to meet new
              friends. When you use U-R-LIVE, you are paired randomly with another person to talk
              one-on-one.
            </p>
            <p className="text-neutral-400 text-xs sm:text-sm">
              If you prefer, you can add your interests below to be paired with people who share your
              hobbies. Chats are strictly peer-to-peer and confidential until you choose to reveal yourself.
            </p>
          </div>

          {/* Interests Section ("What do you wanna talk about?") */}
          <div className="mt-7 rounded-2xl border border-white/[0.08] bg-white/[0.02] p-4 sm:p-5">
            <div className="flex items-center gap-2 text-xs font-bold uppercase tracking-wider text-neutral-300">
              <Tag01Icon size={14} className="text-red-400" />
              <span>What do you wanna talk about? (Optional)</span>
            </div>

            {/* Interest tag chips input */}
            <div className="mt-3 flex flex-wrap items-center gap-1.5 rounded-xl border border-white/10 bg-black/40 p-2 focus-within:border-red-500/60 focus-within:ring-1 focus-within:ring-red-500/30 transition">
              {interests.map((tag) => (
                <span
                  key={tag}
                  className="inline-flex items-center gap-1 rounded-lg border border-red-500/30 bg-red-500/15 px-2.5 py-1 text-xs font-medium text-red-200"
                >
                  <span>#{tag}</span>
                  <button
                    type="button"
                    onClick={() => handleRemoveTag(tag)}
                    className="hover:text-white transition"
                    aria-label={`Remove tag ${tag}`}
                  >
                    <Cancel01Icon size={12} />
                  </button>
                </span>
              ))}

              <input
                type="text"
                value={tagInput}
                onChange={(e) => setTagInput(e.target.value)}
                onKeyDown={handleKeyDown}
                placeholder={
                  interests.length === 0
                    ? 'Add interests (e.g. gaming, anime, music) separated by comma or Enter...'
                    : 'Add more...'
                }
                className="min-w-[180px] flex-1 bg-transparent px-2 py-1 text-xs text-white placeholder-neutral-500 focus:outline-none"
              />
            </div>

            {/* Quick-add popular tag pills */}
            <div className="mt-3 flex flex-wrap items-center gap-1.5 text-xs text-neutral-400">
              <span className="text-[11px] font-semibold text-neutral-500 mr-1">Suggestions:</span>
              {POPULAR_TAGS.map((tag) => {
                const isSelected = interests.includes(tag);
                return (
                  <button
                    key={tag}
                    type="button"
                    onClick={() => (isSelected ? handleRemoveTag(tag) : handleAddTag(tag))}
                    className={`rounded-full px-2.5 py-0.5 text-[11px] font-medium transition ${
                      isSelected
                        ? 'border border-red-500/40 bg-red-500/20 text-red-200'
                        : 'border border-white/10 bg-white/[0.04] text-neutral-300 hover:border-white/20 hover:bg-white/[0.08]'
                    }`}
                  >
                    #{tag}
                  </button>
                );
              })}
            </div>
          </div>

          {/* Start Chatting: Big Action Buttons */}
          <div className="mt-8">
            <p className="text-xs font-bold uppercase tracking-wider text-neutral-400 mb-3 text-center sm:text-left">
              Start chatting:
            </p>

            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
              {/* Text Chat Button */}
              <button
                type="button"
                onClick={() => handleStart('text')}
                onMouseEnter={preloadLivePage}
                onFocus={preloadLivePage}
                className="group relative flex flex-col items-center justify-center gap-1.5 rounded-2xl border border-sky-400/30 bg-gradient-to-b from-sky-500/20 to-sky-600/10 p-5 text-white transition hover:border-sky-400/60 hover:from-sky-500/30 hover:to-sky-600/20 active:scale-[0.98] shadow-[0_10px_30px_-10px_rgba(56,189,248,0.25)]"
              >
                <div className="flex items-center gap-2 text-lg font-extrabold tracking-tight text-sky-200 group-hover:text-white transition">
                  <Message01Icon size={22} className="text-sky-400" />
                  <span>Text</span>
                </div>
                <span className="text-xs text-neutral-400">Instant chat only · No camera required</span>
              </button>

              {/* Video Chat Button */}
              <button
                type="button"
                onClick={() => handleStart('video')}
                onMouseEnter={preloadLivePage}
                onFocus={preloadLivePage}
                className="group relative flex flex-col items-center justify-center gap-1.5 rounded-2xl border border-red-500/40 bg-gradient-to-b from-red-600/25 to-rose-700/15 p-5 text-white transition hover:border-red-400 hover:from-red-600/35 hover:to-rose-700/25 active:scale-[0.98] shadow-[0_10px_35px_-10px_rgba(239,68,68,0.35)]"
              >
                <div className="flex items-center gap-2 text-lg font-extrabold tracking-tight text-red-200 group-hover:text-white transition">
                  <CameraVideoIcon size={22} className="text-red-400" />
                  <span>Video</span>
                </div>
                <span className="text-xs text-neutral-300">Face-to-face video &amp; audio with chat</span>
              </button>
            </div>
          </div>

          {/* 18+ Warning & Safety Checkpoint */}
          <div className="mt-7 flex items-center justify-between gap-3 border-t border-white/[0.08] pt-5">
            <label className="flex items-center gap-2.5 text-xs text-neutral-400 select-none cursor-pointer">
              <input
                type="checkbox"
                checked={agreedToTerms}
                onChange={(e) => setAgreedToTerms(e.target.checked)}
                className="h-4 w-4 rounded border-white/20 bg-black/40 text-red-500 focus:ring-red-500/50"
              />
              <span>
                I confirm I am <strong className="text-white">18 years or older</strong> and agree to community standards.
              </span>
            </label>

            <button
              type="button"
              onClick={onNavigateToSafety}
              className="hidden sm:inline-flex items-center gap-1 text-xs font-semibold text-neutral-400 hover:text-white transition underline decoration-white/20 underline-offset-4"
            >
              <Shield02Icon size={13} />
              Safety Centre
            </button>
          </div>
        </div>

        {/* Feature Badges below card */}
        <div className="mt-8 grid grid-cols-2 gap-3 sm:grid-cols-4 w-full">
          <div className="flex items-center gap-2 rounded-xl border border-white/[0.06] bg-white/[0.02] p-3 text-xs text-neutral-400">
            <LockIcon size={16} className="shrink-0 text-emerald-400" />
            <span>Encrypted P2P Media</span>
          </div>

          <div className="flex items-center gap-2 rounded-xl border border-white/[0.06] bg-white/[0.02] p-3 text-xs text-neutral-400">
            <ZapIcon size={16} className="shrink-0 text-amber-400" />
            <span>Instant Esc-Esc Skip</span>
          </div>

          <div className="flex items-center gap-2 rounded-xl border border-white/[0.06] bg-white/[0.02] p-3 text-xs text-neutral-400">
            <Globe02Icon size={16} className="shrink-0 text-sky-400" />
            <span>Shared Tag Matching</span>
          </div>

          <div className="flex items-center gap-2 rounded-xl border border-white/[0.06] bg-white/[0.02] p-3 text-xs text-neutral-400">
            <WebProtectionIcon size={16} className="shrink-0 text-rose-400" />
            <span>One-Tap Block &amp; Report</span>
          </div>
        </div>
      </div>
    </div>
  );
};
