import { NextRequest, NextResponse } from "next/server";
import { getDb, rowToGarment } from "@/lib/db";
import fs from "node:fs";
import path from "node:path";
import crypto from "node:crypto";

/**
 * OPTIONAL AI realistic try-on.
 * Requires OPENAI_API_KEY. Edits the stored avatar image so the doll wears
 * the selected garments. Without a key, responds { skipped: true } and the
 * client falls back to the instant outfit-board collage (no AI needed).
 */
export async function POST(req: NextRequest) {
  const apiKey = process.env.OPENAI_API_KEY;
  if (!apiKey) {
    return NextResponse.json({
      skipped: true,
      reason: "Set OPENAI_API_KEY to enable AI realistic try-on. The instant outfit board works without it.",
    });
  }
  const body = await req.json().catch(() => ({}));
  const garmentIds: number[] = Array.isArray(body.garmentIds) ? body.garmentIds.map(Number).filter(Boolean) : [];
  if (garmentIds.length === 0) return NextResponse.json({ error: "garmentIds required" }, { status: 400 });

  const db = getDb();
  const avatar: any = db.prepare("SELECT * FROM avatar WHERE id = 1").get();
  if (!avatar?.image_path) return NextResponse.json({ error: "Set an avatar first" }, { status: 400 });
  const garments = db
    .prepare(`SELECT * FROM garments WHERE id IN (${garmentIds.map(() => "?").join(",")})`)
    .all(...garmentIds)
    .map(rowToGarment);

  const avatarFile = path.join(process.cwd(), "public", avatar.image_path.replace(/^\//, ""));
  if (!fs.existsSync(avatarFile)) return NextResponse.json({ error: "Avatar image file missing" }, { status: 500 });

  const garmentDesc = garments.map((g) => `${g.color} ${g.name} (${g.notes})`.slice(0, 140)).join("; ");
  const prompt =
    `Edit this fashion-doll illustration so she is wearing the following outfit, keeping her face, hair, skin tone, proportions and pose EXACTLY the same — change only the clothing: ${garmentDesc}. ` +
    `Match each garment's true cut and silhouette (e.g. barrel-leg pants stay barrel-shaped, cropped tops stay cropped). Clean studio background.`;

  const form = new FormData();
  form.append("model", process.env.OPENAI_TRYON_MODEL || "gpt-image-1");
  form.append("prompt", prompt);
  form.append("image", new Blob([fs.readFileSync(avatarFile)]), "avatar.png");

  const res = await fetch("https://api.openai.com/v1/images/edits", {
    method: "POST",
    headers: { Authorization: `Bearer ${apiKey}` },
    body: form,
  });
  if (!res.ok) {
    const text = await res.text().catch(() => "");
    return NextResponse.json({ error: `AI provider error (${res.status}): ${text.slice(0, 200)}` }, { status: 502 });
  }
  const data = await res.json();
  const b64 = data?.data?.[0]?.b64_json;
  if (!b64) return NextResponse.json({ error: "AI provider returned no image" }, { status: 502 });

  const outDir = path.join(process.cwd(), "public", "uploads");
  fs.mkdirSync(outDir, { recursive: true });
  const name = `tryon-${crypto.randomBytes(6).toString("hex")}.png`;
  fs.writeFileSync(path.join(outDir, name), Buffer.from(b64, "base64"));
  return NextResponse.json({ image_path: `/uploads/${name}`, ai: true });
}
