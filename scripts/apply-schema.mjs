/**
 * Apply supabase/reset_all.sql via Postgres (full reset — deletes all app data).
 *
 * Easiest: paste the pooler URI from Supabase → Settings → Database
 * into .env as DATABASE_URL, then: npm run db:apply
 */
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";
import pg from "pg";

const __dirname = path.dirname(fileURLToPath(import.meta.url));

loadDotEnv(path.join(__dirname, "..", ".env"));

const sqlPath = path.join(__dirname, "..", "supabase", "reset_all.sql");
const sql = fs.readFileSync(sqlPath, "utf8");

const connectionString = resolveConnectionString();
if (!connectionString) {
  console.error(`
Could not build a database URL.

Option A (recommended): In Supabase → Project Settings → Database → Connection string,
choose "Session pooler" or "URI", copy it into .env as:

  DATABASE_URL=postgresql://postgres.[ref]:[password]@aws-0-[region].pooler.supabase.com:5432/postgres

Then run: npm run db:apply

Option B: Open supabase/reset_all.sql in the SQL Editor and run it there.

Note: db.[project].supabase.co often fails with ENOTFOUND on IPv4-only networks.
Use the pooler host (*.pooler.supabase.com), not the direct db.* host.
`);
  process.exit(1);
}

console.warn("Applying reset_all.sql — this DELETES all LoKohot tables and data.");

const client = new pg.Client({
  connectionString,
  ssl: { rejectUnauthorized: false },
});

try {
  await client.connect();
  await client.query(sql);
  const { rows } = await client.query("select count(*)::int as n from public.players");
  console.log("Schema applied. players count:", rows[0]?.n);
} catch (err) {
  console.error(err);
  process.exit(1);
} finally {
  await client.end();
}

function resolveConnectionString() {
  const direct = process.env.DATABASE_URL?.trim();
  if (direct) return direct;

  const password = process.env.SUPABASE_DB_PASSWORD?.trim();
  if (!password) return null;

  const projectRef =
    process.env.SUPABASE_PROJECT_REF?.trim() || projectRefFromSupabaseUrl(process.env.VITE_SUPABASE_URL);

  if (!projectRef) {
    console.error("Set SUPABASE_PROJECT_REF or VITE_SUPABASE_URL in .env");
    return null;
  }

  const region = process.env.SUPABASE_DB_REGION?.trim();
  if (region) {
    const user = `postgres.${projectRef}`;
    return `postgresql://${user}:${encodeURIComponent(password)}@aws-0-${region}.pooler.supabase.com:5432/postgres`;
  }

  return `postgresql://postgres:${encodeURIComponent(password)}@db.${projectRef}.supabase.co:5432/postgres`;
}

function projectRefFromSupabaseUrl(url) {
  if (!url) return null;
  try {
    const host = new URL(url.trim()).hostname;
    const m = host.match(/^([a-z0-9]+)\.supabase\.co$/i);
    return m ? m[1] : null;
  } catch {
    return null;
  }
}

/** Minimal .env loader (no dependency). */
function loadDotEnv(filePath) {
  if (!fs.existsSync(filePath)) return;
  const text = fs.readFileSync(filePath, "utf8");
  for (const line of text.split("\n")) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith("#")) continue;
    const eq = trimmed.indexOf("=");
    if (eq <= 0) continue;
    const key = trimmed.slice(0, eq).trim();
    let val = trimmed.slice(eq + 1).trim();
    if (
      (val.startsWith('"') && val.endsWith('"')) ||
      (val.startsWith("'") && val.endsWith("'"))
    ) {
      val = val.slice(1, -1);
    }
    if (process.env[key] === undefined) process.env[key] = val;
  }
}
