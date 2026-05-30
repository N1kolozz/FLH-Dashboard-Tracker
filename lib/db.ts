import { Pool, PoolClient } from "pg";

declare global {
  // eslint-disable-next-line no-var
  var _pgPool: Pool | undefined;
}

function createPool(): Pool {
  if (!process.env.DATABASE_URL) {
    throw new Error("DATABASE_URL environment variable is not set");
  }
  // NOTE: DATABASE_URL must be the Neon *pooled* connection string (the host
  // contains "-pooler", routing through Neon's PgBouncer). On Vercel every warm
  // serverless instance opens its own pool, so we cap `max` low to avoid
  // exhausting Neon's connection budget under load. Schema migrations must use a
  // *direct* (non-pooled) connection instead — see DIRECT_DATABASE_URL in
  // drizzle.config.ts / scripts/migrate.ts.
  return new Pool({
    connectionString: process.env.DATABASE_URL,
    max: Number(process.env.PG_POOL_MAX ?? 5),
    idleTimeoutMillis: 30_000,
    connectionTimeoutMillis: 10_000,
    ssl:
      process.env.NODE_ENV === "production"
        ? { rejectUnauthorized: false }
        : false,
  });
}

// Reuse pool across hot-reloads in development
export const pool: Pool =
  global._pgPool ?? (global._pgPool = createPool());

/**
 * Run `fn` inside a single transaction on a dedicated pooled client.
 * Commits on success, rolls back on any thrown error, and always releases the
 * client. Pass the provided `client` to every query that must be atomic.
 */
export async function withTransaction<T>(
  fn: (client: PoolClient) => Promise<T>
): Promise<T> {
  const client = await pool.connect();
  try {
    await client.query("BEGIN");
    const result = await fn(client);
    await client.query("COMMIT");
    return result;
  } catch (e) {
    await client.query("ROLLBACK");
    throw e;
  } finally {
    client.release();
  }
}
