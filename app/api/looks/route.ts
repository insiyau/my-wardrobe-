import { NextRequest, NextResponse } from "next/server";
import { getDb, rowToGarment } from "@/lib/db";
import { Look, LookType } from "@/lib/types";

function lookWithGarments(db: any, row: any): Look {
  const garment_ids: number[] = db
    .prepare("SELECT garment_id FROM look_garments WHERE look_id = ? ORDER BY garment_id")
    .all(row.id)
    .map((x: any) => x.garment_id);
  return { ...row, garment_ids };
}

export async function GET(req: NextRequest) {
  const db = getDb();
  const type = new URL(req.url).searchParams.get("type") as LookType | null;
  const rows: any[] =
    type === "worn" || type === "inspo"
      ? db.prepare("SELECT * FROM looks WHERE type = ? ORDER BY created_at DESC, id DESC").all(type)
      : db.prepare("SELECT * FROM looks ORDER BY created_at DESC, id DESC").all();
  return NextResponse.json({ looks: rows.map((r) => lookWithGarments(db, r)) });
}

export async function POST(req: NextRequest) {
  const body = await req.json().catch(() => ({}));
  const type = body.type as LookType;
  const title = String(body.title || "").slice(0, 80);
  const garmentIds: number[] = Array.isArray(body.garmentIds) ? body.garmentIds.map(Number).filter(Boolean) : [];
  if (type !== "worn" && type !== "inspo")
    return NextResponse.json({ error: "type must be 'worn' or 'inspo'" }, { status: 400 });
  if (!title) return NextResponse.json({ error: "title is required" }, { status: 400 });
  if (garmentIds.length === 0) return NextResponse.json({ error: "Pick at least one garment" }, { status: 400 });

  const db = getDb();
  const existing = db.prepare(`SELECT id FROM garments WHERE id IN (${garmentIds.map(() => "?").join(",")})`).all(...garmentIds);
  if (existing.length !== garmentIds.length)
    return NextResponse.json({ error: "One or more garments not found" }, { status: 400 });

  const occasion = String(body.occasion || "").slice(0, 80);
  const mood = String(body.mood || "").slice(0, 80);
  const rationale = String(body.rationale || "").slice(0, 400);
  const worn_on = type === "worn" ? String(body.wornOn || new Date().toISOString().slice(0, 10)).slice(0, 10) : null;

  const info = db
    .prepare("INSERT INTO looks (type, title, occasion, mood, rationale, worn_on) VALUES (?,?,?,?,?,?)")
    .run(type, title, occasion, mood, rationale, worn_on);
  const link = db.prepare("INSERT OR IGNORE INTO look_garments (look_id, garment_id) VALUES (?,?)");
  for (const gid of garmentIds) link.run(info.lastInsertRowid, gid);
  const row = db.prepare("SELECT * FROM looks WHERE id = ?").get(info.lastInsertRowid);
  const look = lookWithGarments(db, row);
  const garments = db
    .prepare(`SELECT * FROM garments WHERE id IN (${garmentIds.map(() => "?").join(",")})`)
    .all(...garmentIds)
    .map(rowToGarment);
  return NextResponse.json({ look: { ...look, garments } }, { status: 201 });
}
