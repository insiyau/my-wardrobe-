import { Garment, Scores, Suggestion } from "./types";

/* ------------------------------------------------------------------ */
/* Color helpers                                                       */
/* ------------------------------------------------------------------ */

const NEUTRAL_WORDS = [
  "black", "white", "grey", "gray", "beige", "navy", "brown", "khaki",
  "oatmeal", "off white", "off-white", "washed", "coffee", "mocha",
  "denim", "dark blue", "dark navy", "navy blue", "dark brown", "carbon",
];

function normColor(c: string): string {
  return c.toLowerCase().trim();
}

function isNeutral(color: string): boolean {
  const c = normColor(color);
  return NEUTRAL_WORDS.some((w) => c.includes(w));
}

function isBright(color: string): boolean {
  return !isNeutral(color);
}

/* ------------------------------------------------------------------ */
/* Style keywords                                                      */
/* ------------------------------------------------------------------ */

const DRESSY = ["satin", "leather", "faux leather", "tweed", "embroidery", "ruffle", "cowl", "mermaid", "sequin", "velvet", "patent", "smocked"];
const CASUAL = ["fleece", "sweatpants", "jersey", "denim", "cargo", "knit", "ribbed", "linen"];
const FIT_WORDS = ["cropped", "oversized", "wide-leg", "wide leg", "fitted", "slim", "relaxed", "flare", "straight-leg", "straight leg", "barrel", "bodycon", "a-line", "balloon"];

function hasAny(text: string, words: string[]): boolean {
  const t = text.toLowerCase();
  return words.some((w) => t.includes(w));
}

function isSwim(g: Garment): boolean {
  return /swimsuit/i.test(g.name);
}
function isPartyDress(g: Garment): boolean {
  return g.category === "dresses" && hasAny(g.name + " " + g.notes, ["satin", "mermaid", "cowl", "sequin", "velvet"]);
}
function isGymBottom(g: Garment): boolean {
  return g.category === "bottoms" && /sweatpants|gym|jogger/i.test(g.name + " " + g.notes);
}
function isDressy(g: Garment): boolean {
  return hasAny(g.name + " " + g.notes, DRESSY);
}
function isCasualPiece(g: Garment): boolean {
  return hasAny(g.name + " " + g.notes, CASUAL);
}

/* ------------------------------------------------------------------ */
/* Clash filtering (hard rules)                                        */
/* ------------------------------------------------------------------ */

export function clashes(pieces: Garment[], occasion: string): boolean {
  const occ = occasion.toLowerCase();
  const swimOk = /swim|beach|pool|ocean|vacation/.test(occ);
  const swims = pieces.filter(isSwim);
  if (swims.length > 0 && swims.length < pieces.length && !swimOk) return true; // swimwear with normal clothes
  if (swims.length === pieces.length && pieces.length > 1) return true; // two swimsuits
  const partyDress = pieces.some(isPartyDress);
  const gymBottom = pieces.some(isGymBottom);
  if (partyDress && gymBottom) return true;
  const dressyTop = pieces.some((g) => g.category === "tops" && isDressy(g));
  if (dressyTop && gymBottom) return true;
  return false;
}

/* ------------------------------------------------------------------ */
/* Weather filtering                                                   */
/* ------------------------------------------------------------------ */

export interface WeatherCtx {
  tempF: number | null;
  conditions: string; // free text, e.g. "rainy", "sunny"
}

export function parseWeather(weather: string | undefined): WeatherCtx {
  if (!weather) return { tempF: null, conditions: "" };
  const m = weather.match(/(-?\d+)\s*°?\s*F/i);
  let tempF = m ? parseInt(m[1], 10) : null;
  const cMatch = weather.match(/(-?\d+)\s*°?\s*C/i);
  if (tempF === null && cMatch) tempF = Math.round(parseInt(cMatch[1], 10) * 9 / 5 + 32);
  return { tempF, conditions: weather.toLowerCase() };
}

export function weatherOk(g: Garment, w: WeatherCtx): boolean {
  const text = (g.name + " " + g.notes).toLowerCase();
  const seasons = g.seasons.map((s) => s.toLowerCase());
  if (w.tempF !== null) {
    if (w.tempF < 50) {
      if (g.category === "shoes" && /sandal|open-toe|open toe|mule/i.test(text)) return false;
      if (/linen/i.test(text)) return false;
      if (/crop/i.test(text) && seasons.includes("summer") && !seasons.includes("fall")) return false;
    }
    if (w.tempF > 75) {
      if (/wool|fleece/i.test(text)) return false;
      if (g.category === "outerwear" && seasons.every((s) => ["fall", "winter"].includes(s))) return false;
    }
  }
  if (/rain|drizzle|storm|shower/.test(w.conditions)) {
    if (/suede|satin|silk|chiffon/i.test(text)) return false;
    if (g.category === "shoes" && /sandal|open/i.test(text)) return false;
  }
  return true;
}

/* ------------------------------------------------------------------ */
/* Scoring                                                             */
/* ------------------------------------------------------------------ */

function colorHarmony(pieces: Garment[]): number {
  const fams = pieces.map((g) => normColor(g.color));
  const uniq = [...new Set(fams)];
  const brights = uniq.filter(isBright);
  let score = 72;
  if (uniq.length <= 2) score += 12;
  else if (uniq.length === 3) score += 4;
  else score -= 8 * (uniq.length - 3);
  if (brights.length === 1 && uniq.length > 1) score += 8; // one accent + neutrals
  if (brights.length >= 3) score -= 12;
  const hasBlack = uniq.some((c) => c.includes("black"));
  const hasBrown = uniq.some((c) => c.includes("brown") && !c.includes("dark brown"));
  if (hasBlack && hasBrown) score -= 6;
  return clamp(Math.round(score));
}

function silhouetteBalance(pieces: Garment[]): number {
  const text = pieces.map((g) => (g.name + " " + g.notes).toLowerCase()).join(" | ");
  let score = 70;
  const topCropped = /crop/i.test(pieces.filter((g) => g.category === "tops").map((g) => g.name + g.notes).join(" "));
  const bottomWide = /wide|barrel|flare|relaxed|a-line/i.test(
    pieces.filter((g) => g.category === "bottoms").map((g) => g.name + g.notes).join(" ")
  );
  const bottomSlim = /slim|skinny|straight|fitted/i.test(
    pieces.filter((g) => g.category === "bottoms").map((g) => g.name + g.notes).join(" ")
  );
  const topOversized = /oversized|relaxed/i.test(
    pieces.filter((g) => g.category === "tops").map((g) => g.name + g.notes).join(" ")
  );
  if (topCropped && bottomWide) score += 15;
  if (topOversized && bottomSlim) score += 12;
  if (topOversized && bottomWide) score -= 12;
  const dresses = pieces.filter((g) => g.category === "dresses").length;
  if (dresses === 1 && pieces.length <= 3) score += 8;
  if (/fitted/i.test(text) && /fitted/i.test(text) && pieces.length >= 3) score += 4;
  void FIT_WORDS;
  return clamp(Math.round(score));
}

function styleConsistency(pieces: Garment[]): number {
  const dressyCount = pieces.filter(isDressy).length;
  const casualCount = pieces.filter(isCasualPiece).length;
  let score = 78;
  if (dressyCount > 0 && casualCount > 0) {
    score -= 14 * Math.min(dressyCount, casualCount);
  }
  const allSeasons = pieces.flatMap((g) => g.seasons.map((s) => s.toLowerCase()));
  if (!allSeasons.includes("all-season")) {
    const seasonSets = pieces.map((g) => new Set(g.seasons.map((s) => s.toLowerCase())));
    const shared = seasonSets.reduce((a, b) => new Set([...a].filter((x) => b.has(x))));
    if (shared.size === 0) score -= 10;
  }
  return clamp(Math.round(score));
}

function clamp(n: number): number {
  return Math.max(0, Math.min(100, n));
}

function scoreOutfit(pieces: Garment[]): Scores {
  const color_harmony = colorHarmony(pieces);
  const silhouette_balance = silhouetteBalance(pieces);
  const style_consistency = styleConsistency(pieces);
  const overall = Math.round(color_harmony * 0.4 + silhouette_balance * 0.3 + style_consistency * 0.3);
  return { color_harmony, silhouette_balance, style_consistency, overall };
}

/* ------------------------------------------------------------------ */
/* Occasion / mood context                                             */
/* ------------------------------------------------------------------ */

function contextBoost(pieces: Garment[], occasion: string, mood: string): { boost: number; notes: string[] } {
  const occ = occasion.toLowerCase();
  const md = mood.toLowerCase();
  const text = pieces.map((g) => (g.name + " " + g.notes).toLowerCase()).join(" ");
  let boost = 0;
  const notes: string[] = [];
  if (/work|office|meeting|interview/.test(occ)) {
    if (/trouser|blazer|blouse|tweed|button/i.test(text)) { boost += 8; notes.push("office-ready tailoring"); }
    if (/sweatpants|fleece|gym/i.test(text)) { boost -= 12; notes.push("too casual for work"); }
  }
  if (/dinner|date|party|evening|event/.test(occ)) {
    if (/satin|dress|heel|mule|leather/i.test(text)) { boost += 8; notes.push("evening polish"); }
  }
  if (/beach|pool|swim|vacation/.test(occ)) {
    if (/swimsuit|sandal|linen/i.test(text)) { boost += 10; notes.push("beach-ready"); }
  }
  if (/comfy|cozy|casual|lounge|relax/.test(md)) {
    if (/knit|fleece|jersey|ribbed|soft/i.test(text)) { boost += 8; notes.push("cozy textures"); }
  }
  if (/polished|chic|elegant|dressy/.test(md)) {
    if (/satin|heel|tweed|embroidery/i.test(text)) { boost += 8; notes.push("polished finish"); }
  }
  return { boost, notes };
}

/* ------------------------------------------------------------------ */
/* Outfit construction                                                 */
/* ------------------------------------------------------------------ */

function keyOf(ids: number[]): string {
  return [...ids].sort((a, b) => a - b).join(",");
}

export interface SuggestOpts {
  occasion: string;
  mood: string;
  weather?: string;
  garments: Garment[];
  wornSets: Set<string>;       // sorted-id keys already worn
  historySets: Set<string>;    // sorted-id keys already suggested
  wornColorPrefs: string[];    // most-worn normalized colors
  limit: number;
  shuffle: boolean;            // no-repeat mode
}

function titleFor(pieces: Garment[]): string {
  const pick = (cat: string) => pieces.find((g) => g.category === cat);
  const top = pick("tops"), bottom = pick("bottoms"), dress = pick("dresses"), outer = pick("outerwear");
  const cap = (s: string) => s.charAt(0).toUpperCase() + s.slice(1);
  if (dress) return `${cap(dress.color)} ${dress.name.split(" - ")[0].replace(/\s*\(Cider\)\s*/i, "").slice(0, 34)}`.trim();
  const bits: string[] = [];
  if (top) bits.push(cap(top.color));
  if (bottom) bits.push(bottom.name.split(" - ")[0].replace(/\s*\(Cider\)\s*/i, "").replace(/\s*\(Uniqlo\)\s*/i, "").slice(0, 30));
  else if (outer) bits.push(cap(outer.color) + " layer");
  return bits.join(" + ") || "Curated Look";
}

function rationaleFor(pieces: Garment[], scores: Scores, ctxNotes: string[], wornNote: string | null): string {
  const names = pieces.map((g) => g.name.split(" - ")[0].replace(/\s*\((Cider|Uniqlo)\)\s*/i, "").trim());
  const parts: string[] = [];
  if (scores.color_harmony >= 85) parts.push("the palette clicks");
  else if (scores.color_harmony >= 70) parts.push("the colors sit well together");
  else parts.push("an unexpected color mix");
  if (scores.silhouette_balance >= 85) parts.push("the proportions balance");
  if (scores.style_consistency >= 85) parts.push("the vibe is consistent throughout");
  if (ctxNotes.length) parts.push(ctxNotes[0]);
  let r = `${names.slice(0, 3).join(", ")} — ${parts.join(", ")}.`;
  if (wornNote) r += ` ${wornNote}`;
  return r;
}

export function suggestOutfits(opts: SuggestOpts): Suggestion[] {
  const w = parseWeather(opts.weather);
  const pool = opts.garments.filter((g) => weatherOk(g, w));
  const byCat = (c: string) => pool.filter((g) => g.category === c);

  const bases: Garment[][] = [];
  // Dress-based outfits
  for (const d of byCat("dresses")) bases.push([d]);
  // Top + bottom outfits
  const tops = byCat("tops"), bottoms = byCat("bottoms");
  for (const t of tops) for (const b of bottoms) bases.push([t, b]);

  const outerwear = byCat("outerwear"), shoes = byCat("shoes");
  const candidates: Garment[][] = [];
  for (const base of bases) {
    if (clashes(base, opts.occasion)) continue;
    if (opts.wornSets.has(keyOf(base.map((g) => g.id)))) continue;
    candidates.push(base);
    // Try one outerwear layer
    for (const o of outerwear.slice(0, 6)) {
      const full = [...base, o];
      if (!clashes(full, opts.occasion) && !opts.wornSets.has(keyOf(full.map((g) => g.id)))) candidates.push(full);
    }
    // Try one shoe option
    for (const s of shoes.slice(0, 4)) {
      const full = [...base, s];
      if (!clashes(full, opts.occasion) && !opts.wornSets.has(keyOf(full.map((g) => g.id)))) candidates.push(full);
    }
  }

  const scored = candidates.map((pieces) => {
    const ids = pieces.map((g) => g.id);
    const scores = scoreOutfit(pieces);
    const { boost, notes } = contextBoost(pieces, opts.occasion, opts.mood);
    let wornNote: string | null = null;
    const colors = pieces.map((g) => normColor(g.color));
    const prefHit = opts.wornColorPrefs.find((p) => colors.some((c) => c.includes(p)));
    let prefBoost = 0;
    if (prefHit) { prefBoost = 8; wornNote = `You've been reaching for ${prefHit} lately.`; }
    const overall = clamp(scores.overall + boost + prefBoost);
    return {
      suggestion: {
        garment_ids: ids,
        title: titleFor(pieces),
        rationale: rationaleFor(pieces, scores, notes, opts.shuffle ? null : wornNote),
        scores: { ...scores, overall },
      },
      key: keyOf(ids),
      overall,
    };
  });

  scored.sort((a, b) => b.overall - a.overall || a.key.localeCompare(b.key));

  let picked = scored;
  if (opts.shuffle) {
    picked = scored.filter((s) => !opts.historySets.has(s.key));
    if (picked.length === 0) picked = scored; // exhausted: allow repeats
  }
  return picked.slice(0, opts.limit).map((s) => s.suggestion);
}

/** Learn style signals from worn looks. */
export function learnFromWorn(wornGarmentIds: number[][], garments: Garment[]): { wornSets: Set<string>; colorPrefs: string[] } {
  const wornSets = new Set(wornGarmentIds.map(keyOf));
  const colorCount = new Map<string, number>();
  const byId = new Map(garments.map((g) => [g.id, g]));
  for (const ids of wornGarmentIds) {
    for (const id of ids) {
      const g = byId.get(id);
      if (!g) continue;
      const c = normColor(g.color);
      colorCount.set(c, (colorCount.get(c) ?? 0) + 1);
    }
  }
  const colorPrefs = [...colorCount.entries()]
    .sort((a, b) => b[1] - a[1])
    .slice(0, 4)
    .map(([c]) => c);
  return { wornSets, colorPrefs };
}
