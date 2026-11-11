-- ============================================================================
-- U-R-LIVE Phase 2 Schema Migration: Supabase PostgreSQL
-- Idempotent, transaction-safe schema for guest-first anonymous video platform
-- ============================================================================

-- 1. Users Table (Persistent Profiles & Account Identifiers)
CREATE TABLE IF NOT EXISTS users (
    id VARCHAR(64) PRIMARY KEY,
    display_name VARCHAR(100) NOT NULL,
    email VARCHAR(255) UNIQUE,
    avatar_url TEXT,
    google_id VARCHAR(128) UNIQUE,
    auth_provider VARCHAR(32) NOT NULL DEFAULT 'guest',
    gender VARCHAR(32) NOT NULL DEFAULT 'unspecified',
    country VARCHAR(32) NOT NULL DEFAULT 'GLOBAL',
    is_adult_verified BOOLEAN NOT NULL DEFAULT FALSE,
    role VARCHAR(32) NOT NULL DEFAULT 'user',
    status VARCHAR(32) NOT NULL DEFAULT 'active',
    allow_friend_requests BOOLEAN NOT NULL DEFAULT TRUE,
    created_at BIGINT NOT NULL,
    last_active_at BIGINT NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_users_email ON users(email);
CREATE INDEX IF NOT EXISTS idx_users_google_id ON users(google_id);
CREATE INDEX IF NOT EXISTS idx_users_role_status ON users(role, status);
CREATE INDEX IF NOT EXISTS idx_users_last_active ON users(last_active_at DESC);

-- 2. User & Guest Sessions (Session Expiry & Revocation)
CREATE TABLE IF NOT EXISTS user_sessions (
    id VARCHAR(64) PRIMARY KEY,
    user_id VARCHAR(64) NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    token_hash VARCHAR(64) NOT NULL UNIQUE,
    role VARCHAR(32) NOT NULL DEFAULT 'user',
    is_guest BOOLEAN NOT NULL DEFAULT TRUE,
    created_at BIGINT NOT NULL,
    expires_at BIGINT NOT NULL,
    revoked BOOLEAN NOT NULL DEFAULT FALSE,
    last_active_at BIGINT NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_user_sessions_user_id ON user_sessions(user_id);
CREATE INDEX IF NOT EXISTS idx_user_sessions_token_hash ON user_sessions(token_hash);
CREATE INDEX IF NOT EXISTS idx_user_sessions_expires_at ON user_sessions(expires_at);

-- 3. User Preferences (Guest & User Matchmaking Settings)
CREATE TABLE IF NOT EXISTS user_preferences (
    user_id VARCHAR(64) PRIMARY KEY REFERENCES users(id) ON DELETE CASCADE,
    chat_mode VARCHAR(16) NOT NULL DEFAULT 'video',
    preferred_gender VARCHAR(16) NOT NULL DEFAULT 'any',
    preferred_country VARCHAR(32) NOT NULL DEFAULT 'GLOBAL',
    interests JSONB NOT NULL DEFAULT '[]'::jsonb,
    interest_matching_enabled BOOLEAN NOT NULL DEFAULT FALSE,
    strict_interests BOOLEAN NOT NULL DEFAULT FALSE,
    languages JSONB NOT NULL DEFAULT '[]'::jsonb,
    primary_language VARCHAR(32) NOT NULL DEFAULT 'en',
    strict_language BOOLEAN NOT NULL DEFAULT FALSE,
    priority_queue BOOLEAN NOT NULL DEFAULT FALSE,
    updated_at BIGINT NOT NULL
);

-- 7. User Reports (Moderation & Safety Queue)
CREATE TABLE IF NOT EXISTS user_reports (
    id VARCHAR(64) PRIMARY KEY,
    reporter_id VARCHAR(64) NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    reporter_name VARCHAR(100) NOT NULL,
    reported_user_id VARCHAR(64) NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    reported_user_name VARCHAR(100) NOT NULL,
    category VARCHAR(64) NOT NULL,
    description TEXT NOT NULL,
    session_id VARCHAR(128),
    status VARCHAR(32) NOT NULL DEFAULT 'pending',
    action_taken VARCHAR(32) DEFAULT 'none',
    moderator_notes TEXT,
    created_at BIGINT NOT NULL,
    resolved_at BIGINT
);

CREATE INDEX IF NOT EXISTS idx_user_reports_status ON user_reports(status);
CREATE INDEX IF NOT EXISTS idx_user_reports_reported_user ON user_reports(reported_user_id);
CREATE INDEX IF NOT EXISTS idx_user_reports_created ON user_reports(created_at DESC);

-- 5. User Blocks (Pairwise Matchmaking Exclusion)
CREATE TABLE IF NOT EXISTS user_blocks (
    id VARCHAR(128) PRIMARY KEY,
    blocker_id VARCHAR(64) NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    blocked_user_id VARCHAR(64) NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    created_at BIGINT NOT NULL,
    CONSTRAINT uq_blocker_blocked UNIQUE (blocker_id, blocked_user_id),
    CONSTRAINT chk_no_self_block CHECK (blocker_id <> blocked_user_id)
);

CREATE INDEX IF NOT EXISTS idx_user_blocks_blocker ON user_blocks(blocker_id);
CREATE INDEX IF NOT EXISTS idx_user_blocks_blocked ON user_blocks(blocked_user_id);

-- 6. Admin Audit Logs (Tamper-evident administrative history)
CREATE TABLE IF NOT EXISTS admin_audit_logs (
    id VARCHAR(64) PRIMARY KEY,
    admin_user_id VARCHAR(64) NOT NULL,
    action VARCHAR(64) NOT NULL,
    target_type VARCHAR(32) NOT NULL,
    target_id VARCHAR(128) NOT NULL,
    details JSONB,
    created_at BIGINT NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_audit_logs_created ON admin_audit_logs(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_audit_logs_admin ON admin_audit_logs(admin_user_id);

-- Row Level Security (RLS) Enablement
ALTER TABLE users ENABLE ROW LEVEL SECURITY;
ALTER TABLE user_sessions ENABLE ROW LEVEL SECURITY;
ALTER TABLE user_preferences ENABLE ROW LEVEL SECURITY;
ALTER TABLE user_reports ENABLE ROW LEVEL SECURITY;
ALTER TABLE user_blocks ENABLE ROW LEVEL SECURITY;
ALTER TABLE admin_audit_logs ENABLE ROW LEVEL SECURITY;
