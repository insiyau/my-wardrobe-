import fs from "node:fs";
import path from "node:path";
import crypto from "node:crypto";
import { lookup } from "node:dns/promises";
import net from "node:net";

export const UPLOAD_DIR = path.join(process.cwd(), "public", "uploads");
const MAX_IMAGE_BYTES = 12 * 1024 * 1024;
const MAX_HTML_BYTES = 1024 * 1024;
const FETCH_TIMEOUT_MS = 8_000;
const MAX_REDIRECTS = 5;

export function ensureUploadDir() {
  fs.mkdirSync(UPLOAD_DIR, { recursive: true });
}

function extFor(contentType: string | null, url: string, bytes?: Buffer): string {
  const detected = imageKind(bytes);
  if (detected) return detected.ext;
  if (contentType?.includes("jpeg")) return ".jpg";
  if (contentType?.includes("png")) return ".png";
  if (contentType?.includes("webp")) return ".webp";
  if (contentType?.includes("gif")) return ".gif";
  const m = url.match(/\.(jpe?g|png|webp|gif)(\?|$)/i);
  return m ? "." + m[1].toLowerCase().replace("jpeg", "jpg") : ".jpg";
}

function imageKind(buf: Buffer | undefined): { mime: string; ext: string } | null {
  if (!buf || buf.length < 12) return null;
  if (buf.subarray(0, 3).equals(Buffer.from([0xff, 0xd8, 0xff]))) return { mime: "image/jpeg", ext: ".jpg" };
  if (buf.subarray(0, 8).equals(Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]))) return { mime: "image/png", ext: ".png" };
  if (buf.subarray(0, 4).toString("ascii") === "RIFF" && buf.subarray(8, 12).toString("ascii") === "WEBP") {
    return { mime: "image/webp", ext: ".webp" };
  }
  const head = buf.subarray(0, 6).toString("ascii");
  if (head === "GIF87a" || head === "GIF89a") return { mime: "image/gif", ext: ".gif" };
  return null;
}

function isPrivateIpv4(address: string): boolean {
  const parts = address.split(".").map(Number);
  if (parts.length !== 4 || parts.some((part) => !Number.isInteger(part) || part < 0 || part > 255)) return true;
  const [a, b] = parts;
  return (
    a === 0 ||
    a === 10 ||
    a === 127 ||
    a === 169 && b === 254 ||
    a === 172 && b >= 16 && b <= 31 ||
    a === 192 && b === 168 ||
    a === 100 && b >= 64 && b <= 127 ||
    a === 198 && (b === 18 || b === 19) ||
    a >= 224
  );
}

function isPrivateIpv6(address: string): boolean {
  const normalized = address.toLowerCase();
  return (
    normalized === "::" ||
    normalized === "::1" ||
    normalized.startsWith("fc") ||
    normalized.startsWith("fd") ||
    normalized.startsWith("fe80:") ||
    normalized.startsWith("::ffff:10.") ||
    normalized.startsWith("::ffff:127.") ||
    normalized.startsWith("::ffff:169.254.") ||
    normalized.startsWith("::ffff:192.168.")
  );
}

async function assertPublicHttpUrl(url: URL): Promise<void> {
  if (url.protocol !== "http:" && url.protocol !== "https:") throw new Error("URL must start with http(s)");
  if (url.username || url.password) throw new Error("URL credentials are not supported");

  const host = url.hostname.toLowerCase();
  if (host === "localhost" || host.endsWith(".localhost") || host.endsWith(".local")) {
    throw new Error("Local network URLs are not supported");
  }

  const directIp = net.isIP(host);
  const addresses = directIp ? [{ address: host, family: directIp }] : await lookup(host, { all: true });
  if (addresses.length === 0) throw new Error("Could not resolve that URL");
  for (const { address, family } of addresses) {
    if (family === 4 && isPrivateIpv4(address)) throw new Error("Local network URLs are not supported");
    if (family === 6 && isPrivateIpv6(address)) throw new Error("Local network URLs are not supported");
  }
}

async function fetchPublicUrl(url: URL, init: RequestInit = {}, redirects = 0): Promise<Response> {
  await assertPublicHttpUrl(url);
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), FETCH_TIMEOUT_MS);
  try {
    const res = await fetch(url.toString(), {
      ...init,
      redirect: "manual",
      signal: controller.signal,
    });
    if ([301, 302, 303, 307, 308].includes(res.status)) {
      if (redirects >= MAX_REDIRECTS) throw new Error("Too many redirects");
      const location = res.headers.get("location");
      if (!location) throw new Error("Redirect missing destination");
      return fetchPublicUrl(new URL(location, url.toString()), init, redirects + 1);
    }
    return res;
  } finally {
    clearTimeout(timeout);
  }
}

async function readLimited(res: Response, maxBytes: number): Promise<Buffer> {
  const lengthHeader = res.headers.get("content-length");
  const declaredLength = lengthHeader ? Number(lengthHeader) : 0;
  if (declaredLength > maxBytes) throw new Error("Remote file is too large");
  if (!res.body) throw new Error("Remote response had no body");

  const reader = res.body.getReader();
  const chunks: Uint8Array[] = [];
  let total = 0;
  while (true) {
    const { done, value } = await reader.read();
    if (done) break;
    if (!value) continue;
    total += value.byteLength;
    if (total > maxBytes) {
      await reader.cancel();
      throw new Error("Remote file is too large");
    }
    chunks.push(value);
  }
  return Buffer.concat(chunks);
}

/** Download an image URL into public/uploads and return its public path. */
export async function downloadImage(imageUrl: string): Promise<string> {
  ensureUploadDir();
  const url = new URL(imageUrl);
  const res = await fetchPublicUrl(url, {
    headers: { "User-Agent": "Mozilla/5.0 (compatible; MyWardrobe/1.0)" },
  });
  if (!res.ok) throw new Error(`Image download failed (${res.status})`);
  const contentType = res.headers.get("content-type");
  if (contentType && !contentType.toLowerCase().startsWith("image/")) {
    throw new Error("Remote file is not an image");
  }
  const buf = await readLimited(res, MAX_IMAGE_BYTES);
  if (buf.length < 1024) throw new Error("Downloaded file is too small to be an image");
  const kind = imageKind(buf);
  if (!kind) throw new Error("Remote file is not a supported image");
  const name = crypto.randomBytes(8).toString("hex") + extFor(contentType, imageUrl, buf);
  fs.writeFileSync(path.join(UPLOAD_DIR, name), buf);
  return `/uploads/${name}`;
}

/** Save an uploaded File (from multipart form data) into public/uploads. */
export async function saveUpload(file: File): Promise<string> {
  ensureUploadDir();
  const allowed = ["image/jpeg", "image/png", "image/webp", "image/gif"];
  if (!allowed.includes(file.type)) throw new Error("Only JPEG/PNG/WebP/GIF images are allowed");
  if (file.size > MAX_IMAGE_BYTES) throw new Error("Image must be under 12 MB");
  const buf = Buffer.from(await file.arrayBuffer());
  const kind = imageKind(buf);
  if (!kind || kind.mime !== file.type) throw new Error("File contents do not match the image type");
  const ext = kind.ext;
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
  const res = await fetchPublicUrl(url, {
    headers: { "User-Agent": "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0 Safari/537.36" },
  });
  if (!res.ok) throw new Error(`Could not fetch that page (${res.status})`);
  const contentType = res.headers.get("content-type");
  if (contentType && !/text\/html|application\/xhtml\+xml/i.test(contentType)) {
    throw new Error("That URL did not return a product page");
  }
  const html = new TextDecoder().decode(await readLimited(res, MAX_HTML_BYTES));

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
