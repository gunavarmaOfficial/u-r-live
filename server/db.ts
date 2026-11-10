/**
 * U-R-LIVE Hybrid PostgreSQL & Memory-Cached Database Engine
 * Supports Supabase PostgreSQL (via DATABASE_URL or SUPABASE_DB_URL)
 * with zero-latency synchronized in-memory caching for real-time WebRTC signaling,
 * ACID durability, and safe local development fallback.
 */
import fs from 'fs';
import path from 'path';
import crypto from 'crypto';
import pg from 'pg';
import {
  UserProfile,
  Subscription,
  PaymentEvent,
  UserReport,
  UserBlock,
  AdminAuditLog,
  UserSession,
  LegalConsent,
} from './types';

const { Pool } = pg;

const DATA_DIR = path.resolve(process.cwd(), '.data');
const DB_FILE = path.join(DATA_DIR, 'omelive_db.json');

export interface UserPreferences {
  userId: string;
  chatMode: 'video' | 'text';
  preferredGender: 'any' | 'male' | 'female';
  preferredCountry: string;
  preferredCountries?: string[];
  isMultipleCountries?: boolean;
  interests: string[];
  interestMatchingEnabled: boolean;
  strictInterests: boolean;
  languages: string[];
  preferredLanguages?: string[];
  primaryLanguage: string;
  strictLanguage: boolean;
  priorityQueue: boolean;
  updatedAt: number;
}

interface DatabaseSchema {
  users: Record<string, UserProfile>;
  subscriptions: Record<string, Subscription>; // keyed by userId
  paymentEvents: Record<string, PaymentEvent>; // keyed by providerEventId
  reports: Record<string, UserReport>;
  blocks: Record<string, UserBlock>;
  auditLogs: AdminAuditLog[];
  preferences: Record<string, UserPreferences>;
  sessions: Record<string, UserSession>; // keyed by tokenHash
  consents: Record<string, LegalConsent>; // keyed by userId:kind:version
}

// Initial Default Admin Profile
const DEFAULT_ADMIN: UserProfile = {
  id: 'admin-root-001',
  displayName: 'Safety Admin',
  gender: 'unspecified',
  country: 'IN',
  isAdultVerified: true,
  role: 'admin',
  status: 'active',
  createdAt: 1704067200000,
  lastActiveAt: 1704067200000,
};

export class Database {
  private data: DatabaseSchema = {
    users: {
      [DEFAULT_ADMIN.id]: DEFAULT_ADMIN,
    },
    subscriptions: {},
    paymentEvents: {},
    reports: {},
    blocks: {},
    auditLogs: [],
    preferences: {},
    sessions: {},
    consents: {},
  };

  private pool: pg.Pool | null = null;
  private isPostgresActive = false;

  constructor() {
    this.init();
  }

  /**
   * Initialize database engine:
   * 1. If DATABASE_URL / SUPABASE_DB_URL is set, connect to PostgreSQL.
   * 2. If in production and no database URL is set, fail closed.
   * 3. Otherwise, use file-backed local JSON storage for development/test.
   */
  private init() {
    const dbUrl = process.env.DATABASE_URL || process.env.SUPABASE_DB_URL;

    if (dbUrl) {
      try {
        const isSslRequired = !dbUrl.includes('localhost') && !dbUrl.includes('127.0.0.1');
        this.pool = new Pool({
          connectionString: dbUrl,
          ssl: isSslRequired ? { rejectUnauthorized: false } : undefined,
          max: 10,
          idleTimeoutMillis: 30000,
          connectionTimeoutMillis: 5000,
        });

        this.pool.on('error', (err) => {
          console.error('[Database] Unexpected PostgreSQL pool error:', err.message);
        });

        this.isPostgresActive = true;
        // Load initial state into in-memory cache asynchronously
        this.hydrateFromPostgres();
      } catch (err: any) {
        console.error('[Database] Failed to initialize PostgreSQL pool:', err.message);
        if (process.env.NODE_ENV === 'production') {
          throw new Error('Database initialization failed in production: ' + err.message);
        }
      }
    } else {
      if (process.env.NODE_ENV === 'production' && !process.env.VERCEL) {
        throw new Error(
          'FATAL: Production environment detected (NODE_ENV=production) but DATABASE_URL or SUPABASE_DB_URL is not configured. Silently falling back to JSON storage in production is prohibited.'
        );
      }
      this.loadLocalJson();
    }
  }

  /**
   * Load snapshot from local JSON file (development & offline testing)
   */
  private loadLocalJson() {
    try {
      if (fs.existsSync(DB_FILE)) {
        const raw = fs.readFileSync(DB_FILE, 'utf-8');
        const parsed = JSON.parse(raw);
        this.data = {
          ...this.data,
          ...parsed,
          users: { ...this.data.users, ...(parsed.users || {}) },
          subscriptions: { ...this.data.subscriptions, ...(parsed.subscriptions || {}) },
          paymentEvents: { ...this.data.paymentEvents, ...(parsed.paymentEvents || {}) },
          reports: { ...this.data.reports, ...(parsed.reports || {}) },
          blocks: { ...this.data.blocks, ...(parsed.blocks || {}) },
          auditLogs: parsed.auditLogs || this.data.auditLogs,
          preferences: { ...this.data.preferences, ...(parsed.preferences || {}) },
          sessions: { ...this.data.sessions, ...(parsed.sessions || {}) },
          consents: { ...this.data.consents, ...(parsed.consents || {}) },
        };
      }
    } catch (err) {
      console.warn('[Database] Could not load local JSON database:', err);
    }
  }

  /**
   * Save snapshot to local JSON file when running without PostgreSQL
   */
  public save() {
    if (this.isPostgresActive || process.env.NODE_ENV === 'test') return;
    try {
      if (!fs.existsSync(DATA_DIR)) {
        fs.mkdirSync(DATA_DIR, { recursive: true });
      }
      fs.writeFileSync(DB_FILE, JSON.stringify(this.data, null, 2), 'utf-8');
    } catch (err) {
      console.error('[Database] Failed to persist local database file:', err);
    }
  }

  /**
   * Hydrate in-memory cache from PostgreSQL tables
   */
  public async hydrateFromPostgres(): Promise<void> {
    if (!this.pool) return;
    try {
      const client = await this.pool.connect();
      try {
        // Users
        const usersRes = await client.query('SELECT * FROM users');
        for (const row of usersRes.rows) {
          this.data.users[row.id] = {
            id: row.id,
            displayName: row.display_name,
            email: row.email || undefined,
            avatarUrl: row.avatar_url || undefined,
            googleId: row.google_id || undefined,
            authProvider: row.auth_provider,
            gender: row.gender,
            country: row.country,
            isAdultVerified: row.is_adult_verified,
            role: row.role,
            status: row.status,
            allowFriendRequests: row.allow_friend_requests,
            termsVersion: row.terms_version || undefined,
            termsAcceptedAt: row.terms_accepted_at ? Number(row.terms_accepted_at) : undefined,
            ageConfirmedAt: row.age_confirmed_at ? Number(row.age_confirmed_at) : undefined,
            createdAt: Number(row.created_at),
            lastActiveAt: Number(row.last_active_at),
          };
        }

        // Subscriptions
        const subsRes = await client.query('SELECT * FROM subscriptions');
        for (const row of subsRes.rows) {
          this.data.subscriptions[row.user_id] = {
            id: row.id,
            userId: row.user_id,
            provider: row.provider,
            providerCustomerId: row.provider_customer_id,
            providerSubscriptionId: row.provider_subscription_id,
            planCode: row.plan_code,
            status: row.status,
            currentPeriodStart: Number(row.current_period_start),
            currentPeriodEnd: Number(row.current_period_end),
            cancelAtPeriodEnd: row.cancel_at_period_end,
            createdAt: Number(row.created_at),
            updatedAt: Number(row.updated_at),
          };
        }

        // Payment Events
        const peRes = await client.query('SELECT * FROM payment_events');
        for (const row of peRes.rows) {
          this.data.paymentEvents[row.provider_event_id] = {
            id: row.id,
            provider: row.provider,
            providerEventId: row.provider_event_id,
            eventType: row.event_type,
            processingStatus: row.processing_status,
            receivedAt: Number(row.received_at),
            payload: row.payload,
          };
        }

        // Reports
        const repRes = await client.query('SELECT * FROM user_reports');
        for (const row of repRes.rows) {
          this.data.reports[row.id] = {
            id: row.id,
            reporterId: row.reporter_id,
            reporterName: row.reporter_name,
            reportedUserId: row.reported_user_id,
            reportedUserName: row.reported_user_name,
            category: row.category,
            description: row.description,
            sessionId: row.session_id || undefined,
            status: row.status,
            createdAt: Number(row.created_at),
            resolvedAt: row.resolved_at ? Number(row.resolved_at) : undefined,
            actionTaken: row.action_taken || undefined,
            moderatorNotes: row.moderator_notes || undefined,
          };
        }

        // Blocks
        const blkRes = await client.query('SELECT * FROM user_blocks');
        for (const row of blkRes.rows) {
          this.data.blocks[row.id] = {
            id: row.id,
            blockerId: row.blocker_id,
            blockedUserId: row.blocked_user_id,
            createdAt: Number(row.created_at),
          };
        }

        // Audit Logs
        const logRes = await client.query('SELECT * FROM admin_audit_logs ORDER BY created_at DESC LIMIT 500');
        this.data.auditLogs = logRes.rows.map((row) => ({
          id: row.id,
          adminUserId: row.admin_user_id,
          action: row.action,
          targetType: row.target_type,
          targetId: row.target_id,
          details: row.details || undefined,
          createdAt: Number(row.created_at),
        }));

        // User Preferences
        const prefRes = await client.query('SELECT * FROM user_preferences');
        for (const row of prefRes.rows) {
          this.data.preferences[row.user_id] = {
            userId: row.user_id,
            chatMode: row.chat_mode,
            preferredGender: row.preferred_gender,
            preferredCountry: row.preferred_country,
            interests: row.interests || [],
            interestMatchingEnabled: row.interest_matching_enabled,
            strictInterests: row.strict_interests,
            languages: row.languages || [],
            primaryLanguage: row.primary_language,
            strictLanguage: row.strict_language,
            priorityQueue: row.priority_queue,
            updatedAt: Number(row.updated_at),
          };
        }

        // User Sessions
        const sessRes = await client.query(
          'SELECT * FROM user_sessions WHERE expires_at > $1 AND revoked = FALSE',
          [Date.now()]
        );
        for (const row of sessRes.rows) {
          this.data.sessions[row.token_hash] = {
            id: row.id,
            userId: row.user_id,
            tokenHash: row.token_hash,
            role: row.role,
            isGuest: row.is_guest,
            createdAt: Number(row.created_at),
            expiresAt: Number(row.expires_at),
            revoked: row.revoked,
            lastActiveAt: Number(row.last_active_at),
          };
        }

        // Legal consents (table may not exist until migration 002 has run)
        try {
          const consentRes = await client.query('SELECT * FROM consents');
          for (const row of consentRes.rows) {
            this.data.consents[`${row.user_id}:${row.kind}:${row.version}`] = {
              id: row.id,
              userId: row.user_id,
              kind: row.kind,
              version: row.version,
              acceptedAt: Number(row.accepted_at),
              ipHash: row.ip_hash || undefined,
              userAgentHash: row.user_agent_hash || undefined,
            };
          }
        } catch (err: any) {
          console.warn('[Database] Could not hydrate consents table:', err.message);
        }
      } finally {
        client.release();
      }
    } catch (err: any) {
      console.warn('[Database] Could not hydrate cache from PostgreSQL:', err.message);
    }
  }

  public isPostgresConnected(): boolean {
    return this.isPostgresActive;
  }

  /** Lightweight readiness probe. Resolves false when PostgreSQL is unreachable. */
  public async ping(): Promise<boolean> {
    if (!this.pool) return true;
    try {
      await this.pool.query('SELECT 1');
      return true;
    } catch {
      return false;
    }
  }

  // --- Users ---
  getUser(id: string): UserProfile | undefined {
    return this.data.users[id];
  }

  /**
   * Cache-through user lookup. In multi-instance deployments a user may have
   * been created by another instance, so fall back to PostgreSQL (and warm the
   * local cache) instead of treating the account as missing.
   */
  async ensureUser(id: string): Promise<UserProfile | undefined> {
    const cached = this.data.users[id];
    if (cached || !this.pool) return cached;

    try {
      const res = await this.pool.query('SELECT * FROM users WHERE id = $1', [id]);
      const row = res.rows[0];
      if (!row) return undefined;

      const user: UserProfile = {
        id: row.id,
        displayName: row.display_name,
        email: row.email || undefined,
        avatarUrl: row.avatar_url || undefined,
        googleId: row.google_id || undefined,
        authProvider: row.auth_provider,
        gender: row.gender,
        country: row.country,
        isAdultVerified: row.is_adult_verified,
        role: row.role,
        status: row.status,
        allowFriendRequests: row.allow_friend_requests,
        termsVersion: row.terms_version || undefined,
        termsAcceptedAt: row.terms_accepted_at ? Number(row.terms_accepted_at) : undefined,
        ageConfirmedAt: row.age_confirmed_at ? Number(row.age_confirmed_at) : undefined,
        createdAt: Number(row.created_at),
        lastActiveAt: Number(row.last_active_at),
      };

      this.data.users[user.id] = user;
      return user;
    } catch (err: any) {
      console.error('[Database] Failed to load user from PostgreSQL:', err.message);
      return undefined;
    }
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

  private normalizeUser(user: UserProfile): UserProfile {
    const now = Date.now();
    return {
      ...user,
      lastActiveAt: now,
      createdAt: user.createdAt || now,
    };
  }

  private userUpsertQuery(user: UserProfile): { sql: string; values: any[] } {
    return {
      sql: `INSERT INTO users (
            id, display_name, email, avatar_url, google_id, auth_provider,
            gender, country, is_adult_verified, role, status, allow_friend_requests,
            terms_version, terms_accepted_at, age_confirmed_at,
            created_at, last_active_at
          ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16, $17)
          ON CONFLICT (id) DO UPDATE SET
            display_name = EXCLUDED.display_name,
            email = COALESCE(EXCLUDED.email, users.email),
            avatar_url = COALESCE(EXCLUDED.avatar_url, users.avatar_url),
            google_id = COALESCE(EXCLUDED.google_id, users.google_id),
            auth_provider = EXCLUDED.auth_provider,
            gender = EXCLUDED.gender,
            country = EXCLUDED.country,
            is_adult_verified = EXCLUDED.is_adult_verified,
            role = EXCLUDED.role,
            status = EXCLUDED.status,
            allow_friend_requests = EXCLUDED.allow_friend_requests,
            terms_version = COALESCE(EXCLUDED.terms_version, users.terms_version),
            terms_accepted_at = COALESCE(EXCLUDED.terms_accepted_at, users.terms_accepted_at),
            age_confirmed_at = COALESCE(EXCLUDED.age_confirmed_at, users.age_confirmed_at),
            last_active_at = EXCLUDED.last_active_at`,
      values: [
        user.id,
        user.displayName,
        user.email || null,
        user.avatarUrl || null,
        user.googleId || null,
        user.authProvider || 'guest',
        user.gender,
        user.country,
        user.isAdultVerified,
        user.role,
        user.status,
        user.allowFriendRequests ?? true,
        user.termsVersion || null,
        user.termsAcceptedAt || null,
        user.ageConfirmedAt || null,
        user.createdAt,
        user.lastActiveAt,
      ],
    };
  }

  saveUser(user: UserProfile): UserProfile {
    const updatedUser = this.normalizeUser(user);
    this.data.users[updatedUser.id] = updatedUser;
    this.save();

    if (this.pool) {
      const { sql, values } = this.userUpsertQuery(updatedUser);
      this.pool.query(sql, values).catch((err) => {
        console.error('[Database] Failed to upsert user in PostgreSQL:', err.message);
      });
    }

    return updatedUser;
  }

  /** Awaited user write for account creation, where losing the row is not acceptable. */
  async saveUserAwait(user: UserProfile): Promise<UserProfile> {
    const updatedUser = this.normalizeUser(user);
    this.data.users[updatedUser.id] = updatedUser;
    this.save();

    if (this.pool) {
      const { sql, values } = this.userUpsertQuery(updatedUser);
      await this.pool.query(sql, values);
    }

    return updatedUser;
  }

  updateUserStatus(id: string, status: 'active' | 'suspended' | 'banned'): UserProfile | undefined {
    const user = this.data.users[id];
    if (!user) return undefined;
    user.status = status;
    this.save();

    if (this.pool) {
      this.pool
        .query('UPDATE users SET status = $1 WHERE id = $2', [status, id])
        .catch((err) => {
          console.error('[Database] Failed to update user status in PostgreSQL:', err.message);
        });
    }

    return user;
  }

  // --- Legal consent (versioned Terms / Privacy / 18+ confirmation) ---
  getConsents(userId: string): LegalConsent[] {
    return Object.values(this.data.consents).filter((c) => c.userId === userId);
  }

  /**
   * Records Terms acceptance and 18+ confirmation for a version, updates the
   * user row, and awaits the PostgreSQL write so callers can gate entry on it.
   */
  async acceptLegalConsent(
    userId: string,
    termsVersion: string,
    meta: { ipHash?: string; userAgentHash?: string } = {}
  ): Promise<UserProfile | undefined> {
    const user = this.data.users[userId];
    if (!user) return undefined;

    const now = Date.now();
    const updated: UserProfile = {
      ...user,
      isAdultVerified: true,
      termsVersion,
      termsAcceptedAt: now,
      ageConfirmedAt: now,
      lastActiveAt: now,
    };
    this.data.users[userId] = updated;

    const records: LegalConsent[] = (['terms', 'age'] as const).map((kind) => ({
      id: 'con_' + crypto.randomBytes(8).toString('hex'),
      userId,
      kind,
      version: termsVersion,
      acceptedAt: now,
      ipHash: meta.ipHash,
      userAgentHash: meta.userAgentHash,
    }));

    for (const record of records) {
      const key = `${record.userId}:${record.kind}:${record.version}`;
      if (!this.data.consents[key]) this.data.consents[key] = record;
    }

    this.save();

    if (this.pool) {
      const client = await this.pool.connect();
      try {
        await client.query('BEGIN');
        await client.query(
          `UPDATE users SET
            is_adult_verified = TRUE,
            terms_version = $2,
            terms_accepted_at = $3,
            age_confirmed_at = $4,
            last_active_at = $5
          WHERE id = $1`,
          [userId, termsVersion, now, now, now]
        );
        for (const record of records) {
          await client.query(
            `INSERT INTO consents (id, user_id, kind, version, accepted_at, ip_hash, user_agent_hash)
             VALUES ($1, $2, $3, $4, $5, $6, $7)
             ON CONFLICT (user_id, kind, version) DO NOTHING`,
            [
              record.id,
              record.userId,
              record.kind,
              record.version,
              record.acceptedAt,
              record.ipHash || null,
              record.userAgentHash || null,
            ]
          );
        }
        await client.query('COMMIT');
      } catch (err) {
        await client.query('ROLLBACK').catch(() => {});
        throw err;
      } finally {
        client.release();
      }
    }

    return updated;
  }

  // --- Subscriptions ---
  getSubscription(userId: string): Subscription | undefined {
    return this.data.subscriptions[userId];
  }

  isUserPro(userId: string): boolean {
    const sub = this.data.subscriptions[userId];
    if (!sub) return false;
    if (sub.status === 'active') {
      if (sub.currentPeriodEnd > Date.now()) {
        return true;
      } else {
        // Expired
        sub.status = 'expired';
        this.save();
        if (this.pool) {
          this.pool
            .query("UPDATE subscriptions SET status = 'expired' WHERE id = $1", [sub.id])
            .catch((err) => {
              console.error('[Database] Failed to expire subscription in PostgreSQL:', err.message);
            });
        }
        return false;
      }
    }
    return false;
  }

  private subscriptionUpsertQuery(sub: Subscription): { sql: string; values: any[] } {
    return {
      sql: `INSERT INTO subscriptions (
            id, user_id, provider, provider_customer_id, provider_subscription_id,
            plan_code, status, current_period_start, current_period_end, cancel_at_period_end,
            created_at, updated_at
          ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12)
          ON CONFLICT (id) DO UPDATE SET
            status = EXCLUDED.status,
            current_period_start = EXCLUDED.current_period_start,
            current_period_end = EXCLUDED.current_period_end,
            cancel_at_period_end = EXCLUDED.cancel_at_period_end,
            updated_at = EXCLUDED.updated_at`,
      values: [
        sub.id,
        sub.userId,
        sub.provider,
        sub.providerCustomerId,
        sub.providerSubscriptionId,
        sub.planCode,
        sub.status,
        sub.currentPeriodStart,
        sub.currentPeriodEnd,
        sub.cancelAtPeriodEnd,
        sub.createdAt,
        sub.updatedAt,
      ],
    };
  }

  saveSubscription(sub: Subscription): Subscription {
    this.data.subscriptions[sub.userId] = sub;
    this.save();

    if (this.pool) {
      const { sql, values } = this.subscriptionUpsertQuery(sub);
      this.pool.query(sql, values).catch((err) => {
        console.error('[Database] Failed to save subscription in PostgreSQL:', err.message);
      });
    }

    return sub;
  }

  /** Awaited entitlement write: Pro must never be granted on an unpersisted row. */
  async saveSubscriptionAwait(sub: Subscription): Promise<Subscription> {
    this.data.subscriptions[sub.userId] = sub;
    this.save();

    if (this.pool) {
      const { sql, values } = this.subscriptionUpsertQuery(sub);
      await this.pool.query(sql, values);
    }

    return sub;
  }

  cancelSubscription(userId: string): Subscription | undefined {
    const sub = this.data.subscriptions[userId];
    if (!sub) return undefined;
    sub.cancelAtPeriodEnd = true;
    sub.updatedAt = Date.now();
    this.save();

    if (this.pool) {
      this.pool
        .query(
          'UPDATE subscriptions SET cancel_at_period_end = TRUE, updated_at = $1 WHERE user_id = $2',
          [sub.updatedAt, userId]
        )
        .catch((err) => {
          console.error('[Database] Failed to cancel subscription in PostgreSQL:', err.message);
        });
    }

    return sub;
  }

  /** Awaited cancellation so the UI never reports success on an unpersisted change. */
  async cancelSubscriptionAwait(userId: string): Promise<Subscription | undefined> {
    const sub = this.data.subscriptions[userId];
    if (!sub) return undefined;
    sub.cancelAtPeriodEnd = true;
    sub.updatedAt = Date.now();
    this.save();

    if (this.pool) {
      await this.pool.query(
        'UPDATE subscriptions SET cancel_at_period_end = TRUE, updated_at = $1 WHERE user_id = $2',
        [sub.updatedAt, userId]
      );
    }

    return sub;
  }

  // --- Payment Events (Idempotency) ---
  hasPaymentEvent(eventId: string): boolean {
    return !!this.data.paymentEvents[eventId];
  }

  /**
   * Claims a provider event for processing. Returns false when the event was
   * already claimed, which is the authoritative duplicate check across instances.
   */
  async claimPaymentEvent(event: PaymentEvent): Promise<boolean> {
    if (this.data.paymentEvents[event.providerEventId]) return false;
    this.data.paymentEvents[event.providerEventId] = event;
    this.save();

    if (!this.pool) return true;

    const result = await this.pool.query(
      `INSERT INTO payment_events (
        id, provider, provider_event_id, event_type, processing_status, received_at, payload
      ) VALUES ($1, $2, $3, $4, $5, $6, $7)
      ON CONFLICT (provider_event_id) DO NOTHING
      RETURNING id`,
      [
        event.id,
        event.provider,
        event.providerEventId,
        event.eventType,
        event.processingStatus,
        event.receivedAt,
        JSON.stringify(event.payload),
      ]
    );

    return (result.rowCount ?? 0) > 0;
  }

  /** Persists an already-claimed event's final processing status. */
  async updatePaymentEvent(event: PaymentEvent): Promise<void> {
    this.data.paymentEvents[event.providerEventId] = event;
    this.save();

    if (!this.pool) return;

    await this.pool.query(
      `UPDATE payment_events SET processing_status = $2, payload = $3
       WHERE provider_event_id = $1`,
      [event.providerEventId, event.processingStatus, JSON.stringify(event.payload)]
    );
  }

  /**
   * Grants entitlement and records the causing payment event atomically, so a
   * crash cannot leave Pro activated without an idempotency record (or vice versa).
   */
  async activateSubscriptionWithEvent(sub: Subscription, event: PaymentEvent): Promise<void> {
    this.data.subscriptions[sub.userId] = sub;
    const stored = { ...event, processingStatus: 'processed' as const };
    this.data.paymentEvents[stored.providerEventId] = stored;
    this.save();

    if (!this.pool) return;

    const client = await this.pool.connect();
    try {
      await client.query('BEGIN');
      const subQuery = this.subscriptionUpsertQuery(sub);
      await client.query(subQuery.sql, subQuery.values);
      await client.query(
        `UPDATE payment_events SET processing_status = 'processed', payload = $2
         WHERE provider_event_id = $1`,
        [stored.providerEventId, JSON.stringify(stored.payload)]
      );
      await client.query('COMMIT');
    } catch (err) {
      await client.query('ROLLBACK').catch(() => {});
      throw err;
    } finally {
      client.release();
    }
  }

  savePaymentEvent(event: PaymentEvent): void {
    this.data.paymentEvents[event.providerEventId] = event;
    this.save();

    if (this.pool) {
      this.pool
        .query(
          `INSERT INTO payment_events (
            id, provider, provider_event_id, event_type, processing_status, received_at, payload
          ) VALUES ($1, $2, $3, $4, $5, $6, $7)
          ON CONFLICT (provider, provider_event_id) DO UPDATE SET
            processing_status = EXCLUDED.processing_status`,
          [
            event.id,
            event.provider,
            event.providerEventId,
            event.eventType,
            event.processingStatus,
            event.receivedAt,
            JSON.stringify(event.payload),
          ]
        )
        .catch((err) => {
          console.error('[Database] Failed to save payment event in PostgreSQL:', err.message);
        });
    }
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

    if (this.pool) {
      this.pool
        .query(
          `INSERT INTO user_reports (
            id, reporter_id, reporter_name, reported_user_id, reported_user_name,
            category, description, session_id, status, action_taken, created_at
          ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11)`,
          [
            newReport.id,
            newReport.reporterId,
            newReport.reporterName,
            newReport.reportedUserId,
            newReport.reportedUserName,
            newReport.category,
            newReport.description,
            newReport.sessionId || null,
            newReport.status,
            'none',
            newReport.createdAt,
          ]
        )
        .catch((err) => {
          console.error('[Database] Failed to save user report in PostgreSQL:', err.message);
        });
    }

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

    if (this.pool) {
      this.pool
        .query(
          `UPDATE user_reports SET
            status = $1, action_taken = $2, moderator_notes = $3, resolved_at = $4
          WHERE id = $5`,
          [status, actionTaken || 'none', notes || null, report.resolvedAt, reportId]
        )
        .catch((err) => {
          console.error('[Database] Failed to update user report in PostgreSQL:', err.message);
        });
    }

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

    if (this.pool) {
      this.pool
        .query(
          `INSERT INTO user_blocks (id, blocker_id, blocked_user_id, created_at)
           VALUES ($1, $2, $3, $4)
           ON CONFLICT (blocker_id, blocked_user_id) DO NOTHING`,
          [block.id, blockerId, blockedUserId, block.createdAt]
        )
        .catch((err) => {
          console.error('[Database] Failed to save block in PostgreSQL:', err.message);
        });
    }

    return block;
  }

  unblockUser(blockerId: string, blockedUserId: string): boolean {
    const id = `${blockerId}_blocks_${blockedUserId}`;
    if (this.data.blocks[id]) {
      delete this.data.blocks[id];
      this.save();

      if (this.pool) {
        this.pool
          .query('DELETE FROM user_blocks WHERE blocker_id = $1 AND blocked_user_id = $2', [
            blockerId,
            blockedUserId,
          ])
          .catch((err) => {
            console.error('[Database] Failed to delete block in PostgreSQL:', err.message);
          });
      }

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

  // --- User Preferences ---
  getUserPreferences(userId: string): UserPreferences | undefined {
    return this.data.preferences[userId];
  }

  saveUserPreferences(userId: string, prefs: Partial<UserPreferences>): UserPreferences {
    const existing = this.data.preferences[userId] || {
      userId,
      chatMode: 'video',
      preferredGender: 'any',
      preferredCountry: 'GLOBAL',
      interests: [],
      interestMatchingEnabled: false,
      strictInterests: false,
      languages: [],
      primaryLanguage: 'en',
      strictLanguage: false,
      priorityQueue: false,
      updatedAt: Date.now(),
    };

    const updated: UserPreferences = {
      ...existing,
      ...prefs,
      userId,
      updatedAt: Date.now(),
    };

    this.data.preferences[userId] = updated;
    this.save();

    if (this.pool) {
      this.pool
        .query(
          `INSERT INTO user_preferences (
            user_id, chat_mode, preferred_gender, preferred_country,
            interests, interest_matching_enabled, strict_interests,
            languages, primary_language, strict_language, priority_queue, updated_at
          ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12)
          ON CONFLICT (user_id) DO UPDATE SET
            chat_mode = EXCLUDED.chat_mode,
            preferred_gender = EXCLUDED.preferred_gender,
            preferred_country = EXCLUDED.preferred_country,
            interests = EXCLUDED.interests,
            interest_matching_enabled = EXCLUDED.interest_matching_enabled,
            strict_interests = EXCLUDED.strict_interests,
            languages = EXCLUDED.languages,
            primary_language = EXCLUDED.primary_language,
            strict_language = EXCLUDED.strict_language,
            priority_queue = EXCLUDED.priority_queue,
            updated_at = EXCLUDED.updated_at`,
          [
            updated.userId,
            updated.chatMode,
            updated.preferredGender,
            updated.preferredCountry,
            JSON.stringify(updated.interests),
            updated.interestMatchingEnabled,
            updated.strictInterests,
            JSON.stringify(updated.languages),
            updated.primaryLanguage,
            updated.strictLanguage,
            updated.priorityQueue,
            updated.updatedAt,
          ]
        )
        .catch((err) => {
          console.error('[Database] Failed to save user preferences in PostgreSQL:', err.message);
        });
    }

    return updated;
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

    if (this.pool) {
      this.pool
        .query(
          `INSERT INTO admin_audit_logs (id, admin_user_id, action, target_type, target_id, details, created_at)
           VALUES ($1, $2, $3, $4, $5, $6, $7)`,
          [
            entry.id,
            entry.adminUserId,
            entry.action,
            entry.targetType,
            entry.targetId,
            entry.details ? JSON.stringify(entry.details) : null,
            entry.createdAt,
          ]
        )
        .catch((err) => {
          console.error('[Database] Failed to save audit log in PostgreSQL:', err.message);
        });
    }

    return entry;
  }

  getAuditLogs(): AdminAuditLog[] {
    return this.data.auditLogs;
  }

  // --- Sessions (Guest & Auth) ---
  getSession(tokenHash: string): UserSession | undefined {
    const session = this.data.sessions[tokenHash];
    if (!session) return undefined;
    if (session.revoked || session.expiresAt <= Date.now()) {
      delete this.data.sessions[tokenHash];
      return undefined;
    }
    return session;
  }

  private sessionInsertQuery(session: UserSession): { sql: string; values: any[] } {
    return {
      sql: `INSERT INTO user_sessions (
            id, user_id, token_hash, role, is_guest, created_at, expires_at, revoked, last_active_at
          ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
          ON CONFLICT (token_hash) DO UPDATE SET
            last_active_at = EXCLUDED.last_active_at,
            revoked = EXCLUDED.revoked`,
      values: [
        session.id,
        session.userId,
        session.tokenHash,
        session.role,
        session.isGuest,
        session.createdAt,
        session.expiresAt,
        session.revoked,
        session.lastActiveAt,
      ],
    };
  }

  saveSession(session: UserSession): UserSession {
    this.data.sessions[session.tokenHash] = session;
    this.save();

    if (this.pool) {
      const { sql, values } = this.sessionInsertQuery(session);
      this.pool.query(sql, values).catch((err) => {
        console.error('[Database] Failed to save session in PostgreSQL:', err.message);
      });
    }

    return session;
  }

  /** Awaited session write so a freshly minted token is durable before it is returned. */
  async saveSessionAwait(session: UserSession): Promise<UserSession> {
    this.data.sessions[session.tokenHash] = session;
    this.save();

    if (this.pool) {
      const { sql, values } = this.sessionInsertQuery(session);
      await this.pool.query(sql, values);
    }

    return session;
  }

  revokeSession(tokenHash: string): boolean {
    const session = this.data.sessions[tokenHash];
    if (session) {
      session.revoked = true;
      delete this.data.sessions[tokenHash];
      this.save();

      if (this.pool) {
        this.pool
          .query('UPDATE user_sessions SET revoked = TRUE WHERE token_hash = $1', [tokenHash])
          .catch((err) => {
            console.error('[Database] Failed to revoke session in PostgreSQL:', err.message);
          });
      }
      return true;
    }
    return false;
  }

  /**
   * Close the PostgreSQL connection pool cleanly
   */
  public async close(): Promise<void> {
    if (this.pool) {
      await this.pool.end();
      this.pool = null;
      this.isPostgresActive = false;
    }
  }
}

export const db = new Database();
