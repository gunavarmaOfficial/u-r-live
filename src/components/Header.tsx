import React, { useEffect, useRef, useState } from 'react';
import { Link, useLocation } from 'react-router-dom';
import {
  SparklesIcon,
  WebProtectionIcon,
  Settings02Icon,
  Logout01Icon,
  UserCircleIcon,
  Shield02Icon,
  BookOpen01Icon,
  CameraVideoIcon,
  Menu01Icon,
  UserCheck01Icon,
  RefreshIcon,
} from 'hugeicons-react';
import { useApp } from '../context/AppContext';
import { useSystemHealth } from '../hooks/useSystemHealth';
import { preloadLivePage } from '../lib/preload';
import { Logo } from './Logo';

interface NavItem {
  path: string;
  label: string;
  icon: React.ComponentType<{ className?: string }>;
}

const NAV_ITEMS: NavItem[] = [
  { path: '/live', label: 'Live', icon: CameraVideoIcon },
  { path: '/safety', label: 'Safety', icon: WebProtectionIcon },
  { path: '/', label: 'About', icon: BookOpen01Icon },
];

export const Header: React.FC = () => {
  const location = useLocation();
  const {
    user,
    isPro,
    isGoogleUser,
    googleEnabled,
    openUpgrade,
    openSettings,
    openGoogle,
    signOut,
  } = useApp();
  const health = useSystemHealth();
  const [isMenuOpen, setIsMenuOpen] = useState(false);
  const menuRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    setIsMenuOpen(false);
  }, [location.pathname]);

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(event.target as Node)) {
        setIsMenuOpen(false);
      }
    };
    const handleEscape = (event: KeyboardEvent) => {
      if (event.key === 'Escape') setIsMenuOpen(false);
    };
    document.addEventListener('mousedown', handleClickOutside);
    document.addEventListener('keydown', handleEscape);
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
      document.removeEventListener('keydown', handleEscape);
    };
  }, []);

  const isActive = (path: string) => {
    if (path === '/') return location.pathname === '/';
    return location.pathname === path;
  };

  const queueLabel = health.loaded
    ? health.status === 'online' || health.status === 'healthy'
      ? health.queueLength > 0
        ? `${health.queueLength} waiting now`
        : 'Queue open'
      : 'Server unreachable'
    : 'Live queue';

  return (
    <header className="relative z-40 w-full shrink-0 border-b border-white/[0.06] bg-[#07060d]/72 backdrop-blur-2xl">
      <div className="mx-auto flex h-16 w-full max-w-[1560px] items-center justify-between gap-3 px-3 sm:px-5">
        <div className="flex min-w-0 items-center gap-3 lg:gap-6">
          <Link to="/" aria-label="U-R-LIVE home" className="shrink-0">
            <Logo size="sm" />
          </Link>

          <nav aria-label="Primary" className="hidden items-center gap-1 rounded-full border border-white/[0.07] bg-white/[0.03] p-1 md:flex">
            {NAV_ITEMS.map(({ path, label, icon: Icon }) => {
              const active = isActive(path);
              return (
                <Link
                  key={path}
                  to={path}
                  aria-current={active ? 'page' : undefined}
                  onMouseEnter={path === '/live' ? preloadLivePage : undefined}
                  onFocus={path === '/live' ? preloadLivePage : undefined}
                  className={`inline-flex items-center gap-1.5 rounded-full px-3.5 py-1.5 text-xs font-bold transition-all ${
                    active
                      ? 'bg-white/[0.1] text-white shadow-[inset_0_1px_0_rgba(255,255,255,0.12)]'
                      : 'text-neutral-400 hover:bg-white/[0.05] hover:text-white'
                  }`}
                >
                  <Icon className={`h-3.5 w-3.5 ${active ? 'text-[#a78bfa]' : 'text-neutral-500'}`} />
                  <span>{label}</span>
                  {active && <span className="h-1 w-1 rounded-full bg-[#22d3ee]" />}
                </Link>
              );
            })}
          </nav>

          <div className="hidden items-center gap-2 xl:flex" title="Reported by the matchmaking server">
            <span className="relative flex h-2 w-2">
              {health.status === 'offline' ? (
                <span className="relative inline-flex h-2 w-2 rounded-full bg-rose-400" />
              ) : (
                <>
                  <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-emerald-400 opacity-60 motion-reduce:animate-none" />
                  <span className="relative inline-flex h-2 w-2 rounded-full bg-emerald-400" />
                </>
              )}
            </span>
            <span className="font-mono text-[11px] font-semibold text-neutral-400">
              {health.loaded && health.queueLength > 0 ? (
                <span className="text-white">{health.queueLength}</span>
              ) : null}{' '}
              {queueLabel}
            </span>
          </div>
        </div>

        <div className="flex items-center gap-1.5 sm:gap-2.5">
          <div className="hidden items-center gap-1.5 rounded-full border border-emerald-400/20 bg-emerald-400/[0.07] px-3 py-1.5 text-[11px] font-semibold text-emerald-300 sm:flex">
            <Shield02Icon className="h-3.5 w-3.5" />
            <span className="hidden md:inline">18+ only</span>
          </div>

          <Link
            to="/safety"
            title="Community rules and safety centre"
            aria-label="Safety centre"
            className={`hidden h-9 w-9 items-center justify-center rounded-full border transition-all md:inline-flex ${
              isActive('/safety')
                ? 'border-[#8b5cf6]/50 bg-[#8b5cf6]/15 text-white'
                : 'border-white/[0.08] bg-white/[0.03] text-neutral-400 hover:border-white/20 hover:text-white'
            }`}
          >
            <WebProtectionIcon className="h-4 w-4" />
          </Link>

          {!isPro ? (
            <button
              onClick={() => openUpgrade()}
              title="Unlock gender, country and language filters"
              className="group inline-flex h-9 items-center gap-1.5 rounded-full border border-[#fbbf24]/35 bg-gradient-to-r from-[#fbbf24]/15 via-[#f472b6]/15 to-[#8b5cf6]/15 px-3 text-xs font-extrabold text-amber-100 transition-all hover:border-[#fbbf24]/60 hover:shadow-[0_0_24px_-6px_rgba(251,191,36,0.6)] active:scale-95 sm:px-4"
            >
              <SparklesIcon className="h-3.5 w-3.5 text-amber-300 transition-transform group-hover:rotate-12" />
              <span className="hidden sm:inline">Go Pro</span>
              <span className="hidden font-mono text-[10px] text-amber-200/70 lg:inline">₹299</span>
            </button>
          ) : (
            <span className="inline-flex h-9 items-center gap-1.5 rounded-full border border-amber-400/40 bg-amber-400/10 px-3 text-[11px] font-black uppercase tracking-wider text-amber-200">
              <SparklesIcon className="h-3.5 w-3.5" />
              Pro
            </span>
          )}

          {!user ? (
            <Link
              to="/live"
              onMouseEnter={preloadLivePage}
              onFocus={preloadLivePage}
              className="inline-flex h-9 items-center gap-1.5 rounded-full bg-gradient-to-r from-[#8b5cf6] to-[#22d3ee] px-3.5 text-xs font-extrabold text-white transition-transform active:scale-95 sm:px-4"
            >
              <CameraVideoIcon className="h-4 w-4" />
              <span>Start chat</span>
            </Link>
          ) : (
            <div className="relative" ref={menuRef}>
              <button
                onClick={() => setIsMenuOpen((open) => !open)}
                aria-expanded={isMenuOpen}
                aria-haspopup="menu"
                aria-label="Open account menu"
                className={`flex h-9 items-center gap-2 rounded-full border pl-1 pr-1 transition-all sm:pr-2.5 ${
                  isMenuOpen
                    ? 'border-[#8b5cf6]/50 bg-white/[0.08]'
                    : 'border-white/[0.08] bg-white/[0.03] hover:border-white/20 hover:bg-white/[0.06]'
                }`}
              >
                <span className="relative flex h-7 w-7 items-center justify-center overflow-hidden rounded-full bg-gradient-to-tr from-[#f472b6]/30 via-[#8b5cf6]/30 to-[#22d3ee]/30">
                  {user.avatarUrl ? (
                    <img src={user.avatarUrl} alt="" className="h-full w-full object-cover" />
                  ) : (
                    <UserCircleIcon className="h-5 w-5 text-white/80" />
                  )}
                  {user.isAdultVerified && (
                    <span className="absolute -bottom-0.5 -right-0.5 h-2.5 w-2.5 rounded-full border-2 border-[#07060d] bg-emerald-400" />
                  )}
                </span>
                <span className="hidden max-w-[110px] truncate text-xs font-bold text-neutral-200 sm:inline">
                  {user.displayName}
                </span>
                <Menu01Icon className={`h-4 w-4 text-neutral-500 transition-transform ${isMenuOpen ? 'rotate-90' : ''}`} />
              </button>

              {isMenuOpen && (
                <div
                  role="menu"
                  className="animate-in absolute right-0 z-50 mt-2 w-72 origin-top-right overflow-hidden rounded-2xl border border-white/[0.1] bg-[#0d0b18]/96 shadow-[0_30px_80px_-20px_rgba(0,0,0,0.9)] backdrop-blur-2xl"
                >
                  <div className="border-b border-white/[0.07] bg-white/[0.02] px-4 py-3.5">
                    <div className="flex items-center gap-3">
                      <div className="flex h-10 w-10 items-center justify-center overflow-hidden rounded-xl bg-gradient-to-tr from-[#f472b6]/30 via-[#8b5cf6]/30 to-[#22d3ee]/30">
                        {user.avatarUrl ? (
                          <img src={user.avatarUrl} alt="" className="h-full w-full object-cover" />
                        ) : (
                          <UserCircleIcon className="h-6 w-6 text-white/80" />
                        )}
                      </div>
                      <div className="min-w-0">
                        <p className="truncate text-sm font-bold text-white">{user.displayName}</p>
                        <p className="truncate text-[11px] text-neutral-500">
                          {user.email || 'Anonymous guest session'}
                        </p>
                      </div>
                    </div>
                    <div className="mt-3 flex items-center gap-1.5">
                      <span
                        className={`inline-flex items-center gap-1 rounded-full border px-2 py-0.5 text-[10px] font-bold ${
                          user.isAdultVerified
                            ? 'border-emerald-400/25 bg-emerald-400/10 text-emerald-300'
                            : 'border-amber-400/25 bg-amber-400/10 text-amber-300'
                        }`}
                      >
                        <Shield02Icon className="h-2.5 w-2.5" />
                        {user.isAdultVerified ? '18+ confirmed' : 'Age not confirmed'}
                      </span>
                      <span className="inline-flex items-center gap-1 rounded-full border border-white/10 bg-white/[0.05] px-2 py-0.5 text-[10px] font-bold text-neutral-300">
                        <SparklesIcon className="h-2.5 w-2.5 text-amber-300" />
                        {isPro ? 'Pro member' : 'Free plan'}
                      </span>
                    </div>
                  </div>

                  {!isGoogleUser && googleEnabled && (
                    <div className="border-b border-white/[0.07] p-1.5">
                      <button
                        role="menuitem"
                        onClick={() => {
                          setIsMenuOpen(false);
                          openGoogle();
                        }}
                        className="flex w-full items-center gap-2.5 rounded-xl px-3 py-2 text-xs font-bold text-white transition-colors hover:bg-white/[0.06]"
                      >
                        <svg className="h-4 w-4 shrink-0" viewBox="0 0 24 24" aria-hidden="true">
                          <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" />
                          <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" />
                          <path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.06H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.94l2.85-2.22.81-.63z" />
                          <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.06l3.66 2.84c.87-2.6 3.3-4.52 6.16-4.52z" />
                        </svg>
                        <span>Link Google account</span>
                      </button>
                    </div>
                  )}

                  <div className="p-1.5 text-xs">
                    <Link
                      to="/live"
                      role="menuitem"
                      className="flex w-full items-center gap-2.5 rounded-xl px-3 py-2 font-semibold text-neutral-200 transition-colors hover:bg-white/[0.06]"
                    >
                      <CameraVideoIcon className="h-4 w-4 text-neutral-500" />
                      <span>Live video chat</span>
                      <span className="ml-auto h-1.5 w-1.5 rounded-full bg-emerald-400" />
                    </Link>

                    <button
                      role="menuitem"
                      onClick={() => {
                        setIsMenuOpen(false);
                        openUpgrade();
                      }}
                      className="flex w-full items-center gap-2.5 rounded-xl px-3 py-2 font-semibold text-amber-200 transition-colors hover:bg-amber-400/[0.07]"
                    >
                      <SparklesIcon className="h-4 w-4 text-amber-300" />
                      <span>Pro features</span>
                      <span className="ml-auto font-mono text-[10px] text-neutral-500">₹299/mo</span>
                    </button>

                    <Link
                      to="/live"
                      role="menuitem"
                      className="flex w-full items-center gap-2.5 rounded-xl px-3 py-2 text-neutral-300 transition-colors hover:bg-white/[0.06] hover:text-white"
                    >
                      <UserCheck01Icon className="h-4 w-4 text-neutral-500" />
                      <span>Gender &amp; matching</span>
                      <span className="ml-auto rounded-full border border-white/10 bg-white/[0.04] px-2 py-0.5 text-[10px] capitalize text-neutral-400">
                        {user.gender !== 'unspecified' ? user.gender : 'Set up'}
                      </span>
                    </Link>

                    <button
                      role="menuitem"
                      onClick={() => {
                        setIsMenuOpen(false);
                        openSettings();
                      }}
                      className="flex w-full items-center gap-2.5 rounded-xl px-3 py-2 text-neutral-300 transition-colors hover:bg-white/[0.06] hover:text-white"
                    >
                      <Settings02Icon className="h-4 w-4 text-neutral-500" />
                      <span>Account &amp; preferences</span>
                    </button>

                    <Link
                      to="/safety"
                      role="menuitem"
                      className="flex w-full items-center gap-2.5 rounded-xl px-3 py-2 text-neutral-300 transition-colors hover:bg-white/[0.06] hover:text-white"
                    >
                      <WebProtectionIcon className="h-4 w-4 text-neutral-500" />
                      <span>Safety &amp; 18+ policy</span>
                    </Link>

                    {user.role === 'admin' && (
                      <Link
                        to="/admin"
                        role="menuitem"
                        className="flex w-full items-center gap-2.5 rounded-xl px-3 py-2 font-semibold text-violet-300 transition-colors hover:bg-violet-400/[0.08]"
                      >
                        <Shield02Icon className="h-4 w-4 text-violet-400" />
                        <span>Admin dashboard</span>
                      </Link>
                    )}

                    <Link
                      to="/"
                      role="menuitem"
                      className="flex w-full items-center gap-2.5 rounded-xl px-3 py-2 text-neutral-400 transition-colors hover:bg-white/[0.06] hover:text-neutral-200"
                    >
                      <BookOpen01Icon className="h-4 w-4 text-neutral-600" />
                      <span>About U-R-LIVE</span>
                    </Link>
                  </div>

                  <div className="border-t border-white/[0.07] p-1.5">
                    <button
                      role="menuitem"
                      onClick={() => {
                        setIsMenuOpen(false);
                        signOut();
                      }}
                      className="flex w-full items-center gap-2.5 rounded-xl px-3 py-2 text-xs font-semibold text-rose-300 transition-colors hover:bg-rose-400/[0.08]"
                    >
                      {isGoogleUser ? (
                        <Logout01Icon className="h-4 w-4" />
                      ) : (
                        <RefreshIcon className="h-4 w-4" />
                      )}
                      <span>{isGoogleUser ? 'Sign out' : 'Start a new guest session'}</span>
                    </button>
                  </div>
                </div>
              )}
            </div>
          )}
        </div>
      </div>
    </header>
  );
};
