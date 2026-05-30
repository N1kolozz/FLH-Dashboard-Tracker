import { Pool } from "pg";
import * as dotenv from "dotenv";
import * as path from "path";

dotenv.config({ path: path.resolve(process.cwd(), ".env.local") });

async function migrate() {
  // Migrations should run against a *direct* Neon connection (not the pooler).
  // Prefer DIRECT_DATABASE_URL when set, falling back to DATABASE_URL.
  const migrationUrl = process.env.DIRECT_DATABASE_URL ?? process.env.DATABASE_URL;
  if (!migrationUrl) {
    throw new Error("DIRECT_DATABASE_URL or DATABASE_URL is not set in .env.local");
  }

  const pool = new Pool({
    connectionString: migrationUrl,
    ssl:
      process.env.NODE_ENV === "production"
        ? { rejectUnauthorized: false }
        : false,
  });

  const client = await pool.connect();

  try {
    console.log("Running migrations...");

    await client.query(`
      CREATE TABLE IF NOT EXISTS users (
        id SERIAL PRIMARY KEY,
        email VARCHAR(255) UNIQUE NOT NULL,
        password_hash VARCHAR(255),
        full_name VARCHAR(255) NOT NULL,
        role VARCHAR(50) NOT NULL,
        department VARCHAR(100) NOT NULL,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      );
    `);
    console.log("✓ users table ready");

    await client.query(`
      ALTER TABLE users ADD COLUMN IF NOT EXISTS position VARCHAR(255) DEFAULT ''
    `);
    console.log("✓ users position column ready");

    await client.query(`
      CREATE TABLE IF NOT EXISTS social_accounts (
        id SERIAL PRIMARY KEY,
        platform VARCHAR(50) NOT NULL,
        name VARCHAR(255),
        url TEXT NOT NULL,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      );
    `);
    console.log("✓ social_accounts table ready");

    await client.query(`
      CREATE TABLE IF NOT EXISTS follower_history (
        id SERIAL PRIMARY KEY,
        account_id INTEGER REFERENCES social_accounts(id),
        followers INTEGER NOT NULL,
        recorded_date DATE NOT NULL,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        UNIQUE(account_id, recorded_date)
      );
    `);
    console.log("✓ follower_history table ready");

    await client.query(`
      ALTER TABLE follower_history ADD COLUMN IF NOT EXISTS total_likes INTEGER
    `);
    await client.query(`
      ALTER TABLE follower_history ADD COLUMN IF NOT EXISTS posts_count INTEGER
    `);
    await client.query(`
      CREATE INDEX IF NOT EXISTS follower_history_account_recorded_date_idx
      ON follower_history (account_id, recorded_date DESC)
    `);
    console.log("✓ follower_history profile stats columns ready");

    // ── Department module tables ────────────────────────────────────

    await client.query(`
      CREATE TABLE IF NOT EXISTS projects (
        id SERIAL PRIMARY KEY,
        name VARCHAR(255) NOT NULL,
        description TEXT DEFAULT '',
        status VARCHAR(50) NOT NULL DEFAULT 'planning',
        priority VARCHAR(50) NOT NULL DEFAULT 'medium',
        deadline DATE,
        team VARCHAR(255) DEFAULT '',
        tags TEXT[] DEFAULT '{}',
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      );
    `);
    console.log("✓ projects table ready");

    await client.query(`
      ALTER TABLE projects
      ADD COLUMN IF NOT EXISTS owner_user_id INTEGER REFERENCES users(id) ON DELETE SET NULL
    `);
    console.log("✓ projects owner column ready");

    await client.query(`
      ALTER TABLE projects
      ADD COLUMN IF NOT EXISTS owner_user_ids INTEGER[] NOT NULL DEFAULT '{}'
    `);
    await client.query(`
      UPDATE projects
      SET owner_user_ids = ARRAY[owner_user_id]
      WHERE owner_user_id IS NOT NULL AND cardinality(owner_user_ids) = 0
    `);
    console.log("✓ projects owners column ready");

    await client.query(`
      ALTER TABLE projects
      ADD COLUMN IF NOT EXISTS updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
    `);
    await client.query(`
      UPDATE projects
      SET updated_at = created_at
      WHERE updated_at IS NULL
    `);
    await client.query(`
      ALTER TABLE projects
      ADD COLUMN IF NOT EXISTS review_status VARCHAR(50) NOT NULL DEFAULT 'not_requested'
    `);
    await client.query(`
      CREATE INDEX IF NOT EXISTS projects_review_status_idx
      ON projects (review_status)
    `);
    console.log("✓ projects updated_at column ready");

    await client.query(`
      ALTER TABLE projects
      ADD COLUMN IF NOT EXISTS last_update_type TEXT
    `);
    console.log("✓ projects last_update_type column ready");

    await client.query(`
      ALTER TABLE projects
      ADD COLUMN IF NOT EXISTS sort_order INTEGER NOT NULL DEFAULT 0
    `);
    console.log("✓ projects sort_order column ready");

    await client.query(`
      CREATE TABLE IF NOT EXISTS events (
        id SERIAL PRIMARY KEY,
        title VARCHAR(255) NOT NULL,
        date DATE NOT NULL,
        time VARCHAR(10) DEFAULT '',
        end_time VARCHAR(10) DEFAULT '',
        location VARCHAR(255) DEFAULT '',
        department VARCHAR(50) NOT NULL DEFAULT 'other',
        description TEXT DEFAULT '',
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      );
    `);
    console.log("✓ events table ready");

    await client.query(`
      ALTER TABLE events
      ADD COLUMN IF NOT EXISTS owner_user_id INTEGER REFERENCES users(id) ON DELETE SET NULL
    `);
    console.log("✓ events owner column ready");

    await client.query(`
      ALTER TABLE events
      ADD COLUMN IF NOT EXISTS owner_user_ids INTEGER[] NOT NULL DEFAULT '{}'
    `);
    await client.query(`
      UPDATE events
      SET owner_user_ids = ARRAY[owner_user_id]
      WHERE owner_user_id IS NOT NULL AND cardinality(owner_user_ids) = 0
    `);
    await client.query(`
      CREATE INDEX IF NOT EXISTS events_date_idx
      ON events (date DESC)
    `);
    console.log("✓ events owners column ready");

    await client.query(`
      ALTER TABLE events
      ADD COLUMN IF NOT EXISTS updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
    `);
    await client.query(`
      UPDATE events
      SET updated_at = created_at
      WHERE updated_at IS NULL
    `);
    await client.query(`
      ALTER TABLE events
      ADD COLUMN IF NOT EXISTS last_update_type TEXT
    `);
    console.log("✓ events updated_at + last_update_type columns ready");

    await client.query(`
      CREATE TABLE IF NOT EXISTS attendance_sessions (
        id SERIAL PRIMARY KEY,
        event_id INTEGER REFERENCES events(id) ON DELETE SET NULL,
        title VARCHAR(255) NOT NULL,
        meeting_date DATE NOT NULL,
        instructions TEXT DEFAULT '',
        is_active BOOLEAN NOT NULL DEFAULT FALSE,
        created_by_user_id INTEGER REFERENCES users(id) ON DELETE SET NULL,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      );
    `);
    console.log("✓ attendance_sessions table ready");

    await client.query(`
      CREATE TABLE IF NOT EXISTS attendance_records (
        id SERIAL PRIMARY KEY,
        session_id INTEGER NOT NULL REFERENCES attendance_sessions(id) ON DELETE CASCADE,
        user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
        status VARCHAR(20) NOT NULL DEFAULT 'pending',
        note TEXT DEFAULT '',
        reason TEXT DEFAULT '',
        updated_by_user_id INTEGER REFERENCES users(id) ON DELETE SET NULL,
        responded_at TIMESTAMP,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      );
    `);
    console.log("✓ attendance_records table ready");

    await client.query(`
      ALTER TABLE attendance_sessions
      ADD COLUMN IF NOT EXISTS instructions TEXT DEFAULT ''
    `);
    await client.query(`
      ALTER TABLE attendance_sessions
      ADD COLUMN IF NOT EXISTS is_active BOOLEAN NOT NULL DEFAULT FALSE
    `);
    await client.query(`
      ALTER TABLE attendance_sessions
      ADD COLUMN IF NOT EXISTS updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
    `);
    await client.query(`
      ALTER TABLE attendance_records
      ADD COLUMN IF NOT EXISTS note TEXT DEFAULT ''
    `);
    await client.query(`
      ALTER TABLE attendance_records
      ADD COLUMN IF NOT EXISTS reason TEXT DEFAULT ''
    `);
    await client.query(`
      ALTER TABLE attendance_records
      ADD COLUMN IF NOT EXISTS updated_by_user_id INTEGER REFERENCES users(id) ON DELETE SET NULL
    `);
    await client.query(`
      ALTER TABLE attendance_records
      ADD COLUMN IF NOT EXISTS responded_at TIMESTAMP
    `);
    await client.query(`
      ALTER TABLE attendance_records
      ADD COLUMN IF NOT EXISTS updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
    `);
    await client.query(`
      CREATE INDEX IF NOT EXISTS attendance_sessions_event_id_idx
      ON attendance_sessions (event_id)
    `);
    await client.query(`
      CREATE INDEX IF NOT EXISTS attendance_sessions_active_idx
      ON attendance_sessions (is_active)
    `);
    await client.query(`
      CREATE UNIQUE INDEX IF NOT EXISTS attendance_records_session_user_idx
      ON attendance_records (session_id, user_id)
    `);
    await client.query(`
      CREATE INDEX IF NOT EXISTS attendance_records_user_status_idx
      ON attendance_records (user_id, status)
    `);
    console.log("✓ attendance columns and indexes ready");

    await client.query(`
      CREATE TABLE IF NOT EXISTS news_posts (
        id SERIAL PRIMARY KEY,
        title VARCHAR(255) NOT NULL,
        body TEXT DEFAULT '',
        created_by_user_id INTEGER REFERENCES users(id) ON DELETE SET NULL,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      );
    `);
    await client.query(`
      CREATE INDEX IF NOT EXISTS news_posts_created_at_idx
      ON news_posts (created_at DESC)
    `);
    console.log("✓ news_posts table ready");

    await client.query(`
      CREATE TABLE IF NOT EXISTS daily_briefings (
        id SERIAL PRIMARY KEY,
        user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
        briefing_date DATE NOT NULL,
        briefing TEXT NOT NULL,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        UNIQUE(user_id, briefing_date)
      );
    `);
    await client.query(`
      CREATE INDEX IF NOT EXISTS daily_briefings_user_date_idx
      ON daily_briefings (user_id, briefing_date DESC)
    `);
    console.log("daily_briefings table ready");

    await client.query(`
      CREATE TABLE IF NOT EXISTS push_subscriptions (
        id SERIAL PRIMARY KEY,
        user_id INTEGER REFERENCES users(id) ON DELETE CASCADE,
        endpoint TEXT NOT NULL UNIQUE,
        p256dh TEXT NOT NULL,
        auth TEXT NOT NULL,
        user_agent TEXT DEFAULT '',
        topic_news BOOLEAN NOT NULL DEFAULT TRUE,
        topic_events BOOLEAN NOT NULL DEFAULT TRUE,
        topic_projects BOOLEAN NOT NULL DEFAULT TRUE,
        topic_attendance BOOLEAN NOT NULL DEFAULT TRUE,
        last_success_at TIMESTAMP,
        last_failure_at TIMESTAMP,
        last_failure_reason TEXT DEFAULT '',
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      );
    `);
    await client.query(`
      CREATE INDEX IF NOT EXISTS push_subscriptions_user_id_idx
      ON push_subscriptions (user_id)
    `);
    await client.query(`
      ALTER TABLE push_subscriptions
      ADD COLUMN IF NOT EXISTS topic_attendance BOOLEAN NOT NULL DEFAULT TRUE
    `);
    await client.query(`
      ALTER TABLE push_subscriptions
      ADD COLUMN IF NOT EXISTS topic_content BOOLEAN NOT NULL DEFAULT TRUE
    `);
    console.log("✓ push_subscriptions table ready");

    await client.query(`
      CREATE TABLE IF NOT EXISTS inventory_items (
        id SERIAL PRIMARY KEY,
        name VARCHAR(255) NOT NULL,
        category VARCHAR(50) NOT NULL DEFAULT 'other',
        quantity INTEGER NOT NULL DEFAULT 1,
        status VARCHAR(50) NOT NULL DEFAULT 'available',
        location VARCHAR(255) DEFAULT '',
        condition VARCHAR(255) DEFAULT '',
        notes TEXT DEFAULT '',
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      );
    `);
    console.log("✓ inventory_items table ready");

    await client.query(`
      CREATE TABLE IF NOT EXISTS inventory_checkouts (
        id SERIAL PRIMARY KEY,
        item_id INTEGER NOT NULL REFERENCES inventory_items(id) ON DELETE CASCADE,
        person VARCHAR(255) NOT NULL,
        checkout_date DATE NOT NULL,
        return_date DATE,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      );
    `);
    console.log("✓ inventory_checkouts table ready");

    await client.query(`
      CREATE TABLE IF NOT EXISTS expenses (
        id SERIAL PRIMARY KEY,
        description VARCHAR(255) NOT NULL,
        amount NUMERIC(12,2) NOT NULL DEFAULT 0,
        category VARCHAR(50) NOT NULL DEFAULT 'other',
        date DATE NOT NULL,
        paid_by VARCHAR(255) DEFAULT '',
        notes TEXT DEFAULT '',
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      );
    `);
    console.log("✓ expenses table ready");

    await client.query(`
      CREATE TABLE IF NOT EXISTS content_posts (
        id SERIAL PRIMARY KEY,
        platform VARCHAR(50) NOT NULL DEFAULT 'instagram',
        caption TEXT NOT NULL,
        date DATE NOT NULL,
        time VARCHAR(10) DEFAULT '',
        status VARCHAR(50) NOT NULL DEFAULT 'draft',
        notes TEXT DEFAULT '',
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      );
    `);
    console.log("✓ content_posts table ready");

    await client.query(`
      ALTER TABLE content_posts
      ADD COLUMN IF NOT EXISTS owner_user_id INTEGER REFERENCES users(id) ON DELETE SET NULL
    `);
    console.log("✓ content_posts owner column ready");

    await client.query(`
      ALTER TABLE content_posts
      ADD COLUMN IF NOT EXISTS owner_user_ids INTEGER[] NOT NULL DEFAULT '{}'
    `);
    await client.query(`
      UPDATE content_posts
      SET owner_user_ids = ARRAY[owner_user_id]
      WHERE owner_user_id IS NOT NULL AND cardinality(owner_user_ids) = 0
    `);
    await client.query(`
      ALTER TABLE content_posts
      ADD COLUMN IF NOT EXISTS approval_status VARCHAR(50) NOT NULL DEFAULT 'not_requested'
    `);
    await client.query(`
      CREATE INDEX IF NOT EXISTS content_posts_date_time_idx
      ON content_posts (date DESC, time ASC)
    `);
    await client.query(`
      CREATE INDEX IF NOT EXISTS content_posts_approval_status_idx
      ON content_posts (approval_status)
    `);
    console.log("✓ content_posts owners column ready");

    await client.query(`
      ALTER TABLE content_posts
      ADD COLUMN IF NOT EXISTS updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
    `);
    await client.query(`
      UPDATE content_posts
      SET updated_at = created_at
      WHERE updated_at IS NULL
    `);
    await client.query(`
      ALTER TABLE content_posts
      ADD COLUMN IF NOT EXISTS last_update_type TEXT
    `);
    console.log("✓ content_posts updated_at + last_update_type columns ready");

    await client.query(`
      CREATE TABLE IF NOT EXISTS review_requests (
        id SERIAL PRIMARY KEY,
        entity_type VARCHAR(50) NOT NULL,
        entity_id INTEGER NOT NULL,
        status VARCHAR(50) NOT NULL DEFAULT 'pending',
        submitted_by INTEGER REFERENCES users(id) ON DELETE SET NULL,
        reviewed_by INTEGER REFERENCES users(id) ON DELETE SET NULL,
        feedback TEXT DEFAULT '',
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        reviewed_at TIMESTAMP
      );
    `);
    await client.query(`
      CREATE INDEX IF NOT EXISTS review_requests_entity_lookup_idx
      ON review_requests (entity_type, entity_id, created_at DESC)
    `);
    await client.query(`
      CREATE INDEX IF NOT EXISTS review_requests_status_created_at_idx
      ON review_requests (status, created_at DESC)
    `);
    console.log("✓ review_requests table ready");

    await client.query(`
      CREATE TABLE IF NOT EXISTS impact_records (
        id SERIAL PRIMARY KEY,
        project_id INTEGER REFERENCES projects(id) ON DELETE SET NULL,
        project_name VARCHAR(255) NOT NULL,
        activity_type VARCHAR(50) NOT NULL DEFAULT 'other',
        people_reached INTEGER NOT NULL DEFAULT 0,
        date DATE NOT NULL,
        result_summary TEXT DEFAULT '',
        evidence_link TEXT DEFAULT '',
        notes TEXT DEFAULT '',
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      );
    `);
    console.log("✓ impact_records table ready");

    await client.query(`
      ALTER TABLE impact_records
      ADD COLUMN IF NOT EXISTS project_id INTEGER REFERENCES projects(id) ON DELETE SET NULL
    `);
    await client.query(`
      CREATE INDEX IF NOT EXISTS impact_records_project_id_idx
      ON impact_records (project_id)
    `);
    await client.query(`
      WITH project_matches AS (
        SELECT DISTINCT ON (LOWER(BTRIM(name)))
          id,
          name,
          LOWER(BTRIM(name)) AS normalized_name
        FROM projects
        WHERE BTRIM(name) <> ''
        ORDER BY LOWER(BTRIM(name)), created_at DESC, id DESC
      )
      UPDATE impact_records AS ir
      SET project_id = pm.id,
          project_name = pm.name
      FROM project_matches AS pm
      WHERE ir.project_id IS NULL
        AND LOWER(BTRIM(ir.project_name)) = pm.normalized_name
    `);
    console.log("✓ impact_records project link ready");

    await client.query(`
      ALTER TABLE impact_records
      ADD COLUMN IF NOT EXISTS result_summary TEXT DEFAULT ''
    `);
    await client.query(`
      ALTER TABLE impact_records
      ADD COLUMN IF NOT EXISTS evidence_link TEXT DEFAULT ''
    `);
    await client.query(`
      UPDATE impact_records
      SET result_summary = COALESCE(result_summary, ''),
          evidence_link = COALESCE(evidence_link, '')
      WHERE result_summary IS NULL OR evidence_link IS NULL
    `);
    console.log("✓ impact_records structured outcome columns ready");

    await client.query(`
      CREATE TABLE IF NOT EXISTS user_sessions (
        id SERIAL PRIMARY KEY,
        user_id INTEGER REFERENCES users(id) ON DELETE CASCADE,
        start_time TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        last_ping TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        duration_seconds INTEGER DEFAULT 0,
        ip_address VARCHAR(45) DEFAULT '',
        user_agent TEXT DEFAULT '',
        is_active BOOLEAN DEFAULT TRUE
      );
    `);
    await client.query(`
      CREATE INDEX IF NOT EXISTS user_sessions_user_id_idx ON user_sessions (user_id);
    `);
    await client.query(`
      CREATE INDEX IF NOT EXISTS user_sessions_start_time_idx ON user_sessions (start_time DESC);
    `);
    console.log("✓ user_sessions table ready");

    await client.query(`
      CREATE TABLE IF NOT EXISTS user_activities (
        id SERIAL PRIMARY KEY,
        user_id INTEGER REFERENCES users(id) ON DELETE CASCADE,
        session_id INTEGER REFERENCES user_sessions(id) ON DELETE SET NULL,
        action VARCHAR(255) NOT NULL,
        path VARCHAR(255) DEFAULT '',
        details JSONB DEFAULT '{}'::jsonb,
        ip_address VARCHAR(45) DEFAULT '',
        user_agent TEXT DEFAULT '',
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      );
    `);
    await client.query(`
      CREATE INDEX IF NOT EXISTS user_activities_user_id_idx ON user_activities (user_id);
    `);
    await client.query(`
      CREATE INDEX IF NOT EXISTS user_activities_action_idx ON user_activities (action);
    `);
    await client.query(`
      CREATE INDEX IF NOT EXISTS user_activities_created_at_idx ON user_activities (created_at DESC);
    `);
    console.log("✓ user_activities table ready");

    // Seed accounts (upsert by URL to avoid duplicates)
    const accounts = [
      {
        platform: "instagram",
        name: "FLHUB Instagram",
        url: "https://www.instagram.com/future_leaders_hub/",
      },
      {
        platform: "tiktok",
        name: "FLHUB TikTok",
        url: "https://www.tiktok.com/@future_leaders_hub",
      },
      {
        platform: "facebook",
        name: "FLHUB Facebook",
        url: "https://www.facebook.com/profile.php?id=61556110770300",
      },
    ];

    for (const account of accounts) {
      const existing = await client.query(
        "SELECT id FROM social_accounts WHERE url = $1",
        [account.url]
      );
      if (existing.rows.length === 0) {
        await client.query(
          "INSERT INTO social_accounts (platform, name, url) VALUES ($1, $2, $3)",
          [account.platform, account.name, account.url]
        );
        console.log(`✓ Seeded: ${account.name}`);
      } else {
        console.log(`– Already exists: ${account.name}`);
      }
    }

    console.log("\nMigration complete!");

    const seedAdminEmail = process.env.SEED_ADMIN_EMAIL?.trim();
    if (seedAdminEmail) {
      const existingAdmin = await client.query(
        "SELECT id FROM users WHERE email = $1",
        [seedAdminEmail]
      );
      if (existingAdmin.rows.length === 0) {
        await client.query(
          "INSERT INTO users (email, full_name, role, department, position) VALUES ($1, $2, $3, $4, $5)",
          [
            seedAdminEmail,
            process.env.SEED_ADMIN_FULL_NAME?.trim() || "Admin User",
            "ADMIN",
            process.env.SEED_ADMIN_DEPARTMENT?.trim() || "Management",
            process.env.SEED_ADMIN_POSITION?.trim() || "",
          ]
        );
        console.log(`✓ Seeded admin from SEED_ADMIN_EMAIL: ${seedAdminEmail}`);
      } else {
        console.log(`– Seed admin already exists: ${seedAdminEmail}`);
      }
    } else {
      console.log("– Skipping admin seed (SEED_ADMIN_EMAIL not set)");
    }
  } finally {
    client.release();
    await pool.end();
  }
}

migrate().catch((err) => {
  console.error("Migration failed:", err);
  process.exit(1);
});
