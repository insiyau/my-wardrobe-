import Database from "better-sqlite3";
import fs from "node:fs";
import path from "node:path";
import { parseCategory, parseSeasonList } from "./validation";
import type { Garment } from "./types";

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

type GarmentRow = {
  id?: unknown;
  name?: unknown;
  category?: unknown;
  color?: unknown;
  seasons?: unknown;
  notes?: unknown;
  image_path?: unknown;
  is_favorite?: unknown;
  created_at?: unknown;
};

export function rowToGarment(row: unknown): Garment {
  const value = (row ?? {}) as GarmentRow;
  return {
    id: Number(value.id) || 0,
    name: typeof value.name === "string" ? value.name : "",
    category: parseCategory(value.category) ?? "other",
    color: typeof value.color === "string" ? value.color : "",
    seasons: parseSeasonList(value.seasons),
    notes: typeof value.notes === "string" ? value.notes : "",
    image_path: typeof value.image_path === "string" ? value.image_path : null,
    is_favorite: value.is_favorite ? 1 : 0,
    created_at: typeof value.created_at === "string" ? value.created_at : "",
  };
}
