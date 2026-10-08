import { NextRequest, NextResponse } from "next/server";
import { getDb, rowToGarment } from "@/lib/db";
import { downloadImage, extractProductImage } from "@/lib/images";

/**
 * Self-serve "paste a product link" import.
 * Fetches the page server-side, grabs its main image, stores it locally,
 * and creates the garment. The client shows progress / error states.
 */
export async function POST(req: NextRequest) {
  const { url, name } = await req.json().catch(() => ({}));
  if (!url || typeof url !== "string")
    return NextResponse.json({ error: "A product URL is required" }, { status: 400 });
  try {
    const { imageUrl, title } = await extractProductImage(url);
    const image_path = await downloadImage(imageUrl);
    const db = getDb();
    const finalName = (typeof name === "string" && name.trim() ? name : title).slice(0, 80);
    const info = db
      .prepare("INSERT INTO garments (name, category, color, seasons, notes, image_path) VALUES (?,?,?,?,?,?)")
      .run(finalName, "other", "", JSON.stringify([]), `Imported from ${url.slice(0, 120)}`, image_path);
    const row = db.prepare("SELECT * FROM garments WHERE id = ?").get(info.lastInsertRowid);
    return NextResponse.json({ garment: rowToGarment(row) }, { status: 201 });
  } catch (e: any) {
    return NextResponse.json({ error: e.message || "Import failed" }, { status: 422 });
  }
}
