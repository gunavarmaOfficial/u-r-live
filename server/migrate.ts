/**
 * U-R-LIVE Phase 2 Database Migration & JSON Importer
 * Run with: npx tsx server/migrate.ts
 *
 * Idempotently executes PostgreSQL schema migrations and safely imports
 * existing data from .data/omelive_db.json into Supabase PostgreSQL.
 * Does not destroy JSON files or log sensitive user credentials.
 */
import fs from 'fs';
import path from 'path';
import pg from 'pg';
import dotenv from 'dotenv';

dotenv.config();

const { Pool } = pg;

const MIGRATIONS_DIR = path.resolve(process.cwd(), 'server/migrations');
const JSON_FILE = path.resolve(process.cwd(), '.data/omelive_db.json');

// Stable advisory lock id so concurrent Cloud Run instances serialize schema work
// instead of racing the same DDL on first boot.
const MIGRATION_LOCK_KEY = 872345001;

export async function runMigration(databaseUrl?: string) {
  const url = databaseUrl || process.env.DATABASE_URL || process.env.SUPABASE_DB_URL;

  if (!url) {
    console.error('[Migration Error] No DATABASE_URL or SUPABASE_DB_URL found.');
    console.error('Please configure your Supabase connection string in your environment or .env:');
    console.error('DATABASE_URL="postgresql://postgres.[REF]:[PASSWORD]@aws-0-[REGION].pooler.supabase.com:6543/postgres"');
    return { success: false, error: 'Missing connection string' };
  }

  const isSslRequired = !url.includes('localhost') && !url.includes('127.0.0.1');
  const pool = new Pool({
    connectionString: url,
    ssl: isSslRequired ? { rejectUnauthorized: false } : undefined,
  });

  const client = await pool.connect();
  try {
    console.log('[Migration] Waiting for migration advisory lock...');
    await client.query('SELECT pg_advisory_lock($1)', [MIGRATION_LOCK_KEY]);
    console.log('[Migration] Advisory lock acquired. Applying schema migrations...');

    // 1. Run DDL schema migrations in filename order
    if (!fs.existsSync(MIGRATIONS_DIR)) {
      throw new Error(`Migrations directory not found at ${MIGRATIONS_DIR}`);
    }

    const migrationFiles = fs
      .readdirSync(MIGRATIONS_DIR)
      .filter((file) => file.endsWith('.sql'))
      .sort();

    if (migrationFiles.length === 0) {
      throw new Error(`No .sql migrations found in ${MIGRATIONS_DIR}`);
    }

    for (const file of migrationFiles) {
      const schemaSql = fs.readFileSync(path.join(MIGRATIONS_DIR, file), 'utf-8');
      await client.query('BEGIN');
      await client.query(schemaSql);
      await client.query('COMMIT');
      console.log(`[Migration] Applied ${file}`);
    }
    console.log('[Migration] Schema migrations applied successfully.');

    // 2. Import existing JSON data if available
    let importCounts = {
      users: 0,
      reports: 0,
      blocks: 0,
      auditLogs: 0,
      preferences: 0,
    };

    if (fs.existsSync(JSON_FILE)) {
      console.log('[Migration] Found existing JSON data snapshot. Starting idempotent import...');
      const raw = fs.readFileSync(JSON_FILE, 'utf-8');
      const data = JSON.parse(raw);

      await client.query('BEGIN');

      // Import Users
      if (data.users && typeof data.users === 'object') {
        const users = Object.values(data.users) as any[];
        for (const u of users) {
          await client.query(
            `INSERT INTO users (
              id, display_name, email, avatar_url, google_id, auth_provider,
              gender, country, is_adult_verified, role, status, allow_friend_requests,
              created_at, last_active_at
            ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14)
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
              last_active_at = EXCLUDED.last_active_at`,
            [
              u.id,
              u.displayName || 'Stranger',
              u.email || null,
              u.avatarUrl || null,
              u.googleId || null,
              u.authProvider || 'guest',
              u.gender || 'unspecified',
              u.country || 'GLOBAL',
              u.isAdultVerified ?? false,
              u.role || 'user',
              u.status || 'active',
              u.allowFriendRequests ?? true,
              Number(u.createdAt || Date.now()),
              Number(u.lastActiveAt || Date.now()),
            ]
          );
          importCounts.users++;
        }
      }

      // Import Reports
      if (data.reports && typeof data.reports === 'object') {
        const reports = Object.values(data.reports) as any[];
        for (const r of reports) {
          // Ensure reporter and reported user exist
          for (const uid of [r.reporterId, r.reportedUserId]) {
            const uc = await client.query('SELECT id FROM users WHERE id = $1', [uid]);
            if (uc.rowCount === 0) {
              await client.query(
                `INSERT INTO users (id, display_name, role, status, created_at, last_active_at)
                 VALUES ($1, $2, 'user', 'active', $3, $3)
                 ON CONFLICT (id) DO NOTHING`,
                [uid, 'User', Number(r.createdAt || Date.now())]
              );
            }
          }

          await client.query(
            `INSERT INTO user_reports (
              id, reporter_id, reporter_name, reported_user_id, reported_user_name,
              category, description, session_id, status, action_taken, moderator_notes,
              created_at, resolved_at
            ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13)
            ON CONFLICT (id) DO UPDATE SET
              status = EXCLUDED.status,
              action_taken = EXCLUDED.action_taken,
              moderator_notes = EXCLUDED.moderator_notes,
              resolved_at = EXCLUDED.resolved_at`,
            [
              r.id,
              r.reporterId,
              r.reporterName || 'Reporter',
              r.reportedUserId,
              r.reportedUserName || 'Reported',
              r.category || 'other',
              r.description || '',
              r.sessionId || null,
              r.status || 'pending',
              r.actionTaken || 'none',
              r.moderatorNotes || null,
              Number(r.createdAt || Date.now()),
              r.resolvedAt ? Number(r.resolvedAt) : null,
            ]
          );
          importCounts.reports++;
        }
      }

      // Import Blocks
      if (data.blocks && typeof data.blocks === 'object') {
        const blocks = Object.values(data.blocks) as any[];
        for (const b of blocks) {
          if (b.blockerId === b.blockedUserId) continue;

          for (const uid of [b.blockerId, b.blockedUserId]) {
            const uc = await client.query('SELECT id FROM users WHERE id = $1', [uid]);
            if (uc.rowCount === 0) {
              await client.query(
                `INSERT INTO users (id, display_name, role, status, created_at, last_active_at)
                 VALUES ($1, $2, 'user', 'active', $3, $3)
                 ON CONFLICT (id) DO NOTHING`,
                [uid, 'User', Number(b.createdAt || Date.now())]
              );
            }
          }

          await client.query(
            `INSERT INTO user_blocks (id, blocker_id, blocked_user_id, created_at)
             VALUES ($1, $2, $3, $4)
             ON CONFLICT (blocker_id, blocked_user_id) DO NOTHING`,
            [b.id, b.blockerId, b.blockedUserId, Number(b.createdAt || Date.now())]
          );
          importCounts.blocks++;
        }
      }

      // Import Audit Logs
      if (Array.isArray(data.auditLogs)) {
        for (const log of data.auditLogs) {
          await client.query(
            `INSERT INTO admin_audit_logs (id, admin_user_id, action, target_type, target_id, details, created_at)
             VALUES ($1, $2, $3, $4, $5, $6, $7)
             ON CONFLICT (id) DO NOTHING`,
            [
              log.id,
              log.adminUserId || 'system',
              log.action || 'action',
              log.targetType || 'system',
              log.targetId || 'unknown',
              log.details ? JSON.stringify(log.details) : null,
              Number(log.createdAt || Date.now()),
            ]
          );
          importCounts.auditLogs++;
        }
      }

      // Import User Preferences
      if (data.preferences && typeof data.preferences === 'object') {
        const prefs = Object.values(data.preferences) as any[];
        for (const p of prefs) {
          const userCheck = await client.query('SELECT id FROM users WHERE id = $1', [p.userId]);
          if (userCheck.rowCount && userCheck.rowCount > 0) {
            await client.query(
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
                p.userId,
                p.chatMode || 'video',
                p.preferredGender || 'any',
                p.preferredCountry || 'GLOBAL',
                JSON.stringify(p.interests || []),
                p.interestMatchingEnabled ?? false,
                p.strictInterests ?? false,
                JSON.stringify(p.languages || []),
                p.primaryLanguage || 'en',
                p.strictLanguage ?? false,
                p.priorityQueue ?? false,
                Number(p.updatedAt || Date.now()),
              ]
            );
            importCounts.preferences++;
          }
        }
      }

      await client.query('COMMIT');
      console.log('[Migration] Idempotent data import completed successfully.');
      console.log(
        `[Migration Summary] Imported/Synchronized: ${importCounts.users} users, ${importCounts.reports} reports, ${importCounts.blocks} blocks, ${importCounts.auditLogs} audit logs, ${importCounts.preferences} preferences.`
      );
    } else {
      console.log('[Migration] No local JSON file found to import. Ready for fresh operations.');
    }

    return { success: true, importCounts };
  } catch (err: any) {
    await client.query('ROLLBACK');
    console.error('[Migration Failed] Error:', err.message);
    return { success: false, error: err.message };
  } finally {
    await client.query('SELECT pg_advisory_unlock($1)', [MIGRATION_LOCK_KEY]).catch(() => {});
    client.release();
    await pool.end();
  }
}

// Allow direct execution: npx tsx server/migrate.ts, or the bundled dist-server/migrate.mjs
const invokedScript = process.argv[1] || '';
if (/migrate\.(ts|mjs|js)$/.test(invokedScript)) {
  runMigration().then((res) => {
    if (!res.success) {
      process.exit(1);
    }
  });
}
