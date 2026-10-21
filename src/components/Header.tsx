import React, { useState, useRef, useEffect } from 'react';
import {
  SparklesIcon,
  WebProtectionIcon,
  Settings02Icon,
  Logout01Icon,
  Menu01Icon,
  UserCircleIcon,
  Shield02Icon,
  BookOpen01Icon,
} from 'hugeicons-react';
import { UserProfile } from '../types';
import { Logo } from './Logo';

interface HeaderProps {
  currentView: 'video' | 'safety' | 'admin' | 'landing' | 'onboarding';
  onNavigate: (view: 'video' | 'safety' | 'admin' | 'landing' | 'onboarding') => void;
  user: UserProfile | null;
  isPro: boolean;
  onOpenUpgradeModal: () => void;
  onOpenSettingsModal: () => void;
  onOpenGoogleModal: () => void;
  onOpenOnboarding?: () => void;
  onLogout: () => void;
}

export const Header: React.FC<HeaderProps> = ({
  currentView,
  onNavigate,
  user,
  isPro,
  onOpenUpgradeModal,
  onOpenSettingsModal,
  onOpenGoogleModal,
  onOpenOnboarding,
  onLogout,
}) => {
  const [isMenuOpen, setIsMenuOpen] = useState(false);
  const menuRef = useRef<HTMLDivElement>(null);

  // Close dropdown on outside click
  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) {
        setIsMenuOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const isGoogleUser = user?.authProvider === 'google';

  return (
    <header className="w-full bg-[#141519] border-b border-neutral-800 h-13 px-2 sm:px-4 flex items-center justify-between shrink-0 select-none z-30">
      {/* Left: Brand Logo & Online Counter */}
      <div className="flex items-center gap-2 sm:gap-4 min-w-0">
        <Logo
          size="sm"
          onClick={() => onNavigate('video')}
          className="shrink-0 cursor-pointer"
        />

        <div className="h-4 w-[1px] bg-neutral-800 hidden sm:block" />

        {/* Live Users Counter */}
        <div className="hidden xs:flex items-center gap-1.5 px-2 py-0.5 sm:py-1 rounded-md bg-neutral-900/90 border border-neutral-800 text-[11px] font-medium text-neutral-300 shrink-0">
          <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
          <span className="font-semibold text-white">43,180</span>
          <span className="text-neutral-400 hidden sm:inline">online</span>
        </div>
      </div>

      {/* Center: Quick 18+ Safety Notice */}
      <div className="hidden lg:flex items-center gap-2 text-xs text-neutral-400">
        <button
          onClick={() => onNavigate('safety')}
          className="flex items-center gap-1.5 px-3 py-1 rounded-md bg-neutral-900/80 hover:bg-neutral-800 text-neutral-300 hover:text-white border border-neutral-800 transition-colors"
        >
          <Shield02Icon className="w-3.5 h-3.5 text-emerald-400" />
          <span>Strictly 18+ & Moderated · Read Rules</span>
        </button>
      </div>

      {/* Right: Pro Membership, Safety & User Account Menu */}
      <div className="flex items-center gap-2 sm:gap-2.5">
        {!isPro ? (
          <button
            onClick={onOpenUpgradeModal}
            className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-bold text-amber-300 bg-amber-500/10 hover:bg-amber-500/20 border border-amber-500/30 rounded-lg transition-all"
            title="Unlock gender filter, priority queue & verified badge"
          >
            <SparklesIcon className="w-3.5 h-3.5 text-amber-400" />
            <span className="hidden sm:inline">Upgrade Pro (₹299)</span>
            <span className="sm:hidden">Pro</span>
          </button>
        ) : (
          <span className="flex items-center gap-1 px-2.5 py-1 text-xs font-bold text-amber-400 bg-amber-500/10 border border-amber-500/30 rounded-lg">
            <SparklesIcon className="w-3 h-3" />
            <span>PRO</span>
          </span>
        )}

        <button
          onClick={() => onNavigate('safety')}
          className={`p-1.5 rounded-lg border transition-colors ${
            currentView === 'safety'
              ? 'border-emerald-500 bg-emerald-500/10 text-white'
              : 'border-neutral-800 hover:border-neutral-700 bg-neutral-900 text-neutral-300 hover:text-white'
          }`}
          title="Community Rules & Safety Center"
        >
          <WebProtectionIcon className="w-4 h-4" />
        </button>

        {/* User Account Menu Button */}
        <div className="relative" ref={menuRef}>
          <button
            onClick={() => setIsMenuOpen(!isMenuOpen)}
            className="flex items-center gap-1.5 p-1.5 sm:px-2.5 sm:py-1.5 rounded-lg border border-neutral-800 hover:border-neutral-700 bg-neutral-900 text-neutral-300 hover:text-white transition-all text-xs"
          >
            {user?.avatarUrl ? (
              <img
                src={user.avatarUrl}
                alt={user.displayName}
                className="w-5 h-5 rounded-full object-cover border border-neutral-700"
              />
            ) : (
              <UserCircleIcon className="w-5 h-5 text-neutral-400" />
            )}
            <span className="hidden sm:inline font-semibold max-w-[100px] truncate">
              {user?.displayName || 'Account'}
            </span>
            <Menu01Icon className="w-3.5 h-3.5 text-neutral-400 ml-0.5" />
          </button>

          {/* User Menu Dropdown */}
          {isMenuOpen && (
            <div className="absolute right-0 mt-1.5 w-60 rounded-xl border border-neutral-800 bg-[#1a1b20] shadow-2xl py-1.5 z-50 animate-in fade-in zoom-in-95 duration-100 text-xs">
              <div className="px-3 py-2 border-b border-neutral-800">
                <p className="font-bold text-white truncate">{user?.displayName || 'Guest User'}</p>
                {user?.email && (
                  <p className="text-[11px] text-neutral-400 truncate">{user.email}</p>
                )}
                <div className="flex items-center gap-1.5 mt-1 text-[10px] text-neutral-400">
                  <span className={`w-1.5 h-1.5 rounded-full ${user?.isAdultVerified ? 'bg-emerald-400' : 'bg-amber-400'}`} />
                  <span>{user?.isAdultVerified ? '18+ Verified' : 'Age Not Verified'}</span>
                  <span>·</span>
                  <span>{isPro ? 'Pro Member' : 'Free Member'}</span>
                </div>
              </div>

              {!isGoogleUser ? (
                <div className="p-1 border-b border-neutral-800">
                  <button
                    onClick={() => {
                      setIsMenuOpen(false);
                      onOpenGoogleModal();
                    }}
                    className="w-full text-left px-3 py-2 font-semibold text-white hover:bg-neutral-800 rounded-lg transition-colors flex items-center gap-2"
                  >
                    <svg className="w-3.5 h-3.5 shrink-0" viewBox="0 0 24 24">
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
                </div>
              ) : null}

              <div className="py-1">
                <button
                  onClick={() => {
                    setIsMenuOpen(false);
                    onNavigate('video');
                  }}
                  className={`w-full text-left px-3 py-1.5 hover:bg-neutral-800 transition-colors ${
                    currentView === 'video' ? 'text-emerald-400 font-bold' : 'text-neutral-200'
                  }`}
                >
                  Video Chat (Live)
                </button>

                <button
                  onClick={() => {
                    setIsMenuOpen(false);
                    onOpenUpgradeModal();
                  }}
                  className="w-full text-left px-3 py-1.5 hover:bg-neutral-800 text-amber-300 font-semibold transition-colors flex items-center justify-between"
                >
                  <span>Pro Features</span>
                  <span className="text-[10px] text-neutral-400">₹299/mo</span>
                </button>

                {onOpenOnboarding && (
                  <button
                    onClick={() => {
                      setIsMenuOpen(false);
                      onOpenOnboarding();
                    }}
                    className="w-full text-left px-3 py-1.5 hover:bg-neutral-800 text-neutral-200 hover:text-white transition-colors flex items-center justify-between"
                  >
                    <span className="flex items-center gap-2">
                      <span className="text-xs">⚧</span>
                      <span>Gender & Matching Setup</span>
                    </span>
                    <span className="text-[10px] text-emerald-400 capitalize">
                      {user?.gender !== 'unspecified' ? user?.gender : 'Set'}
                    </span>
                  </button>
                )}

                <button
                  onClick={() => {
                    setIsMenuOpen(false);
                    onOpenSettingsModal();
                  }}
                  className="w-full text-left px-3 py-1.5 hover:bg-neutral-800 text-neutral-300 hover:text-white transition-colors flex items-center gap-2"
                >
                  <Settings02Icon className="w-3.5 h-3.5 text-neutral-400" />
                  <span>Account & Preferences</span>
                </button>

                <button
                  onClick={() => {
                    setIsMenuOpen(false);
                    onNavigate('safety');
                  }}
                  className="w-full text-left px-3 py-1.5 hover:bg-neutral-800 text-neutral-300 hover:text-white transition-colors flex items-center gap-2"
                >
                  <WebProtectionIcon className="w-3.5 h-3.5 text-neutral-400" />
                  <span>Safety Rules & 18+ Policy</span>
                </button>

                {user?.role === 'admin' && (
                  <button
                    onClick={() => {
                      setIsMenuOpen(false);
                      onNavigate('admin');
                    }}
                    className="w-full text-left px-3 py-1.5 hover:bg-neutral-800 text-purple-300 font-bold transition-colors flex items-center gap-2"
                  >
                    <Shield02Icon className="w-3.5 h-3.5 text-purple-400" />
                    <span>Admin Dashboard</span>
                  </button>
                )}

                <button
                  onClick={() => {
                    setIsMenuOpen(false);
                    onNavigate('landing');
                  }}
                  className="w-full text-left px-3 py-1.5 hover:bg-neutral-800 text-neutral-400 hover:text-neutral-200 transition-colors flex items-center gap-2"
                >
                  <BookOpen01Icon className="w-3.5 h-3.5 text-neutral-500" />
                  <span>About U-R-LIVE</span>
                </button>
              </div>

              {isGoogleUser && (
                <div className="border-t border-neutral-800 pt-1 mt-1">
                  <button
                    onClick={() => {
                      setIsMenuOpen(false);
                      onLogout();
                    }}
                    className="w-full text-left px-3 py-1.5 text-rose-400 hover:bg-neutral-800 transition-colors flex items-center gap-2"
                  >
                    <Logout01Icon className="w-3.5 h-3.5" />
                    <span>Sign out</span>
                  </button>
                </div>
              )}
            </div>
          )}
        </div>
      </div>
    </header>
  );
};
