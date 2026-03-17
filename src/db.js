import "dotenv/config";
import pg from "pg";

const { Pool } = pg;

const IS_TEST = process.env.NODE_ENV === "test" || Boolean(process.env.VITEST);
const APP_DATABASE_URL = process.env.DATABASE_URL;
const TEST_DATABASE_URL =
  process.env.TEST_DATABASE_URL ??
  process.env.TEST_DATABASE ??
  process.env.DATABASE_URL_TEST;
const DATABASE_URL = IS_TEST ? TEST_DATABASE_URL : APP_DATABASE_URL;

if (IS_TEST && APP_DATABASE_URL && TEST_DATABASE_URL && APP_DATABASE_URL.trim() === TEST_DATABASE_URL.trim()) {
  throw new Error(
    "Refusing to run tests: test DB URL matches DATABASE_URL. Set TEST_DATABASE_URL (or TEST_DATABASE / DATABASE_URL_TEST) to a separate database.",
  );
}

if (!DATABASE_URL || typeof DATABASE_URL !== "string") {
  throw new Error(
    IS_TEST
      ? "TEST_DATABASE_URL (or TEST_DATABASE / DATABASE_URL_TEST) is required for tests (e.g. postgresql://postgres:postgres@127.0.0.1:5432/imageboard_test)"
      : "DATABASE_URL is required (e.g. postgresql://postgres:postgres@127.0.0.1:5432/imageboard)",
  );
}

export const pool = new Pool({
  connectionString: DATABASE_URL,
  // helpful for local dev; safe to remove later
  max: Number(process.env.PGPOOL_MAX ?? 10),
  idleTimeoutMillis: Number(process.env.PGPOOL_IDLE_TIMEOUT_MS ?? 30_000),
  connectionTimeoutMillis: Number(process.env.PGPOOL_CONN_TIMEOUT_MS ?? 5_000),
});
