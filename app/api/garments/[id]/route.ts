import { NextRequest, NextResponse } from "next/server";
import { getDb, rowToGarment } from "@/lib/db";
import { CATEGORIES } from "@/lib/types";

export async function PATCH(req: NextRequest, { params }: { params: { id: string } }) {
  const db = getDb();
  const existing = db.prepare("SELECT * FROM garments WHERE id = ?").get(params.id);
  if (!existing) return NextResponse.json({ error: "Not found" }, { status: 404 });
  const body = await req.json().catch(() => ({}));
  const fields: string[] = [];
  const values: any[] = [];
  if (typeof body.name === "string" && body.name.trim()) {
    fields.push("name = ?"); values.push(body.name.slice(0, 80));
  }
  if (typeof body.category === "string" && (CATEGORIES as string[]).includes(body.category)) {
    fields.push("category = ?"); values.push(body.category);
  }
  if (typeof body.color === "string") { fields.push("color = ?"); values.push(body.color.slice(0, 40)); }
  if (Array.isArray(body.seasons)) { fields.push("seasons = ?"); values.push(JSON.stringify(body.seasons.slice(0, 4))); }
  if (typeof body.notes === "string") { fields.push("notes = ?"); values.push(body.notes.slice(0, 280)); }
  if (fields.length === 0) return NextResponse.json({ error: "Nothing to update" }, { status: 400 });
  values.push(params.id);
  db.prepare(`UPDATE garments SET ${fields.join(", ")} WHERE id = ?`).run(...values);
  const row = db.prepare("SELECT * FROM garments WHERE id = ?").get(params.id);
  return NextResponse.json({ garment: rowToGarment(row) });
}

export async function DELETE(_req: NextRequest, { params }: { params: { id: string } }) {
  const db = getDb();
  db.prepare("DELETE FROM look_garments WHERE garment_id = ?").run(params.id);
  const info = db.prepare("DELETE FROM garments WHERE id = ?").run(params.id);
  if (info.changes === 0) return NextResponse.json({ error: "Not found" }, { status: 404 });
  return NextResponse.json({ ok: true });
}
