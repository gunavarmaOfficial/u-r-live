import React, { useEffect, useState } from 'react';
import {
  WebProtectionIcon,
  AlertCircleIcon,
  Search01Icon,
  UserCircleIcon,
  SparklesIcon,
  CheckmarkCircle01Icon,
  Cancel01Icon,
  Settings02Icon,
  Globe02Icon,
} from 'hugeicons-react';
import { api } from '../services/api';
import { UserReport, UserProfile } from '../types';

export const AdminDashboardView: React.FC = () => {
  const [activeTab, setActiveTab] = useState<'overview' | 'reports' | 'users' | 'health'>('overview');
  const [overview, setOverview] = useState<any>(null);
  const [reports, setReports] = useState<UserReport[]>([]);
  const [users, setUsers] = useState<(UserProfile & { isPro: boolean })[]>([]);
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

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 py-8 space-y-8 text-neutral-300">
      {/* Top Bar */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-neutral-800 pb-5">
        <div>
          <div className="flex items-center gap-2">
            <span className="w-2.5 h-2.5 rounded-full bg-[#FF385C]" />
            <h1 className="text-2xl font-bold text-white tracking-tight">U-R-LIVE Staff Console</h1>
          </div>
          <p className="text-xs text-neutral-400 mt-1">
            Server-side moderation, safety reviews, and WebRTC diagnostics
          </p>
        </div>

        <button
          onClick={loadData}
          disabled={isLoading}
          className="px-4 py-2 rounded-full border border-neutral-800 bg-neutral-900 hover:bg-neutral-800 text-xs font-semibold text-neutral-300 hover:text-white transition-colors flex items-center gap-2 self-start sm:self-auto"
        >
          <span>{isLoading ? 'Refreshing...' : 'Refresh Metrics'}</span>
        </button>
      </div>

      {/* Tabs */}
      <div className="flex items-center gap-2 border-b border-neutral-800 pb-2 text-xs">
        <button
          onClick={() => setActiveTab('overview')}
          className={`px-4 py-2 rounded-full font-semibold transition-colors ${
            activeTab === 'overview'
              ? 'bg-neutral-800 text-white shadow-sm'
              : 'text-neutral-400 hover:text-white'
          }`}
        >
          Overview
        </button>
        <button
          onClick={() => setActiveTab('reports')}
          className={`px-4 py-2 rounded-full font-semibold transition-colors flex items-center gap-1.5 ${
            activeTab === 'reports'
              ? 'bg-neutral-800 text-white shadow-sm'
              : 'text-neutral-400 hover:text-white'
          }`}
        >
          <AlertCircleIcon className="w-3.5 h-3.5 text-rose-400" />
          <span>Safety Reports</span>
          {overview?.pendingReportsCount > 0 && (
            <span className="px-2 py-0.5 bg-rose-500/20 text-rose-300 text-[10px] rounded-full font-mono">
              {overview.pendingReportsCount}
            </span>
          )}
        </button>
        <button
          onClick={() => setActiveTab('users')}
          className={`px-4 py-2 rounded-full font-semibold transition-colors flex items-center gap-1.5 ${
            activeTab === 'users' ? 'bg-neutral-800 text-white shadow-sm' : 'text-neutral-400 hover:text-white'
          }`}
        >
          <UserCircleIcon className="w-3.5 h-3.5 text-[#FF385C]" />
          <span>User Accounts</span>
        </button>
        <button
          onClick={() => setActiveTab('health')}
          className={`px-4 py-2 rounded-full font-semibold transition-colors flex items-center gap-1.5 ${
            activeTab === 'health' ? 'bg-neutral-800 text-white shadow-sm' : 'text-neutral-400 hover:text-white'
          }`}
        >
          <Globe02Icon className="w-3.5 h-3.5 text-emerald-400" />
          <span>WebRTC & Health</span>
        </button>
      </div>

      {/* Overview Tab */}
      {activeTab === 'overview' && overview && (
        <div className="space-y-6">
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            <div className="p-5 rounded-3xl bg-[#161618] border border-neutral-800">
              <p className="text-xs text-neutral-400 font-medium">Total Users</p>
              <p className="text-2xl font-extrabold font-mono text-white mt-1 tabular-nums">
                {overview.totalUsers}
              </p>
            </div>
            <div className="p-5 rounded-3xl bg-[#161618] border border-neutral-800">
              <p className="text-xs text-neutral-400 font-medium">Active Queue</p>
              <p className="text-2xl font-extrabold font-mono text-[#FF385C] mt-1 tabular-nums">
                {overview.activeQueueLength}
              </p>
            </div>
            <div className="p-5 rounded-3xl bg-[#161618] border border-neutral-800">
              <p className="text-xs text-neutral-400 font-medium">Active Matches</p>
              <p className="text-2xl font-extrabold font-mono text-emerald-400 mt-1 tabular-nums">
                {overview.activeMatchesCount}
              </p>
            </div>
            <div className="p-5 rounded-3xl bg-[#161618] border border-neutral-800">
              <p className="text-xs text-neutral-400 font-medium">Pro Subscribers</p>
              <p className="text-2xl font-extrabold font-mono text-amber-400 mt-1 tabular-nums">
                {overview.proSubscribers}{' '}
                <span className="text-xs font-normal text-neutral-400">
                  (₹{overview.monthlyRevenueInr}/mo)
                </span>
              </p>
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div className="p-6 rounded-3xl bg-[#161618] border border-neutral-800 space-y-4">
              <h3 className="text-sm font-bold text-white flex items-center gap-2">
                <AlertCircleIcon className="w-4 h-4 text-rose-400" />
                <span>Safety Review Queue</span>
              </h3>
              <div className="space-y-2 text-xs">
                <div className="flex justify-between py-1.5 border-b border-neutral-800">
                  <span className="text-neutral-400">Pending Safety Reports</span>
                  <span className="font-mono font-bold text-rose-400">
                    {overview.pendingReportsCount}
                  </span>
                </div>
                <div className="flex justify-between py-1.5 border-b border-neutral-800">
                  <span className="text-neutral-400">Total Reports Received</span>
                  <span className="font-mono text-white">{overview.totalReportsCount}</span>
                </div>
                <div className="flex justify-between py-1.5">
                  <span className="text-neutral-400">Immediate Peer Blocking</span>
                  <span className="text-emerald-400 font-semibold">Automatic on Submit</span>
                </div>
              </div>
            </div>

            <div className="p-6 rounded-3xl bg-[#161618] border border-neutral-800 space-y-4">
              <h3 className="text-sm font-bold text-white flex items-center gap-2">
                <SparklesIcon className="w-4 h-4 text-[#FF385C]" />
                <span>Cashfree Subscriptions (₹299/mo)</span>
              </h3>
              <div className="space-y-2 text-xs">
                <div className="flex justify-between py-1.5 border-b border-neutral-800">
                  <span className="text-neutral-400">Plan Code</span>
                  <span className="font-mono text-white">pro_monthly_299</span>
                </div>
                <div className="flex justify-between py-1.5 border-b border-neutral-800">
                  <span className="text-neutral-400">Server Signature Verification</span>
                  <span className="text-emerald-400 font-semibold">HMAC-SHA256 Enforced</span>
                </div>
                <div className="flex justify-between py-1.5">
                  <span className="text-neutral-400">Webhook Idempotency</span>
                  <span className="text-emerald-400 font-semibold">Active (Zero Duplicates)</span>
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
            <div className="flex items-center gap-2 text-xs">
              <span className="text-neutral-400 font-medium">Status Filter:</span>
              <select
                value={filterStatus}
                onChange={(e) => setFilterStatus(e.target.value)}
                className="bg-neutral-900 border border-neutral-800 rounded-full px-3 py-1.5 text-xs text-white"
              >
                <option value="all">All Reports</option>
                <option value="pending">Pending Review</option>
                <option value="resolved">Resolved</option>
                <option value="dismissed">Dismissed</option>
                <option value="escalated">Escalated</option>
              </select>
            </div>
            <span className="text-xs text-neutral-500 font-mono">
              {filteredReports.length} reports
            </span>
          </div>

          {filteredReports.length === 0 ? (
            <div className="p-12 text-center border border-neutral-800 rounded-3xl bg-[#161618] text-xs text-neutral-400">
              No reports found for this filter.
            </div>
          ) : (
            <div className="border border-neutral-800 rounded-3xl overflow-hidden bg-[#161618] text-xs">
              <table className="w-full text-left">
                <thead className="bg-neutral-900/80 border-b border-neutral-800 text-neutral-400">
                  <tr>
                    <th className="p-3.5 font-semibold">Violation Category</th>
                    <th className="p-3.5 font-semibold">Reported User</th>
                    <th className="p-3.5 font-semibold">Reporter</th>
                    <th className="p-3.5 font-semibold">Status</th>
                    <th className="p-3.5 font-semibold">Action Taken</th>
                    <th className="p-3.5 font-semibold text-right">Review</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-neutral-800/60">
                  {filteredReports.map((r) => (
                    <tr key={r.id} className="hover:bg-neutral-900/40">
                      <td className="p-3.5">
                        <span className="font-bold text-white capitalize">
                          {r.category.replace(/_/g, ' ')}
                        </span>
                        {r.description && (
                          <p className="text-[11px] text-neutral-500 truncate max-w-xs">
                            {r.description}
                          </p>
                        )}
                      </td>
                      <td className="p-3.5 font-mono text-neutral-300">
                        {r.reportedUserName} ({r.reportedUserId.slice(0, 8)}...)
                      </td>
                      <td className="p-3.5 text-neutral-400">{r.reporterName}</td>
                      <td className="p-3.5">
                        <span
                          className={`px-2.5 py-0.5 rounded-full text-[10px] font-mono ${
                            r.status === 'pending'
                              ? 'bg-rose-500/20 text-rose-300 border border-rose-800/40'
                              : 'bg-neutral-800 text-neutral-300'
                          }`}
                        >
                          {r.status}
                        </span>
                      </td>
                      <td className="p-3.5 font-mono text-neutral-400 capitalize">
                        {r.actionTaken || 'none'}
                      </td>
                      <td className="p-3.5 text-right">
                        <button
                          onClick={() => {
                            setSelectedReport(r);
                            setActionStatus(r.status);
                            setActionDecision(r.actionTaken || 'none');
                            setActionNotes(r.moderatorNotes || '');
                          }}
                          className="px-3 py-1 bg-neutral-800 hover:bg-neutral-700 text-white rounded-full font-semibold transition-colors"
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
            <div className="relative w-72">
              <Search01Icon className="w-3.5 h-3.5 text-neutral-500 absolute left-3.5 top-3" />
              <input
                type="text"
                value={searchUser}
                onChange={(e) => setSearchUser(e.target.value)}
                placeholder="Search user ID or display name..."
                className="w-full bg-neutral-900 border border-neutral-800 rounded-full pl-9 pr-4 py-2 text-xs text-white placeholder-neutral-500 focus:outline-none focus:border-[#FF385C]"
              />
            </div>
            <span className="text-xs text-neutral-500 font-mono">{filteredUsers.length} users</span>
          </div>

          <div className="border border-neutral-800 rounded-3xl overflow-hidden bg-[#161618] text-xs">
            <table className="w-full text-left">
              <thead className="bg-neutral-900/80 border-b border-neutral-800 text-neutral-400">
                <tr>
                  <th className="p-3.5 font-semibold">User</th>
                  <th className="p-3.5 font-semibold">Plan</th>
                  <th className="p-3.5 font-semibold">18+ Verified</th>
                  <th className="p-3.5 font-semibold">Status</th>
                  <th className="p-3.5 font-semibold text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-neutral-800/60">
                {filteredUsers.map((u) => (
                  <tr key={u.id} className="hover:bg-neutral-900/40">
                    <td className="p-3.5">
                      <p className="font-bold text-white">{u.displayName}</p>
                      <p className="text-[11px] font-mono text-neutral-500">
                        {u.email || u.id}
                      </p>
                    </td>
                    <td className="p-3.5">
                      {u.isPro ? (
                        <span className="text-[#FF385C] font-semibold">Pro Member</span>
                      ) : (
                        <span className="text-neutral-500">Free Tier</span>
                      )}
                    </td>
                    <td className="p-3.5">
                      {u.isAdultVerified ? (
                        <span className="text-emerald-400 font-semibold">✓ Verified 18+</span>
                      ) : (
                        <span className="text-neutral-500">Pending</span>
                      )}
                    </td>
                    <td className="p-3.5">
                      <span
                        className={`px-2.5 py-0.5 rounded-full text-[10px] font-mono ${
                          u.status === 'active'
                            ? 'bg-emerald-500/10 text-emerald-400'
                            : u.status === 'suspended'
                            ? 'bg-amber-500/20 text-amber-300'
                            : 'bg-rose-500/20 text-rose-300'
                        }`}
                      >
                        {u.status}
                      </span>
                    </td>
                    <td className="p-3.5 text-right space-x-1.5">
                      {u.status === 'active' ? (
                        <>
                          <button
                            onClick={() => handleToggleUserStatus(u.id, 'suspended')}
                            className="px-3 py-1 rounded-full bg-amber-950/40 hover:bg-amber-900/60 text-amber-300 border border-amber-800/40 text-[11px]"
                          >
                            Suspend
                          </button>
                          <button
                            onClick={() => handleToggleUserStatus(u.id, 'banned')}
                            className="px-3 py-1 rounded-full bg-rose-950/40 hover:bg-rose-900/60 text-rose-300 border border-rose-800/40 text-[11px]"
                          >
                            Ban
                          </button>
                        </>
                      ) : (
                        <button
                          onClick={() => handleToggleUserStatus(u.id, 'active')}
                          className="px-3 py-1 rounded-full bg-emerald-950/40 hover:bg-emerald-900/60 text-emerald-300 border border-emerald-800/40 text-[11px]"
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
        <div className="space-y-6">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            <div className="p-6 rounded-3xl bg-[#161618] border border-neutral-800 space-y-3 text-xs">
              <h3 className="font-bold text-white">WebSocket Signaling</h3>
              <div className="space-y-2">
                <div className="flex justify-between py-1 border-b border-neutral-800">
                  <span className="text-neutral-400">Endpoint</span>
                  <span className="font-mono text-white">/ws (Port 3000)</span>
                </div>
                <div className="flex justify-between py-1 border-b border-neutral-800">
                  <span className="text-neutral-400">Heartbeat Interval</span>
                  <span className="font-mono text-white">30s Ping / Pong</span>
                </div>
                <div className="flex justify-between py-1">
                  <span className="text-neutral-400">Queue State</span>
                  <span className="text-emerald-400 font-semibold">In-Memory Ephemeral</span>
                </div>
              </div>
            </div>

            <div className="p-6 rounded-3xl bg-[#161618] border border-neutral-800 space-y-3 text-xs">
              <h3 className="font-bold text-white">TURN / STUN Relays</h3>
              <div className="space-y-2">
                <div className="flex justify-between py-1 border-b border-neutral-800">
                  <span className="text-neutral-400">Google STUN Pool</span>
                  <span className="text-emerald-400 font-semibold">Active (3 endpoints)</span>
                </div>
                <div className="flex justify-between py-1 border-b border-neutral-800">
                  <span className="text-neutral-400">TURN Relay Fallback</span>
                  <span className="font-mono text-neutral-300">
                    {systemHealth.turnConfigured ? 'Configured' : 'Env Ready (TURN_URL)'}
                  </span>
                </div>
                <div className="flex justify-between py-1">
                  <span className="text-neutral-400">Video Server Bypass</span>
                  <span className="text-emerald-400 font-semibold">100% P2P Enforced</span>
                </div>
              </div>
            </div>

            <div className="p-6 rounded-3xl bg-[#161618] border border-neutral-800 space-y-3 text-xs">
              <h3 className="font-bold text-white">Operational Uptime</h3>
              <div className="space-y-2">
                <div className="flex justify-between py-1 border-b border-neutral-800">
                  <span className="text-neutral-400">Process Uptime</span>
                  <span className="font-mono text-white">{systemHealth.uptimeSeconds}s</span>
                </div>
                <div className="flex justify-between py-1 border-b border-neutral-800">
                  <span className="text-neutral-400">Health Status</span>
                  <span className="text-emerald-400 font-semibold uppercase font-mono">
                    {systemHealth.status}
                  </span>
                </div>
                <div className="flex justify-between py-1">
                  <span className="text-neutral-400">Zero Video Retention</span>
                  <span className="text-emerald-400 font-semibold">Active</span>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Review Modal */}
      {selectedReport && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm">
          <div className="w-full max-w-md rounded-3xl border border-neutral-800 bg-[#161618] p-6 shadow-2xl space-y-4">
            <div className="flex items-center justify-between pb-3 border-b border-neutral-800">
              <h2 className="text-base font-bold text-white">Moderation Review</h2>
              <button
                onClick={() => setSelectedReport(null)}
                className="text-neutral-400 hover:text-white"
              >
                <Cancel01Icon className="w-4 h-4" />
              </button>
            </div>

            <div className="space-y-2 text-xs">
              <div className="p-4 rounded-2xl bg-neutral-950 border border-neutral-800 space-y-1">
                <p className="text-neutral-400">
                  Category:{' '}
                  <strong className="text-white capitalize">
                    {selectedReport.category.replace(/_/g, ' ')}
                  </strong>
                </p>
                <p className="text-neutral-400">
                  Reported User:{' '}
                  <span className="font-mono text-[#FF385C]">
                    {selectedReport.reportedUserName} ({selectedReport.reportedUserId})
                  </span>
                </p>
                <p className="text-neutral-400">
                  Reporter: <span className="text-neutral-200">{selectedReport.reporterName}</span>
                </p>
                {selectedReport.description && (
                  <p className="text-neutral-300 pt-1 border-t border-neutral-900">
                    "{selectedReport.description}"
                  </p>
                )}
              </div>
            </div>

            <form onSubmit={handleUpdateReportAction} className="space-y-3 pt-1 text-xs">
              <div>
                <label className="block text-neutral-400 mb-1 font-semibold">Moderator Action</label>
                <select
                  value={actionDecision}
                  onChange={(e) => setActionDecision(e.target.value as any)}
                  className="w-full bg-neutral-950 border border-neutral-800 rounded-xl p-2.5 text-white"
                >
                  <option value="none">No Action (Dismiss false report)</option>
                  <option value="warned">Issue Warning</option>
                  <option value="suspended">Suspend User Account</option>
                  <option value="banned">Permanently Ban User</option>
                </select>
              </div>

              <div>
                <label className="block text-neutral-400 mb-1 font-semibold">Report Status</label>
                <select
                  value={actionStatus}
                  onChange={(e) => setActionStatus(e.target.value as any)}
                  className="w-full bg-neutral-950 border border-neutral-800 rounded-xl p-2.5 text-white"
                >
                  <option value="resolved">Resolved</option>
                  <option value="dismissed">Dismissed</option>
                  <option value="escalated">Escalated to Legal</option>
                  <option value="reviewed">In Review</option>
                </select>
              </div>

              <div>
                <label className="block text-neutral-400 mb-1 font-semibold">
                  Moderator Notes
                </label>
                <textarea
                  value={actionNotes}
                  onChange={(e) => setActionNotes(e.target.value)}
                  placeholder="Record justification..."
                  rows={2}
                  className="w-full bg-neutral-950 border border-neutral-800 rounded-xl p-2.5 text-white"
                />
              </div>

              <div className="flex items-center justify-end gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => setSelectedReport(null)}
                  className="px-4 py-2 rounded-full border border-neutral-800 text-neutral-400 hover:text-white"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-5 py-2 rounded-full bg-gradient-to-r from-[#FF385C] to-[#E00B41] text-white font-bold shadow-md shadow-[#FF385C]/25"
                >
                  Save Decision
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
