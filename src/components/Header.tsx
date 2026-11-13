import React, { useEffect, useRef, useState } from 'react';
import { Link, useLocation } from 'react-router-dom';
import { useApp } from '../context/AppContext';
import { useSystemHealth } from '../hooks/useSystemHealth';
import { Logo } from './Logo';

export const Header: React.FC = () => {
  const location = useLocation();
  const { user, theme, toggleTheme } = useApp();
  const health = useSystemHealth();

  const isLive = location.pathname === '/live';

  const onlineCount = health.loaded && health.activeMatches > 0
    ? (13000 + health.activeMatches * 12).toLocaleString()
    : '15,420';

  return (
    <header className={`relative z-40 w-full shrink-0 border-b border-neutral-200/80 dark:border-white/[0.06] bg-white/80 dark:bg-[#07060d]/80 backdrop-blur-xl transition-colors ${
      isLive ? 'hidden lg:block' : 'block'
    }`}>
      <div className="mx-auto flex h-16 w-full max-w-[1600px] items-center justify-between gap-3 px-4 sm:px-6">
        {/* Left: Logo */}
        <Link to="/" aria-label="U-R-LIVE home" className="flex items-center gap-2.5 transition active:scale-95">
          <Logo size="sm" />
        </Link>

        {/* Right: Theme switch + Live online counter */}
        <div className="flex items-center gap-3">
          {/* Theme Switch Toggle */}
          <button
            type="button"
            onClick={toggleTheme}
            aria-label={`Switch to ${theme === 'dark' ? 'light' : 'dark'} mode`}
            title={`Switch to ${theme === 'dark' ? 'light' : 'dark'} mode`}
            className="flex h-8 w-14 items-center rounded-full border border-neutral-200 dark:border-white/10 bg-neutral-100 dark:bg-white/[0.06] p-1 transition-colors cursor-pointer hover:border-neutral-300 dark:hover:border-white/20"
          >
            <div
              className={`flex h-6 w-6 items-center justify-center rounded-full bg-white dark:bg-[#ef4444] text-neutral-700 dark:text-white shadow-sm transition-transform duration-200 ${
                theme === 'dark' ? 'translate-x-6' : 'translate-x-0'
              }`}
            >
              {theme === 'dark' ? (
                <svg className="h-3.5 w-3.5" viewBox="0 0 24 24" fill="currentColor">
                  <path d="M12 3a9 9 0 109 9c0-.46-.04-.92-.1-1.36a5.389 5.389 0 01-4.4 2.26 5.403 5.403 0 01-3.14-9.8c-.44-.06-.9-.1-1.36-.1z" />
                </svg>
              ) : (
                <svg className="h-3.5 w-3.5 text-amber-500" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <circle cx="12" cy="12" r="5" />
                  <line x1="12" y1="1" x2="12" y2="3" />
                  <line x1="12" y1="21" x2="12" y2="23" />
                  <line x1="4.22" y1="4.22" x2="5.64" y2="5.64" />
                  <line x1="18.36" y1="18.36" x2="19.78" y2="19.78" />
                  <line x1="1" y1="12" x2="3" y2="12" />
                  <line x1="21" y1="12" x2="23" y2="12" />
                  <line x1="4.22" y1="19.78" x2="5.64" y2="18.36" />
                  <line x1="18.36" y1="5.64" x2="19.78" y2="4.22" />
                </svg>
              )}
            </div>
          </button>

          {/* Live Online Counter Badge */}
          <div className="flex items-center gap-1.5 rounded-full border border-neutral-200 dark:border-white/10 bg-neutral-100/90 dark:bg-white/[0.04] px-3.5 py-1.5 text-xs font-bold text-neutral-800 dark:text-neutral-200 shadow-sm">
            <span className="relative flex h-2 w-2">
              <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-emerald-400 opacity-75" />
              <span className="relative inline-flex h-2 w-2 rounded-full bg-emerald-500" />
            </span>
            <span className="text-[#ef4444] dark:text-[#f87171] font-extrabold tracking-tight">
              {onlineCount}+
            </span>
            <span className="text-neutral-500 dark:text-neutral-400 font-medium">online</span>
          </div>
        </div>
      </div>
    </header>
  );
};
