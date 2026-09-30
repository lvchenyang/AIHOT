-- Reader accounts are separate from administrators and public editorial data.
CREATE TABLE member_users (
  id            bigserial PRIMARY KEY,
  username      text NOT NULL UNIQUE CHECK (username ~ '^[a-z0-9][a-z0-9_.-]{2,31}$'),
  display_name  text NOT NULL CHECK (char_length(display_name) BETWEEN 1 AND 80),
  password_hash text NOT NULL,
  enabled       boolean NOT NULL DEFAULT true,
  created_at    timestamptz NOT NULL DEFAULT now(),
  updated_at    timestamptz NOT NULL DEFAULT now(),
  last_login_at timestamptz
);

CREATE TABLE member_sessions (
  id_hash    text PRIMARY KEY,
  user_id    bigint NOT NULL REFERENCES member_users (id) ON DELETE CASCADE,
  csrf_token text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  expires_at timestamptz NOT NULL
);
CREATE INDEX member_sessions_user_idx ON member_sessions (user_id);
CREATE INDEX member_sessions_expiry_idx ON member_sessions (expires_at);

-- Shared across API processes and restarts; identifiers are hashed, never passwords.
CREATE TABLE member_login_limits (
  key        text PRIMARY KEY,
  attempts   integer NOT NULL,
  expires_at timestamptz NOT NULL
);
CREATE INDEX member_login_limits_expiry_idx ON member_login_limits (expires_at);
