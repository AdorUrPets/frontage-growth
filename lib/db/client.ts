import Database from "better-sqlite3";
import path from "path";
import { SCHEMA_SQL } from "./schema";
import { seedDefaults } from "./seed";

// Mirrors lead-finder's app/lib/db.ts: DATABASE_URL="file:./whatever.db",
// resolved relative to project root, connection cached across dev hot-reloads.
const dbFileName = (() => {
  const url = process.env.DATABASE_URL || "file:./frontage-growth.db";
  const raw = url.startsWith("file:") ? url.slice("file:".length) : url;
  return raw.replace(/^\.?\/?/, "") || "frontage-growth.db";
})();
const dbPath = path.join(/* turbopackIgnore: true */ process.cwd(), dbFileName);

const globalForDb = globalThis as unknown as { __frontageGrowthDb?: Database.Database };

// Columns added to tables that already existed on someone's disk before the
// column was introduced — CREATE TABLE IF NOT EXISTS won't add them. No
// migration framework for a single-file local DB; just try each ALTER once
// and ignore "duplicate column" if it's already there.
const COLUMN_MIGRATIONS = [
  "ALTER TABLE missions ADD COLUMN protocol TEXT NOT NULL DEFAULT 'seo'",
  "ALTER TABLE sites ADD COLUMN search_console_property TEXT",
  "ALTER TABLE sites ADD COLUMN google_refresh_token_ciphertext TEXT",
  "ALTER TABLE sites ADD COLUMN google_refresh_token_iv TEXT",
  "ALTER TABLE sites ADD COLUMN google_refresh_token_tag TEXT",
  "ALTER TABLE sites ADD COLUMN google_connection_id TEXT REFERENCES google_connections(id) ON DELETE SET NULL",
  "ALTER TABLE pages ADD COLUMN price REAL",
  "ALTER TABLE pages ADD COLUMN price_currency TEXT",
  "ALTER TABLE pages ADD COLUMN images_total INTEGER",
  "ALTER TABLE pages ADD COLUMN images_missing_alt INTEGER",
  "ALTER TABLE pages ADD COLUMN viewport_content TEXT",
  "ALTER TABLE pages ADD COLUMN has_lorem_ipsum INTEGER",
  "ALTER TABLE sites ADD COLUMN analytics_property_id TEXT",
  "ALTER TABLE sites ADD COLUMN repo_local_path TEXT",
];

// Retired features (Shopify integration, the Growth Agent live-site pull
// token) — these drop the columns/table they used so no stored
// tokens/secrets are left behind on disk. Safe to run repeatedly: a
// missing column/table is caught and ignored, same as the ADD COLUMN
// migrations above.
const COLUMN_REMOVAL_MIGRATIONS = [
  "ALTER TABLE sites DROP COLUMN shopify_shop_domain",
  "ALTER TABLE sites DROP COLUMN shopify_access_token_ciphertext",
  "ALTER TABLE sites DROP COLUMN shopify_access_token_iv",
  "ALTER TABLE sites DROP COLUMN shopify_access_token_tag",
  "ALTER TABLE sites DROP COLUMN platform",
  "DROP TABLE IF EXISTS shopify_oauth_pending",
  "ALTER TABLE sites DROP COLUMN growth_agent_token_hash",
  "ALTER TABLE sites DROP COLUMN growth_agent_token_created_at",
];

function runMigrations(db: Database.Database) {
  for (const sql of COLUMN_MIGRATIONS) {
    try {
      db.exec(sql);
    } catch {
      // column already exists — fine
    }
  }
  for (const sql of COLUMN_REMOVAL_MIGRATIONS) {
    try {
      db.exec(sql);
    } catch {
      // already dropped, or never existed on a fresh DB — fine
    }
  }
  try {
    db.exec(`DELETE FROM agents WHERE code = 'seo_publisher'`);
  } catch {
    // agents table not created yet on a brand-new DB — fine
  }
  migrateLegacyPerSiteGoogleTokens(db);
}

// One-time forward migration: the first version of Search Console support
// stored a refresh token per-site instead of per-account. Any site that
// still has one of those (and no google_connection_id yet) gets it promoted
// into a real google_connections row, so whoever already went through the
// OAuth dance once doesn't have to do it again after this fix.
function migrateLegacyPerSiteGoogleTokens(db: Database.Database) {
  const legacy = db
    .prepare(
      `SELECT id, google_refresh_token_ciphertext, google_refresh_token_iv, google_refresh_token_tag
       FROM sites
       WHERE google_refresh_token_ciphertext IS NOT NULL AND google_connection_id IS NULL`
    )
    .all() as { id: string; google_refresh_token_ciphertext: string; google_refresh_token_iv: string; google_refresh_token_tag: string }[];

  for (const site of legacy) {
    const connectionId = crypto.randomUUID();
    db.prepare(
      `INSERT INTO google_connections (id, label, refresh_token_ciphertext, refresh_token_iv, refresh_token_tag)
       VALUES (?, 'Migrated connection', ?, ?, ?)`
    ).run(connectionId, site.google_refresh_token_ciphertext, site.google_refresh_token_iv, site.google_refresh_token_tag);
    db.prepare(
      `UPDATE sites SET google_connection_id = ?, google_refresh_token_ciphertext = NULL, google_refresh_token_iv = NULL, google_refresh_token_tag = NULL WHERE id = ?`
    ).run(connectionId, site.id);
  }
}

export function getDb(): Database.Database {
  if (!globalForDb.__frontageGrowthDb) {
    const db = new Database(dbPath);
    db.pragma("journal_mode = WAL");
    db.pragma("foreign_keys = ON");
    db.exec(SCHEMA_SQL);
    runMigrations(db);
    seedDefaults(db);
    globalForDb.__frontageGrowthDb = db;
  }
  return globalForDb.__frontageGrowthDb;
}

export function newId(): string {
  return crypto.randomUUID();
}
