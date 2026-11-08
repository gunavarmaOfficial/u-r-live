import React, { useEffect, useRef, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { Cancel01Icon, UserCircleIcon, AlertCircleIcon } from 'hugeicons-react';
import { api } from '../services/api';
import { UserProfile, Subscription } from '../types';
import { LEGAL } from '../legal/config';
import { Logo } from './Logo';
import { ModalShell } from './ModalShell';

interface GoogleAuthModalProps {
  isOpen: boolean;
  clientId: string | null;
  onClose: () => void;
  onSuccess: (user: UserProfile, isPro: boolean, sub: Subscription | null) => void;
}

interface GoogleIdentity {
  accounts: {
    id: {
      initialize: (options: {
        client_id: string;
        callback: (response: { credential?: string }) => void;
        cancel_on_tap_outside?: boolean;
      }) => void;
      renderButton: (
        parent: HTMLElement,
        options: Record<string, string | number | boolean>
      ) => void;
    };
  };
}

declare global {
  interface Window {
    google?: GoogleIdentity;
  }
}

const GSI_SCRIPT_ID = 'google-identity-services';

function loadGsiScript(): Promise<void> {
  if (window.google?.accounts?.id) return Promise.resolve();
  const existing = document.getElementById(GSI_SCRIPT_ID) as HTMLScriptElement | null;
  if (existing) {
    return new Promise((resolve, reject) => {
      existing.addEventListener('load', () => resolve());
      existing.addEventListener('error', () => reject(new Error('Google sign-in failed to load')));
    });
  }
  return new Promise((resolve, reject) => {
    const script = document.createElement('script');
    script.id = GSI_SCRIPT_ID;
    script.src = 'https://accounts.google.com/gsi/client';
    script.async = true;
    script.defer = true;
    script.onload = () => resolve();
    script.onerror = () => reject(new Error('Google sign-in failed to load'));
    document.head.appendChild(script);
  });
}

export const GoogleAuthModal: React.FC<GoogleAuthModalProps> = ({
  isOpen,
  clientId,
  onClose,
  onSuccess,
}) => {
  const navigate = useNavigate();
  const buttonRef = useRef<HTMLDivElement>(null);
  const [ageConfirmed, setAgeConfirmed] = useState(false);
  const [acceptedTerms, setAcceptedTerms] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState('');

  const consentReady = ageConfirmed && acceptedTerms;

  useEffect(() => {
    if (!isOpen || !clientId) return;
    let cancelled = false;

    const handleCredential = async (response: { credential?: string }) => {
      if (!response.credential) {
        setError('Google did not return a credential. Please try again.');
        return;
      }
      setIsLoading(true);
      setError('');
      try {
        const res = await api.loginWithGoogle({
          credential: response.credential,
          termsVersion: LEGAL.termsVersion,
          ageConfirmed: true,
        });
        onSuccess(res.user, res.isPro, res.subscription);
        onClose();
      } catch (err: any) {
        setError(err.message || 'Google sign-in failed');
      } finally {
        setIsLoading(false);
      }
    };

    loadGsiScript()
      .then(() => {
        if (cancelled || !buttonRef.current || !window.google?.accounts?.id) return;
        window.google.accounts.id.initialize({
          client_id: clientId,
          callback: handleCredential,
          cancel_on_tap_outside: true,
        });
        buttonRef.current.innerHTML = '';
        window.google.accounts.id.renderButton(buttonRef.current, {
          type: 'standard',
          theme: 'filled_black',
          size: 'large',
          shape: 'pill',
          text: 'continue_with',
          logo_alignment: 'left',
          width: 320,
        });
      })
      .catch((err: Error) => setError(err.message));

    return () => {
      cancelled = true;
    };
  }, [isOpen, clientId, onSuccess, onClose]);

  if (!isOpen) return null;

  return (
    <ModalShell
      isOpen={isOpen}
      onClose={onClose}
      ariaLabel="Sign in with Google"
      panelClassName="max-w-md rounded-t-[28px] border border-white/10 bg-[#0b0914]/95 shadow-[0_40px_120px_-40px_rgba(0,0,0,0.95)] backdrop-blur-2xl sm:rounded-[28px]"
    >
      <div
        aria-hidden="true"
        className="absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-violet-400/70 to-transparent"
      />

        <div className="flex items-center justify-between px-5 pt-5 pb-2">
          <Logo size="sm" />
          <button
            onClick={onClose}
            className="grid h-8 w-8 place-items-center rounded-full text-white/45 transition-colors hover:bg-white/[0.08] hover:text-white focus:outline-none focus-visible:ring-2 focus-visible:ring-violet-400/70"
            aria-label="Close"
          >
            <Cancel01Icon className="h-4.5 w-4.5" />
          </button>
        </div>

        <div className="min-h-0 flex-1 overflow-y-auto overscroll-contain px-5 pb-[calc(1.25rem+env(safe-area-inset-bottom))]">
          <div className="mt-2">
            <h2 className="font-display text-xl font-bold tracking-tight">
              Welcome to <span className="text-gradient-brand">U-R-LIVE</span>
            </h2>
            <p className="mt-1.5 text-xs leading-relaxed text-white/45">
              Sign in with Google to keep your preferences, Pro status and safety history across devices.
            </p>
          </div>

          <div className="mt-5 space-y-2.5">
            <label className="flex cursor-pointer select-none items-start gap-3 rounded-2xl border border-white/[0.08] bg-white/[0.03] p-3.5">
              <input
                type="checkbox"
                checked={ageConfirmed}
                onChange={(e) => setAgeConfirmed(e.target.checked)}
                className="mt-0.5 h-4 w-4 shrink-0 cursor-pointer rounded border-white/20 bg-black/40 accent-[#8b5cf6]"
              />
              <span className="text-[11px] leading-relaxed text-white/50">
                I confirm I am at least{' '}
                <strong className="font-bold text-white">{LEGAL.minimumAge} years old</strong>.
              </span>
            </label>

            <label className="flex cursor-pointer select-none items-start gap-3 rounded-2xl border border-white/[0.08] bg-white/[0.03] p-3.5">
              <input
                type="checkbox"
                checked={acceptedTerms}
                onChange={(e) => setAcceptedTerms(e.target.checked)}
                className="mt-0.5 h-4 w-4 shrink-0 cursor-pointer rounded border-white/20 bg-black/40 accent-[#8b5cf6]"
              />
              <span className="text-[11px] leading-relaxed text-white/50">
                I agree to the{' '}
                <Link to="/terms" target="_blank" rel="noreferrer" className="font-semibold text-violet-300 underline underline-offset-2">
                  Terms
                </Link>{' '}
                and{' '}
                <Link to="/privacy" target="_blank" rel="noreferrer" className="font-semibold text-violet-300 underline underline-offset-2">
                  Privacy Policy
                </Link>
                .
              </span>
            </label>
          </div>

          <div className="relative mt-4">
            <div
              ref={buttonRef}
              className={`flex min-h-[44px] justify-center transition-opacity ${
                consentReady && !isLoading ? 'opacity-100' : 'pointer-events-none opacity-40'
              }`}
            />
            {!consentReady && (
              <p className="mt-2 text-center text-[10px] text-white/35">
                Confirm both statements to enable Google sign-in.
              </p>
            )}
          </div>

          {error && (
            <div className="mt-3 flex items-start gap-2 rounded-2xl border border-rose-400/25 bg-rose-500/10 p-3 text-xs text-rose-200">
              <AlertCircleIcon className="mt-px h-4 w-4 shrink-0" />
              <span>{error}</span>
            </div>
          )}

          <div className="relative my-5 flex items-center justify-center">
            <div className="h-px w-full bg-white/[0.08]" />
            <span className="absolute bg-[#0b0914] px-3 text-[10px] font-bold uppercase tracking-[0.16em] text-white/25">
              or
            </span>
          </div>

          <button
            onClick={() => {
              onClose();
              navigate('/live');
            }}
            className="flex w-full items-center justify-center gap-2 rounded-full border border-white/[0.08] bg-transparent px-4 py-3 text-xs font-medium text-white/60 transition-colors hover:bg-white/[0.05] hover:text-white"
          >
            <UserCircleIcon className="h-4 w-4 text-white/40" />
            <span>Continue as anonymous guest</span>
          </button>

          <p className="mt-4 text-center text-[10px] leading-relaxed text-white/25">
            By signing in you accept the U-R-LIVE Community Rules and confirm you are {LEGAL.minimumAge}+.
          </p>
        </div>
    </ModalShell>
  );
};
