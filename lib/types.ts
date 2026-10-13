export const CATEGORIES = [
  "tops",
  "bottoms",
  "dresses",
  "outerwear",
  "shoes",
  "bags",
  "accessories",
  "other",
] as const;

export type Category = (typeof CATEGORIES)[number];

export const SEASONS = ["spring", "summer", "fall", "winter", "all-season"] as const;

export type Season = (typeof SEASONS)[number];

export interface Garment {
  id: number;
  name: string;
  category: Category;
  color: string;
  seasons: Season[];
  notes: string;
  image_path: string | null;
  is_favorite: number; // 0 | 1
  created_at: string;
}

export interface Scores {
  color_harmony: number;
  silhouette_balance: number;
  style_consistency: number;
  overall: number;
}

export interface Suggestion {
  garment_ids: number[];
  title: string;
  rationale: string;
  scores: Scores;
}

export type LookType = "worn" | "inspo";

export interface Look {
  id: number;
  type: LookType;
  title: string;
  occasion: string;
  mood: string;
  rationale: string;
  worn_on: string | null;
  created_at: string;
  garment_ids: number[];
}
