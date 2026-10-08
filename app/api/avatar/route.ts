import { NextRequest, NextResponse } from "next/server";
import { getDb } from "@/lib/db";
import { saveUpload } from "@/lib/images";

export async function GET() {
  const db = getDb();
  const row: any = db.prepare("SELECT * FROM avatar WHERE id = 1").get();
  return NextResponse.json({ avatar: row ? { image_path: row.image_path } : null });
}

export async function POST(req: NextRequest) {
  const form = await req.formData();
  const file = form.get("image");
  if (!(file instanceof File) || file.size === 0)
    return NextResponse.json({ error: "An image file is required" }, { status: 400 });
  try {
    const image_path = await saveUpload(file);
    const db = getDb();
    db.prepare("INSERT INTO avatar (id, image_path) VALUES (1, ?) ON CONFLICT(id) DO UPDATE SET image_path = excluded.image_path").run(image_path);
    return NextResponse.json({ avatar: { image_path } });
  } catch (e: any) {
    return NextResponse.json({ error: e.message }, { status: 400 });
  }
}
