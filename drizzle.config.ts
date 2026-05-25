// Drizzle Kit configuration.
// drizzle-kit reads this when running `generate`, `migrate`, `push`, `studio`.
// The schema file is the source of truth for table definitions; generated
// migration SQL is written to ./drizzle.

import * as dotenv from "dotenv";
import * as path from "path";
import { defineConfig } from "drizzle-kit";

// This project uses .env.local (Next.js convention), not .env, so load it
// explicitly before reading process.env.
dotenv.config({ path: path.resolve(process.cwd(), ".env.local") });

if (!process.env.DATABASE_URL) {
  throw new Error("DATABASE_URL is required for drizzle-kit");
}

export default defineConfig({
  schema: "./lib/db/schema.ts",
  out: "./drizzle",
  dialect: "postgresql",
  dbCredentials: {
    url: process.env.DATABASE_URL,
  },
  verbose: true,
  strict: true,
});
