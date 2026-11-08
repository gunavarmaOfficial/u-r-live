-- ============================================================================
-- U-R-LIVE Migration 002: Versioned legal consent
-- Records Terms/Privacy acceptance and 18+ confirmation per user and version.
-- ============================================================================

ALTER TABLE users ADD COLUMN IF NOT EXISTS terms_version VARCHAR(32);
ALTER TABLE users ADD COLUMN IF NOT EXISTS terms_accepted_at BIGINT;
ALTER TABLE users ADD COLUMN IF NOT EXISTS age_confirmed_at BIGINT;

CREATE TABLE IF NOT EXISTS consents (
    id VARCHAR(64) PRIMARY KEY,
    user_id VARCHAR(64) NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    kind VARCHAR(32) NOT NULL,
    version VARCHAR(32) NOT NULL,
    accepted_at BIGINT NOT NULL,
    ip_hash VARCHAR(64),
    user_agent_hash VARCHAR(64),
    CONSTRAINT uq_consent_user_kind_version UNIQUE (user_id, kind, version)
);

CREATE INDEX IF NOT EXISTS idx_consents_user_kind ON consents(user_id, kind);
CREATE INDEX IF NOT EXISTS idx_consents_accepted_at ON consents(accepted_at DESC);
