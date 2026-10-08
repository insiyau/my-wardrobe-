import { NextRequest, NextResponse } from "next/server";
import { getDb, rowToGarment } from "@/lib/db";

export async function POST(_req: NextRequest, { params }: { params: { id: string } }) {
  const db = getDb();
  const existing: any = db.prepare("SELECT * FROM garments WHERE id = ?").get(params.id);
  if (!existing) return NextResponse.json({ error: "Not found" }, { status: 404 });
  const next = existing.is_favorite ? 0 : 1;
  db.prepare("UPDATE garments SET is_favorite = ? WHERE id = ?").run(next, params.id);
  const row = db.prepare("SELECT * FROM garments WHERE id = ?").get(params.id);
  return NextResponse.json({ garment: rowToGarment(row) });
}
