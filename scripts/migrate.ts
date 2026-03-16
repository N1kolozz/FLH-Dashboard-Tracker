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
  } finally {
    client.release();
    await pool.end();
  }
}

migrate().catch((err) => {
  console.error("Migration failed:", err);
  process.exit(1);
});
