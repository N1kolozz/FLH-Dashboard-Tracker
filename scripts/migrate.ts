import { Pool } from "pg";
import * as dotenv from "dotenv";
import * as path from "path";

dotenv.config({ path: path.resolve(process.cwd(), ".env.local") });

async function migrate() {
  if (!process.env.DATABASE_URL) {
    throw new Error("DATABASE_URL is not set in .env.local");
  }

  const pool = new Pool({
    connectionString: process.env.DATABASE_URL,
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
    console.log("✓ projects updated_at column ready");

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
    console.log("✓ events owners column ready");

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
    console.log("✓ content_posts owners column ready");

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

    // Seed accounts (upsert by URL to avoid duplicates)
    const accounts = [
      {
        platform: "instagram",
        name: "Future Leaders Hub Instagram",
        url: "https://www.instagram.com/future_leaders_hub/",
      },
      {
        platform: "tiktok",
        name: "Future Leaders Hub TikTok",
        url: "https://www.tiktok.com/@future_leaders_hub",
      },
      {
        platform: "facebook",
        name: "Future Leaders Hub Facebook",
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

    // Seed default admin
    const adminEmail = "mr.osievi5@gmail.com";
    const existingAdmin = await client.query(
      "SELECT id FROM users WHERE email = $1",
      [adminEmail]
    );
    if (existingAdmin.rows.length === 0) {
      await client.query(
        "INSERT INTO users (email, full_name, role, department) VALUES ($1, $2, $3, $4)",
        [adminEmail, "Admin User", "ADMIN", "Management"]
      );
      console.log(`✓ Seeded default admin: ${adminEmail}`);
    } else {
      console.log(`– Default admin already exists: ${adminEmail}`);
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
