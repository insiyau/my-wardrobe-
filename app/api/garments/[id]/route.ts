import { NextRequest, NextResponse } from "next/server";
import { getDb, rowToGarment } from "@/lib/db";
import { boundedString, parseCategory, parseSeasonList } from "@/lib/validation";

type RouteContext = { params: Promise<{ id: string }> };

export async function PATCH(req: NextRequest, { params }: RouteContext) {
  const { id } = await params;
  const db = getDb();
  const existing = db.prepare("SELECT * FROM garments WHERE id = ?").get(id);
  if (!existing) return NextResponse.json({ error: "Not found" }, { status: 404 });
  const body = await req.json().catch(() => ({}));
  const fields: string[] = [];
  const values: (number | string)[] = [];
  const name = boundedString(body.name, 80);
  if (name) {
    fields.push("name = ?"); values.push(name);
  }
  const category = parseCategory(body.category);
  if (category) {
    fields.push("category = ?"); values.push(category);
  }
  if (typeof body.color === "string") { fields.push("color = ?"); values.push(boundedString(body.color, 40)); }
  if (Array.isArray(body.seasons)) { fields.push("seasons = ?"); values.push(JSON.stringify(parseSeasonList(body.seasons))); }
  if (typeof body.notes === "string") { fields.push("notes = ?"); values.push(boundedString(body.notes, 280)); }
  if (fields.length === 0) return NextResponse.json({ error: "Nothing to update" }, { status: 400 });
  values.push(id);
  db.prepare(`UPDATE garments SET ${fields.join(", ")} WHERE id = ?`).run(...values);
  const row = db.prepare("SELECT * FROM garments WHERE id = ?").get(id);
  return NextResponse.json({ garment: rowToGarment(row) });
}

export async function DELETE(_req: NextRequest, { params }: RouteContext) {
  const { id } = await params;
  const db = getDb();
  db.prepare("DELETE FROM look_garments WHERE garment_id = ?").run(id);
  const info = db.prepare("DELETE FROM garments WHERE id = ?").run(id);
  if (info.changes === 0) return NextResponse.json({ error: "Not found" }, { status: 404 });
  return NextResponse.json({ ok: true });
}
