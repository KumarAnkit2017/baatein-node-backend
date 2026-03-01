const { Pool } = require('pg');
const { databaseUrl, databaseSsl } = require('./env');

const pool = new Pool({
  connectionString: databaseUrl,
  ssl: databaseSsl ? { rejectUnauthorized: false } : false
});

const initSchema = async () => {
  await pool.query('CREATE EXTENSION IF NOT EXISTS pgcrypto;');

  await pool.query(`
    CREATE TABLE IF NOT EXISTS users (
      id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      name VARCHAR(80) NOT NULL,
      email VARCHAR(255) UNIQUE,
      mobile_number VARCHAR(20) UNIQUE,
      password_hash TEXT NOT NULL,
      avatar TEXT NOT NULL DEFAULT '',
      bio VARCHAR(250) NOT NULL DEFAULT '',
      is_active BOOLEAN NOT NULL DEFAULT true,
      created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
      updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
    );
  `);

  await pool.query('ALTER TABLE users ADD COLUMN IF NOT EXISTS mobile_number VARCHAR(20);');
  await pool.query('ALTER TABLE users ALTER COLUMN email DROP NOT NULL;');
  await pool.query('CREATE UNIQUE INDEX IF NOT EXISTS idx_users_mobile_unique ON users (mobile_number) WHERE mobile_number IS NOT NULL;');
  await pool.query('CREATE UNIQUE INDEX IF NOT EXISTS idx_users_email_unique ON users (email) WHERE email IS NOT NULL;');

  await pool.query(`
    CREATE TABLE IF NOT EXISTS otp_codes (
      id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      mobile_number VARCHAR(20) NOT NULL,
      otp_hash TEXT NOT NULL,
      expires_at TIMESTAMPTZ NOT NULL,
      attempts INTEGER NOT NULL DEFAULT 0,
      created_at TIMESTAMPTZ NOT NULL DEFAULT now()
    );
  `);

  await pool.query('CREATE INDEX IF NOT EXISTS idx_otp_mobile_created ON otp_codes (mobile_number, created_at DESC);');

  await pool.query(`
    CREATE TABLE IF NOT EXISTS groups (
      id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      name VARCHAR(120) NOT NULL,
      description VARCHAR(300) NOT NULL DEFAULT '',
      admin_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
      updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
    );
  `);

  await pool.query(`
    CREATE TABLE IF NOT EXISTS group_members (
      group_id UUID NOT NULL REFERENCES groups(id) ON DELETE CASCADE,
      user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      PRIMARY KEY (group_id, user_id)
    );
  `);

  await pool.query(`
    CREATE TABLE IF NOT EXISTS messages (
      id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      sender_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      recipient_id UUID REFERENCES users(id) ON DELETE CASCADE,
      group_id UUID REFERENCES groups(id) ON DELETE CASCADE,
      content TEXT NOT NULL,
      message_type VARCHAR(10) NOT NULL DEFAULT 'text',
      created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
      CONSTRAINT private_or_group_message CHECK (
        (recipient_id IS NOT NULL AND group_id IS NULL)
        OR (recipient_id IS NULL AND group_id IS NOT NULL)
      )
    );
  `);

  await pool.query('CREATE INDEX IF NOT EXISTS idx_messages_private ON messages (sender_id, recipient_id, created_at);');
  await pool.query('CREATE INDEX IF NOT EXISTS idx_messages_group ON messages (group_id, created_at);');
  await pool.query('CREATE INDEX IF NOT EXISTS idx_group_members_user ON group_members (user_id);');
};

const connectDB = async () => {
  await pool.query('SELECT 1');
  await initSchema();
};

module.exports = { connectDB, pool };