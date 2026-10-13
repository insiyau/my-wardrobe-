import { NextRequest, NextResponse } from "next/server";
import { getDb, rowToGarment } from "@/lib/db";
import { saveUpload } from "@/lib/images";
import { boundedString, parseCategory, parseSeasonList } from "@/lib/validation";

export async function GET(req: NextRequest) {
  const db = getDb();
  const { searchParams } = new URL(req.url);
  const category = parseCategory(searchParams.get("category"));
  const q = searchParams.get("q")?.trim().toLowerCase();
  const where: string[] = [];
  const params: string[] = [];
  if (category) {
    where.push("category = ?");
    params.push(category);
  }
  if (q) {
    where.push("(lower(name) LIKE ? OR lower(color) LIKE ? OR lower(notes) LIKE ?)");
    params.push(`%${q}%`, `%${q}%`, `%${q}%`);
  }
  const rows = db
    .prepare(`SELECT * FROM garments ${where.length ? "WHERE " + where.join(" AND ") : ""} ORDER BY created_at DESC, id DESC`)
    .all(...params);
  return NextResponse.json({ garments: rows.map(rowToGarment) });
}

export async function POST(req: NextRequest) {
  const form = await req.formData();
  const name = boundedString(form.get("name"), 80);
  const category = parseCategory(form.get("category")) ?? "other";
  const color = boundedString(form.get("color"), 40);
  const seasons = parseSeasonList(form.get("seasons"));
  const notes = boundedString(form.get("notes"), 280);
  const file = form.get("image");
  if (!name) return NextResponse.json({ error: "Name is required" }, { status: 400 });
  let image_path: string | null = null;
  if (file instanceof File && file.size > 0) {
    try {
      image_path = await saveUpload(file);
    } catch (e: unknown) {
      return NextResponse.json({ error: e instanceof Error ? e.message : "Image upload failed" }, { status: 400 });
    }
  }
  const db = getDb();
  const info = db
    .prepare("INSERT INTO garments (name, category, color, seasons, notes, image_path) VALUES (?,?,?,?,?,?)")
    .run(name, category, color, JSON.stringify(seasons), notes, image_path);
  const row = db.prepare("SELECT * FROM garments WHERE id = ?").get(info.lastInsertRowid);
  return NextResponse.json({ garment: rowToGarment(row) }, { status: 201 });
}
