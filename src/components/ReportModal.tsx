import React, { useState } from 'react';
import {
  AlertCircleIcon,
  CheckmarkCircle01Icon,
  Cancel01Icon,
  WebProtectionIcon,
} from 'hugeicons-react';
import { ReportCategory } from '../types';
import { api } from '../services/api';

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
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm animate-in fade-in duration-200">
      <div className="w-full max-w-lg rounded-3xl border border-neutral-800 bg-[#161618] p-6 shadow-2xl space-y-5">
        <div className="flex items-center justify-between pb-3 border-b border-neutral-800">
          <div className="flex items-center gap-3">
            <div className="p-2.5 rounded-full bg-rose-500/15 text-rose-400">
              <AlertCircleIcon className="w-5 h-5" />
            </div>
            <div>
              <h2 className="text-base font-bold text-white">Report User</h2>
              <p className="text-xs text-neutral-400">Reporting {reportedUserName || 'Stranger'}</p>
            </div>
          </div>
          <button onClick={onClose} className="p-1 rounded-full text-neutral-400 hover:text-white">
            <Cancel01Icon className="w-4 h-4" />
          </button>
        </div>

        {isDone ? (
          <div className="py-8 text-center space-y-3">
            <div className="w-12 h-12 rounded-full bg-emerald-500/20 text-emerald-400 flex items-center justify-center mx-auto">
              <CheckmarkCircle01Icon className="w-6 h-6" />
            </div>
            <p className="text-sm font-bold text-white">Report Submitted & Peer Blocked</p>
            <p className="text-xs text-neutral-400 max-w-xs mx-auto">
              This user has been blocked from your U-R-LIVE queue and routed for moderation review.
            </p>
          </div>
        ) : (
          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="space-y-1.5">
              <label className="text-xs font-semibold text-neutral-300">Category of Violation</label>
              <div className="space-y-1.5 max-h-52 overflow-y-auto pr-1">
                {CATEGORIES.map((c) => (
                  <label
                    key={c.value}
                    className={`flex items-start gap-2.5 p-3 rounded-2xl border cursor-pointer transition-all text-xs ${
                      category === c.value
                        ? 'bg-neutral-800/90 border-[#FF385C] text-white shadow-sm'
                        : 'bg-neutral-950/40 border-neutral-800 text-neutral-400 hover:bg-neutral-800/40'
                    }`}
                  >
                    <input
                      type="radio"
                      name="report_cat"
                      value={c.value}
                      checked={category === c.value}
                      onChange={() => setCategory(c.value)}
                      className="mt-0.5 text-[#FF385C] focus:ring-0"
                    />
                    <div>
                      <p className="font-semibold text-neutral-200">{c.label}</p>
                      <p className="text-[11px] text-neutral-500">{c.desc}</p>
                    </div>
                  </label>
                ))}
              </div>
            </div>

            <div className="space-y-1.5">
              <label className="text-xs font-semibold text-neutral-300">
                Additional Details (Optional)
              </label>
              <textarea
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                placeholder="Describe what occurred (only include necessary details for moderation review)..."
                rows={3}
                className="w-full bg-neutral-950 border border-neutral-800 rounded-2xl p-3 text-xs text-white placeholder-neutral-500 focus:outline-none focus:border-[#FF385C]"
              />
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
                onClick={onClose}
                disabled={isSubmitting}
                className="px-5 py-2.5 rounded-full border border-neutral-700 hover:bg-neutral-800 text-xs font-semibold text-neutral-400 hover:text-white transition-colors"
              >
                Cancel
              </button>
              <button
                type="submit"
                disabled={isSubmitting}
                className="px-6 py-2.5 rounded-full bg-gradient-to-r from-rose-600 to-rose-700 hover:from-rose-500 hover:to-rose-600 disabled:opacity-50 text-xs font-bold text-white shadow-lg shadow-rose-900/40 transition-all flex items-center gap-2 active:scale-95"
              >
                <span>Submit Report & Block</span>
              </button>
            </div>
          </form>
        )}
      </div>
    </div>
  );
};
