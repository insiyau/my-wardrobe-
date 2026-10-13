import test from "node:test";
import assert from "node:assert/strict";
import { clashes, learnFromWorn, parseWeather, suggestOutfits, weatherOk } from "../lib/scoring";
import type { Garment } from "../lib/types";

function garment(overrides: Partial<Garment>): Garment {
  return {
    id: 1,
    name: "Piece",
    category: "tops",
    color: "black",
    seasons: ["all-season"],
    notes: "",
    image_path: null,
    is_favorite: 0,
    created_at: "2026-01-01T00:00:00.000Z",
    ...overrides,
  };
}

test("weatherOk rejects fragile or open pieces in bad weather", () => {
  const rain = parseWeather("48F rain");

  assert.equal(weatherOk(garment({ category: "shoes", name: "Suede sandal" }), rain), false);
  assert.equal(weatherOk(garment({ name: "Cropped linen tank", seasons: ["summer"] }), rain), false);
  assert.equal(weatherOk(garment({ name: "Wool coat", category: "outerwear", seasons: ["winter"] }), parseWeather("80F sunny")), false);
});

test("clashes blocks obviously mismatched outfit categories", () => {
  const partyDress = garment({ id: 1, category: "dresses", name: "Satin party dress" });
  const gymBottom = garment({ id: 2, category: "bottoms", name: "Gym sweatpants" });

  assert.equal(clashes([partyDress, gymBottom], "dinner"), true);
});

test("learnFromWorn returns sorted worn keys and color preferences", () => {
  const redTop = garment({ id: 1, color: "red" });
  const blackPants = garment({ id: 2, category: "bottoms", color: "black" });
  const blackShoes = garment({ id: 3, category: "shoes", color: "black" });

  const learned = learnFromWorn([[2, 1], [2, 3]], [redTop, blackPants, blackShoes]);

  assert.deepEqual([...learned.wornSets].sort(), ["1,2", "2,3"]);
  assert.equal(learned.colorPrefs[0], "black");
});

test("suggestOutfits skips worn sets and returns deterministic suggestions", () => {
  const redTop = garment({ id: 1, name: "Fitted red top", color: "red", category: "tops" });
  const blueTop = garment({ id: 2, name: "Blue button top", color: "navy", category: "tops" });
  const pants = garment({ id: 3, name: "Straight black pants", color: "black", category: "bottoms" });

  const suggestions = suggestOutfits({
    occasion: "work",
    mood: "polished",
    garments: [redTop, blueTop, pants],
    wornSets: new Set(["1,3"]),
    historySets: new Set(),
    wornColorPrefs: [],
    limit: 2,
    shuffle: false,
  });

  assert.deepEqual(suggestions.map((s) => s.garment_ids), [[2, 3]]);
});
