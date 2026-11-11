import React, { useEffect, useState } from 'react';
import {
  AlertCircleIcon,
  Search01Icon,
  UserCircleIcon,
  Cancel01Icon,
  Globe02Icon,
} from 'hugeicons-react';
import { api } from '../services/api';
import { UserReport, UserProfile } from '../types';

const CARD = 'rounded-3xl border border-white/[0.07] bg-white/[0.03]';
const INPUT =
  'w-full rounded-xl border border-white/10 bg-white/[0.04] px-3 py-2 text-xs text-white placeholder:text-white/25 transition-colors focus:border-violet-400/60 focus:outline-none focus-visible:ring-2 focus-visible:ring-violet-400/30';
const TH = 'p-3.5 text-[10px] font-bold uppercase tracking-[0.12em] text-white/35';

export const AdminDashboardView: React.FC = () => {
  const [activeTab, setActiveTab] = useState<'overview' | 'reports' | 'users' | 'health'>('overview');
  const [overview, setOverview] = useState<any>(null);
  const [reports, setReports] = useState<UserReport[]>([]);
  const [users, setUsers] = useState<UserProfile[]>([]);
  const [systemHealth, setSystemHealth] = useState<any>(null);

  const [isLoading, setIsLoading] = useState(true);
  const [filterStatus, setFilterStatus] = useState<string>('all');
  const [searchUser, setSearchUser] = useState('');

  const [selectedReport, setSelectedReport] = useState<UserReport | null>(null);
  const [actionNotes, setActionNotes] = useState('');
  const [actionDecision, setActionDecision] = useState<'none' | 'warned' | 'suspended' | 'banned'>('none');
  const [actionStatus, setActionStatus] = useState<UserReport['status']>('resolved');

  const loadData = async () => {
    setIsLoading(true);
    try {
      const [ov, rep, us, hl] = await Promise.all([
        api.getAdminOverview(),
        api.getAdminReports(),
        api.getAdminUsers(),
        api.getSystemHealth(),
      ]);
      setOverview(ov);
      setReports(rep.reports || []);
      setUsers(us.users || []);
      setSystemHealth(hl);
    } catch (err) {
      console.error('Failed to load admin data:', err);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, []);

  const handleUpdateReportAction = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedReport) return;
    try {
      await api.updateReportAction(selectedReport.id, {
        status: actionStatus,
        actionTaken: actionDecision,
        notes: actionNotes,
      });
      setSelectedReport(null);
      setActionNotes('');
      loadData();
    } catch (err: any) {
      alert(err.message || 'Failed to update report action');
    }
  };

  const handleToggleUserStatus = async (
    userId: string,
    newStatus: 'active' | 'suspended' | 'banned'
  ) => {
    try {
      await api.updateUserStatus(userId, newStatus);
      loadData();
    } catch (err: any) {
      alert(err.message || 'Failed to update user status');
    }
  };

  const filteredReports = reports.filter((r) => {
    if (filterStatus === 'all') return true;
    return r.status === filterStatus;
  });

  const filteredUsers = users.filter((u) => {
    if (!searchUser) return true;
    return (
      u.displayName.toLowerCase().includes(searchUser.toLowerCase()) ||
      u.id.toLowerCase().includes(searchUser.toLowerCase())
    );
  });

  const tabs = [
    { key: 'overview' as const, label: 'Overview', icon: null },
    { key: 'reports' as const, label: 'Safety reports', icon: <AlertCircleIcon className="h-3.5 w-3.5 text-rose-300" /> },
    { key: 'users' as const, label: 'Accounts', icon: <UserCircleIcon className="h-3.5 w-3.5 text-violet-300" /> },
    { key: 'health' as const, label: 'WebRTC & health', icon: <Globe02Icon className="h-3.5 w-3.5 text-emerald-300" /> },
  ];

  return (
    <div className="mx-auto max-w-7xl space-y-7 px-4 py-8 text-white/70 sm:px-6">
      {/* Top Bar */}
      <div className="flex flex-col justify-between gap-4 border-b border-white/[0.07] pb-5 sm:flex-row sm:items-center">
        <div>
          <div className="flex items-center gap-2.5">
            <span className="h-2 w-2 rounded-full bg-gradient-to-r from-violet-400 to-cyan-300 shadow-[0_0_10px_rgba(139,92,246,0.9)]" />
            <h1 className="font-display text-2xl font-bold tracking-tight text-white">
              Staff console
            </h1>
            <span className="rounded-full border border-white/10 bg-white/[0.05] px-2 py-0.5 text-[9px] font-extrabold uppercase tracking-[0.14em] text-white/40">
              Internal
            </span>
          </div>
          <p className="mt-1.5 text-xs text-white/35">
            Moderation, safety reviews and WebRTC diagnostics
          </p>
        </div>

        <button
          onClick={loadData}
          disabled={isLoading}
          className="flex items-center gap-2 self-start rounded-full border border-white/10 bg-white/[0.04] px-4 py-2 text-[11px] font-semibold text-white/60 transition-colors hover:border-white/25 hover:bg-white/[0.08] hover:text-white disabled:opacity-60 sm:self-auto"
        >
          <span className={`h-1.5 w-1.5 rounded-full ${isLoading ? 'animate-pulse bg-amber-300' : 'bg-emerald-400'}`} />
          <span>{isLoading ? 'Refreshing…' : 'Refresh metrics'}</span>
        </button>
      </div>

      {/* Tabs */}
      <div className="flex flex-wrap items-center gap-1 rounded-full border border-white/10 bg-white/[0.04] p-1 text-xs sm:inline-flex">
        {tabs.map((tab) => {
          const isActive = activeTab === tab.key;
          return (
            <button
              key={tab.key}
              onClick={() => setActiveTab(tab.key)}
              className={`flex items-center gap-1.5 rounded-full px-3.5 py-2 font-semibold transition-all ${
                isActive
                  ? 'bg-white/[0.10] text-white shadow-[inset_0_1px_0_rgba(255,255,255,0.12),0_6px_18px_-10px_rgba(0,0,0,0.9)]'
                  : 'text-white/40 hover:text-white/80'
              }`}
            >
              {tab.icon}
              <span>{tab.label}</span>
              {tab.key === 'reports' && overview?.pendingReportsCount > 0 && (
                <span className="grid h-4 min-w-4 place-items-center rounded-full bg-rose-500 px-1 text-[9px] font-extrabold text-white">
                  {overview.pendingReportsCount}
                </span>
              )}
            </button>
          );
        })}
      </div>

      {/* Overview Tab */}
      {activeTab === 'overview' && overview && (
        <div className="space-y-6">
          <div className="grid grid-cols-2 gap-3 md:grid-cols-4 md:gap-4">
            <div className={`${CARD} p-5`}>
              <p className="text-[10px] font-bold uppercase tracking-[0.12em] text-white/35">Total users</p>
              <p className="mt-1.5 font-display text-2xl font-extrabold tabular-nums text-white">
                {overview.totalUsers}
              </p>
            </div>
            <div className={`${CARD} p-5`}>
              <p className="text-[10px] font-bold uppercase tracking-[0.12em] text-white/35">Active queue</p>
              <p className="mt-1.5 font-display text-2xl font-extrabold tabular-nums text-violet-300">
                {overview.activeQueueLength}
              </p>
            </div>
            <div className={`${CARD} p-5`}>
              <p className="text-[10px] font-bold uppercase tracking-[0.12em] text-white/35">Active matches</p>
              <p className="mt-1.5 font-display text-2xl font-extrabold tabular-nums text-emerald-300">
                {overview.activeMatchesCount}
              </p>
            </div>
            <div className={`${CARD} p-5`}>
              <p className="text-[10px] font-bold uppercase tracking-[0.12em] text-white/35">Pending reports</p>
              <p className="mt-1.5 font-display text-2xl font-extrabold tabular-nums text-rose-300">
                {overview.pendingReportsCount}
              </p>
            </div>
          </div>

          <div className="grid grid-cols-1 gap-4 md:grid-cols-2 md:gap-6">
            <div className={`${CARD} space-y-4 p-6`}>
              <h3 className="flex items-center gap-2 text-sm font-bold text-white">
                <AlertCircleIcon className="h-4 w-4 text-rose-300" />
                Safety review queue
              </h3>
              <div className="space-y-1 text-xs">
                <div className="flex justify-between border-b border-white/[0.06] py-2">
                  <span className="text-white/40">Pending safety reports</span>
                  <span className="font-bold tabular-nums text-rose-300">
                    {overview.pendingReportsCount}
                  </span>
                </div>
                <div className="flex justify-between border-b border-white/[0.06] py-2">
                  <span className="text-white/40">Total reports received</span>
                  <span className="tabular-nums text-white/80">{overview.totalReportsCount}</span>
                </div>
                <div className="flex justify-between py-2">
                  <span className="text-white/40">Immediate peer blocking</span>
                  <span className="font-semibold text-emerald-300">Automatic on submit</span>
                </div>
              </div>
            </div>

            <div className={`${CARD} space-y-4 p-6`}>
              <h3 className="flex items-center gap-2 text-sm font-bold text-white">
                <Globe02Icon className="h-4 w-4 text-emerald-300" />
                WebRTC &amp; signaling
              </h3>
              <div className="space-y-1 text-xs">
                <div className="flex justify-between border-b border-white/[0.06] py-2">
                  <span className="text-white/40">Matchmaker health</span>
                  <span className="font-mono font-semibold uppercase text-emerald-300">
                    {systemHealth?.status ?? '—'}
                  </span>
                </div>
                <div className="flex justify-between border-b border-white/[0.06] py-2">
                  <span className="text-white/40">Process uptime</span>
                  <span className="font-mono text-white/80">
                    {systemHealth ? `${systemHealth.uptimeSeconds}s` : '—'}
                  </span>
                </div>
                <div className="flex justify-between py-2">
                  <span className="text-white/40">Video retention</span>
                  <span className="font-semibold text-emerald-300">None</span>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Reports Tab */}
      {activeTab === 'reports' && (
        <div className="space-y-4">
          <div className="flex items-center justify-between gap-4">
            <div className="flex items-center gap-2 text-[11px]">
              <span className="text-white/35">Status</span>
              <select
                value={filterStatus}
                onChange={(e) => setFilterStatus(e.target.value)}
                className="rounded-full border border-white/10 bg-white/[0.04] px-3 py-1.5 text-[11px] text-white/80 focus:border-violet-400/60 focus:outline-none"
              >
                <option value="all">All reports</option>
                <option value="pending">Pending review</option>
                <option value="resolved">Resolved</option>
                <option value="dismissed">Dismissed</option>
                <option value="escalated">Escalated</option>
              </select>
            </div>
            <span className="font-mono text-[11px] text-white/30">
              {filteredReports.length} reports
            </span>
          </div>

          {filteredReports.length === 0 ? (
            <div className={`${CARD} p-12 text-center text-xs text-white/35`}>
              No reports found for this filter.
            </div>
          ) : (
            <div className={`${CARD} overflow-x-auto text-xs`}>
              <table className="w-full min-w-[720px] text-left">
                <thead className="border-b border-white/[0.07] bg-white/[0.03]">
                  <tr>
                    <th className={TH}>Violation</th>
                    <th className={TH}>Reported user</th>
                    <th className={TH}>Reporter</th>
                    <th className={TH}>Status</th>
                    <th className={TH}>Action</th>
                    <th className={`${TH} text-right`}>Review</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-white/[0.05]">
                  {filteredReports.map((r) => (
                    <tr key={r.id} className="transition-colors hover:bg-white/[0.03]">
                      <td className="p-3.5">
                        <span className="font-semibold capitalize text-white/85">
                          {r.category.replace(/_/g, ' ')}
                        </span>
                        {r.description && (
                          <p className="mt-0.5 max-w-xs truncate text-[11px] text-white/30">
                            {r.description}
                          </p>
                        )}
                      </td>
                      <td className="p-3.5 font-mono text-white/55">
                        {r.reportedUserName} ({r.reportedUserId.slice(0, 8)}…)
                      </td>
                      <td className="p-3.5 text-white/40">{r.reporterName}</td>
                      <td className="p-3.5">
                        <span
                          className={`rounded-full px-2.5 py-0.5 text-[10px] font-semibold ${
                            r.status === 'pending'
                              ? 'border border-rose-400/25 bg-rose-500/15 text-rose-200'
                              : 'bg-white/[0.06] text-white/55'
                          }`}
                        >
                          {r.status}
                        </span>
                      </td>
                      <td className="p-3.5 capitalize text-white/40">{r.actionTaken || 'none'}</td>
                      <td className="p-3.5 text-right">
                        <button
                          onClick={() => {
                            setSelectedReport(r);
                            setActionStatus(r.status);
                            setActionDecision(r.actionTaken || 'none');
                            setActionNotes(r.moderatorNotes || '');
                          }}
                          className="rounded-full border border-white/10 bg-white/[0.05] px-3 py-1 font-semibold text-white/80 transition-colors hover:border-white/25 hover:bg-white/[0.09] hover:text-white"
                        >
                          Review
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}

      {/* Users Tab */}
      {activeTab === 'users' && (
        <div className="space-y-4">
          <div className="flex items-center justify-between gap-4">
            <div className="relative w-full max-w-xs">
              <Search01Icon className="pointer-events-none absolute left-3 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-white/30" />
              <input
                type="text"
                value={searchUser}
                onChange={(e) => setSearchUser(e.target.value)}
                placeholder="Search user ID or name…"
                className={`${INPUT} pl-9`}
              />
            </div>
            <span className="shrink-0 font-mono text-[11px] text-white/30">
              {filteredUsers.length} users
            </span>
          </div>

          <div className={`${CARD} overflow-x-auto text-xs`}>
            <table className="w-full min-w-[720px] text-left">
              <thead className="border-b border-white/[0.07] bg-white/[0.03]">
                <tr>
                  <th className={TH}>User</th>
                  <th className={TH}>18+ verified</th>
                  <th className={TH}>Status</th>
                  <th className={`${TH} text-right`}>Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-white/[0.05]">
                {filteredUsers.map((u) => (
                  <tr key={u.id} className="transition-colors hover:bg-white/[0.03]">
                    <td className="p-3.5">
                      <p className="font-semibold text-white/85">{u.displayName}</p>
                      <p className="mt-0.5 font-mono text-[11px] text-white/25">{u.email || u.id}</p>
                    </td>
                    <td className="p-3.5">
                      {u.isAdultVerified ? (
                        <span className="font-semibold text-emerald-300">Verified</span>
                      ) : (
                        <span className="text-white/30">Pending</span>
                      )}
                    </td>
                    <td className="p-3.5">
                      <span
                        className={`rounded-full px-2.5 py-0.5 text-[10px] font-semibold ${
                          u.status === 'active'
                            ? 'bg-emerald-500/12 text-emerald-300'
                            : u.status === 'suspended'
                              ? 'bg-amber-500/15 text-amber-200'
                              : 'bg-rose-500/15 text-rose-200'
                        }`}
                      >
                        {u.status}
                      </span>
                    </td>
                    <td className="space-x-1.5 p-3.5 text-right">
                      {u.status === 'active' ? (
                        <>
                          <button
                            onClick={() => handleToggleUserStatus(u.id, 'suspended')}
                            className="rounded-full border border-amber-400/25 bg-amber-500/10 px-3 py-1 text-[11px] font-semibold text-amber-200 transition-colors hover:bg-amber-500/20"
                          >
                            Suspend
                          </button>
                          <button
                            onClick={() => handleToggleUserStatus(u.id, 'banned')}
                            className="rounded-full border border-rose-400/25 bg-rose-500/10 px-3 py-1 text-[11px] font-semibold text-rose-200 transition-colors hover:bg-rose-500/20"
                          >
                            Ban
                          </button>
                        </>
                      ) : (
                        <button
                          onClick={() => handleToggleUserStatus(u.id, 'active')}
                          className="rounded-full border border-emerald-400/25 bg-emerald-500/10 px-3 py-1 text-[11px] font-semibold text-emerald-200 transition-colors hover:bg-emerald-500/20"
                        >
                          Reactivate
                        </button>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Health Tab */}
      {activeTab === 'health' && systemHealth && (
        <div className="grid grid-cols-1 gap-4 md:grid-cols-3 md:gap-6">
          <div className={`${CARD} space-y-3 p-6 text-xs`}>
            <h3 className="text-sm font-bold text-white">WebSocket signaling</h3>
            <div className="space-y-1">
              <div className="flex justify-between border-b border-white/[0.06] py-1.5">
                <span className="text-white/35">Endpoint</span>
                <span className="font-mono text-white/75">/ws · 3000</span>
              </div>
              <div className="flex justify-between border-b border-white/[0.06] py-1.5">
                <span className="text-white/35">Heartbeat</span>
                <span className="font-mono text-white/75">30s ping/pong</span>
              </div>
              <div className="flex justify-between py-1.5">
                <span className="text-white/35">Queue state</span>
                <span className="font-semibold text-emerald-300">Ephemeral</span>
              </div>
            </div>
          </div>

          <div className={`${CARD} space-y-3 p-6 text-xs`}>
            <h3 className="text-sm font-bold text-white">TURN / STUN relays</h3>
            <div className="space-y-1">
              <div className="flex justify-between border-b border-white/[0.06] py-1.5">
                <span className="text-white/35">Google STUN pool</span>
                <span className="font-semibold text-emerald-300">3 endpoints</span>
              </div>
              <div className="flex justify-between border-b border-white/[0.06] py-1.5">
                <span className="text-white/35">TURN fallback</span>
                <span className="font-mono text-white/60">
                  {systemHealth.turnConfigured ? 'Configured' : 'Env ready'}
                </span>
              </div>
              <div className="flex justify-between py-1.5">
                <span className="text-white/35">Video path</span>
                <span className="font-semibold text-emerald-300">100% P2P</span>
              </div>
            </div>
          </div>

          <div className={`${CARD} space-y-3 p-6 text-xs`}>
            <h3 className="text-sm font-bold text-white">Operational uptime</h3>
            <div className="space-y-1">
              <div className="flex justify-between border-b border-white/[0.06] py-1.5">
                <span className="text-white/35">Process uptime</span>
                <span className="font-mono text-white/75">{systemHealth.uptimeSeconds}s</span>
              </div>
              <div className="flex justify-between border-b border-white/[0.06] py-1.5">
                <span className="text-white/35">Health</span>
                <span className="font-mono font-semibold uppercase text-emerald-300">
                  {systemHealth.status}
                </span>
              </div>
              <div className="flex justify-between py-1.5">
                <span className="text-white/35">Video retention</span>
                <span className="font-semibold text-emerald-300">None</span>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Review Modal */}
      {selectedReport && (
        <div
          className="fixed inset-0 z-[80] flex items-end justify-center bg-black/75 p-0 backdrop-blur-xl animate-in fade-in duration-200 sm:items-center sm:p-4"
          role="dialog"
          aria-modal="true"
          aria-label="Moderation review"
        >
          <div className="animate-in flex max-h-[92dvh] w-full max-w-md flex-col overflow-hidden rounded-t-[28px] border border-white/10 bg-[#0b0914]/95 text-white shadow-[0_40px_120px_-40px_rgba(0,0,0,0.95)] backdrop-blur-2xl sm:rounded-[28px]">
            <div className="flex items-center justify-between border-b border-white/[0.07] px-5 py-4">
              <h2 className="font-display text-base font-bold">Moderation review</h2>
              <button
                onClick={() => setSelectedReport(null)}
                className="grid h-8 w-8 place-items-center rounded-full text-white/45 transition-colors hover:bg-white/[0.08] hover:text-white"
                aria-label="Close review"
              >
                <Cancel01Icon className="h-4 w-4" />
              </button>
            </div>

            <form
              onSubmit={handleUpdateReportAction}
              className="min-h-0 flex-1 space-y-3.5 overflow-y-auto overscroll-contain px-5 py-4 text-xs"
            >
              <div className="space-y-1.5 rounded-2xl border border-white/[0.07] bg-white/[0.03] p-4">
                <p className="text-white/40">
                  Category:{' '}
                  <strong className="capitalize text-white/85">
                    {selectedReport.category.replace(/_/g, ' ')}
                  </strong>
                </p>
                <p className="text-white/40">
                  Reported user:{' '}
                  <span className="font-mono text-violet-300">
                    {selectedReport.reportedUserName} ({selectedReport.reportedUserId})
                  </span>
                </p>
                <p className="text-white/40">
                  Reporter: <span className="text-white/75">{selectedReport.reporterName}</span>
                </p>
                {selectedReport.description && (
                  <p className="border-t border-white/[0.06] pt-2 leading-relaxed text-white/55">
                    “{selectedReport.description}”
                  </p>
                )}
              </div>

              <div>
                <label htmlFor="mod-action" className="mb-1.5 block text-[10px] font-bold uppercase tracking-[0.12em] text-white/35">
                  Moderator action
                </label>
                <select
                  id="mod-action"
                  value={actionDecision}
                  onChange={(e) => setActionDecision(e.target.value as any)}
                  className={INPUT}
                >
                  <option value="none">No action — dismiss report</option>
                  <option value="warned">Issue warning</option>
                  <option value="suspended">Suspend account</option>
                  <option value="banned">Permanently ban</option>
                </select>
              </div>

              <div>
                <label htmlFor="mod-status" className="mb-1.5 block text-[10px] font-bold uppercase tracking-[0.12em] text-white/35">
                  Report status
                </label>
                <select
                  id="mod-status"
                  value={actionStatus}
                  onChange={(e) => setActionStatus(e.target.value as any)}
                  className={INPUT}
                >
                  <option value="resolved">Resolved</option>
                  <option value="dismissed">Dismissed</option>
                  <option value="escalated">Escalated to legal</option>
                  <option value="reviewed">In review</option>
                </select>
              </div>

              <div>
                <label htmlFor="mod-notes" className="mb-1.5 block text-[10px] font-bold uppercase tracking-[0.12em] text-white/35">
                  Moderator notes
                </label>
                <textarea
                  id="mod-notes"
                  value={actionNotes}
                  onChange={(e) => setActionNotes(e.target.value)}
                  placeholder="Record the justification…"
                  rows={2}
                  className={`${INPUT} resize-none`}
                />
              </div>

              <div className="flex items-center justify-end gap-2 border-t border-white/[0.07] pt-4">
                <button
                  type="button"
                  onClick={() => setSelectedReport(null)}
                  className="rounded-full px-4 py-2 text-[11px] font-semibold text-white/45 transition-colors hover:bg-white/[0.07] hover:text-white"
                >
                  Cancel
                </button>
                <button type="submit" className="btn-primary px-5 py-2 text-[11px]">
                  Save decision
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
