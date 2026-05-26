/**
 * One-off: apply supabase/schema.sql using DATABASE_URL or SUPABASE_DB_PASSWORD.
 * Usage: SUPABASE_DB_PASSWORD=... node scripts/apply-schema.mjs
 */
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";
import pg from "pg";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const projectRef = "kboqbgnegjwtlnqloqzo";
const password = process.env.SUPABASE_DB_PASSWORD?.trim();
if (!password) {
  console.error("Set SUPABASE_DB_PASSWORD");
  process.exit(1);
}

const connectionString = `postgresql://postgres:${encodeURIComponent(password)}@db.${projectRef}.supabase.co:5432/postgres`;

const sqlPath = path.join(__dirname, "..", "supabase", "schema.sql");
const sql = fs.readFileSync(sqlPath, "utf8");

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
