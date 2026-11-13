// server.ts
import "dotenv/config";
import http from "http";
import fs from "fs";
import path2 from "path";
import crypto5 from "crypto";
import express from "express";
import helmet from "helmet";
import compression from "compression";
import { WebSocketServer as WebSocketServer2 } from "ws";
import { z as z2 } from "zod";

// server/db.ts
import path from "path";
import crypto from "crypto";
import pg from "pg";
var { Pool } = pg;
var DATA_DIR = process.env.VERCEL ? path.resolve("/tmp", ".data") : path.resolve(process.cwd(), ".data");
var DB_FILE = path.join(DATA_DIR, "omelive_db.json");
var DEFAULT_ADMIN = {
  id: "admin-root-001",
  displayName: "Safety Admin",
  gender: "unspecified",
  country: "IN",
  isAdultVerified: true,
  role: "admin",
  status: "active",
  createdAt: 17040672e5,
  lastActiveAt: 17040672e5
};
var Database = class {
  constructor() {
    this.data = {
      users: {
        [DEFAULT_ADMIN.id]: DEFAULT_ADMIN
      },
      reports: {},
      blocks: {},
      auditLogs: [],
      preferences: {},
      sessions: {},
      consents: {}
    };
    this.pool = null;
    this.isPostgresActive = false;
    this.init();
  }
  /**
   * Initialize database engine:
   * Pure in-memory storage engine: stores nothing to disk or external databases.
   */
  init() {
    if (process.env.NODE_ENV === "production" && !process.env.VERCEL && !process.env.DATABASE_URL && !process.env.SUPABASE_DB_URL) {
      throw new Error(
        "FATAL: Production environment detected (NODE_ENV=production) but DATABASE_URL or SUPABASE_DB_URL is not configured. Silently falling back to JSON storage in production is prohibited."
      );
    }
    this.isPostgresActive = false;
    this.pool = null;
  }
  /**
   * No-op: do not write any database files to disk.
   */
  save() {
  }
  /**
   * Hydrate in-memory cache from PostgreSQL tables
   */
  async hydrateFromPostgres() {
    if (!this.pool) return;
    try {
      const client = await this.pool.connect();
      try {
        const usersRes = await client.query("SELECT * FROM users");
        for (const row of usersRes.rows) {
          this.data.users[row.id] = {
            id: row.id,
            displayName: row.display_name,
            email: row.email || void 0,
            avatarUrl: row.avatar_url || void 0,
            googleId: row.google_id || void 0,
            authProvider: row.auth_provider,
            gender: row.gender,
            country: row.country,
            isAdultVerified: row.is_adult_verified,
            role: row.role,
            status: row.status,
            allowFriendRequests: row.allow_friend_requests,
            termsVersion: row.terms_version || void 0,
            termsAcceptedAt: row.terms_accepted_at ? Number(row.terms_accepted_at) : void 0,
            ageConfirmedAt: row.age_confirmed_at ? Number(row.age_confirmed_at) : void 0,
            createdAt: Number(row.created_at),
            lastActiveAt: Number(row.last_active_at)
          };
        }
        const repRes = await client.query("SELECT * FROM user_reports");
        for (const row of repRes.rows) {
          this.data.reports[row.id] = {
            id: row.id,
            reporterId: row.reporter_id,
            reporterName: row.reporter_name,
            reportedUserId: row.reported_user_id,
            reportedUserName: row.reported_user_name,
            category: row.category,
            description: row.description,
            sessionId: row.session_id || void 0,
            status: row.status,
            createdAt: Number(row.created_at),
            resolvedAt: row.resolved_at ? Number(row.resolved_at) : void 0,
            actionTaken: row.action_taken || void 0,
            moderatorNotes: row.moderator_notes || void 0
          };
        }
        const blkRes = await client.query("SELECT * FROM user_blocks");
        for (const row of blkRes.rows) {
          this.data.blocks[row.id] = {
            id: row.id,
            blockerId: row.blocker_id,
            blockedUserId: row.blocked_user_id,
            createdAt: Number(row.created_at)
          };
        }
        const logRes = await client.query("SELECT * FROM admin_audit_logs ORDER BY created_at DESC LIMIT 500");
        this.data.auditLogs = logRes.rows.map((row) => ({
          id: row.id,
          adminUserId: row.admin_user_id,
          action: row.action,
          targetType: row.target_type,
          targetId: row.target_id,
          details: row.details || void 0,
          createdAt: Number(row.created_at)
        }));
        const prefRes = await client.query("SELECT * FROM user_preferences");
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
            updatedAt: Number(row.updated_at)
          };
        }
        const sessRes = await client.query(
          "SELECT * FROM user_sessions WHERE expires_at > $1 AND revoked = FALSE",
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
            lastActiveAt: Number(row.last_active_at)
          };
        }
        try {
          const consentRes = await client.query("SELECT * FROM consents");
          for (const row of consentRes.rows) {
            this.data.consents[`${row.user_id}:${row.kind}:${row.version}`] = {
              id: row.id,
              userId: row.user_id,
              kind: row.kind,
              version: row.version,
              acceptedAt: Number(row.accepted_at),
              ipHash: row.ip_hash || void 0,
              userAgentHash: row.user_agent_hash || void 0
            };
          }
        } catch (err) {
          console.warn("[Database] Could not hydrate consents table:", err.message);
        }
      } finally {
        client.release();
      }
    } catch (err) {
      console.warn("[Database] Could not hydrate cache from PostgreSQL:", err.message);
    }
  }
  isPostgresConnected() {
    return this.isPostgresActive;
  }
  /** Lightweight readiness probe. Resolves false when PostgreSQL is unreachable. */
  async ping() {
    if (!this.pool) return true;
    try {
      await this.pool.query("SELECT 1");
      return true;
    } catch {
      return false;
    }
  }
  // --- Users ---
  getUser(id) {
    return this.data.users[id];
  }
  /**
   * Cache-through user lookup. In multi-instance deployments a user may have
   * been created by another instance, so fall back to PostgreSQL (and warm the
   * local cache) instead of treating the account as missing.
   */
  async ensureUser(id) {
    const cached = this.data.users[id];
    if (cached || !this.pool) return cached;
    try {
      const res = await this.pool.query("SELECT * FROM users WHERE id = $1", [id]);
      const row = res.rows[0];
      if (!row) return void 0;
      const user = {
        id: row.id,
        displayName: row.display_name,
        email: row.email || void 0,
        avatarUrl: row.avatar_url || void 0,
        googleId: row.google_id || void 0,
        authProvider: row.auth_provider,
        gender: row.gender,
        country: row.country,
        isAdultVerified: row.is_adult_verified,
        role: row.role,
        status: row.status,
        allowFriendRequests: row.allow_friend_requests,
        termsVersion: row.terms_version || void 0,
        termsAcceptedAt: row.terms_accepted_at ? Number(row.terms_accepted_at) : void 0,
        ageConfirmedAt: row.age_confirmed_at ? Number(row.age_confirmed_at) : void 0,
        createdAt: Number(row.created_at),
        lastActiveAt: Number(row.last_active_at)
      };
      this.data.users[user.id] = user;
      return user;
    } catch (err) {
      console.error("[Database] Failed to load user from PostgreSQL:", err.message);
      return void 0;
    }
  }
  findUserByGoogleId(googleId) {
    return Object.values(this.data.users).find((u) => u.googleId === googleId);
  }
  findUserByEmail(email) {
    const normalized = email.toLowerCase().trim();
    return Object.values(this.data.users).find((u) => u.email?.toLowerCase().trim() === normalized);
  }
  getAllUsers() {
    return Object.values(this.data.users);
  }
  normalizeUser(user) {
    const now = Date.now();
    return {
      ...user,
      lastActiveAt: now,
      createdAt: user.createdAt || now
    };
  }
  userUpsertQuery(user) {
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
        user.authProvider || "guest",
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
        user.lastActiveAt
      ]
    };
  }
  saveUser(user) {
    const updatedUser = this.normalizeUser(user);
    this.data.users[updatedUser.id] = updatedUser;
    this.save();
    if (this.pool) {
      const { sql, values } = this.userUpsertQuery(updatedUser);
      this.pool.query(sql, values).catch((err) => {
        console.error("[Database] Failed to upsert user in PostgreSQL:", err.message);
      });
    }
    return updatedUser;
  }
  /** Awaited user write for account creation, where losing the row is not acceptable. */
  async saveUserAwait(user) {
    const updatedUser = this.normalizeUser(user);
    this.data.users[updatedUser.id] = updatedUser;
    this.save();
    if (this.pool) {
      const { sql, values } = this.userUpsertQuery(updatedUser);
      await this.pool.query(sql, values);
    }
    return updatedUser;
  }
  updateUserStatus(id, status) {
    const user = this.data.users[id];
    if (!user) return void 0;
    user.status = status;
    this.save();
    if (this.pool) {
      this.pool.query("UPDATE users SET status = $1 WHERE id = $2", [status, id]).catch((err) => {
        console.error("[Database] Failed to update user status in PostgreSQL:", err.message);
      });
    }
    return user;
  }
  // --- Legal consent (versioned Terms / Privacy / 18+ confirmation) ---
  getConsents(userId) {
    return Object.values(this.data.consents).filter((c) => c.userId === userId);
  }
  /**
   * Records Terms acceptance and 18+ confirmation for a version, updates the
   * user row, and awaits the PostgreSQL write so callers can gate entry on it.
   */
  async acceptLegalConsent(userId, termsVersion, meta = {}) {
    const user = this.data.users[userId];
    if (!user) return void 0;
    const now = Date.now();
    const updated = {
      ...user,
      isAdultVerified: true,
      termsVersion,
      termsAcceptedAt: now,
      ageConfirmedAt: now,
      lastActiveAt: now
    };
    this.data.users[userId] = updated;
    const records = ["terms", "age"].map((kind) => ({
      id: "con_" + crypto.randomBytes(8).toString("hex"),
      userId,
      kind,
      version: termsVersion,
      acceptedAt: now,
      ipHash: meta.ipHash,
      userAgentHash: meta.userAgentHash
    }));
    for (const record of records) {
      const key = `${record.userId}:${record.kind}:${record.version}`;
      if (!this.data.consents[key]) this.data.consents[key] = record;
    }
    this.save();
    if (this.pool) {
      const client = await this.pool.connect();
      try {
        await client.query("BEGIN");
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
              record.userAgentHash || null
            ]
          );
        }
        await client.query("COMMIT");
      } catch (err) {
        await client.query("ROLLBACK").catch(() => {
        });
        throw err;
      } finally {
        client.release();
      }
    }
    return updated;
  }
  // --- Reports ---
  createReport(report) {
    const id = "rep_" + Math.random().toString(36).substring(2, 10);
    const newReport = {
      ...report,
      id,
      status: "pending",
      createdAt: Date.now()
    };
    this.data.reports[id] = newReport;
    this.save();
    if (this.pool) {
      this.pool.query(
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
          "none",
          newReport.createdAt
        ]
      ).catch((err) => {
        console.error("[Database] Failed to save user report in PostgreSQL:", err.message);
      });
    }
    return newReport;
  }
  getReports() {
    return Object.values(this.data.reports).sort((a, b) => b.createdAt - a.createdAt);
  }
  updateReportStatus(reportId, status, actionTaken, notes) {
    const report = this.data.reports[reportId];
    if (!report) return void 0;
    report.status = status;
    if (actionTaken) report.actionTaken = actionTaken;
    if (notes) report.moderatorNotes = notes;
    report.resolvedAt = Date.now();
    this.save();
    if (this.pool) {
      this.pool.query(
        `UPDATE user_reports SET
            status = $1, action_taken = $2, moderator_notes = $3, resolved_at = $4
          WHERE id = $5`,
        [status, actionTaken || "none", notes || null, report.resolvedAt, reportId]
      ).catch((err) => {
        console.error("[Database] Failed to update user report in PostgreSQL:", err.message);
      });
    }
    return report;
  }
  // --- Blocks ---
  blockUser(blockerId, blockedUserId) {
    const id = `${blockerId}_blocks_${blockedUserId}`;
    const block = {
      id,
      blockerId,
      blockedUserId,
      createdAt: Date.now()
    };
    this.data.blocks[id] = block;
    this.save();
    if (this.pool) {
      this.pool.query(
        `INSERT INTO user_blocks (id, blocker_id, blocked_user_id, created_at)
           VALUES ($1, $2, $3, $4)
           ON CONFLICT (blocker_id, blocked_user_id) DO NOTHING`,
        [block.id, blockerId, blockedUserId, block.createdAt]
      ).catch((err) => {
        console.error("[Database] Failed to save block in PostgreSQL:", err.message);
      });
    }
    return block;
  }
  unblockUser(blockerId, blockedUserId) {
    const id = `${blockerId}_blocks_${blockedUserId}`;
    if (this.data.blocks[id]) {
      delete this.data.blocks[id];
      this.save();
      if (this.pool) {
        this.pool.query("DELETE FROM user_blocks WHERE blocker_id = $1 AND blocked_user_id = $2", [
          blockerId,
          blockedUserId
        ]).catch((err) => {
          console.error("[Database] Failed to delete block in PostgreSQL:", err.message);
        });
      }
      return true;
    }
    return false;
  }
  isBlocked(userA, userB) {
    const aBlocksB = !!this.data.blocks[`${userA}_blocks_${userB}`];
    const bBlocksA = !!this.data.blocks[`${userB}_blocks_${userA}`];
    return aBlocksB || bBlocksA;
  }
  getBlockedUsers(blockerId) {
    return Object.values(this.data.blocks).filter((b) => b.blockerId === blockerId).map((b) => b.blockedUserId);
  }
  // --- User Preferences ---
  getUserPreferences(userId) {
    return this.data.preferences[userId];
  }
  saveUserPreferences(userId, prefs) {
    const existing = this.data.preferences[userId] || {
      userId,
      chatMode: "video",
      preferredGender: "any",
      preferredCountry: "GLOBAL",
      interests: [],
      interestMatchingEnabled: false,
      strictInterests: false,
      languages: [],
      primaryLanguage: "en",
      strictLanguage: false,
      priorityQueue: false,
      updatedAt: Date.now()
    };
    const updated = {
      ...existing,
      ...prefs,
      userId,
      updatedAt: Date.now()
    };
    this.data.preferences[userId] = updated;
    this.save();
    if (this.pool) {
      this.pool.query(
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
          updated.updatedAt
        ]
      ).catch((err) => {
        console.error("[Database] Failed to save user preferences in PostgreSQL:", err.message);
      });
    }
    return updated;
  }
  // --- Audit Logs ---
  addAuditLog(log) {
    const entry = {
      ...log,
      id: "log_" + Math.random().toString(36).substring(2, 10),
      createdAt: Date.now()
    };
    this.data.auditLogs.unshift(entry);
    if (this.data.auditLogs.length > 500) {
      this.data.auditLogs.pop();
    }
    this.save();
    if (this.pool) {
      this.pool.query(
        `INSERT INTO admin_audit_logs (id, admin_user_id, action, target_type, target_id, details, created_at)
           VALUES ($1, $2, $3, $4, $5, $6, $7)`,
        [
          entry.id,
          entry.adminUserId,
          entry.action,
          entry.targetType,
          entry.targetId,
          entry.details ? JSON.stringify(entry.details) : null,
          entry.createdAt
        ]
      ).catch((err) => {
        console.error("[Database] Failed to save audit log in PostgreSQL:", err.message);
      });
    }
    return entry;
  }
  getAuditLogs() {
    return this.data.auditLogs;
  }
  // --- Sessions (Guest & Auth) ---
  getSession(tokenHash) {
    const session = this.data.sessions[tokenHash];
    if (!session) return void 0;
    if (session.revoked || session.expiresAt <= Date.now()) {
      delete this.data.sessions[tokenHash];
      return void 0;
    }
    return session;
  }
  sessionInsertQuery(session) {
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
        session.lastActiveAt
      ]
    };
  }
  saveSession(session) {
    this.data.sessions[session.tokenHash] = session;
    this.save();
    if (this.pool) {
      const { sql, values } = this.sessionInsertQuery(session);
      this.pool.query(sql, values).catch((err) => {
        console.error("[Database] Failed to save session in PostgreSQL:", err.message);
      });
    }
    return session;
  }
  /** Awaited session write so a freshly minted token is durable before it is returned. */
  async saveSessionAwait(session) {
    this.data.sessions[session.tokenHash] = session;
    this.save();
    if (this.pool) {
      const { sql, values } = this.sessionInsertQuery(session);
      await this.pool.query(sql, values);
    }
    return session;
  }
  revokeSession(tokenHash) {
    const session = this.data.sessions[tokenHash];
    if (session) {
      session.revoked = true;
      delete this.data.sessions[tokenHash];
      this.save();
      if (this.pool) {
        this.pool.query("UPDATE user_sessions SET revoked = TRUE WHERE token_hash = $1", [tokenHash]).catch((err) => {
          console.error("[Database] Failed to revoke session in PostgreSQL:", err.message);
        });
      }
      return true;
    }
    return false;
  }
  /**
   * Close the PostgreSQL connection pool cleanly
   */
  async close() {
    if (this.pool) {
      await this.pool.end();
      this.pool = null;
      this.isPostgresActive = false;
    }
  }
};
var db = new Database();

// server/matchmaker.ts
var STALE_QUEUE_TIMEOUT_MS = 60 * 1e3;
function buildQueueEntry(socketId, userId, gender, country, rawPreferences) {
  const mode = rawPreferences?.mode === "text" ? "text" : "video";
  const interests = Array.isArray(rawPreferences?.interests) ? rawPreferences.interests : [];
  let preferredCountries = ["GLOBAL"];
  let preferredCountry = "GLOBAL";
  let languages = [];
  if (Array.isArray(rawPreferences?.preferredCountries) && rawPreferences.preferredCountries.length > 0) {
    preferredCountries = rawPreferences.preferredCountries;
    preferredCountry = preferredCountries[0] || "GLOBAL";
  } else if (rawPreferences?.preferredCountry) {
    preferredCountry = rawPreferences.preferredCountry;
    preferredCountries = [rawPreferences.preferredCountry];
  }
  if (Array.isArray(rawPreferences?.languages) && rawPreferences.languages.length > 0) {
    languages = rawPreferences.languages;
  } else if (Array.isArray(rawPreferences?.preferredLanguages) && rawPreferences.preferredLanguages.length > 0) {
    languages = rawPreferences.preferredLanguages;
  }
  const preferences = {
    mode,
    preferredGender: rawPreferences?.preferredGender || "any",
    preferredCountry,
    preferredCountries,
    isMultipleCountries: Boolean(rawPreferences?.isMultipleCountries),
    interests,
    languages,
    preferredLanguages: languages,
    primaryLanguage: rawPreferences?.primaryLanguage || (languages[0] || "en"),
    interestMatchingEnabled: interests.length > 0
  };
  return {
    userId,
    socketId,
    gender,
    country,
    mode,
    interests,
    languages,
    preferences,
    joinedAt: Date.now()
  };
}
function areEntriesCompatible(a, b, isBlocked = (userA, userB) => db.isBlocked(userA, userB)) {
  if (a.socketId === b.socketId || a.userId === b.userId) {
    return false;
  }
  if (isBlocked(a.userId, b.userId)) {
    return false;
  }
  const modeA = a.mode || a.preferences?.mode || "video";
  const modeB = b.mode || b.preferences?.mode || "video";
  if (modeA !== modeB) {
    return false;
  }
  if (a.preferences.preferredGender && a.preferences.preferredGender !== "any") {
    if (a.preferences.preferredGender !== b.gender) {
      return false;
    }
  }
  if (b.preferences.preferredGender && b.preferences.preferredGender !== "any") {
    if (b.preferences.preferredGender !== a.gender) {
      return false;
    }
  }
  const aCountries = a.preferences.preferredCountries || (a.preferences.preferredCountry ? [a.preferences.preferredCountry] : ["GLOBAL"]);
  const aHasCountryFilter = aCountries.length > 0 && !aCountries.includes("GLOBAL") && !aCountries.includes("any");
  if (aHasCountryFilter) {
    if (!aCountries.includes(b.country)) {
      return false;
    }
  }
  const bCountries = b.preferences.preferredCountries || (b.preferences.preferredCountry ? [b.preferences.preferredCountry] : ["GLOBAL"]);
  const bHasCountryFilter = bCountries.length > 0 && !bCountries.includes("GLOBAL") && !bCountries.includes("any");
  if (bHasCountryFilter) {
    if (!bCountries.includes(a.country)) {
      return false;
    }
  }
  const aLangs = a.preferences.languages || a.preferences.preferredLanguages || [];
  const aHasLangFilter = aLangs.length > 0 && !aLangs.includes("any");
  if (aHasLangFilter) {
    const bLanguages = b.languages || b.preferences?.languages || [];
    if (bLanguages.length > 0 && !aLangs.some((lang) => bLanguages.includes(lang))) {
      return false;
    }
  }
  const bLangs = b.preferences.languages || b.preferences.preferredLanguages || [];
  const bHasLangFilter = bLangs.length > 0 && !bLangs.includes("any");
  if (bHasLangFilter) {
    const aLanguages = a.languages || a.preferences?.languages || [];
    if (aLanguages.length > 0 && !bLangs.some((lang) => aLanguages.includes(lang))) {
      return false;
    }
  }
  return true;
}
var Matchmaker = class {
  constructor() {
    this.queue = /* @__PURE__ */ new Map();
    // socketId -> QueueEntry
    this.activeMatches = /* @__PURE__ */ new Map();
    // matchId -> ActiveMatch
    this.userToMatch = /* @__PURE__ */ new Map();
    // socketId -> matchId
    this.isProcessing = false;
    setInterval(() => this.cleanupStaleEntries(), 15e3);
  }
  /**
   * Enqueue a user into the matchmaking system.
   * All users keep their custom match preferences (gender, country, language).
   */
  enqueue(socketId, userId, gender, country, rawPreferences) {
    const user = db.getUser(userId);
    if (user && (user.status === "banned" || user.status === "suspended")) {
      return { success: false, error: `Account is ${user.status}. You cannot enter video chat.` };
    }
    this.dequeue(socketId);
    const endedMatch = this.endMatchBySocket(socketId);
    const entry = buildQueueEntry(socketId, userId, gender, country, rawPreferences);
    this.queue.set(socketId, entry);
    return { success: true, endedMatch };
  }
  dequeue(socketId) {
    return this.queue.delete(socketId);
  }
  getActiveMatches() {
    return Array.from(this.activeMatches.values());
  }
  getQueueLength() {
    return this.queue.size;
  }
  getActiveMatchesCount() {
    return this.activeMatches.size;
  }
  getQueueEntry(socketId) {
    return this.queue.get(socketId);
  }
  getMatchBySocket(socketId) {
    const matchId = this.userToMatch.get(socketId);
    if (!matchId) return void 0;
    return this.activeMatches.get(matchId);
  }
  getPeerSocket(socketId) {
    const match = this.getMatchBySocket(socketId);
    if (!match) return void 0;
    if (match.user1.socketId === socketId) return match.user2.socketId;
    if (match.user2.socketId === socketId) return match.user1.socketId;
    return void 0;
  }
  /**
   * Check if two queue entries are compatible for matching.
   */
  isCompatible(a, b) {
    return areEntriesCompatible(a, b);
  }
  /**
   * Run atomic matchmaking pass to find and create matches.
   * Returns newly established matches.
   */
  processMatches() {
    if (this.isProcessing) return [];
    this.isProcessing = true;
    const newMatches = [];
    try {
      const candidates = Array.from(this.queue.values()).sort((a, b) => a.joinedAt - b.joinedAt);
      const matchedSockets = /* @__PURE__ */ new Set();
      for (let i = 0; i < candidates.length; i++) {
        const candidateA = candidates[i];
        if (matchedSockets.has(candidateA.socketId)) continue;
        let bestCandidateB = null;
        let bestScore = -1;
        for (let j = i + 1; j < candidates.length; j++) {
          const candidateB = candidates[j];
          if (matchedSockets.has(candidateB.socketId)) continue;
          if (this.isCompatible(candidateA, candidateB)) {
            const aInterests = candidateA.interests || candidateA.preferences?.interests || [];
            const bInterests = candidateB.interests || candidateB.preferences?.interests || [];
            const sharedInterests = aInterests.filter((x) => bInterests.includes(x));
            const aLangs = candidateA.languages || candidateA.preferences?.languages || [];
            const bLangs = candidateB.languages || candidateB.preferences?.languages || [];
            const sharedLanguages = aLangs.filter((x) => bLangs.includes(x));
            const score = sharedInterests.length * 3 + sharedLanguages.length * 2;
            if (score > bestScore) {
              bestScore = score;
              bestCandidateB = candidateB;
              if (score >= 3) break;
            }
          }
        }
        if (bestCandidateB) {
          const candidateB = bestCandidateB;
          matchedSockets.add(candidateA.socketId);
          matchedSockets.add(candidateB.socketId);
          this.queue.delete(candidateA.socketId);
          this.queue.delete(candidateB.socketId);
          const aInterests = candidateA.interests || candidateA.preferences?.interests || [];
          const bInterests = candidateB.interests || candidateB.preferences?.interests || [];
          const sharedInterests = aInterests.filter((x) => bInterests.includes(x));
          const aLangs = candidateA.languages || candidateA.preferences?.languages || [];
          const bLangs = candidateB.languages || candidateB.preferences?.languages || [];
          const sharedLanguages = aLangs.filter((x) => bLangs.includes(x));
          const matchId = "match_" + Date.now() + "_" + Math.random().toString(36).substring(2, 8);
          const match = {
            matchId,
            mode: candidateA.mode || "video",
            user1: { userId: candidateA.userId, socketId: candidateA.socketId },
            user2: { userId: candidateB.userId, socketId: candidateB.socketId },
            sharedInterests,
            sharedLanguages,
            createdAt: Date.now()
          };
          this.activeMatches.set(matchId, match);
          this.userToMatch.set(candidateA.socketId, matchId);
          this.userToMatch.set(candidateB.socketId, matchId);
          newMatches.push(match);
        }
      }
    } finally {
      this.isProcessing = false;
    }
    return newMatches;
  }
  /**
   * End an active match involving a socket.
   */
  endMatchBySocket(socketId) {
    const matchId = this.userToMatch.get(socketId);
    if (!matchId) return void 0;
    const match = this.activeMatches.get(matchId);
    if (match) {
      this.userToMatch.delete(match.user1.socketId);
      this.userToMatch.delete(match.user2.socketId);
      this.activeMatches.delete(matchId);
    }
    return match;
  }
  endMatchById(matchId) {
    const match = this.activeMatches.get(matchId);
    if (match) {
      this.userToMatch.delete(match.user1.socketId);
      this.userToMatch.delete(match.user2.socketId);
      this.activeMatches.delete(matchId);
    }
    return match;
  }
  /**
   * Clean up disconnected socket completely.
   */
  handleDisconnect(socketId) {
    const wasQueued = this.dequeue(socketId);
    const endedMatch = this.endMatchBySocket(socketId);
    return { endedMatch, wasQueued };
  }
  cleanupStaleEntries() {
    const now = Date.now();
    for (const [socketId, entry] of this.queue.entries()) {
      if (now - entry.joinedAt > STALE_QUEUE_TIMEOUT_MS) {
        this.queue.delete(socketId);
      }
    }
  }
};
var matchmaker = new Matchmaker();

// server/redisMatchmaker.ts
import crypto2 from "crypto";

// server/redis.ts
import Redis from "ioredis";
var commandClient = null;
var subscriberClient = null;
var lastError = null;
function isRedisConfigured() {
  return false;
}
function buildClient() {
  const client = new Redis(process.env.REDIS_URL, {
    maxRetriesPerRequest: 2,
    enableReadyCheck: true,
    connectTimeout: 5e3,
    // Cap reconnect backoff at 5s so a brief Redis blip does not stall signaling
    retryStrategy: (times) => Math.min(times * 200, 5e3)
  });
  client.on("error", (err) => {
    lastError = err.message;
    console.error("[Redis] Connection error:", err.message);
  });
  client.on("ready", () => {
    lastError = null;
  });
  return client;
}
function getRedis() {
  if (!isRedisConfigured()) return null;
  if (!commandClient) commandClient = buildClient();
  return commandClient;
}
function getRedisSubscriber() {
  if (!isRedisConfigured()) return null;
  if (!subscriberClient) subscriberClient = buildClient();
  return subscriberClient;
}
function getRedisStatus() {
  if (!isRedisConfigured()) return "disabled";
  if (!commandClient) return "ready";
  if (lastError) return "error";
  return commandClient.status === "ready" ? "ready" : "error";
}
async function closeRedis() {
  const closing = [];
  if (subscriberClient) {
    closing.push(subscriberClient.quit().catch(() => subscriberClient?.disconnect()));
    subscriberClient = null;
  }
  if (commandClient) {
    closing.push(commandClient.quit().catch(() => commandClient?.disconnect()));
    commandClient = null;
  }
  await Promise.all(closing);
}

// server/redisMatchmaker.ts
var QUEUE_KEY = "url:queue";
var ALIVE_KEY = "url:queue:alive";
var ENTRY_PREFIX = "url:qentry:";
var MATCH_PREFIX = "url:match:";
var BLOCKS_KEY = "url:blocks";
var LOCK_KEY = "url:matchmaker:lock";
var CHANNEL_PREFIX = "url:instance:";
var ENTRY_TTL_MS = 5 * 60 * 1e3;
var MATCH_TTL_SECONDS = 60 * 60;
var STALE_AFTER_MS = 60 * 1e3;
var MATCH_PASS_BATCH = 200;
var MATCH_TTL_LOCAL_MS = 2 * 60 * 60 * 1e3;
var CLAIM_PAIR_LUA = `
local removedA = redis.call('ZREM', KEYS[1], ARGV[1])
local removedB = redis.call('ZREM', KEYS[1], ARGV[2])
if removedA == 1 and removedB == 1 then
  redis.call('ZREM', KEYS[2], ARGV[1])
  redis.call('ZREM', KEYS[2], ARGV[2])
  return 2
end
if removedA == 1 then redis.call('ZADD', KEYS[1], ARGV[3], ARGV[1]) end
if removedB == 1 then redis.call('ZADD', KEYS[1], ARGV[4], ARGV[2]) end
return removedA + removedB
`;
function entryKey(socketId) {
  return `${ENTRY_PREFIX}${socketId}`;
}
function matchKey(matchId) {
  return `${MATCH_PREFIX}${matchId}`;
}
function channelName(instanceId) {
  return `${CHANNEL_PREFIX}${instanceId}`;
}
function blockPairKey(a, b) {
  return a < b ? `${a}|${b}` : `${b}|${a}`;
}
function matchFoundPayload(match, isInitiator, peer) {
  return {
    type: "match_found",
    matchId: match.matchId,
    payload: {
      isInitiator,
      peerUserId: peer.userId,
      peerName: peer.displayName || "Anonymous User",
      peerCountry: peer.country || "GLOBAL",
      sharedInterests: match.sharedInterests || [],
      sharedLanguages: match.sharedLanguages || [],
      mode: match.mode || "video"
    }
  };
}
var RedisMatchmaker = class {
  constructor() {
    this.selfDelivering = true;
    this.instanceId = "inst_" + crypto2.randomBytes(6).toString("hex");
    this.localMatches = /* @__PURE__ */ new Map();
    this.userToMatch = /* @__PURE__ */ new Map();
    this.localQueue = /* @__PURE__ */ new Map();
    this.sink = null;
    this.sweepTimer = null;
  }
  /** Subscribes to this instance's delivery channel and starts local housekeeping. */
  init(sink) {
    this.sink = sink;
    void this.subscribe();
    this.sweepTimer = setInterval(() => {
      const cutoff = Date.now() - MATCH_TTL_LOCAL_MS;
      for (const [matchId, record] of this.localMatches.entries()) {
        if (record.registeredAt < cutoff) this.clearLocalMatch(matchId);
      }
    }, 5 * 60 * 1e3);
    if (this.sweepTimer.unref) this.sweepTimer.unref();
    return this;
  }
  getInstanceId() {
    return this.instanceId;
  }
  async subscribe() {
    const subscriber = getRedisSubscriber();
    if (!subscriber) return;
    try {
      await subscriber.subscribe(channelName(this.instanceId));
      subscriber.on("message", (_channel, raw) => {
        try {
          this.applyEnvelope(JSON.parse(raw));
        } catch (err) {
          console.error("[RedisMatchmaker] Dropped malformed relay message:", err.message);
        }
      });
    } catch (err) {
      console.error("[RedisMatchmaker] Could not subscribe to instance channel:", err.message);
    }
  }
  applyEnvelope(envelope) {
    if (envelope.clearMatchId) this.clearLocalMatch(envelope.clearMatchId);
    if (envelope.match) {
      this.registerMatch(envelope.match.match, envelope.match.instances);
    }
    if (this.sink) this.sink.deliver(envelope.targetSocketId, envelope.message);
  }
  registerMatch(match, instances) {
    if (!this.sink) return;
    if (!this.sink.isLocal(match.user1.socketId) && !this.sink.isLocal(match.user2.socketId)) {
      return;
    }
    this.localMatches.set(match.matchId, { match, instances, registeredAt: Date.now() });
    this.userToMatch.set(match.user1.socketId, match.matchId);
    this.userToMatch.set(match.user2.socketId, match.matchId);
  }
  clearLocalMatch(matchId) {
    const record = this.localMatches.get(matchId);
    if (!record) return;
    this.userToMatch.delete(record.match.user1.socketId);
    this.userToMatch.delete(record.match.user2.socketId);
    this.localMatches.delete(matchId);
  }
  async dispatch(envelope, instanceId) {
    if (instanceId === this.instanceId) {
      this.applyEnvelope(envelope);
      return;
    }
    const client = getRedis();
    if (!client) {
      this.applyEnvelope(envelope);
      return;
    }
    try {
      await client.publish(channelName(instanceId), JSON.stringify(envelope));
    } catch (err) {
      console.error("[RedisMatchmaker] Delivery publish failed:", err.message);
    }
  }
  // --- Queue operations ---
  async enqueue(socketId, userId, gender, country, rawPreferences, displayName) {
    const user = await db.ensureUser(userId);
    if (user && (user.status === "banned" || user.status === "suspended")) {
      return { success: false, error: `Account is ${user.status}. You cannot enter video chat.` };
    }
    await this.dequeue(socketId);
    const endedMatch = await this.endMatchBySocket(socketId);
    const entry = {
      ...buildQueueEntry(socketId, userId, gender, country, rawPreferences),
      instanceId: this.instanceId,
      displayName: displayName || user?.displayName
    };
    const client = getRedis();
    if (!client) return { success: false, error: "Distributed matchmaking unavailable" };
    try {
      const pipeline = client.pipeline();
      pipeline.set(entryKey(socketId), JSON.stringify(entry), "PX", ENTRY_TTL_MS);
      pipeline.zadd(QUEUE_KEY, entry.joinedAt, socketId);
      pipeline.zadd(ALIVE_KEY, Date.now(), socketId);
      await pipeline.exec();
    } catch (err) {
      console.error("[RedisMatchmaker] Enqueue failed:", err.message);
      return { success: false, error: "Could not join the queue. Please retry." };
    }
    this.localQueue.set(socketId, entry);
    return { success: true, endedMatch };
  }
  async dequeue(socketId) {
    const wasQueued = this.localQueue.delete(socketId);
    const client = getRedis();
    if (!client) return wasQueued;
    try {
      await client.multi().zrem(QUEUE_KEY, socketId).zrem(ALIVE_KEY, socketId).del(entryKey(socketId)).exec();
    } catch (err) {
      console.error("[RedisMatchmaker] Dequeue failed:", err.message);
    }
    return wasQueued;
  }
  /** Keeps a queued socket from being swept while it sits in the waiting room. */
  async touch(socketId) {
    if (!this.localQueue.has(socketId)) return;
    const client = getRedis();
    if (!client) return;
    try {
      await client.multi().zadd(ALIVE_KEY, Date.now(), socketId).pexpire(entryKey(socketId), ENTRY_TTL_MS).exec();
    } catch {
    }
  }
  // --- Matching ---
  async processMatches() {
    const client = getRedis();
    if (!client) return [];
    let isLeader = false;
    try {
      const result = await client.set(LOCK_KEY, this.instanceId, "PX", 2500, "NX");
      isLeader = result === "OK";
    } catch (err) {
      console.error("[RedisMatchmaker] Leader election failed:", err.message);
      return [];
    }
    if (!isLeader) return [];
    try {
      const staleCutoff = Date.now() - STALE_AFTER_MS;
      const stale = await client.zrangebyscore(ALIVE_KEY, "-inf", staleCutoff);
      if (stale.length > 0) {
        const cleanup = client.pipeline();
        for (const socketId of stale) {
          cleanup.zrem(QUEUE_KEY, socketId);
          cleanup.zrem(ALIVE_KEY, socketId);
          cleanup.del(entryKey(socketId));
        }
        await cleanup.exec();
      }
      const socketIds = await client.zrange(QUEUE_KEY, 0, MATCH_PASS_BATCH - 1);
      if (socketIds.length < 2) return [];
      const entriesRaw = await client.mget(socketIds.map(entryKey));
      const entries = [];
      for (let i = 0; i < entriesRaw.length; i++) {
        if (!entriesRaw[i]) {
          void client.zrem(QUEUE_KEY, socketIds[i]).catch(() => {
          });
          continue;
        }
        try {
          entries.push(JSON.parse(entriesRaw[i]));
        } catch {
          void client.zrem(QUEUE_KEY, socketIds[i]).catch(() => {
          });
        }
      }
      if (entries.length < 2) return [];
      const blockedPairs = new Set(await client.smembers(BLOCKS_KEY));
      const isBlocked = (a, b) => blockedPairs.has(blockPairKey(a, b));
      const candidates = entries.sort((a, b) => a.joinedAt - b.joinedAt);
      const matched = /* @__PURE__ */ new Set();
      const newMatches = [];
      for (let i = 0; i < candidates.length; i++) {
        const candidateA = candidates[i];
        if (matched.has(candidateA.socketId)) continue;
        let bestB = null;
        let bestScore = -1;
        for (let j = i + 1; j < candidates.length; j++) {
          const candidateB = candidates[j];
          if (matched.has(candidateB.socketId)) continue;
          if (!areEntriesCompatible(candidateA, candidateB, isBlocked)) continue;
          const sharedInterests = (candidateA.interests || []).filter(
            (x) => (candidateB.interests || []).includes(x)
          );
          const sharedLanguages = (candidateA.languages || []).filter(
            (x) => (candidateB.languages || []).includes(x)
          );
          const score = sharedInterests.length * 3 + sharedLanguages.length * 2;
          if (score > bestScore) {
            bestScore = score;
            bestB = candidateB;
            if (score >= 3) break;
          }
        }
        if (!bestB) continue;
        let claimed = 0;
        try {
          claimed = Number(
            await client.eval(
              CLAIM_PAIR_LUA,
              2,
              QUEUE_KEY,
              ALIVE_KEY,
              candidateA.socketId,
              bestB.socketId,
              String(candidateA.joinedAt),
              String(bestB.joinedAt)
            )
          );
        } catch (err) {
          console.error("[RedisMatchmaker] Atomic pair claim failed:", err.message);
          continue;
        }
        if (claimed !== 2) continue;
        matched.add(candidateA.socketId);
        matched.add(bestB.socketId);
        const match = this.createMatch(candidateA, bestB);
        const instances = { u1: candidateA.instanceId, u2: bestB.instanceId };
        const cleanup = client.pipeline();
        cleanup.del(entryKey(candidateA.socketId));
        cleanup.del(entryKey(bestB.socketId));
        cleanup.set(
          matchKey(match.matchId),
          JSON.stringify({ ...match, instances }),
          "EX",
          MATCH_TTL_SECONDS
        );
        await cleanup.exec().catch(() => {
        });
        this.localQueue.delete(candidateA.socketId);
        this.localQueue.delete(bestB.socketId);
        await this.dispatch(
          {
            targetSocketId: candidateA.socketId,
            message: matchFoundPayload(match, true, bestB),
            match: { match, instances }
          },
          candidateA.instanceId
        );
        await this.dispatch(
          {
            targetSocketId: bestB.socketId,
            message: matchFoundPayload(match, false, candidateA),
            match: { match, instances }
          },
          bestB.instanceId
        );
        newMatches.push(match);
      }
      return newMatches;
    } catch (err) {
      console.error("[RedisMatchmaker] Matching pass failed:", err.message);
      return [];
    }
  }
  createMatch(a, b) {
    const sharedInterests = (a.interests || []).filter((x) => (b.interests || []).includes(x));
    const sharedLanguages = (a.languages || []).filter((x) => (b.languages || []).includes(x));
    return {
      matchId: "match_" + Date.now() + "_" + crypto2.randomBytes(4).toString("hex"),
      mode: a.mode || "video",
      user1: { userId: a.userId, socketId: a.socketId },
      user2: { userId: b.userId, socketId: b.socketId },
      sharedInterests,
      sharedLanguages,
      createdAt: Date.now()
    };
  }
  // --- Local views (each instance only owns matches involving its sockets) ---
  getMatchBySocket(socketId) {
    const matchId = this.userToMatch.get(socketId);
    if (!matchId) return void 0;
    return this.localMatches.get(matchId)?.match;
  }
  getPeerSocket(socketId) {
    const match = this.getMatchBySocket(socketId);
    if (!match) return void 0;
    if (match.user1.socketId === socketId) return match.user2.socketId;
    if (match.user2.socketId === socketId) return match.user1.socketId;
    return void 0;
  }
  getActiveMatches() {
    return Array.from(this.localMatches.values()).map((record) => record.match);
  }
  getActiveMatchesCount() {
    return this.localMatches.size;
  }
  getQueueLength() {
    return this.localQueue.size;
  }
  async queueLength() {
    const client = getRedis();
    if (!client) return this.localQueue.size;
    try {
      return await client.zcard(QUEUE_KEY);
    } catch {
      return this.localQueue.size;
    }
  }
  /** Relays a message to the peer of an active match, across instances. */
  async sendToMatchPeer(match, fromSocketId, message) {
    const peer = match.user1.socketId === fromSocketId ? match.user2 : match.user1;
    const record = this.localMatches.get(match.matchId);
    const peerInstance = record ? record.match.user1.socketId === peer.socketId ? record.instances.u1 : record.instances.u2 : this.instanceId;
    await this.dispatch(
      {
        targetSocketId: peer.socketId,
        message,
        clearMatchId: message.type === "peer_disconnected" ? match.matchId : void 0
      },
      peerInstance
    );
  }
  async endMatchBySocket(socketId) {
    const matchId = this.userToMatch.get(socketId);
    if (!matchId) return void 0;
    return this.endMatchById(matchId);
  }
  async endMatchById(matchId) {
    const record = this.localMatches.get(matchId);
    this.clearLocalMatch(matchId);
    const client = getRedis();
    if (client) {
      await client.del(matchKey(matchId)).catch(() => {
      });
    }
    return record?.match;
  }
  async handleDisconnect(socketId) {
    const wasQueued = await this.dequeue(socketId);
    const endedMatch = await this.endMatchBySocket(socketId);
    return { endedMatch, wasQueued };
  }
  /** Records a block so every instance excludes the pair from matching. */
  async recordBlock(userA, userB) {
    const client = getRedis();
    if (!client) return;
    await client.sadd(BLOCKS_KEY, blockPairKey(userA, userB)).catch(() => {
    });
  }
  async removeBlock(userA, userB) {
    const client = getRedis();
    if (!client) return;
    await client.srem(BLOCKS_KEY, blockPairKey(userA, userB)).catch(() => {
    });
  }
  async close() {
    if (this.sweepTimer) clearInterval(this.sweepTimer);
    const subscriber = getRedisSubscriber();
    if (subscriber) {
      await subscriber.unsubscribe(channelName(this.instanceId)).catch(() => {
      });
    }
  }
};

// server/matchmaking.ts
var LocalEngine = class {
  constructor() {
    this.selfDelivering = false;
    this.sink = null;
  }
  init(sink) {
    this.sink = sink;
    return this;
  }
  async enqueue(socketId, userId, gender, country, preferences) {
    return matchmaker.enqueue(socketId, userId, gender, country, preferences);
  }
  async dequeue(socketId) {
    return matchmaker.dequeue(socketId);
  }
  async touch() {
  }
  async processMatches() {
    return matchmaker.processMatches();
  }
  async endMatchById(matchId) {
    return matchmaker.endMatchById(matchId);
  }
  async endMatchBySocket(socketId) {
    return matchmaker.endMatchBySocket(socketId);
  }
  async handleDisconnect(socketId) {
    return matchmaker.handleDisconnect(socketId);
  }
  async sendToMatchPeer(match, fromSocketId, message) {
    const peer = match.user1.socketId === fromSocketId ? match.user2.socketId : match.user1.socketId;
    this.sink?.deliver(peer, message);
  }
  getMatchBySocket(socketId) {
    return matchmaker.getMatchBySocket(socketId);
  }
  getPeerSocket(socketId) {
    return matchmaker.getPeerSocket(socketId);
  }
  getActiveMatches() {
    return matchmaker.getActiveMatches();
  }
  getActiveMatchesCount() {
    return matchmaker.getActiveMatchesCount();
  }
  getQueueLength() {
    return matchmaker.getQueueLength();
  }
  async queueLength() {
    return matchmaker.getQueueLength();
  }
  async close() {
  }
};
var engine = null;
function getMatchmaking() {
  if (!engine) {
    engine = isRedisConfigured() ? new RedisMatchmaker() : new LocalEngine();
  }
  return engine;
}
function syncBlock(userA, userB, blocked) {
  if (!(engine instanceof RedisMatchmaker)) return;
  const action = blocked ? engine.recordBlock(userA, userB) : engine.removeBlock(userA, userB);
  void action.catch(() => {
  });
}

// server/webrtc.ts
import { WebSocket } from "ws";
import { z } from "zod";

// server/auth.ts
import crypto3 from "crypto";
var SESSION_SECRET = process.env.SESSION_SECRET || (process.env.NODE_ENV === "production" && !process.env.VERCEL ? (() => {
  throw new Error("SESSION_SECRET environment variable is required in production");
})() : "dev_session_secret_u_r_live_secure_key_2026");
var DEFAULT_SESSION_DURATION_MS = 30 * 24 * 60 * 60 * 1e3;
var GUEST_SESSION_DURATION_MS = 24 * 60 * 60 * 1e3;
function createSessionToken(userId, role = "user", durationMs = DEFAULT_SESSION_DURATION_MS) {
  const payload = {
    userId,
    role,
    createdAt: Date.now(),
    expiresAt: Date.now() + durationMs,
    nonce: crypto3.randomBytes(8).toString("hex")
  };
  const encodedPayload = Buffer.from(JSON.stringify(payload)).toString("base64url");
  const signature = crypto3.createHmac("sha256", SESSION_SECRET).update(encodedPayload).digest("base64url");
  return `${encodedPayload}.${signature}`;
}
function verifySessionToken(token) {
  if (!token || typeof token !== "string") return null;
  const parts = token.trim().split(".");
  if (parts.length !== 2) return null;
  const [encodedPayload, signature] = parts;
  try {
    const expectedSignature = crypto3.createHmac("sha256", SESSION_SECRET).update(encodedPayload).digest("base64url");
    if (signature.length !== expectedSignature.length || !crypto3.timingSafeEqual(Buffer.from(signature), Buffer.from(expectedSignature))) {
      return null;
    }
    const payload = JSON.parse(
      Buffer.from(encodedPayload, "base64url").toString("utf-8")
    );
    if (!payload.userId || !payload.role || !payload.expiresAt) {
      return null;
    }
    if (Date.now() > payload.expiresAt) {
      return null;
    }
    const tokenHash = crypto3.createHash("sha256").update(token).digest("hex");
    const sessionRecord = db.getSession(tokenHash);
    if (sessionRecord && (sessionRecord.revoked || sessionRecord.expiresAt <= Date.now())) {
      return null;
    }
    return payload;
  } catch {
    return null;
  }
}
function extractSessionToken(req) {
  const authHeader = req.headers.authorization;
  if (authHeader && authHeader.startsWith("Bearer ")) {
    const token = authHeader.substring(7).trim();
    if (token) return token;
  }
  const customHeader = req.headers["x-session-token"];
  if (typeof customHeader === "string" && customHeader.trim()) {
    return customHeader.trim();
  }
  return null;
}
function hashAuditValue(value) {
  if (!value) return void 0;
  return crypto3.createHmac("sha256", SESSION_SECRET).update(value).digest("hex");
}
function peekSessionUser(req) {
  const token = extractSessionToken(req);
  if (!token) return null;
  const payload = verifySessionToken(token);
  if (!payload) return null;
  const user = db.getUser(payload.userId);
  if (!user || user.role !== payload.role) return null;
  return user;
}
function resolveSessionUser(req) {
  const token = extractSessionToken(req);
  if (token) {
    const payload = verifySessionToken(token);
    if (payload) {
      const existing = db.getUser(payload.userId);
      if (existing) {
        if (existing.role === payload.role) {
          const now2 = Date.now();
          if (now2 - (existing.lastActiveAt || 0) > 2 * 60 * 1e3) {
            existing.lastActiveAt = now2;
            db.saveUser(existing);
            const tokenHash2 = crypto3.createHash("sha256").update(token).digest("hex");
            const sess = db.getSession(tokenHash2);
            if (sess) {
              sess.lastActiveAt = now2;
              db.saveSession(sess);
            }
          }
          return { user: existing, sessionToken: token, isNew: false };
        }
      }
    }
  }
  const now = Date.now();
  const guestId = "guest_" + crypto3.randomBytes(6).toString("hex");
  const guestUser = {
    id: guestId,
    displayName: "Stranger " + Math.floor(1e3 + Math.random() * 9e3),
    authProvider: "guest",
    gender: "unspecified",
    country: "GLOBAL",
    isAdultVerified: false,
    role: "user",
    status: "active",
    createdAt: now,
    lastActiveAt: now
  };
  db.saveUser(guestUser);
  const sessionToken = createSessionToken(guestUser.id, "user", GUEST_SESSION_DURATION_MS);
  const tokenHash = crypto3.createHash("sha256").update(sessionToken).digest("hex");
  db.saveSession({
    id: "sess_" + crypto3.randomBytes(8).toString("hex"),
    userId: guestUser.id,
    tokenHash,
    role: "user",
    isGuest: true,
    createdAt: now,
    expiresAt: now + GUEST_SESSION_DURATION_MS,
    revoked: false,
    lastActiveAt: now
  });
  return { user: guestUser, sessionToken, isNew: true };
}
function requireAdmin(req, res, next) {
  const token = extractSessionToken(req);
  if (!token) {
    res.status(401).json({ error: "Authentication required. Missing session token." });
    return;
  }
  const payload = verifySessionToken(token);
  if (!payload || payload.role !== "admin") {
    res.status(403).json({ error: "Unauthorized. Admin privileges required." });
    return;
  }
  const user = db.getUser(payload.userId);
  if (!user || user.role !== "admin" || user.status !== "active") {
    res.status(403).json({ error: "Unauthorized. Active admin account required." });
    return;
  }
  req.user = user;
  next();
}

// server/rateLimit.ts
var RateLimiter = class {
  constructor() {
    this.store = /* @__PURE__ */ new Map();
    this.activeSocketsPerIp = /* @__PURE__ */ new Map();
    this.cleanupInterval = null;
    this.cleanupInterval = setInterval(() => {
      this.cleanup();
    }, 5 * 60 * 1e3);
    if (this.cleanupInterval.unref) {
      this.cleanupInterval.unref();
    }
  }
  cleanup(maxAgeMs = 15 * 60 * 1e3) {
    const now = Date.now();
    for (const [key, record] of this.store.entries()) {
      if (now - record.windowStart > maxAgeMs) {
        this.store.delete(key);
      }
    }
  }
  reset() {
    this.store.clear();
    this.activeSocketsPerIp.clear();
  }
  /**
   * Generic sliding window rate limiter
   */
  checkLimit(key, maxRequests, windowMs) {
    const now = Date.now();
    let record = this.store.get(key);
    if (!record || now - record.windowStart > windowMs) {
      record = { count: 1, windowStart: now };
      this.store.set(key, record);
      return { allowed: true, remaining: maxRequests - 1, retryAfterSeconds: 0 };
    }
    if (record.count >= maxRequests) {
      const retryAfterSeconds = Math.ceil((record.windowStart + windowMs - now) / 1e3);
      return { allowed: false, remaining: 0, retryAfterSeconds: Math.max(1, retryAfterSeconds) };
    }
    record.count++;
    return {
      allowed: true,
      remaining: maxRequests - record.count,
      retryAfterSeconds: 0
    };
  }
  /**
   * Minimum interval cooldown check (e.g. minimum 1.5s between skips)
   */
  checkCooldown(key, minIntervalMs) {
    const now = Date.now();
    const record = this.store.get(key);
    if (!record || !record.lastActionAt) {
      this.store.set(key, { count: 1, windowStart: now, lastActionAt: now });
      return { allowed: true, retryAfterMs: 0 };
    }
    const elapsed = now - record.lastActionAt;
    if (elapsed < minIntervalMs) {
      return { allowed: false, retryAfterMs: minIntervalMs - elapsed };
    }
    record.lastActionAt = now;
    return { allowed: true, retryAfterMs: 0 };
  }
  /**
   * WebSocket Connection Limiter per IP
   */
  trackWsConnection(ip, maxConcurrent = 5, maxPerMinute = 20) {
    const now = Date.now();
    const freqKey = `ws_freq_${ip}`;
    const freq = this.checkLimit(freqKey, maxPerMinute, 60 * 1e3);
    if (!freq.allowed) {
      return {
        allowed: false,
        reason: `Connection frequency limit exceeded. Please wait ${freq.retryAfterSeconds}s before reconnecting.`
      };
    }
    const currentActive = this.activeSocketsPerIp.get(ip) || 0;
    if (currentActive >= maxConcurrent) {
      return {
        allowed: false,
        reason: `Too many concurrent connections from your network (maximum ${maxConcurrent}).`
      };
    }
    this.activeSocketsPerIp.set(ip, currentActive + 1);
    return { allowed: true };
  }
  releaseWsConnection(ip) {
    const current = this.activeSocketsPerIp.get(ip) || 1;
    if (current <= 1) {
      this.activeSocketsPerIp.delete(ip);
    } else {
      this.activeSocketsPerIp.set(ip, current - 1);
    }
  }
  getActiveWsCount(ip) {
    return this.activeSocketsPerIp.get(ip) || 0;
  }
};
var rateLimiter = new RateLimiter();
function getClientIp(req) {
  const cfIp = req.headers["cf-connecting-ip"];
  if (typeof cfIp === "string" && cfIp.trim()) {
    return cfIp.trim();
  }
  const forwarded = req.headers["x-forwarded-for"];
  if (typeof forwarded === "string") {
    const first = forwarded.split(",")[0].trim();
    if (first) return first;
  }
  return req.ip || req.socket?.remoteAddress || "127.0.0.1";
}
function createRateLimitMiddleware(options) {
  const {
    max,
    windowMs,
    message = "Too many requests. Please slow down and try again.",
    prefix = "rl",
    keyGenerator = (req) => `${prefix}_${getClientIp(req)}`
  } = options;
  return (req, res, next) => {
    const key = keyGenerator(req);
    const result = rateLimiter.checkLimit(key, max, windowMs);
    res.setHeader("X-RateLimit-Limit", max);
    res.setHeader("X-RateLimit-Remaining", Math.max(0, result.remaining));
    if (!result.allowed) {
      res.setHeader("Retry-After", result.retryAfterSeconds);
      res.status(429).json({
        error: message,
        code: "RATE_LIMIT_EXCEEDED",
        retryAfter: result.retryAfterSeconds
      });
      return;
    }
    next();
  };
}
var guestSessionRateLimit = createRateLimitMiddleware({
  max: 15,
  // Max 15 guest session creations
  windowMs: 5 * 60 * 1e3,
  // per 5 minutes per IP
  prefix: "guest_session",
  message: "Too many guest sessions initiated from your network. Please wait a few minutes."
});
var reportRateLimit = createRateLimitMiddleware({
  max: 5,
  // Max 5 reports
  windowMs: 10 * 60 * 1e3,
  // per 10 minutes per IP/user
  prefix: "report_sub",
  keyGenerator: (req) => {
    const ip = getClientIp(req);
    const authHeader = req.headers.authorization || "";
    return `report_${ip}_${authHeader.slice(-16)}`;
  },
  message: "You have submitted several reports recently. Please wait before reporting again."
});
var adminLoginRateLimit = createRateLimitMiddleware({
  max: 5,
  // Max 5 admin login attempts
  windowMs: 15 * 60 * 1e3,
  // per 15 minutes
  prefix: "admin_login",
  message: "Too many admin authentication attempts. Please wait 15 minutes before trying again."
});
var standardApiRateLimit = createRateLimitMiddleware({
  max: 120,
  // Max 120 requests
  windowMs: 60 * 1e3,
  // per 1 minute
  prefix: "api_std",
  message: "Rate limit exceeded. Please slow down your requests."
});
function createDistributedRateLimit(options) {
  const { max, windowMs, prefix, message = "Too many requests. Please slow down and try again." } = options;
  const fallback = createRateLimitMiddleware({ max, windowMs, prefix, message });
  return async (req, res, next) => {
    const client = getRedis();
    if (!client) {
      fallback(req, res, next);
      return;
    }
    const windowIndex = Math.floor(Date.now() / windowMs);
    const key = `url:rl:${prefix}:${getClientIp(req)}:${windowIndex}`;
    try {
      const count = await client.incr(key);
      if (count === 1) await client.pexpire(key, windowMs);
      res.setHeader("X-RateLimit-Limit", max);
      res.setHeader("X-RateLimit-Remaining", Math.max(0, max - count));
      if (count > max) {
        const ttlMs = await client.pttl(key);
        res.setHeader("Retry-After", Math.max(1, Math.ceil(ttlMs / 1e3)));
        res.status(429).json({
          error: message,
          code: "RATE_LIMIT_EXCEEDED",
          retryAfter: Math.max(1, Math.ceil(ttlMs / 1e3))
        });
        return;
      }
      next();
    } catch {
      fallback(req, res, next);
    }
  };
}
var distributedApiRateLimit = createDistributedRateLimit({
  max: 120,
  windowMs: 60 * 1e3,
  prefix: "api_std",
  message: "Rate limit exceeded. Please slow down your requests."
});

// server/webrtc.ts
var MATCH_CONNECT_TIMEOUT_MS = 45 * 1e3;
var MAX_SIGNALING_MESSAGE_BYTES = 64 * 1024;
var MAX_MESSAGES_PER_10S = 200;
var MAX_CHAT_MESSAGES_PER_MINUTE = 20;
var languageListSchema = z.array(z.string().trim().min(1).max(24)).max(10);
var preferencesSchema = z.object({
  preferredGender: z.enum(["any", "male", "female"]).optional(),
  preferredCountry: z.string().max(40).optional(),
  preferredCountries: z.array(z.string().max(40)).max(12).optional(),
  isMultipleCountries: z.boolean().optional(),
  languages: languageListSchema.optional(),
  preferredLanguages: languageListSchema.optional(),
  interests: z.array(z.string().trim().min(1).max(40)).max(20).optional()
});
var matchIdSchema = z.string().min(1).max(64);
var sdpSchema = z.object({
  type: z.string().max(16).optional(),
  sdp: z.string().max(32768).optional()
});
var iceCandidateSchema = z.object({
  candidate: z.string().max(4096).optional(),
  sdpMid: z.string().max(64).nullish(),
  sdpMLineIndex: z.number().int().min(0).max(64).nullish(),
  usernameFragment: z.string().max(256).nullish()
});
var signalingMessageSchema = z.discriminatedUnion("type", [
  z.object({ type: z.literal("ping") }),
  z.object({
    type: z.literal("join_queue"),
    payload: z.object({
      sessionToken: z.string().min(10).max(2048),
      gender: z.enum(["unspecified", "male", "female", "non-binary"]).optional(),
      country: z.string().max(40).optional(),
      preferences: preferencesSchema.optional()
    })
  }),
  z.object({ type: z.literal("leave_queue") }),
  z.object({ type: z.literal("offer"), matchId: matchIdSchema, payload: sdpSchema }),
  z.object({ type: z.literal("answer"), matchId: matchIdSchema, payload: sdpSchema }),
  z.object({ type: z.literal("ice_candidate"), matchId: matchIdSchema, payload: iceCandidateSchema }),
  z.object({
    type: z.literal("chat_message"),
    matchId: matchIdSchema,
    payload: z.object({
      text: z.string().trim().min(1).max(500),
      senderId: z.string().max(64).optional()
    })
  }),
  z.object({
    type: z.literal("typing"),
    matchId: matchIdSchema,
    payload: z.object({ isTyping: z.boolean() })
  }),
  z.object({
    type: z.literal("media_state"),
    matchId: matchIdSchema,
    payload: z.object({ connected: z.boolean() })
  }),
  z.object({
    type: z.literal("skip_match"),
    payload: z.object({
      findNext: z.boolean().optional(),
      preferences: preferencesSchema.optional()
    }).optional()
  })
]);
function setupSignaling(wss2) {
  const clients = /* @__PURE__ */ new Map();
  const connectedMatches = /* @__PURE__ */ new Set();
  function sendToSocket(socketId, message) {
    const client = clients.get(socketId);
    if (client && client.readyState === WebSocket.OPEN) {
      client.send(JSON.stringify(message));
    }
  }
  const engine2 = getMatchmaking().init({
    deliver: sendToSocket,
    isLocal: (socketId) => clients.has(socketId)
  });
  async function notifyMatchPeer(match, fromSocketId, reason) {
    connectedMatches.delete(match.matchId);
    await engine2.sendToMatchPeer(match, fromSocketId, {
      type: "peer_disconnected",
      matchId: match.matchId,
      payload: { reason }
    });
  }
  function broadcastMatch(match) {
    const u1Profile = db.getUser(match.user1.userId);
    const u2Profile = db.getUser(match.user2.userId);
    sendToSocket(match.user1.socketId, {
      type: "match_found",
      matchId: match.matchId,
      payload: {
        isInitiator: true,
        peerUserId: match.user2.userId,
        peerName: u2Profile?.displayName || "Anonymous User",
        peerCountry: u2Profile?.country || "GLOBAL",
        sharedInterests: match.sharedInterests || [],
        sharedLanguages: match.sharedLanguages || [],
        mode: match.mode || "video"
      }
    });
    sendToSocket(match.user2.socketId, {
      type: "match_found",
      matchId: match.matchId,
      payload: {
        isInitiator: false,
        peerUserId: match.user1.userId,
        peerName: u1Profile?.displayName || "Anonymous User",
        peerCountry: u1Profile?.country || "GLOBAL",
        sharedInterests: match.sharedInterests || [],
        sharedLanguages: match.sharedLanguages || [],
        mode: match.mode || "video"
      }
    });
  }
  async function runMatchingPass() {
    const newMatches = await engine2.processMatches();
    if (!engine2.selfDelivering) {
      for (const match of newMatches) broadcastMatch(match);
    }
    return newMatches;
  }
  const matchInterval = setInterval(() => {
    void runMatchingPass().catch((err) => {
      console.error("Periodic matchmaking error:", err);
    });
  }, 2500);
  const watchdogInterval = setInterval(() => {
    void (async () => {
      const now = Date.now();
      for (const match of engine2.getActiveMatches()) {
        if (now - match.createdAt < MATCH_CONNECT_TIMEOUT_MS) continue;
        if (connectedMatches.has(match.matchId)) continue;
        const timeoutMessage = {
          type: "peer_disconnected",
          matchId: match.matchId,
          payload: { reason: "connection_timeout" }
        };
        await engine2.sendToMatchPeer(match, match.user1.socketId, timeoutMessage).catch(() => {
        });
        await engine2.sendToMatchPeer(match, match.user2.socketId, timeoutMessage).catch(() => {
        });
        const ended = await engine2.endMatchById(match.matchId);
        if (!ended) continue;
        connectedMatches.delete(ended.matchId);
      }
    })().catch((err) => {
      console.error("Match watchdog error:", err);
    });
  }, 1e4);
  const interval = setInterval(() => {
    wss2.clients.forEach((ws) => {
      const client = ws;
      if (!client.isAlive) {
        client.terminate();
        return;
      }
      client.isAlive = false;
      client.ping();
    });
  }, 3e4);
  wss2.on("close", () => {
    clearInterval(interval);
    clearInterval(matchInterval);
    clearInterval(watchdogInterval);
    void engine2.close().catch(() => {
    });
  });
  wss2.on("connection", (ws, req) => {
    const client = ws;
    client.id = "sock_" + Math.random().toString(36).substring(2, 10);
    client.isAlive = true;
    const forwarded = req?.headers?.["x-forwarded-for"];
    const clientIp = (typeof forwarded === "string" ? forwarded.split(",")[0].trim() : void 0) || req?.socket?.remoteAddress || "127.0.0.1";
    client.clientIp = clientIp;
    const connCheck = rateLimiter.trackWsConnection(clientIp, 5, 20);
    if (!connCheck.allowed) {
      client.send(
        JSON.stringify({
          type: "error",
          payload: { code: "RATE_LIMIT_EXCEEDED", message: connCheck.reason || "Too Many Requests" }
        })
      );
      client.close(4429, "Rate limit exceeded");
      return;
    }
    clients.set(client.id, client);
    client.on("pong", () => {
      client.isAlive = true;
    });
    client.on("message", async (data) => {
      try {
        const rawString = typeof data === "string" ? data : data.toString();
        if (rawString.length > MAX_SIGNALING_MESSAGE_BYTES) {
          client.send(
            JSON.stringify({
              type: "error",
              payload: { code: "PAYLOAD_TOO_LARGE", message: "Signaling message exceeds size limit" }
            })
          );
          return;
        }
        const messageRate = rateLimiter.checkLimit(
          `ws_msg_${client.id}`,
          MAX_MESSAGES_PER_10S,
          10 * 1e3
        );
        if (!messageRate.allowed) {
          client.send(
            JSON.stringify({
              type: "error",
              payload: {
                code: "RATE_LIMIT_EXCEEDED",
                message: "Too many signaling messages. Please slow down."
              }
            })
          );
          return;
        }
        let json;
        try {
          json = JSON.parse(rawString);
        } catch {
          client.send(
            JSON.stringify({
              type: "error",
              payload: { code: "INVALID_JSON", message: "Malformed signaling message" }
            })
          );
          return;
        }
        const parsed = signalingMessageSchema.safeParse(json);
        if (!parsed.success) {
          client.send(
            JSON.stringify({
              type: "error",
              payload: { code: "INVALID_MESSAGE", message: "Unsupported or invalid signaling message" }
            })
          );
          return;
        }
        const msg = parsed.data;
        switch (msg.type) {
          case "ping":
            client.send(JSON.stringify({ type: "pong" }));
            void engine2.touch(client.id);
            break;
          case "join_queue": {
            const { sessionToken, gender, country, preferences } = msg.payload || {};
            if (!sessionToken) {
              client.send(
                JSON.stringify({
                  type: "error",
                  payload: {
                    code: "AUTH_REQUIRED",
                    message: "Authentication failed: Missing session token"
                  }
                })
              );
              return;
            }
            const verified = verifySessionToken(sessionToken);
            if (!verified) {
              client.send(
                JSON.stringify({
                  type: "error",
                  payload: {
                    code: "INVALID_TOKEN",
                    message: "Authentication failed: Invalid or expired session token"
                  }
                })
              );
              return;
            }
            const verifiedUserId = verified.userId;
            client.userId = verifiedUserId;
            const userProfile = await db.ensureUser(verifiedUserId);
            if (userProfile && (userProfile.status === "banned" || userProfile.status === "suspended")) {
              client.send(
                JSON.stringify({
                  type: "error",
                  payload: {
                    code: "ACCOUNT_BANNED",
                    message: "Your account has been suspended or banned for safety violations."
                  }
                })
              );
              client.close(4403, "Account suspended");
              return;
            }
            const joinCheck = rateLimiter.checkLimit(`ws_join_${verifiedUserId}`, 15, 60 * 1e3);
            if (!joinCheck.allowed) {
              client.send(
                JSON.stringify({
                  type: "error",
                  payload: {
                    code: "RATE_LIMIT_EXCEEDED",
                    message: `Queue join rate limit exceeded. Please wait ${joinCheck.retryAfterSeconds}s before searching again.`
                  }
                })
              );
              return;
            }
            const priorMatch = engine2.getMatchBySocket(client.id);
            if (priorMatch) await notifyMatchPeer(priorMatch, client.id, "peer_restarted");
            const res = await engine2.enqueue(
              client.id,
              verifiedUserId,
              gender || userProfile?.gender || "unspecified",
              country || userProfile?.country || "GLOBAL",
              preferences || {},
              userProfile?.displayName
            );
            if (!res.success) {
              client.send(
                JSON.stringify({
                  type: "error",
                  payload: { message: res.error || "Failed to join queue" }
                })
              );
              return;
            }
            client.send(
              JSON.stringify({
                type: "queue_status",
                payload: { status: "waiting", queueLength: await engine2.queueLength() }
              })
            );
            await runMatchingPass();
            break;
          }
          case "leave_queue": {
            const match = engine2.getMatchBySocket(client.id);
            if (match) await notifyMatchPeer(match, client.id, "peer_left");
            await engine2.endMatchBySocket(client.id);
            await engine2.dequeue(client.id);
            client.send(
              JSON.stringify({
                type: "queue_status",
                payload: { status: "idle" }
              })
            );
            break;
          }
          case "offer":
          case "answer": {
            const currentMatch = engine2.getMatchBySocket(client.id);
            if (currentMatch && currentMatch.matchId === msg.matchId) {
              await engine2.sendToMatchPeer(currentMatch, client.id, {
                type: msg.type,
                matchId: msg.matchId,
                payload: msg.payload
              });
            }
            break;
          }
          case "ice_candidate": {
            const currentMatch = engine2.getMatchBySocket(client.id);
            if (currentMatch && currentMatch.matchId === msg.matchId) {
              await engine2.sendToMatchPeer(currentMatch, client.id, {
                type: "ice_candidate",
                matchId: msg.matchId,
                payload: msg.payload
              });
            }
            break;
          }
          case "chat_message": {
            if (client.userId) {
              const chatRate = rateLimiter.checkLimit(
                `ws_chat_${client.userId}`,
                MAX_CHAT_MESSAGES_PER_MINUTE,
                60 * 1e3
              );
              if (!chatRate.allowed) {
                client.send(
                  JSON.stringify({
                    type: "error",
                    payload: {
                      code: "RATE_LIMIT_EXCEEDED",
                      message: `You are sending messages too quickly. Wait ${chatRate.retryAfterSeconds}s.`
                    }
                  })
                );
                break;
              }
            }
            const currentMatch = engine2.getMatchBySocket(client.id);
            if (currentMatch && currentMatch.matchId === msg.matchId) {
              await engine2.sendToMatchPeer(currentMatch, client.id, {
                type: "chat_message",
                matchId: msg.matchId,
                payload: {
                  senderId: client.userId,
                  text: msg.payload?.text ?? "",
                  timestamp: Date.now()
                }
              });
            }
            break;
          }
          case "typing": {
            const currentMatch = engine2.getMatchBySocket(client.id);
            if (currentMatch && currentMatch.matchId === msg.matchId) {
              await engine2.sendToMatchPeer(currentMatch, client.id, {
                type: "typing",
                matchId: msg.matchId,
                payload: { isTyping: Boolean(msg.payload?.isTyping) }
              });
            }
            break;
          }
          case "media_state": {
            const currentMatch = engine2.getMatchBySocket(client.id);
            if (currentMatch && currentMatch.matchId === msg.matchId && msg.payload?.connected) {
              connectedMatches.add(currentMatch.matchId);
            }
            break;
          }
          case "skip_match": {
            if (client.userId) {
              const cd = rateLimiter.checkCooldown(`ws_skip_cd_${client.userId}`, 1500);
              if (!cd.allowed) {
                client.send(
                  JSON.stringify({
                    type: "error",
                    payload: {
                      code: "COOLDOWN_ACTIVE",
                      message: "You are skipping too quickly. Please wait a moment before skipping again."
                    }
                  })
                );
                return;
              }
              const freq = rateLimiter.checkLimit(`ws_skip_freq_${client.userId}`, 15, 120 * 1e3);
              if (!freq.allowed) {
                client.send(
                  JSON.stringify({
                    type: "error",
                    payload: {
                      code: "RATE_LIMIT_EXCEEDED",
                      message: `Skip rate limit exceeded. Please wait ${freq.retryAfterSeconds}s before finding another match.`
                    }
                  })
                );
                return;
              }
            }
            const match = engine2.getMatchBySocket(client.id);
            if (match) await notifyMatchPeer(match, client.id, "skipped_by_peer");
            await engine2.endMatchBySocket(client.id);
            await engine2.dequeue(client.id);
            client.send(
              JSON.stringify({
                type: "match_ended",
                payload: { reason: "skipped" }
              })
            );
            if (msg.payload?.findNext && client.userId) {
              const u = await db.ensureUser(client.userId);
              await engine2.enqueue(
                client.id,
                client.userId,
                u?.gender || "unspecified",
                u?.country || "GLOBAL",
                msg.payload?.preferences || {},
                u?.displayName
              );
              client.send(
                JSON.stringify({
                  type: "queue_status",
                  payload: { status: "waiting", queueLength: await engine2.queueLength() }
                })
              );
              await runMatchingPass();
            }
            break;
          }
          default:
            break;
        }
      } catch (err) {
        console.error("Error handling WebSocket message:", err);
      }
    });
    client.on("close", async () => {
      if (client.clientIp) {
        rateLimiter.releaseWsConnection(client.clientIp);
      }
      try {
        const match = engine2.getMatchBySocket(client.id);
        if (match) await notifyMatchPeer(match, client.id, "peer_closed_browser");
        const { endedMatch } = await engine2.handleDisconnect(client.id);
        connectedMatches.delete(endedMatch?.matchId || "");
      } catch (err) {
        console.error("Error cleaning up closed socket:", err.message);
      } finally {
        clients.delete(client.id);
      }
    });
    client.on("error", (err) => {
      console.warn(`WebSocket client ${client.id} error:`, err);
    });
  });
}

// server/httpSignaling.ts
var HttpSignalingManager = class {
  constructor() {
    this.queue = /* @__PURE__ */ new Map();
    this.matches = /* @__PURE__ */ new Map();
    this.userToMatch = /* @__PURE__ */ new Map();
  }
  /**
   * Prune stale entries (users who stopped polling > 20s ago, matches idle > 60s)
   */
  pruneStale() {
    const now = Date.now();
    for (const [userId, user] of this.queue.entries()) {
      if (now - user.lastPoll > 2e4) {
        this.queue.delete(userId);
      }
    }
    for (const [matchId, match] of this.matches.entries()) {
      if (now - match.lastActivity > 6e4) {
        this.userToMatch.delete(match.initiatorId);
        this.userToMatch.delete(match.responderId);
        this.matches.delete(matchId);
      }
    }
  }
  joinQueue(userId, country = "GLOBAL", gender = "unspecified", preferences) {
    this.pruneStale();
    this.leave(userId);
    const candidateEntry = buildQueueEntry(
      "http_" + userId,
      userId,
      gender,
      country,
      preferences
    );
    for (const [otherId, other] of this.queue.entries()) {
      if (otherId === userId) continue;
      const otherEntry = buildQueueEntry(
        "http_" + other.userId,
        other.userId,
        other.gender,
        other.country,
        other.preferences
      );
      if (areEntriesCompatible(candidateEntry, otherEntry)) {
        this.queue.delete(otherId);
        const matchId = "m_" + Date.now() + "_" + Math.random().toString(36).slice(2, 7);
        const candInterests = candidateEntry.interests || [];
        const othInterests = otherEntry.interests || [];
        const sharedInterests = candInterests.filter(
          (i) => othInterests.includes(i)
        );
        const match = {
          matchId,
          initiatorId: other.userId,
          // older waiting user initiates WebRTC offer
          responderId: userId,
          initiatorCountry: other.country,
          responderCountry: country,
          initiatorInterests: othInterests,
          responderInterests: candInterests,
          createdAt: Date.now(),
          lastActivity: Date.now(),
          messagesForInitiator: [],
          messagesForResponder: []
        };
        this.matches.set(matchId, match);
        this.userToMatch.set(other.userId, matchId);
        this.userToMatch.set(userId, matchId);
        return {
          status: "matched",
          matchId,
          isInitiator: false,
          peerUserId: other.userId,
          peerCountry: other.country,
          sharedInterests
        };
      }
    }
    this.queue.set(userId, {
      userId,
      country,
      gender,
      preferences,
      joinedAt: Date.now(),
      lastPoll: Date.now()
    });
    return { status: "waiting" };
  }
  poll(userId) {
    this.pruneStale();
    const matchId = this.userToMatch.get(userId);
    if (matchId) {
      const match = this.matches.get(matchId);
      if (match) {
        match.lastActivity = Date.now();
        const isInitiator = match.initiatorId === userId;
        const msgQueue = isInitiator ? match.messagesForInitiator : match.messagesForResponder;
        const messages = [...msgQueue];
        msgQueue.length = 0;
        const peerUserId = isInitiator ? match.responderId : match.initiatorId;
        const peerCountry = isInitiator ? match.responderCountry : match.initiatorCountry;
        const sharedInterests = match.initiatorInterests.filter(
          (i) => match.responderInterests.includes(i)
        );
        return {
          status: "in_match",
          matchId,
          isInitiator,
          peerUserId,
          peerCountry,
          sharedInterests,
          messages
        };
      }
    }
    const queueUser = this.queue.get(userId);
    if (queueUser) {
      queueUser.lastPoll = Date.now();
      return { status: "waiting" };
    }
    return { status: "idle" };
  }
  sendSignal(matchId, senderId, message) {
    const match = this.matches.get(matchId);
    if (!match) return false;
    match.lastActivity = Date.now();
    const isSenderInitiator = match.initiatorId === senderId;
    const targetQueue = isSenderInitiator ? match.messagesForResponder : match.messagesForInitiator;
    targetQueue.push(message);
    return true;
  }
  leave(userId) {
    this.queue.delete(userId);
    const matchId = this.userToMatch.get(userId);
    if (matchId) {
      this.userToMatch.delete(userId);
      const match = this.matches.get(matchId);
      if (match) {
        const isInitiator = match.initiatorId === userId;
        const otherId = isInitiator ? match.responderId : match.initiatorId;
        this.userToMatch.delete(otherId);
        const otherQueue = isInitiator ? match.messagesForResponder : match.messagesForInitiator;
        otherQueue.push({ type: "peer_disconnected", reason: "Stranger disconnected." });
        setTimeout(() => {
          this.matches.delete(matchId);
        }, 5e3);
      }
    }
  }
};
var httpSignaling = new HttpSignalingManager();

// server/googleAuth.ts
import crypto4 from "crypto";
var CERTS_URL = "https://www.googleapis.com/oauth2/v3/certs";
var CERT_TTL_MS = 60 * 60 * 1e3;
var ALLOWED_ISSUERS = /* @__PURE__ */ new Set(["accounts.google.com", "https://accounts.google.com"]);
var cache = null;
var inFlight = null;
async function loadCerts() {
  if (cache && Date.now() - cache.fetchedAt < CERT_TTL_MS) return cache;
  if (inFlight) return inFlight;
  inFlight = (async () => {
    const res = await fetch(CERTS_URL);
    if (!res.ok) throw new Error(`Google JWKS request failed (${res.status})`);
    const body = await res.json();
    const keys = (body.keys || []).filter((k) => k.kty === "RSA" && k.kid && k.n && k.e).map((k) => ({
      kid: k.kid,
      alg: k.alg || "RS256",
      pem: crypto4.createPublicKey({ key: { kty: k.kty, n: k.n, e: k.e }, format: "jwk" }).export({ type: "spki", format: "pem" }).toString()
    }));
    cache = { fetchedAt: Date.now(), keys };
    return cache;
  })();
  try {
    return await inFlight;
  } finally {
    inFlight = null;
  }
}
function decodeJson(segment) {
  return JSON.parse(Buffer.from(segment, "base64url").toString("utf-8"));
}
async function verifyGoogleIdToken(credential, clientId) {
  if (!clientId) throw new Error("Google sign-in is not configured");
  const parts = credential.split(".");
  if (parts.length !== 3) throw new Error("Malformed Google credential");
  const [encodedHeader, encodedPayload, encodedSignature] = parts;
  const header = decodeJson(encodedHeader);
  const payload = decodeJson(encodedPayload);
  if (header.alg !== "RS256" || !header.kid) throw new Error("Unsupported Google token algorithm");
  const certs = await loadCerts();
  const key = certs.keys.find((entry) => entry.kid === header.kid);
  if (!key) throw new Error("Unknown Google signing key");
  const valid = crypto4.verify(
    "RSA-SHA256",
    Buffer.from(`${encodedHeader}.${encodedPayload}`),
    key.pem,
    Buffer.from(encodedSignature, "base64url")
  );
  if (!valid) throw new Error("Invalid Google token signature");
  if (!ALLOWED_ISSUERS.has(payload.iss)) throw new Error("Invalid Google token issuer");
  if (payload.aud !== clientId) throw new Error("Google token audience mismatch");
  if (!payload.exp || payload.exp * 1e3 <= Date.now()) throw new Error("Google token expired");
  if (!payload.sub || !payload.email) throw new Error("Google token missing identity claims");
  if (payload.email_verified === false) throw new Error("Google email is not verified");
  return {
    sub: String(payload.sub),
    email: String(payload.email),
    emailVerified: payload.email_verified !== false,
    name: String(payload.name || payload.email.split("@")[0]),
    picture: payload.picture ? String(payload.picture) : void 0
  };
}

// server/turnstile.ts
var TURNSTILE_VERIFY_URL = "https://challenges.cloudflare.com/turnstile/v0/siteverify";
var DEFAULT_TIMEOUT_MS = 5e3;
async function verifyTurnstileToken(token, clientIp, timeoutMs = DEFAULT_TIMEOUT_MS) {
  const secretKey = process.env.TURNSTILE_SECRET_KEY;
  const isRequired = process.env.TURNSTILE_REQUIRED === "true";
  const shouldFailOpen = process.env.TURNSTILE_FAIL_OPEN !== "false";
  if (!secretKey) {
    if (isRequired && process.env.NODE_ENV === "production") {
      return {
        success: false,
        error: "Turnstile verification is required but TURNSTILE_SECRET_KEY is not configured on server"
      };
    }
    return { success: true, bypassed: true };
  }
  if (!token || typeof token !== "string" || !token.trim()) {
    return {
      success: false,
      error: "Turnstile verification token is missing or empty"
    };
  }
  if (token === "cf_test_always_pass" || token === "1x0000000000000000000000000000000AA") {
    return { success: true, hostname: "localhost", bypassed: true };
  }
  if (token === "cf_test_always_fail" || token === "2x0000000000000000000000000000000AA") {
    return { success: false, error: "Turnstile challenge failed (invalid-test-response)" };
  }
  try {
    const formData = new URLSearchParams();
    formData.append("secret", secretKey);
    formData.append("response", token.trim());
    if (clientIp) {
      formData.append("remoteip", clientIp);
    }
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), timeoutMs);
    let response;
    try {
      response = await fetch(TURNSTILE_VERIFY_URL, {
        method: "POST",
        headers: {
          "Content-Type": "application/x-www-form-urlencoded"
        },
        body: formData.toString(),
        signal: controller.signal
      });
    } finally {
      clearTimeout(timeoutId);
    }
    if (!response.ok) {
      if (shouldFailOpen && response.status >= 500) {
        console.warn(`[Turnstile] Cloudflare 5xx upstream outage (${response.status}), failing open`);
        return { success: true, failOpen: true };
      }
      return {
        success: false,
        error: `Cloudflare Turnstile API error (${response.status})`
      };
    }
    const data = await response.json();
    if (data.success) {
      return {
        success: true,
        hostname: data.hostname,
        challengeTs: data.challenge_ts
      };
    }
    const errorCodes = Array.isArray(data["error-codes"]) ? data["error-codes"].join(", ") : "invalid-token";
    return {
      success: false,
      error: `Turnstile challenge verification failed: ${errorCodes}`
    };
  } catch (err) {
    if (err.name === "AbortError" || err.message?.includes("timeout") || err.message?.includes("fetch failed")) {
      if (shouldFailOpen) {
        console.warn("[Turnstile] Cloudflare verification timed out / unreachable, failing open:", err.message);
        return { success: true, failOpen: true };
      }
      return {
        success: false,
        error: "Bot verification service timed out. Please try again."
      };
    }
    return {
      success: false,
      error: `Turnstile verification error: ${err.message}`
    };
  }
}
function requireTurnstile(options = {}) {
  const { optionalIfUnconfigured = true } = options;
  return async (req, res, next) => {
    const secretKey = process.env.TURNSTILE_SECRET_KEY;
    if (!secretKey && optionalIfUnconfigured && process.env.NODE_ENV !== "production") {
      return next();
    }
    const token = req.body?.turnstileToken || req.headers["x-turnstile-token"] || req.headers["cf-turnstile-response"];
    const clientIp = getClientIp(req);
    const result = await verifyTurnstileToken(token, clientIp);
    if (!result.success) {
      res.status(403).json({
        error: result.error || "Turnstile verification failed",
        code: "BOT_VERIFICATION_REQUIRED"
      });
      return;
    }
    req.turnstile = result;
    next();
  };
}

// server.ts
var PORT = Number(process.env.PORT) || 3e3;
var LEGAL_TERMS_VERSION = process.env.LEGAL_TERMS_VERSION || "2026-10-28";
function revokePresentedSession(req) {
  const token = extractSessionToken(req);
  if (!token) return;
  const tokenHash = crypto5.createHash("sha256").update(token).digest("hex");
  db.revokeSession(tokenHash);
}
var app = express();
app.set("trust proxy", 1);
app.disable("x-powered-by");
app.use(
  helmet({
    contentSecurityPolicy: process.env.NODE_ENV === "production" ? {
      useDefaults: false,
      directives: {
        defaultSrc: ["'self'"],
        baseUri: ["'self'"],
        objectSrc: ["'none'"],
        scriptSrc: [
          "'self'",
          // Inline JSON-LD + Google Identity Services
          "'unsafe-inline'",
          "https://accounts.google.com",
          "https://www.gstatic.com"
        ],
        styleSrc: ["'self'", "'unsafe-inline'"],
        imgSrc: ["'self'", "data:", "blob:", "https:"],
        fontSrc: ["'self'", "data:"],
        connectSrc: ["'self'", "https:", "wss:", "ws:"],
        mediaSrc: ["'self'", "blob:"],
        frameSrc: ["https://accounts.google.com"],
        workerSrc: ["'self'", "blob:"],
        formAction: ["'self'"],
        frameAncestors: ["'none'"],
        upgradeInsecureRequests: []
      }
    } : false,
    // Google Identity Services opens its own popup and posts back to the opener
    crossOriginOpenerPolicy: { policy: "same-origin-allow-popups" },
    crossOriginEmbedderPolicy: false,
    crossOriginResourcePolicy: { policy: "cross-origin" },
    referrerPolicy: { policy: "strict-origin-when-cross-origin" }
  })
);
app.use(compression());
var corsAllowedOrigins = (process.env.CORS_ORIGINS || "").split(",").map((o) => o.trim().replace(/\/+$/, "")).filter(Boolean);
app.use("/api", (req, res, next) => {
  const origin = req.headers.origin;
  const host = req.headers.host;
  const isSameOrigin = Boolean(
    origin && host && (origin === `http://${host}` || origin === `https://${host}` || origin === `http://${host.replace(/:\d+$/, "")}` || origin === `https://${host.replace(/:\d+$/, "")}`)
  );
  const isVercelOrigin = Boolean(
    origin && (origin.endsWith(".vercel.app") || origin === "https://u-r-live.vercel.app")
  );
  const allowed = !origin || isSameOrigin || isVercelOrigin || corsAllowedOrigins.length === 0 || corsAllowedOrigins.includes("*") || corsAllowedOrigins.includes(origin.replace(/\/+$/, ""));
  if (allowed) {
    if (origin) res.setHeader("Access-Control-Allow-Origin", origin);
    res.setHeader("Vary", "Origin");
    res.setHeader("Access-Control-Allow-Methods", "GET,POST,PUT,PATCH,DELETE,OPTIONS");
    res.setHeader(
      "Access-Control-Allow-Headers",
      "Content-Type,Authorization,x-session-token,x-user-id"
    );
  }
  if (req.method === "OPTIONS") {
    res.status(allowed ? 204 : 403).end();
    return;
  }
  if (origin && !allowed) {
    res.status(403).json({ error: "Origin not allowed" });
    return;
  }
  next();
});
var server = http.createServer(app);
app.use(
  express.json({
    limit: "256kb",
    verify: (req, _res, buf) => {
      req.rawBody = buf.toString("utf-8");
    }
  })
);
app.use("/api", distributedApiRateLimit);
app.get("/api/config", (_req, res) => {
  res.json({
    googleClientId: process.env.GOOGLE_CLIENT_ID || null,
    termsVersion: LEGAL_TERMS_VERSION,
    turnstileSiteKey: process.env.TURNSTILE_SITE_KEY || null,
    siteUrl: process.env.PUBLIC_URL || process.env.RENDER_EXTERNAL_URL || null
  });
});
app.get("/api/legal/status", (req, res) => {
  const user = peekSessionUser(req);
  res.json({
    currentVersion: LEGAL_TERMS_VERSION,
    acceptedVersion: user?.termsVersion ?? null,
    needsAcceptance: user?.termsVersion !== LEGAL_TERMS_VERSION
  });
});
app.post("/api/legal/accept", async (req, res) => {
  const schema = z2.object({
    termsVersion: z2.string().min(1).max(32),
    ageConfirmed: z2.boolean()
  });
  const parsed = schema.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.issues[0]?.message || "Invalid consent payload" });
    return;
  }
  if (!parsed.data.ageConfirmed) {
    res.status(400).json({ error: "You must confirm you are at least 18 years old.", code: "AGE_NOT_CONFIRMED" });
    return;
  }
  if (parsed.data.termsVersion !== LEGAL_TERMS_VERSION) {
    res.status(409).json({
      error: "Our Terms have been updated. Reload the page to review and accept the current version.",
      code: "TERMS_VERSION_MISMATCH",
      currentVersion: LEGAL_TERMS_VERSION
    });
    return;
  }
  const session = resolveSessionUser(req);
  try {
    const updated = await db.acceptLegalConsent(session.user.id, LEGAL_TERMS_VERSION, {
      ipHash: hashAuditValue(req.ip),
      userAgentHash: hashAuditValue(req.get("user-agent"))
    });
    if (!updated) {
      res.status(404).json({ error: "Session not found. Please reload the page." });
      return;
    }
    res.json({
      user: updated,
      sessionToken: session.sessionToken,
      acceptedAt: updated.termsAcceptedAt
    });
  } catch (err) {
    console.error("[Legal] Failed to record consent:", err.message);
    res.status(503).json({ error: "Could not record your consent. Please try again." });
  }
});
app.get("/api/auth/session", (req, res) => {
  const session = resolveSessionUser(req);
  res.json({
    user: session.user,
    sessionToken: session.sessionToken
  });
});
app.post("/api/auth/login", guestSessionRateLimit, (req, res) => {
  const schema = z2.object({
    displayName: z2.string().min(2).max(30).optional(),
    gender: z2.enum(["unspecified", "male", "female", "non-binary"]).optional(),
    country: z2.string().optional(),
    isAdultVerified: z2.boolean().optional()
  });
  const parsed = schema.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.issues[0]?.message || "Invalid parameters" });
    return;
  }
  const { displayName, gender, country, isAdultVerified } = parsed.data;
  const session = resolveSessionUser(req);
  const current = session.user;
  const updated = db.saveUser({
    ...current,
    displayName: displayName || current.displayName,
    gender: gender || current.gender,
    country: country || current.country,
    isAdultVerified: isAdultVerified ?? current.isAdultVerified
  });
  res.json({
    user: updated,
    sessionToken: session.sessionToken
  });
});
app.get("/api/user/preferences", (req, res) => {
  const session = resolveSessionUser(req);
  const preferences = db.getUserPreferences(session.user.id);
  res.json({
    preferences: preferences || null
  });
});
app.post("/api/user/preferences", (req, res) => {
  const session = resolveSessionUser(req);
  const schema = z2.object({
    preferredCountry: z2.string().optional(),
    preferredCountries: z2.array(z2.string()).optional(),
    isMultipleCountries: z2.boolean().optional(),
    languages: z2.array(z2.string()).optional(),
    preferredLanguages: z2.array(z2.string()).optional(),
    preferredGender: z2.enum(["any", "male", "female"]).optional(),
    chatMode: z2.enum(["video", "text"]).optional(),
    interests: z2.array(z2.string()).optional()
  });
  const parsed = schema.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.issues[0]?.message || "Invalid parameters" });
    return;
  }
  const data = parsed.data;
  const updated = db.saveUserPreferences(session.user.id, {
    chatMode: data.chatMode || "video",
    preferredGender: data.preferredGender || "any",
    preferredCountry: data.preferredCountry || "GLOBAL",
    preferredCountries: data.preferredCountries || ["GLOBAL"],
    isMultipleCountries: Boolean(data.isMultipleCountries),
    languages: data.languages || data.preferredLanguages || [],
    preferredLanguages: data.preferredLanguages || data.languages || [],
    interests: data.interests || []
  });
  res.json({
    success: true,
    preferences: updated
  });
});
app.post("/api/user/preferences/reset", (req, res) => {
  const session = resolveSessionUser(req);
  const reset = db.saveUserPreferences(session.user.id, {
    preferredCountry: "GLOBAL",
    preferredCountries: ["GLOBAL"],
    isMultipleCountries: false,
    languages: ["en"],
    preferredLanguages: ["en"],
    preferredGender: "any",
    interests: [],
    interestMatchingEnabled: false
  });
  res.json({
    success: true,
    preferences: reset
  });
});
app.post("/api/auth/admin-login", adminLoginRateLimit, (req, res) => {
  const schema = z2.object({
    adminKey: z2.string().min(1, "Admin key is required")
  });
  const parsed = schema.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.issues[0]?.message || "Admin key is required" });
    return;
  }
  const configuredKey = process.env.ADMIN_SECRET_KEY;
  if (!configuredKey) {
    res.status(503).json({
      error: "Admin access is disabled. ADMIN_SECRET_KEY is not configured in the server environment."
    });
    return;
  }
  const providedKey = parsed.data.adminKey;
  let isMatch = false;
  try {
    isMatch = providedKey.length === configuredKey.length && crypto5.timingSafeEqual(Buffer.from(providedKey), Buffer.from(configuredKey));
  } catch {
    isMatch = false;
  }
  if (!isMatch) {
    res.status(401).json({ error: "Invalid admin credentials" });
    return;
  }
  let adminUser = db.getUser("admin-root-001");
  if (!adminUser) {
    adminUser = db.saveUser({
      id: "admin-root-001",
      displayName: "Safety Admin",
      gender: "unspecified",
      country: "IN",
      isAdultVerified: true,
      role: "admin",
      status: "active",
      createdAt: Date.now(),
      lastActiveAt: Date.now()
    });
  }
  revokePresentedSession(req);
  const sessionToken = createSessionToken(adminUser.id, "admin");
  res.json({
    user: adminUser,
    sessionToken
  });
});
app.post("/api/auth/google", async (req, res) => {
  const clientId = process.env.GOOGLE_CLIENT_ID;
  if (!clientId) {
    res.status(503).json({
      error: "Google sign-in is not enabled on this server.",
      code: "GOOGLE_NOT_CONFIGURED"
    });
    return;
  }
  const schema = z2.object({
    credential: z2.string().min(40).max(8192),
    termsVersion: z2.string().min(1).max(32),
    ageConfirmed: z2.boolean()
  });
  const parsed = schema.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.issues[0]?.message || "Invalid Google sign-in payload" });
    return;
  }
  if (!parsed.data.ageConfirmed) {
    res.status(400).json({ error: "You must confirm you are at least 18 years old.", code: "AGE_NOT_CONFIRMED" });
    return;
  }
  if (parsed.data.termsVersion !== LEGAL_TERMS_VERSION) {
    res.status(409).json({
      error: "Our Terms have been updated. Reload the page to review and accept the current version.",
      code: "TERMS_VERSION_MISMATCH",
      currentVersion: LEGAL_TERMS_VERSION
    });
    return;
  }
  let claims;
  try {
    claims = await verifyGoogleIdToken(parsed.data.credential, clientId);
  } catch (err) {
    res.status(401).json({ error: "Google sign-in could not be verified. Please try again.", code: "GOOGLE_TOKEN_INVALID" });
    return;
  }
  let user = db.findUserByGoogleId(claims.sub) || db.findUserByEmail(claims.email);
  if (user) {
    if (user.status !== "active") {
      res.status(403).json({ error: "This account is not available. Contact support." });
      return;
    }
    user = await db.saveUserAwait({
      ...user,
      displayName: user.displayName || claims.name,
      avatarUrl: claims.picture || user.avatarUrl,
      googleId: claims.sub,
      email: claims.email,
      authProvider: "google",
      lastActiveAt: Date.now()
    });
  } else {
    const now = Date.now();
    user = await db.saveUserAwait({
      id: "usr_g_" + crypto5.randomBytes(8).toString("hex"),
      displayName: claims.name.slice(0, 100),
      email: claims.email,
      avatarUrl: claims.picture,
      googleId: claims.sub,
      authProvider: "google",
      gender: "unspecified",
      country: "GLOBAL",
      isAdultVerified: false,
      role: "user",
      status: "active",
      createdAt: now,
      lastActiveAt: now
    });
  }
  try {
    const consented = await db.acceptLegalConsent(user.id, LEGAL_TERMS_VERSION, {
      ipHash: hashAuditValue(req.ip),
      userAgentHash: hashAuditValue(req.get("user-agent"))
    });
    if (consented) user = consented;
  } catch (err) {
    console.error("[Auth] Failed to record Google consent:", err.message);
    res.status(503).json({ error: "Could not record your consent. Please try again." });
    return;
  }
  revokePresentedSession(req);
  const sessionToken = createSessionToken(user.id, user.role);
  res.json({
    user,
    sessionToken
  });
});
app.post("/api/profile/update", (req, res) => {
  const session = resolveSessionUser(req);
  const user = session.user;
  const schema = z2.object({
    displayName: z2.string().min(2).max(30).optional(),
    gender: z2.enum(["unspecified", "male", "female", "non-binary"]).optional(),
    country: z2.string().min(2).max(40).optional(),
    isAdultVerified: z2.boolean().optional()
  });
  const parsed = schema.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.issues[0]?.message || "Invalid parameters" });
    return;
  }
  const updated = db.saveUser({
    ...user,
    displayName: parsed.data.displayName || user.displayName,
    gender: parsed.data.gender || user.gender,
    country: parsed.data.country || user.country,
    isAdultVerified: parsed.data.isAdultVerified ?? user.isAdultVerified
  });
  res.json({
    user: updated,
    sessionToken: session.sessionToken
  });
});
var reportHandler = async (req, res) => {
  const session = resolveSessionUser(req);
  const reporter = session.user;
  const schema = z2.object({
    reportedUserId: z2.string().min(1, "reportedUserId is required"),
    reportedUserName: z2.string().optional(),
    category: z2.enum([
      "harassment",
      "suspected_underage",
      "sexual_misconduct",
      "threats_abuse",
      "scam_spam",
      "non_consensual",
      "other"
    ]),
    description: z2.string().max(1e3).default(""),
    sessionId: z2.string().optional(),
    turnstileToken: z2.string().optional()
  });
  const parsed = schema.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.issues[0]?.message || "Invalid report fields" });
    return;
  }
  const { reportedUserId, reportedUserName, category, description, sessionId } = parsed.data;
  if (reporter.id === reportedUserId) {
    res.status(400).json({ error: "You cannot report yourself" });
    return;
  }
  const targetUser = db.getUser(reportedUserId);
  if (!targetUser) {
    res.status(404).json({ error: "Reported user does not exist or has been deleted" });
    return;
  }
  const existingReports = db.getReports();
  const hasDuplicate = existingReports.some(
    (r) => r.reporterId === reporter.id && r.reportedUserId === reportedUserId && r.status === "pending" && Date.now() - r.createdAt < 24 * 60 * 60 * 1e3
  );
  if (hasDuplicate) {
    res.status(409).json({
      error: "You have already submitted a report for this user that is currently under review.",
      code: "DUPLICATE_REPORT"
    });
    return;
  }
  const report = db.createReport({
    reporterId: reporter.id,
    reporterName: reporter.displayName,
    reportedUserId,
    reportedUserName: targetUser.displayName || reportedUserName || "Anonymous User",
    category,
    description,
    sessionId
  });
  db.blockUser(reporter.id, reportedUserId);
  syncBlock(reporter.id, reportedUserId, true);
  db.addAuditLog({
    adminUserId: "system",
    action: "report_created",
    targetType: "report",
    targetId: report.id,
    details: {
      reporterId: reporter.id,
      reportedUserId,
      category
    }
  });
  res.json({
    success: true,
    message: "Report submitted successfully. Thank you for keeping our community safe.",
    reportId: report.id
  });
};
app.post("/api/safety/report", reportRateLimit, requireTurnstile(), reportHandler);
app.post("/api/reports", reportRateLimit, requireTurnstile(), reportHandler);
app.post("/api/safety/block", (req, res) => {
  const session = resolveSessionUser(req);
  const blocker = session.user;
  const schema = z2.object({
    blockedUserId: z2.string().min(1, "blockedUserId is required")
  });
  const parsed = schema.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: "blockedUserId is required" });
    return;
  }
  if (blocker.id === parsed.data.blockedUserId) {
    res.status(400).json({ error: "You cannot block yourself" });
    return;
  }
  const target = db.getUser(parsed.data.blockedUserId);
  if (!target) {
    res.status(404).json({ error: "User to block not found" });
    return;
  }
  const block = db.blockUser(blocker.id, parsed.data.blockedUserId);
  syncBlock(blocker.id, parsed.data.blockedUserId, true);
  db.addAuditLog({
    adminUserId: blocker.id,
    action: "user_blocked",
    targetType: "user",
    targetId: parsed.data.blockedUserId,
    details: { blockerId: blocker.id }
  });
  res.json({ success: true, block });
});
app.post("/api/safety/unblock", (req, res) => {
  const session = resolveSessionUser(req);
  const blocker = session.user;
  const schema = z2.object({
    blockedUserId: z2.string()
  });
  const parsed = schema.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: "blockedUserId is required" });
    return;
  }
  const unblocked = db.unblockUser(blocker.id, parsed.data.blockedUserId);
  if (unblocked) syncBlock(blocker.id, parsed.data.blockedUserId, false);
  res.json({ success: unblocked });
});
app.get("/api/safety/blocks", (req, res) => {
  const session = resolveSessionUser(req);
  const user = session.user;
  const blockedIds = db.getBlockedUsers(user.id);
  res.json({ blockedUserIds: blockedIds });
});
app.post("/api/blocks", (req, res) => {
  const session = resolveSessionUser(req);
  const blocker = session.user;
  const { blockedUserId } = req.body || {};
  if (!blockedUserId) {
    res.status(400).json({ error: "blockedUserId is required" });
    return;
  }
  if (blocker.id === blockedUserId) {
    res.status(400).json({ error: "You cannot block yourself" });
    return;
  }
  const block = db.blockUser(blocker.id, blockedUserId);
  syncBlock(blocker.id, blockedUserId, true);
  res.json({ success: true, block });
});
app.get("/api/blocks", (req, res) => {
  const session = resolveSessionUser(req);
  res.json({ blockedUserIds: db.getBlockedUsers(session.user.id) });
});
app.get("/api/admin/overview", requireAdmin, (_req, res) => {
  const users = db.getAllUsers();
  const reports = db.getReports();
  const queueLength = getMatchmaking().getQueueLength();
  const activeMatches = getMatchmaking().getActiveMatchesCount();
  res.json({
    totalUsers: users.length,
    activeQueueLength: queueLength,
    activeMatchesCount: activeMatches,
    pendingReportsCount: reports.filter((r) => r.status === "pending").length,
    totalReportsCount: reports.length
  });
});
app.get("/api/admin/reports", requireAdmin, (_req, res) => {
  const reports = db.getReports();
  res.json({ reports });
});
app.post("/api/admin/reports/:reportId/action", requireAdmin, (req, res) => {
  const admin = req.user;
  const { reportId } = req.params;
  const schema = z2.object({
    status: z2.enum(["pending", "reviewed", "resolved", "dismissed", "escalated"]),
    actionTaken: z2.enum(["none", "warned", "suspended", "banned"]).optional(),
    notes: z2.string().optional()
  });
  const parsed = schema.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: "Invalid action parameters" });
    return;
  }
  const updated = db.updateReportStatus(
    reportId,
    parsed.data.status,
    parsed.data.actionTaken,
    parsed.data.notes
  );
  if (!updated) {
    res.status(404).json({ error: "Report not found" });
    return;
  }
  if (parsed.data.actionTaken === "banned") {
    db.updateUserStatus(updated.reportedUserId, "banned");
  } else if (parsed.data.actionTaken === "suspended") {
    db.updateUserStatus(updated.reportedUserId, "suspended");
  }
  db.addAuditLog({
    adminUserId: admin.id,
    action: `report_${parsed.data.status}`,
    targetType: "report",
    targetId: reportId,
    details: { actionTaken: parsed.data.actionTaken, targetUser: updated.reportedUserId }
  });
  res.json({ success: true, report: updated });
});
app.get("/api/admin/users", requireAdmin, (_req, res) => {
  const users = db.getAllUsers();
  res.json({ users });
});
app.post("/api/admin/users/:userId/status", requireAdmin, (req, res) => {
  const admin = req.user;
  const { userId } = req.params;
  const schema = z2.object({
    status: z2.enum(["active", "suspended", "banned"])
  });
  const parsed = schema.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: "Invalid status" });
    return;
  }
  const updated = db.updateUserStatus(userId, parsed.data.status);
  if (!updated) {
    res.status(404).json({ error: "User not found" });
    return;
  }
  db.addAuditLog({
    adminUserId: admin.id,
    action: `user_status_${parsed.data.status}`,
    targetType: "user",
    targetId: userId
  });
  res.json({ success: true, user: updated });
});
app.get("/api/admin/audit-logs", requireAdmin, (_req, res) => {
  res.json({ logs: db.getAuditLogs() });
});
app.get("/api/webrtc/ice-servers", (_req, res) => {
  const iceServers = [
    { urls: "stun:stun.l.google.com:19302" },
    { urls: "stun:stun1.l.google.com:19302" },
    { urls: "stun:stun2.l.google.com:19302" }
  ];
  if (process.env.TURN_URL && process.env.TURN_USERNAME && process.env.TURN_CREDENTIAL) {
    iceServers.push({
      urls: process.env.TURN_URL,
      username: process.env.TURN_USERNAME,
      credential: process.env.TURN_CREDENTIAL
    });
  }
  res.json({ iceServers });
});
app.get("/api/system/health", async (_req, res) => {
  res.setHeader("Cache-Control", "public, max-age=3, stale-while-revalidate=10");
  res.json({
    status: "healthy",
    timestamp: Date.now(),
    uptimeSeconds: Math.floor(process.uptime()),
    queueLength: await getMatchmaking().queueLength(),
    activeMatches: getMatchmaking().getActiveMatchesCount(),
    turnConfigured: !!process.env.TURN_URL,
    presence: getRedisStatus()
  });
});
app.get("/healthz", (_req, res) => {
  res.status(200).json({ status: "ok", uptimeSeconds: Math.floor(process.uptime()) });
});
app.get("/readyz", async (_req, res) => {
  res.status(200).json({
    status: "ready",
    mode: "in-memory-zero-storage"
  });
});
app.post("/api/match/join", (req, res) => {
  const { userId, country, gender, preferences } = req.body || {};
  if (!userId) {
    return res.status(400).json({ error: "userId is required" });
  }
  const result = httpSignaling.joinQueue(userId, country, gender, preferences);
  res.json(result);
});
app.get("/api/match/poll", (req, res) => {
  const userId = req.query.userId;
  if (!userId) {
    return res.status(400).json({ error: "userId is required" });
  }
  const result = httpSignaling.poll(userId);
  res.json(result);
});
app.post("/api/match/signal", (req, res) => {
  const { matchId, senderId, message } = req.body || {};
  if (!matchId || !senderId || !message) {
    return res.status(400).json({ error: "matchId, senderId and message are required" });
  }
  const ok = httpSignaling.sendSignal(matchId, senderId, message);
  res.json({ ok });
});
app.post("/api/match/leave", (req, res) => {
  const { userId } = req.body || {};
  if (userId) {
    httpSignaling.leave(userId);
  }
  res.json({ ok: true });
});
var wss = new WebSocketServer2(process.env.VERCEL ? { noServer: true } : { server, path: "/ws" });
if (!process.env.VERCEL) {
  setupSignaling(wss);
}
app.use("/api", (_req, res) => {
  res.status(404).json({ error: "Not found" });
});
async function startServer() {
  if (process.env.NODE_ENV !== "production") {
    const { createServer: createViteServer } = await import("vite");
    const vite = await createViteServer({
      server: {
        middlewareMode: true,
        watch: {
          ignored: ["**/.data/**", "**/.git/**", "**/*.json", "**/server/tests/**", "**/*.log"]
        }
      },
      appType: "spa"
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path2.resolve(process.cwd(), "dist");
    const sendHtml = (res, file, status = 200) => {
      res.status(status).sendFile(file, {
        headers: { "Cache-Control": "public, max-age=0, must-revalidate" }
      });
    };
    app.use(
      "/assets",
      express.static(path2.join(distPath, "assets"), {
        immutable: true,
        maxAge: "1y",
        fallthrough: false
      })
    );
    app.use(express.static(distPath, { index: false, maxAge: "1h", redirect: false }));
    app.get("*", (req, res) => {
      let pathname;
      try {
        pathname = decodeURIComponent(req.path);
      } catch {
        pathname = req.path;
      }
      if (pathname.length > 1 && pathname.endsWith("/")) {
        res.redirect(301, pathname.replace(/\/+$/, ""));
        return;
      }
      if (pathname === "/live" || pathname === "/admin") {
        sendHtml(res, path2.join(distPath, pathname.slice(1), "index.html"));
        return;
      }
      const cleanPath = pathname.replace(/\/+$/, "") || "/";
      if (cleanPath.includes("..") || cleanPath.includes("\0")) {
        sendHtml(res, path2.join(distPath, "404.html"), 404);
        return;
      }
      const prerendered = cleanPath === "/" ? path2.join(distPath, "index.html") : path2.join(distPath, cleanPath, "index.html");
      if (fs.existsSync(prerendered)) {
        sendHtml(res, prerendered);
        return;
      }
      sendHtml(res, path2.join(distPath, "404.html"), 404);
    });
  }
  server.listen(PORT, "0.0.0.0", () => {
    console.log(`U-R-LIVE server listening on port ${PORT}`);
  });
}
async function shutdown(signal) {
  console.log(`[Server] ${signal} received. Draining connections...`);
  for (const client of wss.clients) {
    try {
      client.close(1001, "Server restarting");
    } catch {
    }
  }
  wss.close();
  await new Promise((resolve) => server.close(() => resolve()));
  await closeRedis().catch(() => {
  });
  await db.close().catch(() => {
  });
  console.log("[Server] Shutdown complete.");
  process.exit(0);
}
if (process.env.NODE_ENV !== "test" && !process.env.VERCEL) {
  startServer();
  let shuttingDown = false;
  const handleSignal = (signal) => {
    if (shuttingDown) return;
    shuttingDown = true;
    const forcedExit = setTimeout(() => {
      console.error("[Server] Forced exit after shutdown timeout.");
      process.exit(1);
    }, 15e3);
    forcedExit.unref();
    shutdown(signal).catch((err) => {
      console.error("[Server] Shutdown failed:", err);
      process.exit(1);
    });
  };
  process.on("SIGTERM", () => handleSignal("SIGTERM"));
  process.on("SIGINT", () => handleSignal("SIGINT"));
}
var server_default = app;
export {
  app,
  server_default as default,
  server,
  wss
};
