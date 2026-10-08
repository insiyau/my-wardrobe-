"use client";
import { useCallback, useEffect, useState } from "react";
import { Garment } from "@/lib/types";
import { AvatarHero } from "@/components/AvatarHero";
import { CategoryTabs, GarmentGrid } from "@/components/GarmentGrid";
import { OutfitBoard, SelectionTray } from "@/components/OutfitBoard";
import { SuggestPanel } from "@/components/SuggestPanel";

export default function StudioPage() {
  const [garments, setGarments] = useState<Garment[]>([]);
  const [avatarPath, setAvatarPath] = useState<string | null>(null);
  const [category, setCategory] = useState("");
  const [q, setQ] = useState("");
  const [selected, setSelected] = useState<Garment[]>([]);
  const [saveMsg, setSaveMsg] = useState("");

  const load = useCallback(async () => {
    const params = new URLSearchParams();
    if (category) params.set("category", category);
    if (q) params.set("q", q);
    const [gRes, aRes] = await Promise.all([
      fetch(`/api/garments?${params}`),
      fetch("/api/avatar"),
    ]);
    setGarments((await gRes.json()).garments ?? []);
    setAvatarPath((await aRes.json()).avatar?.image_path ?? null);
  }, [category, q]);

  useEffect(() => { load(); }, [load]);
  // Refresh avatar path when hero uploads (poll once after mount is enough since hero manages its own state;
  // we read it once here for the board).
  useEffect(() => {
    fetch("/api/avatar").then((r) => r.json()).then((d) => setAvatarPath(d.avatar?.image_path ?? null));
  }, []);

  const toggle = (g: Garment) =>
    setSelected((s) => (s.some((x) => x.id === g.id) ? s.filter((x) => x.id !== g.id) : [...s, g]));

  const applySuggestion = (ids: number[]) => {
    const byId = new Map(garments.map((g) => [g.id, g]));
    setSelected(ids.map((id) => byId.get(id)).filter(Boolean) as Garment[]);
    window.scrollTo({ top: 0, behavior: "smooth" });
  };

  async function saveSelection(type: "worn" | "inspo") {
    setSaveMsg("");
    const title = prompt(type === "worn" ? "What did you wear? (title)" : "Name this inspo look", selected.map((g) => g.name.split(" - ")[0]).join(", ")?.slice(0, 60) || "My look");
    if (title === null) return;
    const res = await fetch("/api/looks", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        type, title: title || "My look",
        garmentIds: selected.map((g) => g.id),
        wornOn: type === "worn" ? new Date().toISOString().slice(0, 10) : undefined,
      }),
    });
    const data = await res.json();
    setSaveMsg(res.ok ? `Saved to ${type === "worn" ? "Worn" : "Inspo"} ✓` : data.error || "Save failed");
  }

  return (
    <div>
      <AvatarHero initialPath={avatarPath} />

      <section className="card" style={{ marginBottom: 16 }}>
        <div className="eyebrow">Live try-on · instant outfit board</div>
        <h2 style={{ margin: "0 0 4px" }}>Build an outfit</h2>
        <p className="muted" style={{ marginTop: 0 }}>
          Tap pieces to add them to the board. Your doll stays exactly the same — no AI regeneration.
        </p>
        <OutfitBoard avatarPath={avatarPath} pieces={selected} />
      </section>

      <div className="row" style={{ margin: "18px 0 6px" }}>
        <div className="eyebrow" style={{ margin: 0 }}>Pick pieces</div>
        <div className="spacer" />
        <input
          className="input" placeholder="Search closet…" value={q}
          onChange={(e) => setQ(e.target.value)} style={{ maxWidth: 220 }}
        />
      </div>
      <CategoryTabs value={category} onChange={setCategory} />
      <GarmentGrid garments={garments} selectable selectedIds={new Set(selected.map((g) => g.id))} onToggle={toggle} />

      <SuggestPanel onApply={applySuggestion} />

      {saveMsg && <div className="notice" style={{ position: "fixed", bottom: 90, left: 16, right: 16, zIndex: 55 }}>{saveMsg}</div>}

      <SelectionTray
        pieces={selected}
        onRemove={(id) => setSelected((s) => s.filter((g) => g.id !== id))}
        onClear={() => setSelected([])}
        onSaveWorn={() => saveSelection("worn")}
        onSaveInspo={() => saveSelection("inspo")}
      />
    </div>
  );
}
