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

-- 4. Subscriptions (Pro Entitlements & Expiry)
CREATE TABLE IF NOT EXISTS subscriptions (
    id VARCHAR(64) PRIMARY KEY,
    user_id VARCHAR(64) NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    provider VARCHAR(32) NOT NULL DEFAULT 'cashfree',
    provider_customer_id VARCHAR(128) NOT NULL,
    provider_subscription_id VARCHAR(128) NOT NULL,
    plan_code VARCHAR(64) NOT NULL DEFAULT 'pro_monthly_299',
    status VARCHAR(32) NOT NULL DEFAULT 'active',
    current_period_start BIGINT NOT NULL,
    current_period_end BIGINT NOT NULL,
    cancel_at_period_end BOOLEAN NOT NULL DEFAULT FALSE,
    created_at BIGINT NOT NULL,
    updated_at BIGINT NOT NULL,
    CONSTRAINT chk_period CHECK (current_period_end >= current_period_start)
);

CREATE INDEX IF NOT EXISTS idx_subscriptions_user_id ON subscriptions(user_id);
CREATE INDEX IF NOT EXISTS idx_subscriptions_status_period ON subscriptions(status, current_period_end);
CREATE INDEX IF NOT EXISTS idx_subscriptions_provider_sub_id ON subscriptions(provider_subscription_id);

-- 5. Cashfree Orders (Checkout Orders)
CREATE TABLE IF NOT EXISTS cashfree_orders (
    order_id VARCHAR(64) PRIMARY KEY,
    user_id VARCHAR(64) NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    cf_order_id VARCHAR(128),
    payment_session_id TEXT,
    order_amount NUMERIC(10, 2) NOT NULL DEFAULT 299.00,
    order_currency VARCHAR(8) NOT NULL DEFAULT 'INR',
    order_status VARCHAR(32) NOT NULL DEFAULT 'ACTIVE',
    plan_code VARCHAR(64) NOT NULL DEFAULT 'pro_monthly_299',
    created_at BIGINT NOT NULL,
    updated_at BIGINT NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_cashfree_orders_user ON cashfree_orders(user_id);
CREATE INDEX IF NOT EXISTS idx_cashfree_orders_status ON cashfree_orders(order_status);

-- 6. Payment Events (Webhook Idempotency)
CREATE TABLE IF NOT EXISTS payment_events (
    id VARCHAR(64) PRIMARY KEY,
    provider VARCHAR(32) NOT NULL DEFAULT 'cashfree',
    provider_event_id VARCHAR(128) NOT NULL UNIQUE,
    event_type VARCHAR(64) NOT NULL,
    processing_status VARCHAR(32) NOT NULL DEFAULT 'processed',
    received_at BIGINT NOT NULL,
    payload JSONB NOT NULL
);

CREATE UNIQUE INDEX IF NOT EXISTS idx_payment_events_provider_event ON payment_events(provider, provider_event_id);
CREATE INDEX IF NOT EXISTS idx_payment_events_received ON payment_events(received_at DESC);

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

-- 8. User Blocks (Pairwise Matchmaking Exclusion)
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

-- 9. Admin Audit Logs (Tamper-evident administrative history)
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
ALTER TABLE subscriptions ENABLE ROW LEVEL SECURITY;
ALTER TABLE cashfree_orders ENABLE ROW LEVEL SECURITY;
ALTER TABLE payment_events ENABLE ROW LEVEL SECURITY;
ALTER TABLE user_reports ENABLE ROW LEVEL SECURITY;
ALTER TABLE user_blocks ENABLE ROW LEVEL SECURITY;
ALTER TABLE admin_audit_logs ENABLE ROW LEVEL SECURITY;
