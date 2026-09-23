-- Run this once against the Neon/Vercel Postgres database before the wheel
-- feature goes live (Neon SQL console, or `psql "$DATABASE_URL" -f scripts/wheel-schema.sql`).
CREATE TABLE IF NOT EXISTS wheel_submissions (
  id            BIGSERIAL PRIMARY KEY,
  topic_id      TEXT NOT NULL,
  category      TEXT NOT NULL,
  topic_text    TEXT NOT NULL,
  author_name   TEXT,
  is_anonymous  BOOLEAN NOT NULL DEFAULT FALSE,
  body          TEXT NOT NULL,
  status        TEXT NOT NULL DEFAULT 'pending',
  created_at    TIMESTAMPTZ NOT NULL DEFAULT now(),
  reviewed_at   TIMESTAMPTZ
);

CREATE INDEX IF NOT EXISTS wheel_submissions_topic_status_idx ON wheel_submissions (topic_id, status, created_at DESC);
CREATE INDEX IF NOT EXISTS wheel_submissions_status_idx ON wheel_submissions (status, created_at DESC);
