import { NextRequest, NextResponse } from "next/server";
import { getDb, rowToGarment } from "@/lib/db";
import { parseIdList } from "@/lib/validation";
import type { Garment } from "@/lib/types";
import fs from "node:fs";
import path from "node:path";
import crypto from "node:crypto";

const PUBLIC_UPLOADS_DIR = path.join(process.cwd(), "public", "uploads");
const PUBLIC_SEED_DIR = path.join(process.cwd(), "public", "seed");
const TRYON_GARMENT_LIMIT = 8;

function publicFilePath(publicPath: string | null): string | null {
  const fromUploads = publicPath?.startsWith("/uploads/");
  const fromSeed = publicPath?.startsWith("/seed/");
  if (!fromUploads && !fromSeed) return null;
  const prefix = fromUploads ? "/uploads/" : "/seed/";
  const root = fromUploads ? PUBLIC_UPLOADS_DIR : PUBLIC_SEED_DIR;
  const fileName = publicPath!.slice(prefix.length);
  if (!fileName || fileName !== path.basename(fileName)) return null;
  return `${root}${path.sep}${fileName}`;
}

function mimeForFile(filePath: string): string {
  const ext = path.extname(filePath).toLowerCase();
  if (ext === ".jpg" || ext === ".jpeg") return "image/jpeg";
  if (ext === ".png") return "image/png";
  if (ext === ".webp") return "image/webp";
  if (ext === ".gif") return "image/gif";
  return "application/octet-stream";
}

function imageBlob(filePath: string): Blob {
  return new Blob([fs.readFileSync(/*turbopackIgnore: true*/ filePath)], { type: mimeForFile(filePath) });
}

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
  const body = (await req.json().catch(() => ({}))) as { garmentIds?: unknown };
  const garmentIds = parseIdList(body.garmentIds, TRYON_GARMENT_LIMIT);
  if (garmentIds.length === 0) return NextResponse.json({ error: "garmentIds required" }, { status: 400 });

  const db = getDb();
  const avatar = db.prepare("SELECT * FROM avatar WHERE id = 1").get() as { image_path?: unknown } | undefined;
  const avatarPath = typeof avatar?.image_path === "string" ? avatar.image_path : null;
  if (!avatarPath) return NextResponse.json({ error: "Set an avatar first" }, { status: 400 });
  const garments = db
    .prepare(`SELECT * FROM garments WHERE id IN (${garmentIds.map(() => "?").join(",")})`)
    .all(...garmentIds)
    .map(rowToGarment);
  if (garments.length !== garmentIds.length) {
    return NextResponse.json({ error: "One or more garments not found" }, { status: 400 });
  }

  const byId = new Map(garments.map((g) => [g.id, g]));
  const orderedGarments = garmentIds.map((id) => byId.get(id)).filter((g): g is Garment => Boolean(g));
  const avatarFile = publicFilePath(avatarPath);
  if (!avatarFile || !fs.existsSync(/*turbopackIgnore: true*/ avatarFile)) return NextResponse.json({ error: "Avatar image file missing" }, { status: 500 });
  const garmentFiles = orderedGarments.map((garment) => ({
    garment,
    filePath: publicFilePath(garment.image_path),
  }));
  if (garmentFiles.some(({ filePath }) => !filePath || !fs.existsSync(/*turbopackIgnore: true*/ filePath))) {
    return NextResponse.json(
      { error: "Selected garments need local image files for AI preview" },
      { status: 400 },
    );
  }

  const garmentDesc = orderedGarments.map((g) => `${g.color} ${g.name} (${g.notes})`.slice(0, 140)).join("; ");
  const prompt =
    `Use the first image as the avatar and the remaining images as garment references. ` +
    `Edit this fashion-doll illustration so she is wearing the selected outfit, keeping her face, hair, skin tone, proportions and pose EXACTLY the same. ` +
    `Change only the clothing: ${garmentDesc}. Match each garment's true color, cut and silhouette. Clean studio background.`;

  const form = new FormData();
  form.append("model", process.env.OPENAI_TRYON_MODEL || "gpt-image-1");
  form.append("prompt", prompt);
  form.append("image", imageBlob(avatarFile), path.basename(avatarFile));
  for (const { garment, filePath } of garmentFiles) {
    form.append("image", imageBlob(filePath!), `${garment.id}-${path.basename(filePath!)}`);
  }

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
