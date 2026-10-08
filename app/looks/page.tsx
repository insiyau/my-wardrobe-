"use client";
import { useCallback, useEffect, useState } from "react";
import { Garment, Look } from "@/lib/types";

type LookWithGarments = Look & { garments?: Garment[] };

export default function LooksPage() {
  const [tab, setTab] = useState<"worn" | "inspo">("worn");
  const [looks, setLooks] = useState<LookWithGarments[]>([]);
  const [error, setError] = useState("");

  const load = useCallback(async () => {
    const res = await fetch(`/api/looks?type=${tab}`);
    const data = await res.json();
    if (!res.ok) { setError(data.error || "Failed to load"); return; }
    setLooks(data.looks ?? []);
  }, [tab]);

  useEffect(() => { load(); }, [load]);

  async function remove(id: number) {
    if (!confirm("Delete this look?")) return;
    const res = await fetch(`/api/looks/${id}`, { method: "DELETE" });
    if (res.ok) setLooks((ls) => ls.filter((l) => l.id !== id));
  }

  return (
    <div>
      <div className="eyebrow">Collections</div>
      <h1 style={{ margin: "0 0 12px" }}>Looks</h1>
      <div className="look-tabs">
        <button className={`btn ${tab === "worn" ? "btn-primary" : ""}`} onClick={() => setTab("worn")}>
          ✓ Worn — what you've actually worn
        </button>
        <button className={`btn ${tab === "inspo" ? "btn-primary" : ""}`} onClick={() => setTab("inspo")}>
          ♡ Inspo — ideas for later
        </button>
      </div>
      {tab === "worn" && (
        <p className="muted">
          Your wear history. Suggestions learn from this: they avoid repeating worn combos
          and pick up on the colors and cuts you actually reach for.
        </p>
      )}
      {tab === "inspo" && (
        <p className="muted">Outfit ideas you've saved for the future. Log one as worn when you wear it.</p>
      )}
      {error && <div className="error">{error}</div>}
      {looks.length === 0 && <p className="muted">Nothing here yet.</p>}
      <div className="grid">
        {looks.map((l) => (
          <LookCard key={l.id} look={l} onDelete={() => remove(l.id)} />
        ))}
      </div>
    </div>
  );
}

function LookCard({ look, onDelete }: { look: LookWithGarments; onDelete: () => void }) {
  const [garments, setGarments] = useState<Garment[]>([]);
  useEffect(() => {
    if (!look.garment_ids.length) return;
    fetch("/api/garments")
      .then((r) => r.json())
      .then((d) => {
        const byId = new Map((d.garments as Garment[]).map((g) => [g.id, g]));
        setGarments(look.garment_ids.map((id) => byId.get(id)).filter(Boolean) as Garment[]);
      });
  }, [look.id]); // eslint-disable-line react-hooks/exhaustive-deps

  return (
    <div className="card look-card">
      {garments[0]?.image_path && <img src={garments[0].image_path} alt={look.title} />}
      <h3 style={{ margin: "8px 0 4px" }}>{look.title}</h3>
      <div style={{ marginBottom: 6 }}>
        {look.occasion && <span className="chip">{look.occasion}</span>}
        {look.mood && <span className="chip">{look.mood}</span>}
        {look.worn_on && <span className="chip">worn {look.worn_on}</span>}
      </div>
      {look.rationale && <p className="muted" style={{ fontSize: 13 }}>{look.rationale}</p>}
      <div className="row" style={{ marginBottom: 8 }}>
        {garments.map((g) => (
          <span className="chip" key={g.id}>{g.name.split(" - ")[0].slice(0, 28)}</span>
        ))}
      </div>
      <button className="btn" style={{ fontSize: 12 }} onClick={onDelete}>Delete</button>
    </div>
  );
}
