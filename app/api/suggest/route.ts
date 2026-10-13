import { NextRequest, NextResponse } from "next/server";
import { getDb, rowToGarment } from "@/lib/db";
import { learnFromWorn, suggestOutfits } from "@/lib/scoring";
import { boundedString, parseStoredIdList } from "@/lib/validation";

type IdRow = { id: number };
type GarmentIdRow = { garment_id: number };
type HistoryRow = { garment_ids: unknown };

/**
 * POST { occasion, mood, weather?, shuffle?, limit? }
 * Heuristic suggestions: clash filtering, weather-aware, no-repeat shuffle,
 * and style learning from the Worn collection.
 */
export async function POST(req: NextRequest) {
  const body = (await req.json().catch(() => ({}))) as Record<string, unknown>;
  const occasion = boundedString(body.occasion, 80);
  const mood = boundedString(body.mood, 80);
  const weather = typeof body.weather === "string" ? boundedString(body.weather, 80) : undefined;
  const shuffle = Boolean(body.shuffle);
  const limit = Math.max(1, Math.min(6, Number(body.limit) || 3));
  if (!occasion || !mood)
    return NextResponse.json({ error: "occasion and mood are required" }, { status: 400 });

  const db = getDb();
  const garments = db.prepare("SELECT * FROM garments ORDER BY id").all().map(rowToGarment);
  if (garments.length === 0) return NextResponse.json({ suggestions: [] });

  const wornRows = db.prepare("SELECT id FROM looks WHERE type = 'worn'").all() as IdRow[];
  const wornGarmentIds: number[][] = wornRows.map((r) =>
    (db.prepare("SELECT garment_id FROM look_garments WHERE look_id = ?").all(r.id) as GarmentIdRow[]).map((x) => x.garment_id)
  );
  const { wornSets, colorPrefs } = learnFromWorn(wornGarmentIds, garments);

  const historyRows = db
    .prepare("SELECT garment_ids FROM suggestion_history WHERE occasion = ? AND mood = ? ORDER BY id DESC LIMIT 200")
    .all(occasion, mood) as HistoryRow[];
  const historySets = new Set(historyRows.map((r) => parseStoredIdList(r.garment_ids).sort((a, b) => a - b).join(",")));

  const suggestions = suggestOutfits({
    occasion, mood, weather, garments, wornSets, historySets,
    wornColorPrefs: colorPrefs, limit, shuffle,
  });

  const record = db.prepare("INSERT INTO suggestion_history (occasion, mood, garment_ids) VALUES (?,?,?)");
  for (const s of suggestions) record.run(occasion, mood, JSON.stringify(s.garment_ids));

  // Attach garment details for convenience
  const byId = new Map(garments.map((g) => [g.id, g]));
  return NextResponse.json({
    suggestions: suggestions.map((s) => ({
      ...s,
      garments: s.garment_ids.map((id) => byId.get(id)).filter(Boolean),
    })),
  });
}
