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
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm animate-in fade-in duration-200">
      <div className="w-full max-w-md rounded-3xl border border-neutral-800 bg-[#161618] p-6 shadow-2xl space-y-5">
        <div className="flex items-center justify-between pb-3 border-b border-neutral-800">
          <div className="flex items-center gap-3">
            <div className="p-2.5 rounded-full bg-[#FF385C]/15 text-[#FF385C]">
              <WebProtectionIcon className="w-5 h-5" />
            </div>
            <div>
              <h2 className="text-base font-bold text-white">Adult-Only Access Checkpoint</h2>
              <p className="text-xs text-neutral-400">Strictly 18+ Verification</p>
            </div>
          </div>
          <button onClick={onCancel} className="p-1 rounded-full text-neutral-400 hover:text-white">
            <Cancel01Icon className="w-4 h-4" />
          </button>
        </div>

        <p className="text-xs text-neutral-300 leading-relaxed">
          <strong className="text-white">U-R-LIVE</strong> is an adult-only social video platform. To ensure a lawful, safe community, all participants must confirm adulthood before enabling live video or joining matchmaking.
        </p>

        <form onSubmit={handleSubmit} className="space-y-4 pt-1">
          <div className="space-y-3 bg-[#111113] p-4 rounded-2xl border border-neutral-800 text-xs">
            <label className="flex items-start gap-2.5 cursor-pointer select-none">
              <input
                type="checkbox"
                checked={agreedAge}
                onChange={(e) => setAgreedAge(e.target.checked)}
                className="mt-0.5 rounded border-neutral-700 bg-neutral-800 text-[#FF385C] focus:ring-0 focus:ring-offset-0"
              />
              <span className="text-neutral-200">
                I solemnly certify that I am at least <strong className="text-white">18 years of age</strong> or the age of legal majority in my jurisdiction.
              </span>
            </label>

            <label className="flex items-start gap-2.5 cursor-pointer select-none">
              <input
                type="checkbox"
                checked={agreedStandards}
                onChange={(e) => setAgreedStandards(e.target.checked)}
                className="mt-0.5 rounded border-neutral-700 bg-neutral-800 text-[#FF385C] focus:ring-0 focus:ring-offset-0"
              />
              <span className="text-neutral-200">
                I agree to the Community Standards: strictly prohibiting underage users, sexual violence, non-consensual recordings, and unlawful harassment.
              </span>
            </label>
          </div>

          {error && (
            <div className="flex items-center gap-2 p-3 rounded-2xl bg-rose-950/40 border border-rose-800/40 text-rose-300 text-xs">
              <AlertCircleIcon className="w-4 h-4 shrink-0" />
              <span>{error}</span>
            </div>
          )}

          <div className="flex items-center justify-end gap-3 pt-2">
            <button
              type="button"
              onClick={onCancel}
              className="px-5 py-2.5 rounded-full border border-neutral-700 hover:bg-neutral-800 text-xs font-semibold text-neutral-300 hover:text-white transition-colors"
            >
              Exit
            </button>
            <button
              type="submit"
              disabled={!agreedAge || !agreedStandards}
              className="px-6 py-2.5 rounded-full bg-gradient-to-r from-[#FF385C] to-[#E00B41] hover:from-[#E00B41] hover:to-[#D70438] disabled:opacity-40 text-xs font-bold text-white shadow-md shadow-[#FF385C]/30 transition-all flex items-center gap-1.5 active:scale-95"
            >
              <CheckmarkCircle01Icon className="w-4 h-4" />
              <span>Confirm & Enter</span>
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
