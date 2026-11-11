import React, { useEffect, useState } from 'react';
import {
  Cancel01Icon,
  CheckmarkCircle01Icon,
  Delete02Icon,
  Settings02Icon,
  Link04Icon,
} from 'hugeicons-react';
import { UserProfile } from '../types';
import { api } from '../services/api';
import { ModalShell } from './ModalShell';

interface AccountSettingsModalProps {
  isOpen: boolean;
  onClose: () => void;
  user: UserProfile;
  onProfileUpdated: (updatedUser: UserProfile) => void;
  onOpenGoogleModal: () => void;
}

const fieldClass =
  'w-full rounded-xl border border-white/10 bg-white/[0.04] px-3.5 py-2.5 text-xs text-white placeholder:text-white/25 transition-colors focus:border-violet-400/60 focus:bg-white/[0.06] focus:outline-none focus-visible:ring-2 focus-visible:ring-violet-400/30';

const sectionLabelClass =
  'text-[10px] font-bold uppercase tracking-[0.16em] text-white/35';

export const AccountSettingsModal: React.FC<AccountSettingsModalProps> = ({
  isOpen,
  onClose,
  user,
  onProfileUpdated,
  onOpenGoogleModal,
}) => {
  const [displayName, setDisplayName] = useState(user.displayName);
  const [gender, setGender] = useState(user.gender);
  const [country, setCountry] = useState(user.country);
  const [isSaving, setIsSaving] = useState(false);
  const [saveSuccess, setSaveSuccess] = useState(false);
  const [error, setError] = useState('');

  const [blockedUsers, setBlockedUsers] = useState<string[]>([]);
  const [unblockingId, setUnblockingId] = useState<string | null>(null);

  useEffect(() => {
    if (isOpen) {
      setDisplayName(user.displayName);
      setGender(user.gender);
      setCountry(user.country);
      api
        .getBlockedUsers()
        .then((res) => setBlockedUsers(res.blockedUserIds || []))
        .catch(() => {});
    }
  }, [isOpen, user]);

  if (!isOpen) return null;

  const handleSaveProfile = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSaving(true);
    setError('');
    try {
      const res = await api.updateProfile({
        displayName,
        gender,
        country,
      });
      onProfileUpdated(res.user);
      setSaveSuccess(true);
      setTimeout(() => setSaveSuccess(false), 2000);
    } catch (err: any) {
      setError(err.message || 'Failed to update profile');
    } finally {
      setIsSaving(false);
    }
  };

  const handleUnblock = async (blockedId: string) => {
    setUnblockingId(blockedId);
    try {
      await api.unblockUser(blockedId);
      setBlockedUsers((prev) => prev.filter((id) => id !== blockedId));
    } catch (err: any) {
      alert(err.message || 'Could not unblock user');
    } finally {
      setUnblockingId(null);
    }
  };

  const handleDeleteAccountData = () => {
    if (confirm('Delete local session data and reset identity on U-R-LIVE?')) {
      localStorage.clear();
      window.location.reload();
    }
  };

  const isGoogleUser = user.authProvider === 'google';

  return (
    <ModalShell
      isOpen={isOpen}
      onClose={onClose}
      ariaLabel="Account and preferences"
      panelClassName="max-w-lg rounded-t-[28px] border border-white/10 bg-[#0b0914]/95 shadow-[0_40px_120px_-40px_rgba(0,0,0,0.95)] backdrop-blur-2xl sm:rounded-[28px]"
    >
      <div
        aria-hidden="true"
        className="absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-violet-400/70 to-transparent"
      />

        <div className="flex items-start justify-between gap-3 px-5 pt-5 pb-4">
          <div className="flex items-start gap-3">
            <span className="mt-0.5 grid h-10 w-10 shrink-0 place-items-center rounded-2xl border border-white/10 bg-white/[0.06] text-violet-200">
              <Settings02Icon className="h-5 w-5" />
            </span>
            <div>
              <h2 className="font-display text-lg font-bold tracking-tight">Account &amp; preferences</h2>
              <p className="mt-0.5 text-[11px] text-white/45">
                Signed in as <span className="text-white/70">{user.displayName}</span>
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="grid h-8 w-8 shrink-0 place-items-center rounded-full text-white/45 transition-colors hover:bg-white/[0.08] hover:text-white focus:outline-none focus-visible:ring-2 focus-visible:ring-violet-400/70"
            aria-label="Close"
          >
            <Cancel01Icon className="h-4.5 w-4.5" />
          </button>
        </div>

        <div className="min-h-0 flex-1 space-y-5 overflow-y-auto overscroll-contain px-5 pb-[calc(1.25rem+env(safe-area-inset-bottom))]">
          {/* Identity provider */}
          <div className="flex items-center justify-between gap-3 rounded-2xl border border-white/[0.07] bg-white/[0.03] p-3.5">
            <div className="flex min-w-0 items-center gap-3">
              <span className="grid h-9 w-9 shrink-0 place-items-center rounded-xl border border-white/10 bg-white/[0.05]">
                {isGoogleUser ? (
                  <svg className="h-4 w-4" viewBox="0 0 24 24" aria-hidden="true">
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
                ) : (
                  <Link04Icon className="h-4 w-4 text-white/45" />
                )}
              </span>
              <div className="min-w-0">
                <p className="truncate text-xs font-semibold text-white/85">
                  {isGoogleUser ? 'Google account linked' : 'Guest identity'}
                </p>
                <p className="truncate text-[11px] text-white/35">
                  {isGoogleUser ? user.email : 'Link Google to sync across devices'}
                </p>
              </div>
            </div>

            {!isGoogleUser ? (
              <button
                onClick={() => {
                  onClose();
                  onOpenGoogleModal();
                }}
                className="shrink-0 rounded-full border border-white/12 bg-white/[0.06] px-3.5 py-1.5 text-[11px] font-semibold text-white transition-colors hover:border-white/25 hover:bg-white/[0.1]"
              >
                Connect
              </button>
            ) : (
              <span className="inline-flex shrink-0 items-center gap-1.5 rounded-full border border-emerald-400/25 bg-emerald-500/12 px-2.5 py-0.5 text-[10px] font-bold uppercase tracking-[0.12em] text-emerald-300">
                <span className="h-1.5 w-1.5 rounded-full bg-emerald-400" />
                Linked
              </span>
            )}
          </div>

          {/* Profile form */}
          <form onSubmit={handleSaveProfile} className="space-y-3.5">
            <p className={sectionLabelClass}>Profile</p>

            <div>
              <label htmlFor="settings-display-name" className="mb-1.5 block text-[11px] text-white/45">
                Display name <span className="text-white/25">(pseudonym)</span>
              </label>
              <input
                id="settings-display-name"
                type="text"
                value={displayName}
                onChange={(e) => setDisplayName(e.target.value)}
                className={fieldClass}
                maxLength={30}
                required
              />
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div>
                <label htmlFor="settings-gender" className="mb-1.5 block text-[11px] text-white/45">
                  Gender
                </label>
                <select
                  id="settings-gender"
                  value={gender}
                  onChange={(e) => setGender(e.target.value as any)}
                  className={`${fieldClass} appearance-none`}
                >
                  <option value="unspecified">Unspecified</option>
                  <option value="male">Male</option>
                  <option value="female">Female</option>
                  <option value="non-binary">Non-binary</option>
                </select>
              </div>

              <div>
                <label htmlFor="settings-country" className="mb-1.5 block text-[11px] text-white/45">
                  Country
                </label>
                <select
                  id="settings-country"
                  value={country}
                  onChange={(e) => setCountry(e.target.value)}
                  className={`${fieldClass} appearance-none`}
                >
                  <option value="GLOBAL">Global</option>
                  <option value="IN">India</option>
                  <option value="US">United States</option>
                  <option value="GB">United Kingdom</option>
                  <option value="CA">Canada</option>
                  <option value="AU">Australia</option>
                  <option value="DE">Germany</option>
                </select>
              </div>
            </div>

            {error && (
              <div className="rounded-xl border border-rose-400/25 bg-rose-500/10 px-3 py-2 text-[11px] text-rose-200">
                {error}
              </div>
            )}

            <div className="flex items-center justify-between gap-3 pt-0.5">
              <span className="truncate font-mono text-[10px] text-white/25">
                ID {user.id.slice(0, 14)}…
              </span>
              <button
                type="submit"
                disabled={isSaving}
                className={`inline-flex items-center gap-1.5 rounded-full px-4 py-2 text-[11px] font-bold transition-all active:scale-95 disabled:opacity-60 ${
                  saveSuccess
                    ? 'border border-emerald-400/30 bg-emerald-500/15 text-emerald-200'
                    : 'btn-primary'
                }`}
              >
                {saveSuccess && <CheckmarkCircle01Icon className="h-3.5 w-3.5" />}
                <span>{saveSuccess ? 'Saved' : isSaving ? 'Saving…' : 'Save changes'}</span>
              </button>
            </div>
          </form>

          {/* Blocked users */}
          <div className="space-y-2.5">
            <p className={sectionLabelClass}>Blocked users · {blockedUsers.length}</p>

            {blockedUsers.length === 0 ? (
              <p className="rounded-2xl border border-white/[0.06] bg-white/[0.02] px-3.5 py-3 text-[11px] text-white/35">
                Nobody blocked. Anyone you block during a call lands here.
              </p>
            ) : (
              <div className="max-h-36 space-y-1.5 overflow-y-auto pr-1">
                {blockedUsers.map((id) => (
                  <div
                    key={id}
                    className="flex items-center justify-between gap-3 rounded-xl border border-white/[0.06] bg-white/[0.03] px-3 py-2 text-[11px]"
                  >
                    <span className="truncate font-mono text-white/40">User {id.slice(0, 16)}…</span>
                    <button
                      onClick={() => handleUnblock(id)}
                      disabled={unblockingId === id}
                      className="shrink-0 font-semibold text-violet-300 transition-colors hover:text-violet-200 disabled:opacity-50"
                    >
                      {unblockingId === id ? 'Unblocking…' : 'Unblock'}
                    </button>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Account controls */}
          <div className="flex items-center justify-between gap-3 border-t border-white/[0.07] pt-4 text-[11px]">
            <div className="flex items-center gap-2">
              <span className="text-white/30">Role</span>
              <span className="rounded-full border border-white/10 bg-white/[0.05] px-2.5 py-0.5 font-mono text-[10px] uppercase tracking-wide text-white/55">
                {user.role}
              </span>
            </div>

            <button
              onClick={handleDeleteAccountData}
              className="inline-flex items-center gap-1.5 text-white/30 transition-colors hover:text-rose-300"
            >
              <Delete02Icon className="h-3.5 w-3.5" />
              <span>Reset identity</span>
            </button>
          </div>
        </div>
    </ModalShell>
  );
};
