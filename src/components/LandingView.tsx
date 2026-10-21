import React, { useEffect, useState } from 'react';
import {
  CameraVideoIcon,
  Search01Icon,
  Globe02Icon,
  SparklesIcon,
  WebProtectionIcon,
  UserCircleIcon,
  ArrowRight01Icon,
  CheckmarkCircle01Icon,
  Cancel01Icon,
  Alert02Icon,
  LockIcon,
} from 'hugeicons-react';
import { api } from '../services/api';
import { Logo } from './Logo';

interface LandingViewProps {
  onStartChat: () => void;
  onOpenUpgradeModal: () => void;
  onOpenGoogleModal: () => void;
  onNavigateToSafety: () => void;
  isPro: boolean;
  isGoogleUser: boolean;
}

export const LandingView: React.FC<LandingViewProps> = ({
  onStartChat,
  onOpenUpgradeModal,
  onOpenGoogleModal,
  onNavigateToSafety,
  isPro,
  isGoogleUser,
}) => {
  const [metrics, setMetrics] = useState({
    queueLength: 0,
    activeMatches: 0,
    turnConfigured: false,
    status: 'connecting',
  });

  const [activeCategory, setActiveCategory] = useState<'all' | 'verified' | 'popular' | 'nearby'>('all');

  useEffect(() => {
    let isMounted = true;
    api
      .getSystemHealth()
      .then((data) => {
        if (isMounted) {
          setMetrics({
            queueLength: data.queueLength,
            activeMatches: data.activeMatches,
            turnConfigured: data.turnConfigured,
            status: data.status,
          });
        }
      })
      .catch((err) => console.warn('Could not load server health metrics:', err));

    const timer = setInterval(() => {
      api
        .getSystemHealth()
        .then((data) => {
          if (isMounted) {
            setMetrics({
              queueLength: data.queueLength,
              activeMatches: data.activeMatches,
              turnConfigured: data.turnConfigured,
              status: data.status,
            });
          }
        })
        .catch(() => {});
    }, 10000);

    return () => {
      isMounted = false;
      clearInterval(timer);
    };
  }, []);

  return (
    <div className="flex flex-col min-h-[calc(100vh-5rem)] bg-[#0B0B0C] text-neutral-100">
      {/* Category Pills (Airbnb Style Navigation Bar) */}
      <section className="border-b border-neutral-800/80 bg-[#121214]/80 backdrop-blur-md sticky top-20 z-30">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 flex items-center justify-between gap-6 overflow-x-auto py-3 text-xs scrollbar-none">
          <div className="flex items-center gap-2 sm:gap-4 shrink-0">
            <button
              onClick={() => setActiveCategory('all')}
              className={`flex items-center gap-2 px-4 py-2 rounded-full font-semibold transition-all ${
                activeCategory === 'all'
                  ? 'bg-neutral-800 text-white shadow-sm'
                  : 'text-neutral-400 hover:text-white hover:bg-neutral-900'
              }`}
            >
              <Globe02Icon className="w-4 h-4 text-[#FF385C]" />
              <span>Global Random</span>
            </button>

            <button
              onClick={() => setActiveCategory('verified')}
              className={`flex items-center gap-2 px-4 py-2 rounded-full font-semibold transition-all ${
                activeCategory === 'verified'
                  ? 'bg-neutral-800 text-white shadow-sm'
                  : 'text-neutral-400 hover:text-white hover:bg-neutral-900'
              }`}
            >
              <WebProtectionIcon className="w-4 h-4 text-emerald-400" />
              <span>18+ Verified Users</span>
            </button>

            <button
              onClick={() => setActiveCategory('popular')}
              className={`flex items-center gap-2 px-4 py-2 rounded-full font-semibold transition-all ${
                activeCategory === 'popular'
                  ? 'bg-neutral-800 text-white shadow-sm'
                  : 'text-neutral-400 hover:text-white hover:bg-neutral-900'
              }`}
            >
              <SparklesIcon className="w-4 h-4 text-amber-400" />
              <span>Pro Filter Queue</span>
            </button>
          </div>

          <div className="hidden sm:flex items-center gap-3 text-neutral-400 text-xs shrink-0">
            <span className="flex items-center gap-1.5 font-mono">
              <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
              <strong className="text-white font-semibold">{metrics.activeMatches}</strong> live matches
            </span>
          </div>
        </div>
      </section>

      {/* Hero Section */}
      <section className="relative overflow-hidden py-16 sm:py-24 border-b border-neutral-800/60">
        <div className="max-w-7xl mx-auto px-4 sm:px-6">
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-12 items-center">
            {/* Left Column */}
            <div className="lg:col-span-7 space-y-6">
              <div className="inline-flex items-center gap-2 px-3.5 py-1.5 text-xs font-semibold text-neutral-200 bg-neutral-900 border border-neutral-800 rounded-full shadow-sm">
                <span className="w-2 h-2 rounded-full bg-[#FF385C]" />
                <span className="font-bold text-white tracking-wide">U-R-LIVE</span>
                <span aria-hidden="true" className="text-neutral-600">·</span>
                <span>Adult Social Video Platform (18+)</span>
              </div>

              <h1 className="text-4xl sm:text-5xl lg:text-6xl font-extrabold tracking-tight text-white leading-[1.12] text-balance">
                Live random video chat, designed for connection.
              </h1>

              <p className="text-base sm:text-lg text-neutral-400 max-w-2xl leading-relaxed">
                Connect one-on-one with verified adults worldwide. Seamless WebRTC peer streaming, zero video storage, instant skip controls, and server-authoritative matchmaking.
              </p>

              {/* Action Buttons in Airbnb Pill Style */}
              <div className="flex flex-wrap items-center gap-3.5 pt-2">
                <button
                  onClick={onStartChat}
                  className="px-7 py-3.5 text-sm font-bold text-white rounded-full bg-gradient-to-r from-[#FF385C] to-[#E00B41] hover:from-[#E00B41] hover:to-[#D70438] shadow-lg shadow-[#FF385C]/30 transition-all active:scale-95 flex items-center gap-2.5"
                >
                  <CameraVideoIcon className="w-4 h-4 text-white" />
                  <span>Start Chatting Now</span>
                  <ArrowRight01Icon className="w-4 h-4" />
                </button>

                {!isGoogleUser ? (
                  <button
                    onClick={onOpenGoogleModal}
                    className="px-6 py-3.5 text-sm font-semibold text-white rounded-full bg-neutral-900 hover:bg-neutral-800 border border-neutral-700 shadow-sm hover:shadow-md transition-all active:scale-95 flex items-center gap-2.5"
                  >
                    {/* Google G Logo */}
                    <svg className="w-4 h-4" viewBox="0 0 24 24">
                      <path
                        fill="#4285F4"
                        d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"
                      />
                      <path
                        fill="#34A853"
                        d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"
                      />
                      <path
                        fill="#FBBC05"
                        d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.06H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.94l2.85-2.22.81-.63z"
                      />
                      <path
                        fill="#EA4335"
                        d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.06l3.66 2.84c.87-2.6 3.3-4.52 6.16-4.52z"
                      />
                    </svg>
                    <span>Sign in with Google</span>
                  </button>
                ) : (
                  <button
                    onClick={onOpenUpgradeModal}
                    className="px-6 py-3.5 text-sm font-semibold text-white rounded-full bg-neutral-900 hover:bg-neutral-800 border border-neutral-700 shadow-sm transition-all flex items-center gap-2"
                  >
                    <SparklesIcon className="w-4 h-4 text-[#FF385C]" />
                    <span>Explore Pro (₹299/mo)</span>
                  </button>
                )}
              </div>

              <div className="pt-2 text-xs text-neutral-400 flex items-center gap-2">
                <LockIcon className="w-3.5 h-3.5 text-[#FF385C]" />
                <span>Strictly 18+. Direct encrypted P2P video stream. Zero recordings stored.</span>
              </div>
            </div>

            {/* Right Column: Airbnb Styled Card */}
            <div className="lg:col-span-5">
              <div className="relative rounded-3xl border border-neutral-800 bg-[#161618] p-4 shadow-2xl">
                <div className="relative aspect-[4/3] rounded-2xl overflow-hidden bg-neutral-950 border border-neutral-800 flex flex-col justify-between p-5">
                  {/* Floating Top Badge */}
                  <div className="flex items-center justify-between text-xs">
                    <span className="px-3 py-1 rounded-full bg-black/60 backdrop-blur-md border border-neutral-700 text-white font-semibold flex items-center gap-1.5">
                      <span className="w-2 h-2 rounded-full bg-[#FF385C]" />
                      <span>U-R-LIVE Match</span>
                    </span>
                    <span className="px-2.5 py-1 rounded-full bg-black/60 backdrop-blur-md text-[11px] font-mono text-neutral-300">
                      720p HD P2P
                    </span>
                  </div>

                  {/* Center graphic: Colourful Streaming Logo */}
                  <div className="my-auto text-center space-y-3">
                    <div className="flex justify-center">
                      <Logo size="xl" showText={false} />
                    </div>
                    <div>
                      <p className="text-base font-bold text-white tracking-tight">Instant Connection</p>
                      <p className="text-xs text-neutral-400">Match with compatible peers on U-R-LIVE</p>
                    </div>
                  </div>

                  {/* Bottom bar preview */}
                  <div className="flex items-center justify-between pt-3 border-t border-neutral-900 text-xs text-neutral-400">
                    <span>Global Random Queue</span>
                    <span className="text-emerald-400 font-semibold">STUN + TURN Active</span>
                  </div>
                </div>

                <div className="mt-3 flex items-center justify-between px-2 text-xs text-neutral-400">
                  <span>Fast atomic matchmaking</span>
                  <span className="font-mono text-neutral-300">Zero duplicate pairs</span>
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Live Telemetry Strip */}
      <section className="border-b border-neutral-800/60 bg-[#0E0E10] py-6">
        <div className="max-w-7xl mx-auto px-4 sm:px-6">
          <div className="grid grid-cols-2 md:grid-cols-4 gap-6 text-center">
            <div>
              <p className="text-xs text-neutral-400 uppercase tracking-wider font-semibold">Active Queue</p>
              <p className="text-2xl font-bold font-mono tabular-nums text-white mt-1">
                {metrics.queueLength} <span className="text-xs font-normal text-neutral-400">waiting</span>
              </p>
            </div>
            <div>
              <p className="text-xs text-neutral-400 uppercase tracking-wider font-semibold">Connected Sessions</p>
              <p className="text-2xl font-bold font-mono tabular-nums text-[#FF385C] mt-1">
                {metrics.activeMatches} <span className="text-xs font-normal text-neutral-400">live</span>
              </p>
            </div>
            <div>
              <p className="text-xs text-neutral-400 uppercase tracking-wider font-semibold">System State</p>
              <p className="text-2xl font-bold text-emerald-400 mt-1 capitalize">
                {metrics.status}
              </p>
            </div>
            <div>
              <p className="text-xs text-neutral-400 uppercase tracking-wider font-semibold">Encryption</p>
              <p className="text-2xl font-bold font-mono tabular-nums text-white mt-1">
                P2P DTLS/SRTP
              </p>
            </div>
          </div>
        </div>
      </section>

      {/* How It Works (Airbnb Step Cards) */}
      <section className="py-20 border-b border-neutral-800/60 bg-[#0F0F11]">
        <div className="max-w-7xl mx-auto px-4 sm:px-6">
          <div className="text-center max-w-2xl mx-auto mb-14 space-y-2">
            <h2 className="text-xs font-bold text-[#FF385C] uppercase tracking-widest">Simple & Fast</h2>
            <p className="text-3xl font-extrabold text-white tracking-tight">How U-R-LIVE Works</p>
            <p className="text-neutral-400 text-sm">
              Connect effortlessly with new people in seconds from your web browser.
            </p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            <div className="p-7 rounded-3xl border border-neutral-800 bg-[#161618] space-y-4 hover:border-neutral-700 transition-colors">
              <div className="w-10 h-10 rounded-full bg-gradient-to-r from-[#FF385C] to-[#E00B41] text-white flex items-center justify-center font-bold text-sm shadow-md">
                1
              </div>
              <h3 className="text-lg font-bold text-white">Enable Camera & Mic</h3>
              <p className="text-xs text-neutral-400 leading-relaxed">
                Confirm you are 18+ and grant browser media permissions. Audio and video remain encrypted locally on your device.
              </p>
            </div>

            <div className="p-7 rounded-3xl border border-neutral-800 bg-[#161618] space-y-4 hover:border-neutral-700 transition-colors">
              <div className="w-10 h-10 rounded-full bg-gradient-to-r from-[#FF385C] to-[#E00B41] text-white flex items-center justify-center font-bold text-sm shadow-md">
                2
              </div>
              <h3 className="text-lg font-bold text-white">Instant Random Match</h3>
              <p className="text-xs text-neutral-400 leading-relaxed">
                Our server pair you with an available compatible peer. Free users match purely at random; Pro users can specify preferences.
              </p>
            </div>

            <div className="p-7 rounded-3xl border border-neutral-800 bg-[#161618] space-y-4 hover:border-neutral-700 transition-colors">
              <div className="w-10 h-10 rounded-full bg-gradient-to-r from-[#FF385C] to-[#E00B41] text-white flex items-center justify-center font-bold text-sm shadow-md">
                3
              </div>
              <h3 className="text-lg font-bold text-white">Chat, Skip or Report</h3>
              <p className="text-xs text-neutral-400 leading-relaxed">
                Enjoy meeting new friends, or hit "Next" (Spacebar) to jump to the next match. Block and report any misconduct with one click.
              </p>
            </div>
          </div>
        </div>
      </section>

      {/* Pricing Section (Exactly Two Plans: FREE ₹0 and PRO ₹299/mo) */}
      <section id="pricing-section" className="py-20 border-b border-neutral-800/60 bg-[#0B0B0C]">
        <div className="max-w-7xl mx-auto px-4 sm:px-6">
          <div className="text-center max-w-2xl mx-auto mb-14 space-y-2">
            <h2 className="text-xs font-bold text-[#FF385C] uppercase tracking-widest">Simple Pricing</h2>
            <p className="text-3xl font-extrabold text-white tracking-tight">Two Straightforward Plans</p>
            <p className="text-neutral-400 text-sm">
              Full free random video chat, or upgrade to Pro for preferred matching. Exactly two choices.
            </p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-8 max-w-4xl mx-auto">
            {/* Free Plan */}
            <div className="p-8 rounded-3xl border border-neutral-800 bg-[#161618] flex flex-col justify-between space-y-6">
              <div className="space-y-4">
                <div className="flex items-center justify-between">
                  <h3 className="text-xl font-bold text-white">Free Plan</h3>
                  <span className="text-xs font-semibold text-neutral-300 bg-neutral-800 px-3 py-1 rounded-full">
                    Standard
                  </span>
                </div>
                <div className="flex items-baseline gap-1">
                  <span className="text-4xl font-extrabold text-white font-mono">₹0</span>
                  <span className="text-xs text-neutral-400">/ forever</span>
                </div>
                <p className="text-xs text-neutral-400">
                  Full access to one-on-one live video chat with random strangers worldwide.
                </p>

                <div className="pt-4 border-t border-neutral-800/80 space-y-3 text-xs">
                  <div className="flex items-center gap-2.5 text-neutral-200">
                    <CheckmarkCircle01Icon className="w-4 h-4 text-emerald-400 shrink-0" />
                    <span>Random one-to-one video chat</span>
                  </div>
                  <div className="flex items-center gap-2.5 text-neutral-200">
                    <CheckmarkCircle01Icon className="w-4 h-4 text-emerald-400 shrink-0" />
                    <span>Camera & microphone controls</span>
                  </div>
                  <div className="flex items-center gap-2.5 text-neutral-200">
                    <CheckmarkCircle01Icon className="w-4 h-4 text-emerald-400 shrink-0" />
                    <span>Next / Skip and disconnect controls</span>
                  </div>
                  <div className="flex items-center gap-2.5 text-neutral-200">
                    <CheckmarkCircle01Icon className="w-4 h-4 text-emerald-400 shrink-0" />
                    <span>Abuse reporting & blocking</span>
                  </div>
                  <div className="flex items-center gap-2.5 text-neutral-500">
                    <Cancel01Icon className="w-4 h-4 text-neutral-600 shrink-0" />
                    <span>No gender preference filtering</span>
                  </div>
                  <div className="flex items-center gap-2.5 text-neutral-500">
                    <Cancel01Icon className="w-4 h-4 text-neutral-600 shrink-0" />
                    <span>No country location filtering</span>
                  </div>
                </div>
              </div>

              <button
                onClick={onStartChat}
                className="w-full py-3.5 text-xs font-bold text-white rounded-full bg-neutral-800 hover:bg-neutral-700 transition-colors shadow-sm"
              >
                Start Free Chat
              </button>
            </div>

            {/* Pro Plan */}
            <div className="p-8 rounded-3xl border-2 border-[#FF385C] bg-[#1A181A] relative flex flex-col justify-between space-y-6 shadow-2xl shadow-[#FF385C]/15">
              <div className="absolute -top-3.5 right-6 px-3.5 py-1 text-[11px] font-bold text-white bg-gradient-to-r from-[#FF385C] to-[#E00B41] rounded-full shadow-md">
                RECOMMENDED
              </div>

              <div className="space-y-4">
                <div className="flex items-center justify-between">
                  <h3 className="text-xl font-bold text-white flex items-center gap-2">
                    <span>Pro Plan</span>
                    <SparklesIcon className="w-4 h-4 text-[#FF385C]" />
                  </h3>
                  <span className="text-xs font-semibold text-[#FF385C] bg-[#FF385C]/10 px-3 py-1 rounded-full border border-[#FF385C]/30">
                    Full Filters
                  </span>
                </div>
                <div className="flex items-baseline gap-1">
                  <span className="text-4xl font-extrabold text-white font-mono">₹299</span>
                  <span className="text-xs text-neutral-400">/ month</span>
                </div>
                <p className="text-xs text-neutral-400">
                  Filter by preferred gender, country, and receive priority queue placement.
                </p>

                <div className="pt-4 border-t border-neutral-800/80 space-y-3 text-xs">
                  <div className="flex items-center gap-2.5 text-neutral-200 font-medium">
                    <CheckmarkCircle01Icon className="w-4 h-4 text-[#FF385C] shrink-0" />
                    <span>Everything in Free plan</span>
                  </div>
                  <div className="flex items-center gap-2.5 text-neutral-200 font-medium">
                    <CheckmarkCircle01Icon className="w-4 h-4 text-[#FF385C] shrink-0" />
                    <span>Preferred-gender matching (Male / Female)</span>
                  </div>
                  <div className="flex items-center gap-2.5 text-neutral-200 font-medium">
                    <CheckmarkCircle01Icon className="w-4 h-4 text-[#FF385C] shrink-0" />
                    <span>Country filtering (India, US, UK, Global)</span>
                  </div>
                  <div className="flex items-center gap-2.5 text-neutral-200 font-medium">
                    <CheckmarkCircle01Icon className="w-4 h-4 text-[#FF385C] shrink-0" />
                    <span>Priority queue placement</span>
                  </div>
                  <div className="flex items-center gap-2.5 text-neutral-200 font-medium">
                    <CheckmarkCircle01Icon className="w-4 h-4 text-[#FF385C] shrink-0" />
                    <span>Ad-free clean experience</span>
                  </div>
                  <div className="flex items-center gap-2.5 text-neutral-400 text-[11px] pt-1">
                    <span>Cancel anytime via account settings</span>
                  </div>
                </div>
              </div>

              {!isPro ? (
                <button
                  onClick={onOpenUpgradeModal}
                  className="w-full py-3.5 text-xs font-bold text-white rounded-full bg-gradient-to-r from-[#FF385C] to-[#E00B41] hover:from-[#E00B41] hover:to-[#D70438] shadow-lg shadow-[#FF385C]/30 transition-all active:scale-95 flex items-center justify-center gap-2"
                >
                  <SparklesIcon className="w-4 h-4" />
                  <span>Upgrade to Pro — ₹299/mo</span>
                </button>
              ) : (
                <button
                  disabled
                  className="w-full py-3.5 text-xs font-semibold text-[#FF385C] bg-[#FF385C]/10 border border-[#FF385C]/30 rounded-full cursor-default"
                >
                  ✓ Current Plan Active
                </button>
              )}
            </div>
          </div>
        </div>
      </section>

      {/* Safety Notice */}
      <section className="py-10 bg-[#0B0B0C] text-neutral-400 border-t border-neutral-900 text-center">
        <div className="max-w-3xl mx-auto px-4 space-y-2">
          <p className="text-xs font-bold uppercase tracking-wider text-neutral-500">
            Responsible Platform Declaration
          </p>
          <p className="text-xs text-neutral-400 leading-relaxed">
            U-R-LIVE is strictly for adults (18+). Zero tolerance for CSAM, unmoderated lewd content, or non-consensual recordings.
          </p>
          <button
            onClick={onNavigateToSafety}
            className="text-xs text-[#FF385C] hover:underline font-semibold"
          >
            Read Community Safety & Moderation Policies
          </button>
        </div>
      </section>
    </div>
  );
};
