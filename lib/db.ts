import Database from "better-sqlite3";
import fs from "node:fs";
import path from "node:path";

const DB_PATH =
  process.env.WARDROBE_DB_PATH || path.join(process.cwd(), "data", "wardrobe.db");

let db: Database.Database | null = null;

export function getDb(): Database.Database {
  if (db) return db;
  fs.mkdirSync(path.dirname(DB_PATH), { recursive: true });
  db = new Database(DB_PATH);
  db.pragma("journal_mode = WAL");
  db.exec(`
    CREATE TABLE IF NOT EXISTS garments (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      name TEXT NOT NULL,
      category TEXT NOT NULL,
      color TEXT NOT NULL DEFAULT '',
      seasons TEXT NOT NULL DEFAULT '[]',
      notes TEXT NOT NULL DEFAULT '',
      image_path TEXT,
      is_favorite INTEGER NOT NULL DEFAULT 0,
      created_at TEXT NOT NULL DEFAULT (datetime('now'))
    );
    CREATE TABLE IF NOT EXISTS avatar (
      id INTEGER PRIMARY KEY CHECK (id = 1),
      image_path TEXT NOT NULL,
      created_at TEXT NOT NULL DEFAULT (datetime('now'))
    );
    CREATE TABLE IF NOT EXISTS looks (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      type TEXT NOT NULL CHECK (type IN ('worn','inspo')),
      title TEXT NOT NULL,
      occasion TEXT NOT NULL DEFAULT '',
      mood TEXT NOT NULL DEFAULT '',
      rationale TEXT NOT NULL DEFAULT '',
      worn_on TEXT,
      created_at TEXT NOT NULL DEFAULT (datetime('now'))
    );
    CREATE TABLE IF NOT EXISTS look_garments (
      look_id INTEGER NOT NULL REFERENCES looks(id) ON DELETE CASCADE,
      garment_id INTEGER NOT NULL REFERENCES garments(id) ON DELETE CASCADE,
      PRIMARY KEY (look_id, garment_id)
    );
    CREATE TABLE IF NOT EXISTS suggestion_history (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      occasion TEXT NOT NULL DEFAULT '',
      mood TEXT NOT NULL DEFAULT '',
      garment_ids TEXT NOT NULL DEFAULT '[]',
      created_at TEXT NOT NULL DEFAULT (datetime('now'))
    );
  `);
  return db;
}

export function rowToGarment(row: any): import("./types").Garment {
  return {
    ...row,
    seasons: safeParse(row.seasons, []),
    is_favorite: row.is_favorite ? 1 : 0,
  };
}

function safeParse(s: string, fallback: any) {
  try {
    return JSON.parse(s ?? "");
  } catch {
    return fallback;
  }
}
