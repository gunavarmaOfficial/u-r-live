/**
 * In-memory database with atomic operations and persistence for OmeLive
 */
import fs from 'fs';
import path from 'path';
import {
  UserProfile,
  Subscription,
  PaymentEvent,
  UserReport,
  UserBlock,
  AdminAuditLog,
} from './types';

const DATA_DIR = path.resolve(process.cwd(), '.data');
const DB_FILE = path.join(DATA_DIR, 'omelive_db.json');

interface DatabaseSchema {
  users: Record<string, UserProfile>;
  subscriptions: Record<string, Subscription>; // keyed by userId
  paymentEvents: Record<string, PaymentEvent>; // keyed by providerEventId
  reports: Record<string, UserReport>;
  blocks: Record<string, UserBlock>;
  auditLogs: AdminAuditLog[];
}

// Initial Admin User
const DEFAULT_ADMIN: UserProfile = {
  id: 'admin-root-001',
  displayName: 'Safety Admin',
  gender: 'unspecified',
  country: 'IN',
  isAdultVerified: true,
  role: 'admin',
  status: 'active',
  createdAt: Date.now() - 86400000 * 30,
  lastActiveAt: Date.now(),
};

class Database {
  private data: DatabaseSchema = {
    users: {
      [DEFAULT_ADMIN.id]: DEFAULT_ADMIN,
    },
    subscriptions: {},
    paymentEvents: {},
    reports: {},
    blocks: {},
    auditLogs: [],
  };

  constructor() {
    this.load();
  }

  private load() {
    try {
      if (fs.existsSync(DB_FILE)) {
        const raw = fs.readFileSync(DB_FILE, 'utf-8');
        const parsed = JSON.parse(raw);
        this.data = {
          ...this.data,
          ...parsed,
          users: { ...this.data.users, ...(parsed.users || {}) },
        };
      }
    } catch (err) {
      console.warn('Could not load persistent database, initializing fresh store:', err);
    }
  }

  public save() {
    try {
      if (!fs.existsSync(DATA_DIR)) {
        fs.mkdirSync(DATA_DIR, { recursive: true });
      }
      fs.writeFileSync(DB_FILE, JSON.stringify(this.data, null, 2), 'utf-8');
    } catch (err) {
      console.error('Failed to persist database file:', err);
    }
  }

  // --- Users ---
  getUser(id: string): UserProfile | undefined {
    return this.data.users[id];
  }

  findUserByGoogleId(googleId: string): UserProfile | undefined {
    return Object.values(this.data.users).find((u) => u.googleId === googleId);
  }

  findUserByEmail(email: string): UserProfile | undefined {
    const normalized = email.toLowerCase().trim();
    return Object.values(this.data.users).find((u) => u.email?.toLowerCase().trim() === normalized);
  }

  getAllUsers(): UserProfile[] {
    return Object.values(this.data.users);
  }

  saveUser(user: UserProfile): UserProfile {
    this.data.users[user.id] = {
      ...user,
      lastActiveAt: Date.now(),
    };
    this.save();
    return this.data.users[user.id];
  }

  updateUserStatus(id: string, status: 'active' | 'suspended' | 'banned'): UserProfile | undefined {
    const user = this.data.users[id];
    if (!user) return undefined;
    user.status = status;
    this.save();
    return user;
  }

  // --- Subscriptions ---
  getSubscription(userId: string): Subscription | undefined {
    return this.data.subscriptions[userId];
  }

  isUserPro(userId: string): boolean {
    const sub = this.data.subscriptions[userId];
    if (!sub) return false;
    if (sub.status === 'active') {
      // Check if current period has expired
      if (sub.currentPeriodEnd > Date.now()) {
        return true;
      } else {
        // Expired
        sub.status = 'expired';
        this.save();
        return false;
      }
    }
    return false;
  }

  saveSubscription(sub: Subscription): Subscription {
    this.data.subscriptions[sub.userId] = sub;
    this.save();
    return sub;
  }

  cancelSubscription(userId: string): Subscription | undefined {
    const sub = this.data.subscriptions[userId];
    if (!sub) return undefined;
    sub.cancelAtPeriodEnd = true;
    sub.updatedAt = Date.now();
    this.save();
    return sub;
  }

  // --- Payment Events (Idempotent Webhooks) ---
  hasPaymentEvent(eventId: string): boolean {
    return !!this.data.paymentEvents[eventId];
  }

  savePaymentEvent(event: PaymentEvent): void {
    this.data.paymentEvents[event.providerEventId] = event;
    this.save();
  }

  getAllPaymentEvents(): PaymentEvent[] {
    return Object.values(this.data.paymentEvents).sort((a, b) => b.receivedAt - a.receivedAt);
  }

  // --- Reports ---
  createReport(report: Omit<UserReport, 'id' | 'createdAt' | 'status'>): UserReport {
    const id = 'rep_' + Math.random().toString(36).substring(2, 10);
    const newReport: UserReport = {
      ...report,
      id,
      status: 'pending',
      createdAt: Date.now(),
    };
    this.data.reports[id] = newReport;
    this.save();
    return newReport;
  }

  getReports(): UserReport[] {
    return Object.values(this.data.reports).sort((a, b) => b.createdAt - a.createdAt);
  }

  updateReportStatus(
    reportId: string,
    status: UserReport['status'],
    actionTaken?: UserReport['actionTaken'],
    notes?: string
  ): UserReport | undefined {
    const report = this.data.reports[reportId];
    if (!report) return undefined;
    report.status = status;
    if (actionTaken) report.actionTaken = actionTaken;
    if (notes) report.moderatorNotes = notes;
    report.resolvedAt = Date.now();
    this.save();
    return report;
  }

  // --- Blocks ---
  blockUser(blockerId: string, blockedUserId: string): UserBlock {
    const id = `${blockerId}_blocks_${blockedUserId}`;
    const block: UserBlock = {
      id,
      blockerId,
      blockedUserId,
      createdAt: Date.now(),
    };
    this.data.blocks[id] = block;
    this.save();
    return block;
  }

  unblockUser(blockerId: string, blockedUserId: string): boolean {
    const id = `${blockerId}_blocks_${blockedUserId}`;
    if (this.data.blocks[id]) {
      delete this.data.blocks[id];
      this.save();
      return true;
    }
    return false;
  }

  isBlocked(userA: string, userB: string): boolean {
    const aBlocksB = !!this.data.blocks[`${userA}_blocks_${userB}`];
    const bBlocksA = !!this.data.blocks[`${userB}_blocks_${userA}`];
    return aBlocksB || bBlocksA;
  }

  getBlockedUsers(blockerId: string): string[] {
    return Object.values(this.data.blocks)
      .filter((b) => b.blockerId === blockerId)
      .map((b) => b.blockedUserId);
  }

  // --- Audit Logs ---
  addAuditLog(log: Omit<AdminAuditLog, 'id' | 'createdAt'>): AdminAuditLog {
    const entry: AdminAuditLog = {
      ...log,
      id: 'log_' + Math.random().toString(36).substring(2, 10),
      createdAt: Date.now(),
    };
    this.data.auditLogs.unshift(entry);
    if (this.data.auditLogs.length > 500) {
      this.data.auditLogs.pop();
    }
    this.save();
    return entry;
  }

  getAuditLogs(): AdminAuditLog[] {
    return this.data.auditLogs;
  }
}

export const db = new Database();
