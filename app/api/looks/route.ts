import { NextRequest, NextResponse } from "next/server";
import { getDb, rowToGarment } from "@/lib/db";
import { boundedString, parseIdList, parseIsoDate, parseLookType } from "@/lib/validation";
import type Database from "better-sqlite3";
import type { Garment, Look } from "@/lib/types";

type LookWithGarments = Look & { garments: Garment[] };
type LookRow = Omit<Look, "garment_ids">;
type GarmentIdRow = { garment_id: number };
type IdRow = { id: number };

function lookWithGarments(db: Database.Database, row: LookRow): LookWithGarments {
  const garment_ids: number[] = db
    .prepare("SELECT garment_id FROM look_garments WHERE look_id = ? ORDER BY garment_id")
    .all(row.id)
    .map((x) => (x as GarmentIdRow).garment_id);
  const garments = garment_ids.length
    ? db
      .prepare(`SELECT * FROM garments WHERE id IN (${garment_ids.map(() => "?").join(",")})`)
      .all(...garment_ids)
      .map(rowToGarment)
    : [];
  const byId = new Map(garments.map((g: Garment) => [g.id, g]));
  return { ...row, garment_ids, garments: garment_ids.map((id) => byId.get(id)).filter(Boolean) as Garment[] };
}

export async function GET(req: NextRequest) {
  const db = getDb();
  const type = parseLookType(new URL(req.url).searchParams.get("type"));
  const rows =
    type === "worn" || type === "inspo"
      ? db.prepare("SELECT * FROM looks WHERE type = ? ORDER BY created_at DESC, id DESC").all(type) as LookRow[]
      : db.prepare("SELECT * FROM looks ORDER BY created_at DESC, id DESC").all() as LookRow[];
  return NextResponse.json({ looks: rows.map((r) => lookWithGarments(db, r)) });
}

export async function POST(req: NextRequest) {
  const body = (await req.json().catch(() => ({}))) as Record<string, unknown>;
  const type = parseLookType(body.type);
  const title = boundedString(body.title, 80);
  const garmentIds = parseIdList(body.garmentIds);
  if (!type)
    return NextResponse.json({ error: "type must be 'worn' or 'inspo'" }, { status: 400 });
  if (!title) return NextResponse.json({ error: "title is required" }, { status: 400 });
  if (garmentIds.length === 0) return NextResponse.json({ error: "Pick at least one garment" }, { status: 400 });

  const db = getDb();
  const existing = db.prepare(`SELECT id FROM garments WHERE id IN (${garmentIds.map(() => "?").join(",")})`).all(...garmentIds) as IdRow[];
  if (existing.length !== garmentIds.length)
    return NextResponse.json({ error: "One or more garments not found" }, { status: 400 });

  const occasion = boundedString(body.occasion, 80);
  const mood = boundedString(body.mood, 80);
  const rationale = boundedString(body.rationale, 400);
  const worn_on = type === "worn" ? parseIsoDate(body.wornOn, new Date().toISOString().slice(0, 10)) : null;

  const info = db
    .prepare("INSERT INTO looks (type, title, occasion, mood, rationale, worn_on) VALUES (?,?,?,?,?,?)")
    .run(type, title, occasion, mood, rationale, worn_on);
  const link = db.prepare("INSERT OR IGNORE INTO look_garments (look_id, garment_id) VALUES (?,?)");
  for (const gid of garmentIds) link.run(info.lastInsertRowid, gid);
  const row = db.prepare("SELECT * FROM looks WHERE id = ?").get(info.lastInsertRowid) as LookRow;
  const look = lookWithGarments(db, row);
  return NextResponse.json({ look }, { status: 201 });
}
