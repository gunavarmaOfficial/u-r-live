import React, { useState } from 'react';
import { Link } from 'react-router-dom';
import { AlertCircleIcon, Shield02Icon } from 'hugeicons-react';
import { AdminDashboardView } from '../components/AdminDashboardView';
import { Seo } from '../components/Seo';
import { useApp } from '../context/AppContext';
import { api } from '../services/api';

export const AdminPage: React.FC = () => {
  const { user, loadSession } = useApp();
  const [adminKey, setAdminKey] = useState('');
  const [error, setError] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);

  if (user?.role === 'admin') {
    return (
      <>
        <Seo path="/admin" />
        <AdminDashboardView />
      </>
    );
  }

  const handleSubmit = async (event: React.FormEvent) => {
    event.preventDefault();
    if (!adminKey.trim()) {
      setError('Enter your staff access key.');
      return;
    }
    setIsSubmitting(true);
    setError('');
    try {
      await api.adminLogin(adminKey.trim());
      await loadSession();
      setAdminKey('');
    } catch (err: any) {
      setError(err.message || 'Authentication failed.');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <>
      <Seo path="/admin" />
      <div className="flex flex-1 items-center justify-center px-4 py-16">
        <div className="w-full max-w-md rounded-3xl border border-white/[0.08] bg-white/[0.03] p-7">
          <span className="grid h-10 w-10 place-items-center rounded-xl border border-violet-400/25 bg-violet-500/12 text-violet-300">
            <Shield02Icon className="h-5 w-5" />
          </span>
          <h1 className="mt-4 font-display text-2xl font-extrabold tracking-tight text-white">Staff portal</h1>
          <p className="mt-2 text-xs leading-relaxed text-neutral-400">
            Restricted access for the safety and moderation team. Admin sessions are checked
            server-side on every request.
          </p>

          <form onSubmit={handleSubmit} className="mt-6 space-y-3">
            <div>
              <label htmlFor="admin-key" className="mb-1.5 block text-[10px] font-bold uppercase tracking-[0.14em] text-neutral-500">
                Staff access key
              </label>
              <input
                id="admin-key"
                type="password"
                autoComplete="current-password"
                value={adminKey}
                onChange={(event) => setAdminKey(event.target.value)}
                className="w-full rounded-xl border border-white/10 bg-white/[0.04] px-3 py-2.5 text-sm text-white placeholder:text-neutral-600 focus:border-violet-400/60 focus:outline-none focus-visible:ring-2 focus-visible:ring-violet-400/30"
                placeholder="••••••••••••"
              />
            </div>

            {error && (
              <div className="flex items-start gap-2 rounded-xl border border-rose-400/25 bg-rose-500/10 p-3 text-xs text-rose-200" role="alert">
                <AlertCircleIcon className="mt-px h-4 w-4 shrink-0" />
                <span>{error}</span>
              </div>
            )}

            <button type="submit" disabled={isSubmitting} className="btn-primary h-11 w-full text-xs font-bold">
              {isSubmitting ? 'Verifying…' : 'Sign in to staff portal'}
            </button>
          </form>

          <p className="mt-5 text-center text-[11px] text-neutral-500">
            <Link to="/" className="underline decoration-white/20 underline-offset-2 hover:text-white">
              Return to U-R-LIVE
            </Link>
          </p>
        </div>
      </div>
    </>
  );
};
