import React, { useState } from 'react';
import { Link } from 'react-router-dom';
import { useApp } from '../context/AppContext';

export interface LandingViewProps {
  onStartChat: (mode?: 'video' | 'text') => void;
  onOpenGoogleModal?: () => void;
  onNavigateToSafety?: () => void;
  isGoogleUser?: boolean;
  googleEnabled?: boolean;
}

export const LandingView: React.FC<LandingViewProps> = ({
  onStartChat,
}) => {
  const { interests, setInterests } = useApp();
  const [tagInput, setTagInput] = useState('');
  const [openFaq, setOpenFaq] = useState<number | null>(null);

  const handleAddTag = (raw: string) => {
    const cleaned = raw.trim().replace(/^#+/, '').slice(0, 32);
    if (!cleaned) return;
    if (!interests.some((t) => t.toLowerCase() === cleaned.toLowerCase())) {
      setInterests([...interests, cleaned]);
    }
    setTagInput('');
  };

  const handleRemoveTag = (tagToRemove: string) => {
    setInterests(interests.filter((t) => t !== tagToRemove));
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter' || e.key === ',') {
      e.preventDefault();
      handleAddTag(tagInput);
    } else if (e.key === 'Backspace' && !tagInput && interests.length > 0) {
      handleRemoveTag(interests[interests.length - 1]);
    }
  };

  const faqs = [
    {
      q: 'How does interest matching work?',
      a: 'When you enter topics you want to talk about, U-R-LIVE looks for other online users who entered matching tags. If a match is found, you are connected immediately; otherwise, you are paired with a random stranger.',
    },
    {
      q: 'How does U-R-LIVE help keep chats safer?',
      a: 'We enforce an 18+ age restriction, utilize automated real-time moderation, and empower every user with one-click report and instant block tools. Violators of community guidelines are permanently banned.',
    },
    {
      q: 'Why choose U-R-LIVE for online video and text chat?',
      a: 'U-R-LIVE provides peer-to-peer encrypted WebRTC connections with zero recordings, no account or credit card required, instant matchmaking, and the flexibility to switch between text and video at any time.',
    },
    {
      q: 'Can I use U-R-LIVE on my phone?',
      a: 'Yes! U-R-LIVE works natively in all modern mobile browsers on both iOS and Android without needing to download any app from an app store.',
    },
  ];

  return (
    <div className="relative min-h-[calc(100vh-64px)] w-full overflow-hidden bg-[#f8f7ff] dark:bg-[#07060d] text-neutral-900 dark:text-neutral-100 flex flex-col justify-between transition-colors">
      {/* Decorative ambient background blobs (Image 1 style) */}
      <div
        className="pointer-events-none absolute -top-32 -right-32 h-96 w-96 rounded-full bg-purple-300/35 dark:bg-purple-900/15 blur-3xl"
        aria-hidden="true"
      />
      <div
        className="pointer-events-none absolute -bottom-32 -left-32 h-96 w-96 rounded-full bg-indigo-300/35 dark:bg-indigo-900/15 blur-3xl"
        aria-hidden="true"
      />

      <main className="relative z-10 mx-auto w-full max-w-3xl px-4 py-8 sm:py-12 flex-1 flex flex-col justify-center">
        {/* Main Card Container */}
        <div className="w-full rounded-3xl border border-neutral-200/80 dark:border-white/10 bg-white dark:bg-[#121024] p-6 shadow-[0_20px_60px_-15px_rgba(124,58,237,0.08)] dark:shadow-[0_20px_60px_-15px_rgba(0,0,0,0.6)] sm:p-12 transition-colors">
          {/* Header */}
          <div className="text-center">
            <h1 className="font-display text-3xl font-extrabold tracking-tight text-neutral-900 dark:text-white sm:text-4xl">
              Live Video &amp; Text Chat
            </h1>
            <p className="mx-auto mt-3 max-w-lg text-sm leading-relaxed text-neutral-500 dark:text-neutral-400">
              Ready to connect? U-R-LIVE pairs you for live video or text chat with people who share your interests. Fast, moderated, and time to start mingling!
            </p>
          </div>

          {/* Text or Video Choice Buttons */}
          <div className="mt-8 flex items-center justify-center gap-4">
            <button
              type="button"
              onClick={() => onStartChat('text')}
              className="flex h-14 min-w-[130px] items-center justify-center rounded-2xl border-2 border-[#7c3aed] bg-white dark:bg-transparent px-8 text-lg font-bold text-[#7c3aed] dark:text-[#a78bfa] shadow-sm transition hover:bg-[#7c3aed]/10 active:scale-95 cursor-pointer"
            >
              Text
            </button>
            <span className="text-xs font-semibold text-neutral-400 dark:text-neutral-500">or</span>
            <button
              type="button"
              onClick={() => onStartChat('video')}
              className="flex h-14 min-w-[130px] items-center justify-center rounded-2xl bg-[#6d28d9] hover:bg-[#5b21b6] px-8 text-lg font-bold text-white shadow-lg shadow-purple-600/30 transition hover:shadow-purple-600/40 active:scale-95 cursor-pointer"
            >
              Video
            </button>
          </div>

          {/* Interest Tags Input */}
          <div className="mt-8">
            <h2 className="mb-2 text-center text-sm font-bold text-neutral-800 dark:text-neutral-200">
              What do you want to talk about?
            </h2>

            <div className="mx-auto flex max-w-md flex-wrap items-center gap-1.5 rounded-xl border border-neutral-200 dark:border-white/10 bg-neutral-50/70 dark:bg-white/[0.03] p-2 transition focus-within:border-[#7c3aed] focus-within:ring-2 focus-within:ring-[#7c3aed]/20">
              {interests.map((tag) => (
                <span
                  key={tag}
                  className="inline-flex items-center gap-1 rounded-lg bg-[#7c3aed]/10 dark:bg-[#7c3aed]/25 px-2.5 py-1 text-xs font-bold text-[#6d28d9] dark:text-[#c4b5fd]"
                >
                  #{tag}
                  <button
                    type="button"
                    onClick={() => handleRemoveTag(tag)}
                    aria-label={`Remove #${tag}`}
                    className="ml-0.5 hover:text-rose-500"
                  >
                    ×
                  </button>
                </span>
              ))}
              <input
                type="text"
                value={tagInput}
                onChange={(e) => setTagInput(e.target.value)}
                onKeyDown={handleKeyDown}
                placeholder={interests.length === 0 ? 'Add your interests (optional)' : 'Add another tag…'}
                className="min-w-[160px] flex-1 bg-transparent px-2 py-1 text-center sm:text-left text-xs font-medium text-neutral-900 dark:text-white placeholder:text-neutral-400 dark:placeholder:text-neutral-500 focus:outline-none"
              />
            </div>
          </div>

          {/* 18+ Moderation Pill */}
          <div className="mt-5 flex justify-center">
            <div className="inline-flex items-center gap-1.5 rounded-full border border-purple-200 dark:border-purple-900/50 bg-purple-50 dark:bg-purple-950/40 px-4 py-1.5 text-xs font-semibold text-purple-700 dark:text-purple-300">
              <span className="text-sm">💬</span>
              <span>18+ Only · Chats are moderated</span>
            </div>
          </div>

          {/* 4 Feature Highlights Grid */}
          <div className="mt-10 grid grid-cols-2 gap-3 sm:grid-cols-4">
            <div className="flex flex-col items-center rounded-2xl border border-neutral-100 dark:border-white/[0.06] bg-neutral-50/60 dark:bg-white/[0.02] p-4 text-center">
              <div className="mb-2 flex h-9 w-9 items-center justify-center rounded-full bg-purple-100 dark:bg-purple-900/40 text-purple-600 dark:text-purple-300">
                <svg className="h-5 w-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <circle cx="12" cy="12" r="10" />
                  <circle cx="12" cy="12" r="6" />
                  <circle cx="12" cy="12" r="2" />
                </svg>
              </div>
              <h3 className="text-xs font-bold text-neutral-900 dark:text-white">Interest-Based Matching</h3>
              <p className="mt-1 text-[11px] leading-relaxed text-neutral-500 dark:text-neutral-400">
                Add topics you love and get paired with people who share them.
              </p>
            </div>

            <div className="flex flex-col items-center rounded-2xl border border-neutral-100 dark:border-white/[0.06] bg-neutral-50/60 dark:bg-white/[0.02] p-4 text-center">
              <div className="mb-2 flex h-9 w-9 items-center justify-center rounded-full bg-purple-100 dark:bg-purple-900/40 text-purple-600 dark:text-purple-300">
                <svg className="h-5 w-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z" />
                  <path d="M9 12l2 2 4-4" />
                </svg>
              </div>
              <h3 className="text-xs font-bold text-neutral-900 dark:text-white">Active Moderation</h3>
              <p className="mt-1 text-[11px] leading-relaxed text-neutral-500 dark:text-neutral-400">
                Automated systems and human mods work to keep chats in check.
              </p>
            </div>

            <div className="flex flex-col items-center rounded-2xl border border-neutral-100 dark:border-white/[0.06] bg-neutral-50/60 dark:bg-white/[0.02] p-4 text-center">
              <div className="mb-2 flex h-9 w-9 items-center justify-center rounded-full bg-purple-100 dark:bg-purple-900/40 text-purple-600 dark:text-purple-300">
                <svg className="h-5 w-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <circle cx="12" cy="12" r="10" />
                  <line x1="2" y1="12" x2="22" y2="12" />
                  <path d="M12 2a15.3 15.3 0 014 10 15.3 15.3 0 01-4 10 15.3 15.3 0 01-4-10 15.3 15.3 0 014-10z" />
                </svg>
              </div>
              <h3 className="text-xs font-bold text-neutral-900 dark:text-white">Global Community</h3>
              <p className="mt-1 text-[11px] leading-relaxed text-neutral-500 dark:text-neutral-400">
                Thousands of people online around the world, day and night.
              </p>
            </div>

            <div className="flex flex-col items-center rounded-2xl border border-neutral-100 dark:border-white/[0.06] bg-neutral-50/60 dark:bg-white/[0.02] p-4 text-center">
              <div className="mb-2 flex h-9 w-9 items-center justify-center rounded-full bg-purple-100 dark:bg-purple-900/40 text-purple-600 dark:text-purple-300">
                <svg className="h-5 w-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <polygon points="13 2 3 14 12 14 11 22 21 10 12 10 13 2" />
                </svg>
              </div>
              <h3 className="text-xs font-bold text-neutral-900 dark:text-white">Fast &amp; Seamless</h3>
              <p className="mt-1 text-[11px] leading-relaxed text-neutral-500 dark:text-neutral-400">
                Jump into real-time video or text conversations in seconds.
              </p>
            </div>
          </div>

          {/* Frequently Asked Questions */}
          <div className="mt-12 border-t border-neutral-100 dark:border-white/[0.08] pt-8">
            <h3 className="mb-6 text-center font-display text-xl font-bold text-neutral-900 dark:text-white">
              Frequently Asked Questions
            </h3>
            <div className="mx-auto flex max-w-2xl flex-col gap-2.5">
              {faqs.map((faq, i) => {
                const isOpen = openFaq === i;
                return (
                  <div
                    key={faq.q}
                    className="overflow-hidden rounded-xl border border-neutral-200/80 dark:border-white/[0.08] bg-neutral-50/50 dark:bg-white/[0.02] transition"
                  >
                    <button
                      type="button"
                      onClick={() => setOpenFaq(isOpen ? null : i)}
                      className="flex w-full items-center justify-between px-4 py-3.5 text-left text-xs font-bold text-neutral-800 dark:text-neutral-200 hover:text-purple-600 dark:hover:text-purple-400 transition"
                    >
                      <span>{faq.q}</span>
                      <span className="text-base leading-none text-neutral-400">{isOpen ? '−' : '+'}</span>
                    </button>
                    {isOpen && (
                      <div className="px-4 pb-3.5 text-xs leading-relaxed text-neutral-500 dark:text-neutral-400">
                        {faq.a}
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          </div>
        </div>
      </main>

      {/* Footer */}
      <footer className="relative z-10 w-full border-t border-neutral-200/80 dark:border-white/[0.06] bg-white/50 dark:bg-[#07060d]/50 px-4 py-4 text-xs text-neutral-500 dark:text-neutral-400">
        <div className="mx-auto flex max-w-3xl flex-col items-center justify-between gap-3 sm:flex-row">
          <span>&copy; {new Date().getFullYear()} U-R-LIVE.com</span>
          <div className="flex items-center gap-4">
            <Link to="/safety" className="hover:text-neutral-800 dark:hover:text-white transition">Rules</Link>
            <Link to="/safety" className="hover:text-neutral-800 dark:hover:text-white transition">Safety</Link>
            <Link to="/terms" className="hover:text-neutral-800 dark:hover:text-white transition">Terms</Link>
            <Link to="/privacy" className="hover:text-neutral-800 dark:hover:text-white transition">Privacy</Link>
          </div>
        </div>
      </footer>
    </div>
  );
};
