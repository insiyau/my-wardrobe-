import fs from "node:fs";
import path from "node:path";
import crypto from "node:crypto";

export const UPLOAD_DIR = path.join(process.cwd(), "public", "uploads");

export function ensureUploadDir() {
  fs.mkdirSync(UPLOAD_DIR, { recursive: true });
}

function extFor(contentType: string | null, url: string): string {
  if (contentType?.includes("png")) return ".png";
  if (contentType?.includes("webp")) return ".webp";
  if (contentType?.includes("gif")) return ".gif";
  const m = url.match(/\.(jpe?g|png|webp|gif)(\?|$)/i);
  return m ? "." + m[1].toLowerCase().replace("jpeg", "jpg") : ".jpg";
}

/** Download an image URL into public/uploads and return its public path. */
export async function downloadImage(imageUrl: string): Promise<string> {
  ensureUploadDir();
  const res = await fetch(imageUrl, {
    headers: { "User-Agent": "Mozilla/5.0 (compatible; MyWardrobe/1.0)" },
    redirect: "follow",
  });
  if (!res.ok) throw new Error(`Image download failed (${res.status})`);
  const buf = Buffer.from(await res.arrayBuffer());
  if (buf.length < 1024) throw new Error("Downloaded file is too small to be an image");
  const name = crypto.randomBytes(8).toString("hex") + extFor(res.headers.get("content-type"), imageUrl);
  fs.writeFileSync(path.join(UPLOAD_DIR, name), buf);
  return `/uploads/${name}`;
}

/** Save an uploaded File (from multipart form data) into public/uploads. */
export async function saveUpload(file: File): Promise<string> {
  ensureUploadDir();
  const allowed = ["image/jpeg", "image/png", "image/webp", "image/gif"];
  if (!allowed.includes(file.type)) throw new Error("Only JPEG/PNG/WebP/GIF images are allowed");
  if (file.size > 12 * 1024 * 1024) throw new Error("Image must be under 12 MB");
  const buf = Buffer.from(await file.arrayBuffer());
  const ext = file.type === "image/png" ? ".png" : file.type === "image/webp" ? ".webp" : file.type === "image/gif" ? ".gif" : ".jpg";
  const name = crypto.randomBytes(8).toString("hex") + ext;
  fs.writeFileSync(path.join(UPLOAD_DIR, name), buf);
  return `/uploads/${name}`;
}

/**
 * Given a product page URL, fetch the HTML and extract the best candidate
 * main product image (og:image first, then twitter:image, then the largest
 * <img>). Returns { imageUrl, title }.
 */
export async function extractProductImage(pageUrl: string): Promise<{ imageUrl: string; title: string }> {
  let url: URL;
  try {
    url = new URL(pageUrl);
  } catch {
    throw new Error("That doesn't look like a valid URL");
  }
  if (!["http:", "https:"].includes(url.protocol)) throw new Error("URL must start with http(s)");
  const res = await fetch(url.toString(), {
    headers: { "User-Agent": "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0 Safari/537.36" },
    redirect: "follow",
  });
  if (!res.ok) throw new Error(`Could not fetch that page (${res.status})`);
  const html = await res.text();

  const meta = (prop: string) => {
    const m = html.match(new RegExp(`<meta[^>]+(?:property|name)=["']${prop}["'][^>]+content=["']([^"']+)["']`, "i"))
      || html.match(new RegExp(`<meta[^>]+content=["']([^"']+)["'][^>]+(?:property|name)=["']${prop}["']`, "i"));
    return m ? m[1] : null;
  };
  const titleMatch = html.match(/<title[^>]*>([^<]{1,120})<\/title>/i);

  let imageUrl = meta("og:image") || meta("twitter:image");
  if (!imageUrl) {
    // Fallback: largest <img> on the page
    const imgs = [...html.matchAll(/<img[^>]+src=["']([^"']+)["']/gi)]
      .map((m) => m[1])
      .filter((s) => !/sprite|icon|logo|pixel|1x1|blank/i.test(s));
    imageUrl = imgs[0] ?? null;
  }
  if (!imageUrl) throw new Error("Couldn't find a product image on that page");
  try {
    imageUrl = new URL(imageUrl, url.toString()).toString();
  } catch {
    throw new Error("Found an image URL I can't use");
  }
  const title = (meta("og:title") || titleMatch?.[1] || "Imported piece").trim().slice(0, 80);
  return { imageUrl, title };
}
