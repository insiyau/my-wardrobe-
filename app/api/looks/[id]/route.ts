import { NextRequest, NextResponse } from "next/server";
import { getDb } from "@/lib/db";

export async function DELETE(_req: NextRequest, { params }: { params: { id: string } }) {
  const db = getDb();
  db.prepare("DELETE FROM look_garments WHERE look_id = ?").run(params.id);
  const info = db.prepare("DELETE FROM looks WHERE id = ?").run(params.id);
  if (info.changes === 0) return NextResponse.json({ error: "Not found" }, { status: 404 });
  return NextResponse.json({ ok: true });
}
