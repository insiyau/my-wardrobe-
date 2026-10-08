#!/usr/bin/env node
/**
 * Seed the SQLite DB from lib/seed-data.json.
 * Usage: npm run seed
 * Idempotent-ish: skips when garments already exist (use --force to reseed).
 */
import Database from "better-sqlite3";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.join(__dirname, "..");
const DB_PATH = process.env.WARDROBE_DB_PATH || path.join(ROOT, "data", "wardrobe.db");

const SCHEMA = `
CREATE TABLE IF NOT EXISTS garments (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  name TEXT NOT NULL, category TEXT NOT NULL, color TEXT NOT NULL DEFAULT '',
  seasons TEXT NOT NULL DEFAULT '[]', notes TEXT NOT NULL DEFAULT '',
  image_path TEXT, is_favorite INTEGER NOT NULL DEFAULT 0,
  created_at TEXT NOT NULL DEFAULT (datetime('now')));
CREATE TABLE IF NOT EXISTS avatar (
  id INTEGER PRIMARY KEY CHECK (id = 1), image_path TEXT NOT NULL,
  created_at TEXT NOT NULL DEFAULT (datetime('now')));
CREATE TABLE IF NOT EXISTS looks (
  id INTEGER PRIMARY KEY AUTOINCREMENT, type TEXT NOT NULL CHECK (type IN ('worn','inspo')),
  title TEXT NOT NULL, occasion TEXT NOT NULL DEFAULT '', mood TEXT NOT NULL DEFAULT '',
  rationale TEXT NOT NULL DEFAULT '', worn_on TEXT,
  created_at TEXT NOT NULL DEFAULT (datetime('now')));
CREATE TABLE IF NOT EXISTS look_garments (
  look_id INTEGER NOT NULL REFERENCES looks(id) ON DELETE CASCADE,
  garment_id INTEGER NOT NULL REFERENCES garments(id) ON DELETE CASCADE,
  PRIMARY KEY (look_id, garment_id));
CREATE TABLE IF NOT EXISTS suggestion_history (
  id INTEGER PRIMARY KEY AUTOINCREMENT, occasion TEXT NOT NULL DEFAULT '',
  mood TEXT NOT NULL DEFAULT '', garment_ids TEXT NOT NULL DEFAULT '[]',
  created_at TEXT NOT NULL DEFAULT (datetime('now')));
`;

function main() {
  const force = process.argv.includes("--force");
  fs.mkdirSync(path.dirname(DB_PATH), { recursive: true });
  const db = new Database(DB_PATH);
  db.exec(SCHEMA);

  const count = db.prepare("SELECT COUNT(*) AS n FROM garments").get().n;
  if (count > 0 && !force) {
    console.log(`DB already has ${count} garments; skipping seed (use --force to reseed).`);
    return;
  }
  if (force) {
    db.exec("DELETE FROM look_garments; DELETE FROM looks; DELETE FROM suggestion_history; DELETE FROM garments; DELETE FROM avatar;");
  }

  const seed = JSON.parse(fs.readFileSync(path.join(ROOT, "lib", "seed-data.json"), "utf8"));
  const insert = db.prepare(
    "INSERT INTO garments (name, category, color, seasons, notes, image_path) VALUES (?,?,?,?,?,?)"
  );
  const tx = db.transaction((rows) => {
    for (const g of rows) {
      insert.run(g.name, g.category, g.color || "", JSON.stringify(g.seasons || []), g.notes || "", g.image || null);
    }
  });
  tx(seed);
  console.log(`Seeded ${seed.length} garments.`);

  const avatarSrc = path.join(ROOT, "public", "seed", "avatar.jpg");
  if (fs.existsSync(avatarSrc)) {
    db.prepare("INSERT OR REPLACE INTO avatar (id, image_path) VALUES (1, ?)").run("/seed/avatar.jpg");
    console.log("Seeded avatar.");
  }
  // a starter inspo look so the Looks tab isn't empty
  const first = db.prepare("SELECT id FROM garments ORDER BY id LIMIT 3").all().map((r) => r.id);
  if (first.length) {
    const info = db.prepare(
      "INSERT INTO looks (type, title, occasion, mood, rationale) VALUES ('inspo',?,?,?,?)"
    ).run("First seed look", "everyday", "casual", "Starter look from your closet.");
    const link = db.prepare("INSERT INTO look_garments (look_id, garment_id) VALUES (?,?)");
    for (const gid of first) link.run(Number(info.lastInsertRowid), gid);
    console.log("Seeded 1 inspo look.");
  }
}

main();
