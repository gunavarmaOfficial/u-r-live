import React, { useState } from 'react';
import {
  AlertCircleIcon,
  CheckmarkCircle01Icon,
  Cancel01Icon,
  WebProtectionIcon,
} from 'hugeicons-react';
import { ReportCategory } from '../types';
import { api } from '../services/api';
import { ModalShell } from './ModalShell';

interface ReportModalProps {
  isOpen: boolean;
  reportedUserId: string;
  reportedUserName: string;
  onClose: () => void;
  onSubmitted: () => void;
}

const CATEGORIES: { value: ReportCategory; label: string; desc: string }[] = [
  { value: 'harassment', label: 'Harassment or Bullying', desc: 'Targeted aggression, hate speech, or abuse' },
  { value: 'suspected_underage', label: 'Suspected Underage User', desc: 'User appears or declares to be under 18' },
  { value: 'sexual_misconduct', label: 'Sexual Misconduct or Nudity', desc: 'Lewd acts, unsolicited exposure, or vulgarity' },
  { value: 'threats_abuse', label: 'Threats or Violence', desc: 'Physical threats, weapons, or self-harm incitement' },
  { value: 'non_consensual', label: 'Non-Consensual Imagery / Recording', desc: 'Streaming unauthorized third-party media or screens' },
  { value: 'scam_spam', label: 'Scam, Commercial or Bot Spam', desc: 'Automated streams, phishing, or financial scams' },
  { value: 'other', label: 'Other Prohibited Conduct', desc: 'Violation of community standards' },
];

export const ReportModal: React.FC<ReportModalProps> = ({
  isOpen,
  reportedUserId,
  reportedUserName,
  onClose,
  onSubmitted,
}) => {
  const [category, setCategory] = useState<ReportCategory>('harassment');
  const [description, setDescription] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState('');
  const [isDone, setIsDone] = useState(false);

  if (!isOpen) return null;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSubmitting(true);
    setError('');

    try {
      await api.submitReport({
        reportedUserId,
        reportedUserName,
        category,
        description,
      });
      setIsDone(true);
      setTimeout(() => {
        setIsDone(false);
        onSubmitted();
        onClose();
      }, 1500);
    } catch (err: any) {
      setError(err.message || 'Failed to submit report');
      setIsSubmitting(false);
    }
  };

  return (
    <ModalShell
      isOpen={isOpen}
      onClose={onClose}
      ariaLabel="Report user"
      panelClassName="max-w-lg rounded-t-[28px] border border-white/10 bg-[#0b0914]/95 shadow-[0_40px_120px_-40px_rgba(0,0,0,0.95)] backdrop-blur-2xl sm:rounded-[28px]"
    >
      <div className="absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-rose-400/60 to-transparent" aria-hidden="true" />

        <div className="flex items-start justify-between gap-3 px-5 pt-5 pb-4">
          <div className="flex items-start gap-3">
            <span className="mt-0.5 grid h-10 w-10 shrink-0 place-items-center rounded-2xl border border-rose-400/30 bg-rose-500/15 text-rose-300 shadow-[0_0_24px_-10px_rgba(251,113,133,0.9)]">
              <AlertCircleIcon className="h-5 w-5" />
            </span>
            <div>
              <h2 className="font-display text-lg font-bold tracking-tight">Report user</h2>
              <p className="mt-0.5 text-[11px] text-white/45">
                Reporting {reportedUserName || 'stranger'} · your session stays anonymous
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="grid h-8 w-8 shrink-0 place-items-center rounded-full text-white/45 transition-colors hover:bg-white/[0.08] hover:text-white focus:outline-none focus-visible:ring-2 focus-visible:ring-rose-400/70"
            aria-label="Close"
          >
            <Cancel01Icon className="h-4.5 w-4.5" />
          </button>
        </div>

        {isDone ? (
          <div className="flex flex-1 flex-col items-center justify-center gap-3 px-6 py-14 text-center">
            <span className="grid h-14 w-14 place-items-center rounded-full border border-emerald-400/30 bg-emerald-500/15 text-emerald-300 shadow-[0_0_30px_-8px_rgba(52,211,153,0.7)]">
              <CheckmarkCircle01Icon className="h-7 w-7" />
            </span>
            <p className="text-sm font-bold text-white">Report submitted · peer blocked</p>
            <p className="max-w-xs text-xs leading-relaxed text-white/45">
              This user is removed from your queue and routed to the moderation team for review.
            </p>
          </div>
        ) : (
          <form onSubmit={handleSubmit} className="flex min-h-0 flex-1 flex-col">
            <div className="min-h-0 flex-1 space-y-4 overflow-y-auto overscroll-contain px-5 pb-4">
              <div>
                <p className="mb-2 text-[11px] font-bold uppercase tracking-[0.14em] text-white/40">
                  Category of violation
                </p>
                <div className="max-h-[42vh] space-y-1.5 overflow-y-auto pr-1 sm:max-h-56">
                  {CATEGORIES.map((c) => {
                    const isActive = category === c.value;
                    return (
                      <label
                        key={c.value}
                        className={`flex cursor-pointer items-start gap-3 rounded-2xl border p-3 text-xs transition-all ${
                          isActive
                            ? 'border-rose-400/50 bg-rose-500/[0.12] text-white shadow-[0_0_26px_-14px_rgba(251,113,133,0.9)]'
                            : 'border-white/[0.07] bg-white/[0.03] text-white/55 hover:border-white/15 hover:bg-white/[0.05]'
                        }`}
                      >
                        <input
                          type="radio"
                          name="report_cat"
                          value={c.value}
                          checked={isActive}
                          onChange={() => setCategory(c.value)}
                          className="sr-only"
                        />
                        <span
                          className={`mt-0.5 grid h-4 w-4 shrink-0 place-items-center rounded-full border transition-colors ${
                            isActive ? 'border-rose-400 bg-rose-500' : 'border-white/25'
                          }`}
                          aria-hidden="true"
                        >
                          {isActive && <span className="h-1.5 w-1.5 rounded-full bg-white" />}
                        </span>
                        <span className="min-w-0">
                          <span className="block font-semibold text-white/90">{c.label}</span>
                          <span className="mt-0.5 block text-[11px] leading-snug text-white/35">
                            {c.desc}
                          </span>
                        </span>
                      </label>
                    );
                  })}
                </div>
              </div>

              <div>
                <label
                  htmlFor="report-details"
                  className="mb-2 block text-[11px] font-bold uppercase tracking-[0.14em] text-white/40"
                >
                  Additional details <span className="font-medium normal-case text-white/25">(optional)</span>
                </label>
                <textarea
                  id="report-details"
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                  placeholder="Describe what happened — only include what moderators need…"
                  rows={3}
                  maxLength={1000}
                  className="w-full resize-none rounded-2xl border border-white/10 bg-white/[0.04] p-3 text-xs text-white placeholder:text-white/25 transition-colors focus:border-rose-400/50 focus:bg-white/[0.06] focus:outline-none focus-visible:ring-2 focus-visible:ring-rose-400/30"
                />
              </div>

              <div className="flex items-start gap-2 rounded-xl border border-white/[0.07] bg-white/[0.03] px-3 py-2.5 text-[10px] leading-relaxed text-white/35">
                <WebProtectionIcon className="mt-px h-3.5 w-3.5 shrink-0 text-emerald-300/80" />
                <span>
                  Reports are confidential. The user is blocked immediately, and we never reveal your
                  identity to them.
                </span>
              </div>

              {error && (
                <div className="flex items-start gap-2 rounded-2xl border border-rose-400/25 bg-rose-500/10 p-3 text-xs text-rose-200">
                  <AlertCircleIcon className="mt-px h-4 w-4 shrink-0" />
                  <span>{error}</span>
                </div>
              )}
            </div>

            <div className="flex items-center justify-end gap-2 border-t border-white/[0.07] bg-[#08060f]/80 px-5 pt-3 pb-[calc(0.75rem+env(safe-area-inset-bottom))] backdrop-blur-xl">
              <button
                type="button"
                onClick={onClose}
                disabled={isSubmitting}
                className="rounded-full px-4 py-2.5 text-xs font-semibold text-white/50 transition-colors hover:bg-white/[0.07] hover:text-white disabled:opacity-50"
              >
                Cancel
              </button>
              <button
                type="submit"
                disabled={isSubmitting}
                className="inline-flex items-center justify-center gap-2 rounded-full bg-gradient-to-r from-rose-500 to-rose-600 px-5 py-2.5 text-xs font-bold text-white shadow-[0_12px_30px_-12px_rgba(244,63,94,0.9)] transition hover:brightness-110 active:scale-[0.98] disabled:opacity-50"
              >
                <span>{isSubmitting ? 'Submitting…' : 'Submit report & block'}</span>
              </button>
            </div>
          </form>
        )}
    </ModalShell>
  );
};
