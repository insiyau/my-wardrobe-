"use client";
import { useState } from "react";
import { Garment, Suggestion } from "@/lib/types";

interface SuggestionWithGarments extends Suggestion {
  garments: Garment[];
}

export function SuggestPanel({ onApply }: { onApply: (ids: number[]) => void }) {
  const [occasion, setOccasion] = useState("");
  const [mood, setMood] = useState("");
  const [weather, setWeather] = useState("");
  const [results, setResults] = useState<SuggestionWithGarments[]>([]);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [savedMsg, setSavedMsg] = useState("");

  async function run(shuffle: boolean) {
    setBusy(true); setError(""); setSavedMsg("");
    const res = await fetch("/api/suggest", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ occasion, mood, weather: weather || undefined, shuffle, limit: 3 }),
    });
    const data = await res.json();
    setBusy(false);
    if (!res.ok) setError(data.error || "Couldn't generate suggestions");
    else setResults(data.suggestions);
  }

  async function saveLook(s: SuggestionWithGarments, type: "worn" | "inspo") {
    setSavedMsg("");
    const res = await fetch("/api/looks", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        type,
        title: s.title,
        occasion,
        mood,
        rationale: s.rationale,
        garmentIds: s.garment_ids,
        wornOn: type === "worn" ? new Date().toISOString().slice(0, 10) : undefined,
      }),
    });
    const data = await res.json();
    if (!res.ok) setError(data.error || "Save failed");
    else setSavedMsg(`Saved to ${type === "worn" ? "Worn" : "Inspo"} ✓`);
  }

  return (
    <section className="card" style={{ marginTop: 24 }}>
      <div className="eyebrow">Outfit suggestions</div>
      <h2 style={{ margin: "0 0 8px" }}>Dress me for…</h2>
      <div className="row">
        <div style={{ flex: "1 1 160px" }}>
          <label className="field">Occasion</label>
          <input className="input" placeholder="e.g. work dinner" value={occasion} onChange={(e) => setOccasion(e.target.value)} />
        </div>
        <div style={{ flex: "1 1 160px" }}>
          <label className="field">Mood</label>
          <input className="input" placeholder="e.g. polished" value={mood} onChange={(e) => setMood(e.target.value)} />
        </div>
        <div style={{ flex: "1 1 160px" }}>
          <label className="field">Weather (optional)</label>
          <input className="input" placeholder="e.g. 48F, rainy" value={weather} onChange={(e) => setWeather(e.target.value)} />
        </div>
      </div>
      <div className="row" style={{ marginTop: 12 }}>
        <button className="btn btn-primary" disabled={busy || !occasion || !mood} onClick={() => run(false)}>
          {busy ? "Thinking…" : "Suggest outfits"}
        </button>
        <button className="btn" disabled={busy || !occasion || !mood} onClick={() => run(true)}>
          🎲 Surprise me (no repeats)
        </button>
      </div>
      {error && <div className="error">{error}</div>}
      {savedMsg && <div className="notice">{savedMsg}</div>}
      <div style={{ marginTop: 16 }}>
        {results.map((s, i) => (
          <div className="suggestion card" key={i} style={{ background: "#fdfcfa" }}>
            <div className="eyebrow">Score {s.scores.overall}</div>
            <h3>{s.title}</h3>
            <div className="score-row">
              <div className="score"><b>{s.scores.color_harmony}</b>color harmony</div>
              <div className="score"><b>{s.scores.silhouette_balance}</b>silhouette</div>
              <div className="score"><b>{s.scores.style_consistency}</b>style consistency</div>
            </div>
            <p className="rationale">{s.rationale}</p>
            <div className="row" style={{ marginBottom: 10 }}>
              {s.garments.map((g) => (
                <span className="chip" key={g.id}>{g.name.split(" - ")[0].slice(0, 32)}</span>
              ))}
            </div>
            <div className="row">
              <button className="btn" onClick={() => onApply(s.garment_ids)}>Try these on</button>
              <button className="btn" onClick={() => saveLook(s, "inspo")}>♡ Save as inspo</button>
              <button className="btn" onClick={() => saveLook(s, "worn")}>✓ Log as worn</button>
            </div>
          </div>
        ))}
      </div>
    </section>
  );
}
