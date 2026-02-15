-- Helm Event Store Schema
-- This runs automatically on first docker-compose up

CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- ── Events Table (append-only, immutable) ──────────────────
CREATE TABLE IF NOT EXISTS events (
    id          UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    match_id    UUID NOT NULL,
    sequence    INTEGER NOT NULL,
    type        VARCHAR(64) NOT NULL,
    payload     JSONB NOT NULL,
    player_id   VARCHAR(64),
    timestamp   TIMESTAMPTZ NOT NULL DEFAULT NOW(),

    UNIQUE(match_id, sequence)
);

CREATE INDEX IF NOT EXISTS idx_events_match_id ON events(match_id);
CREATE INDEX IF NOT EXISTS idx_events_match_seq ON events(match_id, sequence);
CREATE INDEX IF NOT EXISTS idx_events_type ON events(type);

-- ── Matches Table (lightweight metadata) ───────────────────
CREATE TABLE IF NOT EXISTS matches (
    id          UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    name        VARCHAR(256),
    game_size   VARCHAR(32) NOT NULL DEFAULT 'strike_force',
    status      VARCHAR(32) NOT NULL DEFAULT 'created',
    created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ── Dice Rolls Audit Log ───────────────────────────────────
CREATE TABLE IF NOT EXISTS dice_rolls (
    id          UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    match_id    UUID REFERENCES matches(id),
    roll_id     VARCHAR(64) NOT NULL,
    seed        VARCHAR(128) NOT NULL,
    results     JSONB NOT NULL,
    hash        VARCHAR(128) NOT NULL,
    purpose     VARCHAR(32),
    player_id   VARCHAR(64),
    timestamp   TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_dice_match ON dice_rolls(match_id);

-- ── Override Audit Log ─────────────────────────────────────
CREATE TABLE IF NOT EXISTS overrides (
    id              UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    match_id        UUID REFERENCES matches(id),
    blocked_event_id UUID NOT NULL,
    reason          TEXT NOT NULL,
    approved_by     VARCHAR(64) NOT NULL,
    timestamp       TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ── Vision Fingerprints (unit embeddings) ──────────────────
CREATE TABLE IF NOT EXISTS unit_fingerprints (
    id          UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id     VARCHAR(64) NOT NULL,
    unit_name   VARCHAR(256) NOT NULL,
    embedding   JSONB NOT NULL,  -- float[] stored as JSON
    image_count INTEGER NOT NULL DEFAULT 0,
    provenance  VARCHAR(256),    -- "user_capture_2026-02-14"
    created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_fingerprints_user ON unit_fingerprints(user_id);
