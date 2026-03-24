-- Add wecom_userid field to users table for WeChat Work login
ALTER TABLE users ADD COLUMN IF NOT EXISTS wecom_userid VARCHAR(64) UNIQUE;

-- Make password_hash nullable for OAuth-only users
ALTER TABLE users ALTER COLUMN password_hash DROP NOT NULL;
