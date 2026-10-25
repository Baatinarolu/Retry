import { Pool } from "@neondatabase/serverless";
import { drizzle } from "drizzle-orm/neon-serverless";
import * as schema from "./schema";

const databaseUrl = process.env.DATABASE_URL;

if (!databaseUrl) {
  throw new Error("DATABASE_URL is required (use your Neon pooled connection string)");
}

const globalForDb = globalThis as typeof globalThis & {
  __tradeMindNeonPool?: Pool;
};

function createPool() {
  const neonPool = new Pool({
    connectionString: databaseUrl,
    max: 5,
    connectionTimeoutMillis: 10_000,
    idleTimeoutMillis: 20_000,
  });
  neonPool.on("error", (error: Error) => console.error("Neon database pool error", error));
  return neonPool;
}

// Reuse the transaction-capable WebSocket pool during development hot reloads.
export const pool = globalForDb.__tradeMindNeonPool ?? createPool();

if (process.env.NODE_ENV !== "production") {
  globalForDb.__tradeMindNeonPool = pool;
}

export const db = drizzle(pool, { schema });
export { schema };
