import { NextRequest, NextResponse } from "next/server";
import { getDb, rowToGarment } from "@/lib/db";

type RouteContext = { params: Promise<{ id: string }> };

export async function POST(_req: NextRequest, { params }: RouteContext) {
  const { id } = await params;
  const db = getDb();
  const existing = db.prepare("SELECT * FROM garments WHERE id = ?").get(id) as { is_favorite?: unknown } | undefined;
  if (!existing) return NextResponse.json({ error: "Not found" }, { status: 404 });
  const next = existing.is_favorite ? 0 : 1;
  db.prepare("UPDATE garments SET is_favorite = ? WHERE id = ?").run(next, id);
  const row = db.prepare("SELECT * FROM garments WHERE id = ?").get(id);
  return NextResponse.json({ garment: rowToGarment(row) });
}
