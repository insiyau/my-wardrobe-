# My Wardrobe

A personal wardrobe & outfit app. Catalog your closet, dress a style avatar,
get outfit suggestions for any occasion, and keep Worn and Inspo collections.

## Stack

- **Next.js 16** (App Router) + TypeScript + React 19
- **SQLite** via `better-sqlite3`. The app creates `data/wardrobe.db` automatically.
- No auth, no external services required. One startup command.

## Quick start

Use Node.js 20.9.0 or newer.

```bash
npm install   # also seeds the DB automatically (postinstall)
npm run dev   # http://localhost:3000
```

The database (`data/wardrobe.db`, gitignored) is created and seeded with
54 starter garments + avatar on `npm install`. `npm run seed -- --force`
re-seeds from scratch.

| Script        | What it does                              |
| ------------- | ----------------------------------------- |
| `npm run dev` | Start the dev server                      |
| `npm run build` / `npm start` | Production build / serve       |
| `npm run seed` | Seed the SQLite DB from `lib/seed-data.json` |
| `npm test` | Run the behavior tests                           |
| `npm run typecheck` | `tsc --noEmit`                        |

## Features

- **Closet.** Photo grid with category tabs (tops, bottoms, dresses, outerwear,
  shoes, bags, accessories, other), text search, favorites (★), add via photo
  upload **or** pasting a product URL (the server fetches the listing's main
  image), edit name/category/color/seasons/notes, delete.
- **Avatar.** Upload one style avatar. The Studio page shows it in the hero.
- **Try-on.** Tap garments to select them (multi-select) with a **sticky
  selection tray** (thumbnails; tap to remove; save as Worn or Inspo). The
  **instant outfit board** arranges your avatar plus the real garment photos as
  a Polyvore-style collage. It uses no AI and does not regenerate the avatar.
- **AI realistic try-on (optional).** A button on the board can render the
  avatar *wearing* the outfit via an image-edit API. See below.
- **Suggestions.** Enter an occasion + mood (optional weather like "48F, rainy")
  to get heuristic scored outfits: color harmony, silhouette balance, style
  consistency (each 0-100) plus an overall score and a written rationale.
  Clash filtering (no swimwear-with-sweaters, no party-dress-with-sweatpants),
  weather-aware filtering (temp/rain rules), and no-repeat shuffle.
- **Collections.** **Worn** logs what you wore, with a date. **Inspo** saves
  ideas for later. Suggestions avoid worn combos and learn from your wear
  history: colors and pieces you actually reach for get boosted.

## Environment variables

| Variable         | Required | What it does |
| ---------------- | -------- | ------------ |
| `OPENAI_API_KEY` | No       | Enables the optional **AI realistic try-on** button. Without it, the button returns a friendly "skipped" message and everything else works. |

### Optional AI try-on

`POST /api/tryon` uses OpenAI's image-edit endpoint (`gpt-image-1`) to edit
your avatar photo so it wears the selected garments. It is **opt-in by design**:

- The instant outfit board (avatar + real garment photos, collage-style) is the
  default and never needs a key.
- Set `OPENAI_API_KEY` in `.env` to unlock the "AI garment-reference preview"
  button. The request sends the avatar plus the selected garment photos as image
  references.
- Generated previews are cached under `public/uploads/tryon-*.png`.
- The API is pluggable: the OpenAI call lives in one place
  (`app/api/tryon/route.ts`). Swap it for any other image-edit provider.

## Project layout

```
app/                 pages: / (studio), /closet, /looks + API routes
components/          GarmentGrid, AvatarHero, OutfitBoard(+tray), SuggestPanel
lib/                 db.ts, scoring.ts (suggestion engine), images.ts, types.ts, seed-data.json
scripts/seed.mjs     idempotent seed script
public/seed/         committed starter images (avatar + garments)
public/uploads/      gitignored user uploads & AI previews
data/                gitignored SQLite file (auto-created)
```

## API sketch

- `GET` and `POST /api/garments`, `PATCH` and `DELETE /api/garments/[id]`, `POST /api/garments/[id]/favorite`, `POST /api/garments/from-url`
- `GET` and `POST /api/avatar`
- `POST /api/suggest`. `{ occasion, mood, weather?, shuffle?, limit? }`
- `GET` and `POST /api/looks` (`?type=worn|inspo`), `DELETE /api/looks/[id]`
- `POST /api/tryon`. `{ garmentIds }` (optional AI; skips gracefully without a key)
