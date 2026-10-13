import { CATEGORIES, SEASONS } from "./types";
import type { Category, LookType, Season } from "./types";

export function boundedString(value: unknown, maxLength: number): string {
  return typeof value === "string" ? value.trim().slice(0, maxLength) : "";
}

export function parseCategory(value: unknown): Category | null {
  return typeof value === "string" && (CATEGORIES as readonly string[]).includes(value)
    ? (value as Category)
    : null;
}

export function parseLookType(value: unknown): LookType | null {
  return value === "worn" || value === "inspo" ? value : null;
}

export function parseSeasonList(value: unknown): Season[] {
  let raw = value;
  if (typeof value === "string") {
    try {
      raw = JSON.parse(value);
    } catch {
      return [];
    }
  }
  if (!Array.isArray(raw)) return [];
  const seen = new Set<Season>();
  for (const item of raw) {
    if (typeof item !== "string") continue;
    if (!(SEASONS as readonly string[]).includes(item)) continue;
    seen.add(item as Season);
  }
  return [...seen];
}

export function parseIdList(value: unknown, maxItems = 24): number[] {
  if (!Array.isArray(value)) return [];
  const seen = new Set<number>();
  for (const item of value) {
    const id = Number(item);
    if (!Number.isSafeInteger(id) || id <= 0) continue;
    seen.add(id);
    if (seen.size >= maxItems) break;
  }
  return [...seen];
}

export function parseStoredIdList(value: unknown, maxItems = 50): number[] {
  if (typeof value !== "string") return [];
  try {
    return parseIdList(JSON.parse(value), maxItems);
  } catch {
    return [];
  }
}

export function parseIsoDate(value: unknown, fallback: string): string {
  if (typeof value === "string" && /^\d{4}-\d{2}-\d{2}$/.test(value)) return value;
  return fallback;
}
