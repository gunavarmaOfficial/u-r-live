import React from 'react';
import {
  ArrowRight01Icon,
  ArrowRight01Icon as ArrowNextIcon,
  CallEnd01Icon,
  CameraVideoIcon,
  Cancel01Icon,
  CheckmarkCircle01Icon,
  LanguageSkillIcon,
  LockIcon,
  Message01Icon,
  Mic01Icon,
  PlayIcon,
  Shield02Icon,
  SparklesIcon,
  WebProtectionIcon,
  ZapIcon,
} from 'hugeicons-react';
import { useSystemHealth } from '../hooks/useSystemHealth';
import { preloadLivePage } from '../lib/preload';
import { ThreeDFemaleAvatar, ThreeDMaleAvatar } from './ThreeDIcons';

interface LandingViewProps {
  onStartChat: () => void;
  onOpenUpgradeModal: () => void;
  onOpenGoogleModal: () => void;
  onNavigateToSafety: () => void;
  isPro: boolean;
  isGoogleUser: boolean;
  googleEnabled: boolean;
}

const GoogleGlyph: React.FC<{ className?: string }> = ({ className = 'h-4 w-4' }) => (
  <svg className={className} viewBox="0 0 24 24" aria-hidden="true">
    <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" />
    <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" />
    <path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.06H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.94l2.85-2.22.81-.63z" />
    <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.06l3.66 2.84c.87-2.6 3.3-4.52 6.16-4.52z" />
  </svg>
);

const FEATURES = [
  {
    icon: ZapIcon,
    title: 'Atomic matchmaking',
    body: 'A server-authoritative queue pairs two compatible people the instant they are both available. No polling, no stale sessions.',
    tone: 'from-[#8b5cf6]/25 to-[#6366f1]/10 text-[#c4b5fd]',
  },
  {
    icon: SparklesIcon,
    title: 'Precision filters',
    body: 'Pro members choose preferred gender, multiple countries, languages and shared interests — or leave it open for the fastest match.',
    tone: 'from-[#fbbf24]/25 to-[#f472b6]/10 text-[#fcd34d]',
  },
  {
    icon: LockIcon,
    title: 'Private by architecture',
    body: 'Video and audio travel directly between the two browsers over encrypted DTLS/SRTP. Nothing is recorded or stored on our servers.',
    tone: 'from-[#22d3ee]/25 to-[#0ea5e9]/10 text-[#67e8f9]',
  },
  {
    icon: Message01Icon,
    title: 'Chat that keeps up',
    body: 'Live text messages, typing indicators and unread toasts ride the same signaling channel, so the conversation never stops.',
    tone: 'from-[#f472b6]/25 to-[#8b5cf6]/10 text-[#f9a8d4]',
  },
  {
    icon: LanguageSkillIcon,
    title: 'Global by default',
    body: 'Match worldwide, or narrow the queue by country and language when you want a closer conversation.',
    tone: 'from-[#34d399]/25 to-[#22d3ee]/10 text-[#6ee7b7]',
  },
  {
    icon: WebProtectionIcon,
    title: 'Safety by design',
    body: 'One-tap report and block, an 18+ gate, rate-limited signaling, and a moderator dashboard behind every live session.',
    tone: 'from-[#fb7185]/25 to-[#f472b6]/10 text-[#fda4af]',
  },
];

const STEPS = [
  {
    title: 'Allow camera & mic',
    body: 'Confirm you are 18+ and grant browser media permissions. If a camera is unavailable, U-R-LIVE still connects you with a preview stream.',
  },
  {
    title: 'Get matched instantly',
    body: 'The queue pairs you with the next compatible adult. Set your preferences once, then keep the conversation going.',
  },
  {
    title: 'Talk, skip, repeat',
    body: 'Say hello, hit Next (Space) for someone new, and use one-tap report or block if anything feels off.',
  },
];

export const LandingView: React.FC<LandingViewProps> = ({
  onStartChat,
  onOpenUpgradeModal,
  onOpenGoogleModal,
  onNavigateToSafety,
  isPro,
  isGoogleUser,
  googleEnabled,
}) => {
  const metrics = useSystemHealth();

  const telemetry = [
    {
      label: 'In queue',
      value: metrics.loaded ? String(metrics.queueLength) : '—',
      suffix: metrics.loaded ? 'waiting' : 'checking',
      color: 'text-white',
    },
    {
      label: 'Live sessions',
      value: metrics.loaded ? String(metrics.activeMatches) : '—',
      suffix: metrics.loaded ? 'connected' : 'checking',
      color: 'text-emerald-300',
    },
    {
      label: 'Signaling',
      value: !metrics.loaded
        ? '—'
        : metrics.status === 'offline'
          ? 'Offline'
          : metrics.status === 'degraded'
            ? 'Degraded'
            : 'Online',
      suffix: 'websocket',
      color: 'text-[#a78bfa]',
    },
    {
      label: 'Relay',
      value: !metrics.loaded ? '—' : metrics.turnConfigured ? 'TURN' : 'STUN',
      suffix: metrics.loaded ? (metrics.turnConfigured ? 'fallback ready' : 'direct only') : 'checking',
      color: 'text-[#67e8f9]',
    },
  ];

  return (
    <div className="relative overflow-hidden bg-[#07060d] text-neutral-100">
      <div className="pointer-events-none absolute inset-0 bg-grid opacity-60" />
      {/* Large blur layers are desktop-only; they are the most expensive paint on phones. */}
      <div className="pointer-events-none absolute -left-40 top-0 hidden h-[520px] w-[520px] rounded-full bg-[#8b5cf6]/20 blur-[140px] sm:block" />
      <div className="pointer-events-none absolute -right-32 top-40 hidden h-[560px] w-[560px] rounded-full bg-[#22d3ee]/12 blur-[150px] sm:block" />
      <div className="pointer-events-none absolute bottom-0 left-1/3 hidden h-[420px] w-[420px] rounded-full bg-[#f472b6]/10 blur-[140px] sm:block" />

      {/* ---------------- Hero ---------------- */}
      <section className="relative mx-auto w-full max-w-7xl px-4 pb-16 pt-12 sm:px-6 sm:pb-24 sm:pt-20">
        <div className="grid items-center gap-14 lg:grid-cols-12 lg:gap-10">
          <div className="lg:col-span-6 xl:col-span-6">
            <div className="inline-flex items-center gap-2 rounded-full border border-white/[0.1] bg-white/[0.04] px-3 py-1.5 text-[11px] font-semibold text-neutral-300 backdrop-blur">
              <span className="relative flex h-2 w-2">
                <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-[#f472b6] opacity-60" />
                <span className="relative inline-flex h-2 w-2 rounded-full bg-[#f472b6]" />
              </span>
              <span className="text-white">
                {metrics.status === 'healthy' ? 'Servers online' : metrics.status === 'offline' ? 'Status unavailable' : 'Checking status…'}
              </span>
              <span className="text-neutral-600">·</span>
              <span>18+ adults only</span>
            </div>

            <h1 className="mt-6 font-display text-[2.75rem] font-extrabold leading-[1.04] tracking-tight text-white sm:text-6xl xl:text-[4.2rem]">
              Meet someone new,
              <br />
              <span className="animate-gradient bg-gradient-to-r from-[#f472b6] via-[#a78bfa] to-[#22d3ee] bg-clip-text text-transparent">
                face to face.
              </span>
            </h1>

            <p className="mt-6 max-w-xl text-[15px] leading-relaxed text-neutral-400 sm:text-base">
              U-R-LIVE is a live random video chat built for real conversation. Instant
              server-side matching, encrypted peer-to-peer streaming, zero recordings,
              and one-tap skip when you want to meet someone else.
            </p>

            <div className="mt-8 flex flex-col gap-3 sm:flex-row sm:items-center">
              <button
                onClick={onStartChat}
                onMouseEnter={preloadLivePage}
                onFocus={preloadLivePage}
                className="btn-primary group h-12 px-6 text-sm sm:h-[52px] sm:px-7"
              >
                <CameraVideoIcon className="h-4 w-4" />
                <span>Start video chat</span>
                <ArrowRight01Icon className="h-4 w-4 transition-transform group-hover:translate-x-0.5" />
              </button>

              {!isGoogleUser && googleEnabled ? (
                <button onClick={onOpenGoogleModal} className="btn-secondary h-12 px-5 text-sm sm:h-[52px]">
                  <GoogleGlyph />
                  <span>Continue with Google</span>
                </button>
              ) : isGoogleUser ? (
                <button onClick={onOpenUpgradeModal} className="btn-secondary h-12 px-5 text-sm sm:h-[52px]">
                  <SparklesIcon className="h-4 w-4 text-amber-300" />
                  <span>Explore Pro · ₹299</span>
                </button>
              ) : null}
            </div>

            <div className="mt-7 flex flex-wrap items-center gap-x-5 gap-y-2 text-[11px] font-medium text-neutral-500">
              <span className="inline-flex items-center gap-1.5">
                <LockIcon className="h-3.5 w-3.5 text-emerald-400" />
                End-to-end encrypted media
              </span>
              <span className="inline-flex items-center gap-1.5">
                <Shield02Icon className="h-3.5 w-3.5 text-[#a78bfa]" />
                18+ gate &amp; moderation
              </span>
              <span className="inline-flex items-center gap-1.5">
                <CameraVideoIcon className="h-3.5 w-3.5 text-[#22d3ee]" />
                Zero video retention
              </span>
            </div>
          </div>

          {/* Live preview mock */}
          <div className="lg:col-span-6 xl:col-span-6">
            <div className="relative mx-auto max-w-[540px]">
              <div className="pointer-events-none absolute -inset-6 rounded-[2.5rem] bg-gradient-to-tr from-[#8b5cf6]/25 via-transparent to-[#22d3ee]/25 blur-2xl" />

              <div className="surface-strong relative overflow-hidden rounded-[2rem] p-2.5 shadow-[0_50px_120px_-40px_rgba(0,0,0,0.95)]">
                <div className="overflow-hidden rounded-[1.6rem] bg-[#08070f]">
                  {/* window chrome */}
                  <div className="flex items-center justify-between border-b border-white/[0.06] px-4 py-2.5">
                    <div className="flex items-center gap-2.5">
                      <div className="flex items-center gap-1.5">
                        <span className="h-2 w-2 rounded-full bg-[#fb7185]/80" />
                        <span className="h-2 w-2 rounded-full bg-[#fbbf24]/80" />
                        <span className="h-2 w-2 rounded-full bg-[#34d399]/80" />
                      </div>
                      <span className="h-3 w-px bg-white/10" />
                      <div className="flex items-center gap-1.5">
                        <img src="/logo-icon.png" alt="UR Live" className="h-3.5 w-3.5 object-contain" />
                        <span className="font-display text-[11px] font-bold tracking-tight text-white/90">UR LIVE</span>
                      </div>
                    </div>
                    <div className="flex items-center gap-2 text-[10px] font-semibold text-neutral-500">
                      <span className="inline-flex items-center gap-1 rounded-full border border-emerald-400/25 bg-emerald-400/10 px-2 py-0.5 text-emerald-300">
                        <span className="h-1.5 w-1.5 rounded-full bg-emerald-400 animate-pulse" />
                        LIVE
                      </span>
                      <span className="font-mono">02:41</span>
                    </div>
                  </div>

                  <div className="relative grid aspect-[4/3.35] grid-cols-2 gap-1.5 bg-[#05040a] p-1.5">
                    {/* Partner tile */}
                    <div className="relative flex flex-col items-center justify-center overflow-hidden rounded-[1.15rem] bg-gradient-to-br from-[#3b1d54] via-[#1c1030] to-[#0b0916]">
                      <div className="absolute inset-0 bg-[radial-gradient(circle_at_50%_25%,rgba(244,114,182,0.28),transparent_58%)]" />
                      <div className="absolute left-2.5 top-2.5 z-10 flex items-center gap-1.5 rounded-full bg-black/45 px-2 py-1 text-[9px] font-bold text-white backdrop-blur">
                        <span className="h-1.5 w-1.5 rounded-full bg-emerald-400" />
                        Matched partner
                      </div>
                      <div className="relative h-28 w-28 sm:h-32 sm:w-32 rounded-full border border-white/10 bg-white/[0.04] p-3 shadow-[0_20px_50px_-20px_rgba(0,0,0,0.9)]">
                        <ThreeDFemaleAvatar className="h-full w-full" />
                      </div>
                      <div className="absolute bottom-2.5 left-2.5 right-2.5 flex items-center justify-center gap-1 rounded-lg bg-black/35 py-1 backdrop-blur">
                        {[10, 18, 26, 14, 22, 12, 20].map((h, i) => (
                          <span
                            key={i}
                            className="w-0.5 rounded-full bg-[#f9a8d4]/80 animate-equalizer"
                            style={{ height: `${h}px`, animationDelay: `${i * 0.09}s` }}
                          />
                        ))}
                      </div>
                    </div>

                    {/* You tile */}
                    <div className="relative flex flex-col items-center justify-center overflow-hidden rounded-[1.15rem] bg-gradient-to-br from-[#0d2a35] via-[#0b1a2b] to-[#080912]">
                      <div className="absolute inset-0 bg-[radial-gradient(circle_at_50%_25%,rgba(34,211,238,0.22),transparent_58%)]" />
                      <div className="absolute right-2.5 top-2.5 z-10 rounded-full bg-black/45 px-2 py-1 text-[9px] font-bold text-white/80 backdrop-blur">
                        You
                      </div>
                      <div className="relative h-24 w-24 sm:h-28 sm:w-28 rounded-full border border-white/10 bg-white/[0.04] p-3">
                        <ThreeDMaleAvatar className="h-full w-full" />
                      </div>
                      <div className="absolute bottom-2.5 inline-flex items-center gap-1 rounded-full bg-black/40 px-2 py-1 text-[9px] font-semibold text-emerald-300 backdrop-blur">
                        <Mic01Icon className="h-2.5 w-2.5" />
                        mic on
                      </div>
                    </div>

                    {/* Dock */}
                    <div className="absolute bottom-3 left-1/2 z-20 flex -translate-x-1/2 items-center gap-2 rounded-full border border-white/10 bg-[#0b0917]/85 px-2.5 py-2 backdrop-blur-xl">
                      <span className="flex h-8 w-8 items-center justify-center rounded-full bg-white/[0.07] text-neutral-200">
                        <Mic01Icon className="h-3.5 w-3.5" />
                      </span>
                      <span className="flex h-8 w-8 items-center justify-center rounded-full bg-white/[0.07] text-neutral-200">
                        <CameraVideoIcon className="h-3.5 w-3.5" />
                      </span>
                      <span className="flex h-9 w-9 items-center justify-center rounded-full bg-gradient-to-tr from-[#8b5cf6] to-[#22d3ee] text-white shadow-[0_0_20px_-4px_rgba(139,92,246,0.8)]">
                        <ArrowNextIcon className="h-4 w-4" />
                      </span>
                      <span className="flex h-8 w-8 items-center justify-center rounded-full bg-rose-500/15 text-rose-300">
                        <CallEnd01Icon className="h-3.5 w-3.5" />
                      </span>
                    </div>
                  </div>
                </div>
              </div>

              {/* Floating stat cards */}
              <div className="absolute -left-3 top-16 hidden animate-float rounded-2xl border border-white/[0.1] bg-[#0d0b18]/92 px-3.5 py-2.5 shadow-[0_20px_50px_-20px_rgba(0,0,0,0.9)] backdrop-blur-xl sm:block">
                <div className="flex items-center gap-2">
                  <span className="flex h-7 w-7 items-center justify-center rounded-lg bg-emerald-400/15 text-emerald-300">
                    <ZapIcon className="h-3.5 w-3.5" />
                  </span>
                  <div>
                    <p className="text-[10px] font-semibold uppercase tracking-wide text-neutral-500">Matching</p>
                    <p className="font-mono text-sm font-bold text-white">Server-side</p>
                  </div>
                </div>
              </div>

              <div className="absolute -right-2 bottom-10 hidden animate-float rounded-2xl border border-white/[0.1] bg-[#0d0b18]/92 px-3.5 py-2.5 shadow-[0_20px_50px_-20px_rgba(0,0,0,0.9)] backdrop-blur-xl sm:block [animation-delay:1.4s]">
                <div className="flex items-center gap-2">
                  <span className="flex h-7 w-7 items-center justify-center rounded-lg bg-[#22d3ee]/15 text-[#67e8f9]">
                    <Shield02Icon className="h-3.5 w-3.5" />
                  </span>
                  <div>
                    <p className="text-[10px] font-semibold uppercase tracking-wide text-neutral-500">Transport</p>
                    <p className="font-mono text-sm font-bold text-white">P2P · SRTP</p>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* ---------------- Telemetry ---------------- */}
      <section className="relative border-y border-white/[0.06] bg-[#08070f]/70" aria-label="Live server telemetry">
        <div className="mx-auto grid w-full max-w-7xl grid-cols-2 gap-px bg-white/[0.05] px-0 sm:px-6 lg:grid-cols-4">
          {telemetry.map((stat) => (
            <div key={stat.label} className="bg-[#07060d] px-4 py-6 sm:px-6">
              <p className="text-[10px] font-bold uppercase tracking-[0.16em] text-neutral-500">{stat.label}</p>
              <p className={`mt-1.5 font-display text-2xl font-bold tabular-nums sm:text-[1.7rem] ${stat.color}`}>
                {stat.value}
                <span className="ml-1.5 font-sans text-[10px] font-medium text-neutral-500">{stat.suffix}</span>
              </p>
            </div>
          ))}
        </div>
      </section>

      {/* ---------------- Features ---------------- */}
      <section className="relative mx-auto w-full max-w-7xl px-4 py-20 sm:px-6 sm:py-24">
        <div className="mx-auto max-w-2xl text-center">
          <p className="text-[11px] font-bold uppercase tracking-[0.2em] text-[#a78bfa]">Built for real conversations</p>
          <h2 className="mt-3 font-display text-3xl font-extrabold tracking-tight text-white sm:text-4xl">
            Everything a live chat actually needs
          </h2>
          <p className="mt-4 text-sm leading-relaxed text-neutral-400">
            No bloated feeds, no fake profiles. Just a fast, private, moderated one-to-one
            video experience that works in the browser on any device.
          </p>
        </div>

        <div className="mt-12 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {FEATURES.map(({ icon: Icon, title, body, tone }) => (
            <article
              key={title}
              className="surface surface-hover group rounded-2xl p-6"
            >
              <div className={`mb-5 inline-flex h-11 w-11 items-center justify-center rounded-xl border border-white/[0.08] bg-gradient-to-br ${tone}`}>
                <Icon className="h-5 w-5" />
              </div>
              <h3 className="font-display text-base font-bold text-white">{title}</h3>
              <p className="mt-2 text-[13px] leading-relaxed text-neutral-400">{body}</p>
            </article>
          ))}
        </div>

        <div id="how-it-works" className="mt-14 grid scroll-mt-24 gap-4 md:grid-cols-3">
          {STEPS.map((step, index) => (
            <div key={step.title} className="relative rounded-2xl border border-white/[0.07] bg-white/[0.02] p-5">
              <div className="flex items-center gap-3">
                <span className="flex h-8 w-8 items-center justify-center rounded-full border border-[#8b5cf6]/35 bg-[#8b5cf6]/10 font-mono text-xs font-bold text-[#c4b5fd]">
                  0{index + 1}
                </span>
                <h3 className="text-sm font-bold text-white">{step.title}</h3>
              </div>
              <p className="mt-3 text-xs leading-relaxed text-neutral-400">{step.body}</p>
            </div>
          ))}
        </div>
      </section>

      {/* ---------------- Pricing ---------------- */}
      <section id="pricing-section" className="relative border-t border-white/[0.06] bg-[#08070f]/60 py-20 sm:py-24">
        <div className="mx-auto w-full max-w-7xl px-4 sm:px-6">
          <div className="mx-auto max-w-2xl text-center">
            <p className="text-[11px] font-bold uppercase tracking-[0.2em] text-[#a67cff]">Simple pricing</p>
            <h2 className="mt-3 font-display text-3xl font-extrabold tracking-tight text-white sm:text-4xl">
              Two plans. Nothing hidden.
            </h2>
            <p className="mt-4 text-sm text-neutral-400">
              Random video chat is free forever. Pro adds the filters that make matching feel personal.
            </p>
          </div>

          <div className="mx-auto mt-12 grid max-w-4xl gap-5 md:grid-cols-2">
            {/* Free */}
            <div className="surface flex flex-col rounded-3xl p-7">
              <div className="flex items-start justify-between">
                <div>
                  <h3 className="font-display text-lg font-bold text-white">Free</h3>
                  <p className="mt-1 text-xs text-neutral-500">Meet anyone, anywhere</p>
                </div>
                <span className="rounded-full border border-white/10 bg-white/[0.04] px-2.5 py-1 text-[10px] font-bold uppercase tracking-wide text-neutral-400">
                  Standard
                </span>
              </div>
              <div className="mt-6 flex items-baseline gap-1">
                <span className="font-display text-4xl font-extrabold text-white">₹0</span>
                <span className="text-xs text-neutral-500">forever</span>
              </div>

              <ul className="mt-6 flex-1 space-y-3 text-[13px]">
                {[
                  'Unlimited random one-to-one video',
                  'Camera and microphone video chat',
                  'Next / skip and disconnect controls',
                  'Report, block and safety tools',
                ].map((item) => (
                  <li key={item} className="flex items-start gap-2.5 text-neutral-300">
                    <CheckmarkCircle01Icon className="mt-0.5 h-4 w-4 shrink-0 text-emerald-400" />
                    <span>{item}</span>
                  </li>
                ))}
                {['Gender preference filtering', 'Country and language filters'].map((item) => (
                  <li key={item} className="flex items-start gap-2.5 text-neutral-600">
                    <Cancel01Icon className="mt-0.5 h-4 w-4 shrink-0" />
                    <span>{item}</span>
                  </li>
                ))}
              </ul>

              <button
                onClick={onStartChat}
                className="btn-secondary mt-7 h-11 w-full text-xs font-bold"
              >
                Start free chat
              </button>
            </div>

            {/* Pro */}
            <div className="brand-ring relative flex flex-col overflow-hidden rounded-3xl border border-[#8b5cf6]/40 bg-gradient-to-b from-[#16102b] via-[#0f0c1e] to-[#0b0916] p-7 shadow-[0_40px_100px_-40px_rgba(139,92,246,0.65)]">
              <div className="pointer-events-none absolute -right-16 -top-16 h-48 w-48 rounded-full bg-[#8b5cf6]/20 blur-3xl" />
              <div className="flex items-start justify-between">
                <div>
                  <h3 className="flex items-center gap-2 font-display text-lg font-bold text-white">
                    Pro
                    <SparklesIcon className="h-4 w-4 text-amber-300" />
                  </h3>
                  <p className="mt-1 text-xs text-neutral-400">Filters, priority and a cleaner queue</p>
                </div>
                <span className="rounded-full border border-[#8b5cf6]/40 bg-[#8b5cf6]/15 px-2.5 py-1 text-[10px] font-bold uppercase tracking-wide text-[#c4b5fd]">
                  Recommended
                </span>
              </div>
              <div className="mt-6 flex items-baseline gap-1">
                <span className="font-display text-4xl font-extrabold text-white">₹299</span>
                <span className="text-xs text-neutral-400">/ month</span>
              </div>

              <ul className="mt-6 flex-1 space-y-3 text-[13px]">
                {[
                  'Everything in Free',
                  'Preferred gender matching',
                  'Country and multi-country filters',
                  'Language and interest matching',
                  'Priority queue placement',
                  'Ad-free experience',
                ].map((item) => (
                  <li key={item} className="flex items-start gap-2.5 text-neutral-200">
                    <CheckmarkCircle01Icon className="mt-0.5 h-4 w-4 shrink-0 text-[#c4b5fd]" />
                    <span>{item}</span>
                  </li>
                ))}
              </ul>

              {!isPro ? (
                <button onClick={onOpenUpgradeModal} className="btn-primary mt-7 h-11 w-full text-xs">
                  <SparklesIcon className="h-4 w-4" />
                  Upgrade to Pro — ₹299/mo
                </button>
              ) : (
                <button
                  disabled
                  className="mt-7 inline-flex h-11 w-full items-center justify-center gap-2 rounded-full border border-emerald-400/25 bg-emerald-400/10 text-xs font-bold text-emerald-300"
                >
                  <CheckmarkCircle01Icon className="h-4 w-4" />
                  Current plan active
                </button>
              )}
              <p className="mt-3 text-center text-[10px] text-neutral-500">Cancel anytime from account settings</p>
            </div>
          </div>
        </div>
      </section>

      {/* ---------------- Safety CTA ---------------- */}
      <section className="relative border-t border-white/[0.06] bg-[#06050c] py-12">
        <div className="mx-auto flex w-full max-w-5xl flex-col items-center gap-6 px-4 text-center sm:px-6 md:flex-row md:justify-between md:text-left">
          <div className="flex items-start gap-3.5">
            <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl border border-rose-400/25 bg-rose-400/[0.08] text-rose-300">
              <WebProtectionIcon className="h-5 w-5" />
            </span>
            <div>
              <p className="font-display text-sm font-bold text-white">Adults only. Respect always.</p>
              <p className="mt-1 max-w-xl text-xs leading-relaxed text-neutral-400">
                U-R-LIVE is strictly 18+. Zero tolerance for CSAM, harassment, non-consensual
                recording, or any unlawful conduct. Reports are reviewed by moderators.
              </p>
            </div>
          </div>

          <div className="flex flex-wrap items-center justify-center gap-3">
            <button onClick={onNavigateToSafety} className="btn-secondary h-10 px-4 text-[11px]">
              <Shield02Icon className="h-3.5 w-3.5 text-emerald-400" />
              Community standards
            </button>
            <button onClick={onStartChat} className="btn-primary h-10 px-4 text-[11px]">
              <PlayIcon className="h-3.5 w-3.5" />
              Enter live chat
            </button>
          </div>
        </div>
      </section>
    </div>
  );
};
