import React, { useEffect, useState } from 'react';
import {
  UserCircleIcon,
  SparklesIcon,
  Cancel01Icon,
  CheckmarkCircle01Icon,
  Delete02Icon,
  Settings02Icon,
} from 'hugeicons-react';
import { UserProfile, Subscription } from '../types';
import { api } from '../services/api';

interface AccountSettingsModalProps {
  isOpen: boolean;
  onClose: () => void;
  user: UserProfile;
  isPro: boolean;
  subscription: Subscription | null;
  onProfileUpdated: (updatedUser: UserProfile, isPro: boolean, sub: Subscription | null) => void;
  onOpenUpgradeModal: () => void;
  onOpenGoogleModal: () => void;
}

export const AccountSettingsModal: React.FC<AccountSettingsModalProps> = ({
  isOpen,
  onClose,
  user,
  isPro,
  subscription,
  onProfileUpdated,
  onOpenUpgradeModal,
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
      onProfileUpdated(res.user, res.isPro, res.subscription);
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

  const handleSwitchToAdmin = async () => {
    try {
      const res = await api.login({ role: 'admin' });
      onProfileUpdated(res.user, res.isPro, res.subscription);
      onClose();
    } catch (err: any) {
      alert(err.message || 'Failed to switch role');
    }
  };

  const handleSwitchToUser = async () => {
    try {
      const res = await api.login({ role: 'user' });
      onProfileUpdated(res.user, res.isPro, res.subscription);
      onClose();
    } catch (err: any) {
      alert(err.message || 'Failed to switch role');
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
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm animate-in fade-in duration-200">
      <div className="w-full max-w-lg rounded-3xl border border-neutral-800 bg-[#161618] p-6 shadow-2xl space-y-6 max-h-[90vh] overflow-y-auto">
        <div className="flex items-center justify-between pb-3 border-b border-neutral-800">
          <div className="flex items-center gap-2.5">
            <Settings02Icon className="w-5 h-5 text-[#FF385C]" />
            <h2 className="text-base font-bold text-white">Account & Preferences</h2>
          </div>
          <button onClick={onClose} className="p-1 rounded-full text-neutral-400 hover:text-white">
            <Cancel01Icon className="w-4 h-4" />
          </button>
        </div>

        {/* Google Account Authentication Status */}
        <div className="p-4 rounded-2xl bg-neutral-900 border border-neutral-800 space-y-2">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2.5">
              <svg className="w-4 h-4 shrink-0" viewBox="0 0 24 24">
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
              <div>
                <p className="text-xs font-bold text-white">
                  {isGoogleUser ? 'Google Account Connected' : 'Guest Identity (Unlinked)'}
                </p>
                <p className="text-[11px] text-neutral-400">
                  {isGoogleUser ? user.email : 'Link your Google account to save preferences'}
                </p>
              </div>
            </div>

            {!isGoogleUser ? (
              <button
                onClick={() => {
                  onClose();
                  onOpenGoogleModal();
                }}
                className="px-3.5 py-1.5 rounded-full border border-neutral-700 bg-neutral-800 hover:bg-neutral-700 text-xs font-semibold text-white transition-colors"
              >
                Connect
              </button>
            ) : (
              <span className="text-[11px] font-semibold text-emerald-400 bg-emerald-950/40 border border-emerald-800/40 px-2.5 py-0.5 rounded-full">
                Connected
              </span>
            )}
          </div>
        </div>

        {/* Profile Details Form */}
        <form onSubmit={handleSaveProfile} className="space-y-4">
          <h3 className="text-xs font-bold text-neutral-400 uppercase tracking-wider">
            User Profile
          </h3>

          <div>
            <label className="block text-xs text-neutral-400 mb-1 font-medium">Display Name (Pseudonym)</label>
            <input
              type="text"
              value={displayName}
              onChange={(e) => setDisplayName(e.target.value)}
              className="w-full bg-neutral-950 border border-neutral-800 rounded-2xl px-3.5 py-2.5 text-xs text-white focus:outline-none focus:border-[#FF385C]"
              maxLength={30}
              required
            />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs text-neutral-400 mb-1 font-medium">Self-Selected Gender</label>
              <select
                value={gender}
                onChange={(e) => setGender(e.target.value as any)}
                className="w-full bg-neutral-950 border border-neutral-800 rounded-2xl px-3 py-2 text-xs text-white focus:outline-none focus:border-[#FF385C]"
              >
                <option value="unspecified">Unspecified</option>
                <option value="male">Male</option>
                <option value="female">Female</option>
                <option value="non-binary">Non-Binary</option>
              </select>
            </div>

            <div>
              <label className="block text-xs text-neutral-400 mb-1 font-medium">Country</label>
              <select
                value={country}
                onChange={(e) => setCountry(e.target.value)}
                className="w-full bg-neutral-950 border border-neutral-800 rounded-2xl px-3 py-2 text-xs text-white focus:outline-none focus:border-[#FF385C]"
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

          <div className="flex items-center justify-between pt-1">
            <span className="text-[11px] text-neutral-500 font-mono">
              ID: {user.id.slice(0, 14)}...
            </span>
            <button
              type="submit"
              disabled={isSaving}
              className="px-5 py-2 rounded-full bg-gradient-to-r from-[#FF385C] to-[#E00B41] hover:from-[#E00B41] hover:to-[#D70438] text-xs font-bold text-white transition-all shadow-md shadow-[#FF385C]/25 flex items-center gap-1.5 active:scale-95"
            >
              {saveSuccess ? <CheckmarkCircle01Icon className="w-3.5 h-3.5" /> : null}
              <span>Save Changes</span>
            </button>
          </div>
        </form>

        {/* Subscription Entitlement */}
        <div className="pt-4 border-t border-neutral-800 space-y-3">
          <h3 className="text-xs font-bold text-neutral-400 uppercase tracking-wider flex items-center justify-between">
            <span>Membership Plan</span>
            {isPro && <span className="text-[10px] text-[#FF385C] font-mono">₹299/mo</span>}
          </h3>

          <div className="p-4 rounded-2xl bg-[#0F0F11] border border-neutral-800 flex items-center justify-between">
            <div className="space-y-0.5">
              <p className="text-xs font-bold text-white flex items-center gap-1.5">
                <span>{isPro ? 'Pro Membership Active' : 'Free Standard Plan'}</span>
                {isPro && <SparklesIcon className="w-3.5 h-3.5 text-[#FF385C]" />}
              </p>
              <p className="text-[11px] text-neutral-400">
                {isPro
                  ? `Renews: ${new Date(subscription?.currentPeriodEnd || 0).toLocaleDateString()}`
                  : 'Pure random matching with no gender or country filters'}
              </p>
            </div>

            <button
              onClick={() => {
                onClose();
                onOpenUpgradeModal();
              }}
              className={`px-4 py-2 rounded-full text-xs font-bold transition-all shadow-sm ${
                isPro
                  ? 'bg-neutral-800 hover:bg-neutral-700 text-neutral-300'
                  : 'bg-gradient-to-r from-[#FF385C] to-[#E00B41] text-white hover:opacity-95'
              }`}
            >
              {isPro ? 'Manage' : 'Upgrade (₹299)'}
            </button>
          </div>
        </div>

        {/* Blocked Users */}
        <div className="pt-4 border-t border-neutral-800 space-y-3">
          <h3 className="text-xs font-bold text-neutral-400 uppercase tracking-wider">
            Blocked Users ({blockedUsers.length})
          </h3>

          {blockedUsers.length === 0 ? (
            <p className="text-xs text-neutral-500">You have not blocked any users yet.</p>
          ) : (
            <div className="space-y-1.5 max-h-32 overflow-y-auto">
              {blockedUsers.map((id) => (
                <div
                  key={id}
                  className="p-2.5 rounded-2xl bg-neutral-950 border border-neutral-800 flex items-center justify-between text-xs"
                >
                  <span className="font-mono text-neutral-400 text-[11px]">
                    User {id.slice(0, 16)}...
                  </span>
                  <button
                    onClick={() => handleUnblock(id)}
                    disabled={unblockingId === id}
                    className="text-xs text-[#FF385C] hover:underline font-semibold"
                  >
                    {unblockingId === id ? 'Unblocking...' : 'Unblock'}
                  </button>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Role Switcher & Account Purge */}
        <div className="pt-4 border-t border-neutral-800 flex items-center justify-between text-xs">
          <div className="flex items-center gap-2">
            <span className="text-neutral-500">Demo Role:</span>
            {user.role === 'admin' ? (
              <button
                onClick={handleSwitchToUser}
                className="px-3 py-1 rounded-full bg-neutral-800 hover:bg-neutral-700 text-neutral-300"
              >
                Switch to User
              </button>
            ) : (
              <button
                onClick={handleSwitchToAdmin}
                className="px-3 py-1 rounded-full bg-neutral-800 hover:bg-neutral-700 text-amber-300"
              >
                Switch to Admin Demo
              </button>
            )}
          </div>

          <button
            onClick={handleDeleteAccountData}
            className="text-neutral-500 hover:text-rose-400 transition-colors flex items-center gap-1.5"
          >
            <Delete02Icon className="w-3.5 h-3.5" />
            <span>Reset Identity</span>
          </button>
        </div>
      </div>
    </div>
  );
};
