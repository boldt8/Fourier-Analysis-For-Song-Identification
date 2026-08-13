import { mkdir, stat } from "node:fs/promises";
import { Database } from "bun:sqlite";
import { CATALOG_DATABASE_PATH, GENERATED_DIRECTORY } from "./paths.js";

async function pathExists(path) {
  try {
    await stat(path);
    return true;
  } catch {
    return false;
  }
}

export async function ensureGeneratedDirectory() {
  await mkdir(GENERATED_DIRECTORY, { recursive: true });
}

export function initializeCatalogSchema(db) {
  db.exec(`
    CREATE TABLE IF NOT EXISTS metadata (
      key TEXT PRIMARY KEY,
      value TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS tracks (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      slug TEXT NOT NULL UNIQUE,
      title TEXT NOT NULL,
      artist TEXT NOT NULL,
      album TEXT,
      source_path TEXT NOT NULL,
      duration_sec REAL NOT NULL,
      sample_rate INTEGER NOT NULL,
      peak_count INTEGER NOT NULL DEFAULT 0,
      fingerprint_count INTEGER NOT NULL DEFAULT 0,
      created_at TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS fingerprints (
      hash INTEGER NOT NULL,
      track_id INTEGER NOT NULL,
      anchor_frame INTEGER NOT NULL,
      FOREIGN KEY (track_id) REFERENCES tracks(id) ON DELETE CASCADE
    );

    CREATE INDEX IF NOT EXISTS fingerprints_hash_idx ON fingerprints(hash);
    CREATE INDEX IF NOT EXISTS fingerprints_track_idx ON fingerprints(track_id);
  `);
}

export async function openCatalogDatabase({ createIfMissing = true } = {}) {
  await ensureGeneratedDirectory();

  if (!createIfMissing && !(await pathExists(CATALOG_DATABASE_PATH))) {
    return null;
  }

  const db = new Database(CATALOG_DATABASE_PATH);
  initializeCatalogSchema(db);
  return db;
}
