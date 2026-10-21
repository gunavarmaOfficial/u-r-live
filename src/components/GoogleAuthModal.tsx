import React, { useState } from 'react';
import { Cancel01Icon, UserCircleIcon, CheckmarkCircle01Icon, AlertCircleIcon } from 'hugeicons-react';
import { api } from '../services/api';
import { UserProfile, Subscription } from '../types';
import { Logo } from './Logo';

interface GoogleAuthModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccess: (user: UserProfile, isPro: boolean, sub: Subscription | null) => void;
}

export const GoogleAuthModal: React.FC<GoogleAuthModalProps> = ({
  isOpen,
  onClose,
  onSuccess,
}) => {
  const [emailInput, setEmailInput] = useState('gunavarma0000@gmail.com');
  const [nameInput, setNameInput] = useState('Guna Varma');
  const [showCustomEmail, setShowCustomEmail] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState('');

  if (!isOpen) return null;

  const handleGoogleLogin = async (email: string, name: string) => {
    setIsLoading(true);
    setError('');

    try {
      const res = await api.loginWithGoogle({
        email,
        name,
        avatarUrl: `https://api.dicebear.com/7.x/initials/svg?seed=${encodeURIComponent(name)}&backgroundColor=ff385c`,
      });

      onSuccess(res.user, res.isPro, res.subscription);
      onClose();
    } catch (err: any) {
      setError(err.message || 'Google authentication failed');
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/75 backdrop-blur-sm animate-in fade-in duration-200">
      <div className="w-full max-w-md rounded-3xl border border-neutral-800 bg-[#161618] p-6 shadow-2xl space-y-6 text-neutral-100 relative">
        {/* Top Header */}
        <div className="flex items-center justify-between border-b border-neutral-800 pb-4">
          <button
            onClick={onClose}
            className="p-2 -ml-2 rounded-full hover:bg-neutral-800 text-neutral-400 hover:text-white transition-colors"
          >
            <Cancel01Icon className="w-4 h-4" />
          </button>
          <Logo size="sm" />
          <div className="w-6" /> {/* Spacer */}
        </div>

        {/* Brand welcome */}
        <div className="space-y-1.5">
          <h2 className="text-xl font-bold text-white tracking-tight">
            Welcome to <span className="text-[#FF385C]">U-R-LIVE</span>
          </h2>
          <p className="text-xs text-neutral-400">
            Sign in with your Google account for preferred matching and verified access.
          </p>
        </div>

        {/* Primary Google Login Button (Airbnb Style) */}
        <div className="space-y-3">
          <button
            onClick={() => handleGoogleLogin(emailInput, nameInput)}
            disabled={isLoading}
            className="w-full py-3.5 px-4 rounded-full border border-neutral-700 bg-neutral-900 hover:bg-neutral-800 text-white font-semibold text-xs transition-all shadow-sm hover:shadow-md active:scale-[0.99] flex items-center justify-center gap-3"
          >
            {/* Google SVG Logo */}
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
            <span>Continue with Google</span>
          </button>

          {/* Quick toggle to customize user profile / test with another Google email */}
          {!showCustomEmail ? (
            <button
              onClick={() => setShowCustomEmail(true)}
              className="w-full text-center text-[11px] text-neutral-400 hover:text-white underline"
            >
              Signing in as {emailInput}? Change email
            </button>
          ) : (
            <div className="p-3.5 rounded-2xl bg-neutral-900 border border-neutral-800 space-y-2.5 text-xs animate-in fade-in duration-150">
              <div>
                <label className="block text-[11px] text-neutral-400 mb-1">Google Email</label>
                <input
                  type="email"
                  value={emailInput}
                  onChange={(e) => setEmailInput(e.target.value)}
                  className="w-full bg-neutral-950 border border-neutral-800 rounded-xl px-3 py-2 text-xs text-white focus:outline-none focus:border-[#FF385C]"
                  placeholder="user@gmail.com"
                />
              </div>
              <div>
                <label className="block text-[11px] text-neutral-400 mb-1">Full Name</label>
                <input
                  type="text"
                  value={nameInput}
                  onChange={(e) => setNameInput(e.target.value)}
                  className="w-full bg-neutral-950 border border-neutral-800 rounded-xl px-3 py-2 text-xs text-white focus:outline-none focus:border-[#FF385C]"
                  placeholder="Your Name"
                />
              </div>
            </div>
          )}
        </div>

        {error && (
          <div className="flex items-center gap-2 p-3 rounded-2xl bg-rose-950/40 border border-rose-800/40 text-rose-300 text-xs">
            <AlertCircleIcon className="w-4 h-4 shrink-0" />
            <span>{error}</span>
          </div>
        )}

        {/* Divider */}
        <div className="relative flex items-center justify-center">
          <div className="border-t border-neutral-800 w-full" />
          <span className="bg-[#161618] px-3 text-[11px] text-neutral-500 uppercase tracking-wider font-medium">
            or
          </span>
        </div>

        {/* Anonymous / Guest Option */}
        <button
          onClick={onClose}
          className="w-full py-3 px-4 rounded-full border border-neutral-800 hover:bg-neutral-800/60 text-neutral-300 hover:text-white font-medium text-xs transition-colors flex items-center justify-center gap-2"
        >
          <UserCircleIcon className="w-4 h-4 text-neutral-400" />
          <span>Continue as Anonymous Guest</span>
        </button>

        <p className="text-[11px] text-neutral-500 text-center leading-relaxed">
          By signing in, you confirm you are at least 18 years old and agree to the U-R-LIVE Community Standards and Terms of Service.
        </p>
      </div>
    </div>
  );
};
