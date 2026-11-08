import React, { useState } from 'react';
import { WebProtectionIcon, CheckmarkCircle01Icon, AlertCircleIcon, Cancel01Icon } from 'hugeicons-react';

interface AgeVerificationModalProps {
  isOpen: boolean;
  onConfirm: () => void;
  onCancel: () => void;
}

export const AgeVerificationModal: React.FC<AgeVerificationModalProps> = ({
  isOpen,
  onConfirm,
  onCancel,
}) => {
  const [agreedAge, setAgreedAge] = useState(false);
  const [agreedStandards, setAgreedStandards] = useState(false);
  const [error, setError] = useState('');

  if (!isOpen) return null;

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!agreedAge || !agreedStandards) {
      setError('You must confirm both age and community standards to enter video chat.');
      return;
    }
    setError('');
    onConfirm();
  };

  return (
    <div
      className="fixed inset-0 z-[80] flex items-end justify-center bg-black/75 p-0 backdrop-blur-xl animate-in fade-in duration-200 sm:items-center sm:p-4"
      role="dialog"
      aria-modal="true"
      aria-label="Adult-only verification"
    >
      <div className="animate-in relative flex max-h-[92dvh] w-full max-w-md flex-col overflow-hidden rounded-t-[28px] border border-white/10 bg-[#0b0914]/95 text-white shadow-[0_40px_120px_-40px_rgba(0,0,0,0.95)] backdrop-blur-2xl sm:rounded-[28px]">
        <div
          aria-hidden="true"
          className="absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-violet-400/70 to-transparent"
        />

        <div className="flex items-start justify-between gap-3 px-5 pt-5 pb-4">
          <div className="flex items-start gap-3">
            <span className="mt-0.5 relative flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl border border-red-500/25 bg-gradient-to-br from-red-500/15 to-transparent p-1.5 shadow-[0_0_24px_-8px_rgba(239,68,68,0.7)]">
              <img src="/logo-icon.png" alt="UR Live" className="h-full w-full object-contain" />
            </span>
            <div>
              <div className="flex items-center gap-1.5">
                <h2 className="font-display text-lg font-bold tracking-tight">Adult-only checkpoint</h2>
                <span className="rounded bg-red-500/20 px-1.5 py-0.5 text-[9px] font-bold text-red-300 uppercase tracking-wider">18+</span>
              </div>
              <p className="mt-0.5 text-[11px] text-white/45">U-R-LIVE verification · takes a few seconds</p>
            </div>
          </div>
          <button
            onClick={onCancel}
            className="grid h-8 w-8 shrink-0 place-items-center rounded-full text-white/45 transition-colors hover:bg-white/[0.08] hover:text-white focus:outline-none focus-visible:ring-2 focus-visible:ring-violet-400/70"
            aria-label="Close"
          >
            <Cancel01Icon className="h-4.5 w-4.5" />
          </button>
        </div>

        <form
          onSubmit={handleSubmit}
          className="flex min-h-0 flex-1 flex-col overflow-y-auto overscroll-contain px-5 pb-[calc(1.25rem+env(safe-area-inset-bottom))]"
        >
          <p className="text-xs leading-relaxed text-white/55">
            <strong className="font-semibold text-white/85">U-R-LIVE</strong> is an adult-only social
            video platform. Every participant confirms adulthood before enabling live video or joining
            matchmaking.
          </p>

          <div className="mt-4 space-y-2.5">
            <label className="flex cursor-pointer items-start gap-3 rounded-2xl border border-white/[0.07] bg-white/[0.03] p-3.5 text-xs transition-colors hover:border-white/15 hover:bg-white/[0.05]">
              <input
                type="checkbox"
                checked={agreedAge}
                onChange={(e) => setAgreedAge(e.target.checked)}
                className="peer sr-only"
              />
              <span className="mt-0.5 grid h-4.5 w-4.5 shrink-0 place-items-center rounded-md border border-white/25 transition-colors peer-checked:border-violet-400 peer-checked:bg-gradient-to-br peer-checked:from-violet-500 peer-checked:to-indigo-500 peer-focus-visible:ring-2 peer-focus-visible:ring-violet-400/60">
                {agreedAge && <CheckmarkCircle01Icon className="h-3 w-3 text-white" />}
              </span>
              <span className="leading-relaxed text-white/60">
                I certify that I am at least <strong className="font-semibold text-white">18 years old</strong>{' '}
                or the age of majority in my jurisdiction.
              </span>
            </label>

            <label className="flex cursor-pointer items-start gap-3 rounded-2xl border border-white/[0.07] bg-white/[0.03] p-3.5 text-xs transition-colors hover:border-white/15 hover:bg-white/[0.05]">
              <input
                type="checkbox"
                checked={agreedStandards}
                onChange={(e) => setAgreedStandards(e.target.checked)}
                className="peer sr-only"
              />
              <span className="mt-0.5 grid h-4.5 w-4.5 shrink-0 place-items-center rounded-md border border-white/25 transition-colors peer-checked:border-violet-400 peer-checked:bg-gradient-to-br peer-checked:from-violet-500 peer-checked:to-indigo-500 peer-focus-visible:ring-2 peer-focus-visible:ring-violet-400/60">
                {agreedStandards && <CheckmarkCircle01Icon className="h-3 w-3 text-white" />}
              </span>
              <span className="leading-relaxed text-white/60">
                I agree to the Community Standards: no underage users, sexual violence, non-consensual
                recording, harassment, or unlawful content.
              </span>
            </label>
          </div>

          {error && (
            <div className="mt-3 flex items-start gap-2 rounded-2xl border border-rose-400/25 bg-rose-500/10 p-3 text-xs text-rose-200">
              <AlertCircleIcon className="mt-px h-4 w-4 shrink-0" />
              <span>{error}</span>
            </div>
          )}

          <div className="mt-5 flex items-center justify-end gap-2 border-t border-white/[0.07] pt-4">
            <button
              type="button"
              onClick={onCancel}
              className="rounded-full px-4 py-2.5 text-xs font-semibold text-white/50 transition-colors hover:bg-white/[0.07] hover:text-white"
            >
              Exit
            </button>
            <button
              type="submit"
              disabled={!agreedAge || !agreedStandards}
              className="btn-primary inline-flex items-center gap-1.5 px-5 py-2.5 text-xs"
            >
              <CheckmarkCircle01Icon className="h-4 w-4" />
              <span>Confirm &amp; enter</span>
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
