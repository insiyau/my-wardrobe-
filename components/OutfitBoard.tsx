"use client";
import { useState } from "react";
import { Garment } from "@/lib/types";

/**
 * Instant, no-AI outfit preview: the static avatar plus the selected
 * garments' real product photos arranged as an outfit board collage.
 */
export function OutfitBoard({ avatarPath, pieces }: { avatarPath: string | null; pieces: Garment[] }) {
  const [aiImage, setAiImage] = useState<string | null>(null);
  const [aiBusy, setAiBusy] = useState(false);
  const [aiError, setAiError] = useState("");
  const [aiSkipped, setAiSkipped] = useState("");

  async function aiPreview() {
    setAiBusy(true); setAiError(""); setAiSkipped(""); setAiImage(null);
    const res = await fetch("/api/tryon", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ garmentIds: pieces.map((p) => p.id) }),
    });
    const data = await res.json();
    setAiBusy(false);
    if (!res.ok) setAiError(data.error || "AI preview failed");
    else if (data.skipped) setAiSkipped(data.reason);
    else setAiImage(data.image_path);
  }

  if (pieces.length === 0) {
    return <p className="muted">Select pieces from your closet to build an outfit board.</p>;
  }

  return (
    <div>
      <div className="board">
        <div className="board-avatar">
          <img src={aiImage || avatarPath || ""} alt={aiImage ? "AI try-on preview" : "Outfit board avatar"} />
        </div>
        <div>
          <div className="eyebrow">{aiImage ? "AI realistic preview" : "Outfit board · instant preview"}</div>
          <div className="board-pieces">
            {pieces.map((p) => (
              <div className="board-piece" key={p.id}>
                <div className="zone">{p.category}</div>
                {p.image_path && <img src={p.image_path} alt={p.name} />}
                <div className="nm">{p.name}</div>
              </div>
            ))}
          </div>
          <div className="row" style={{ marginTop: 12 }}>
            <button className="btn" disabled={aiBusy} onClick={aiPreview}>
              {aiBusy ? "Generating…" : "✨ AI realistic preview (optional)"}
            </button>
          </div>
          {aiError && <div className="error">{aiError}</div>}
          {aiSkipped && <div className="notice">{aiSkipped}</div>}
          {!aiImage && !aiSkipped && (
            <p className="muted" style={{ marginTop: 8 }}>
              The board above is instant and uses your real garment photos — no AI involved.
              The AI preview edits your avatar to wear the outfit (needs an API key, see README).
            </p>
          )}
        </div>
      </div>
    </div>
  );
}

export function SelectionTray({
  pieces, onRemove, onClear, onSaveWorn, onSaveInspo,
}: {
  pieces: Garment[];
  onRemove: (id: number) => void;
  onClear: () => void;
  onSaveWorn: () => void;
  onSaveInspo: () => void;
}) {
  if (pieces.length === 0) return null;
  return (
    <div className="tray">
      <div className="tray-inner">
        <div className="tray-thumbs">
          {pieces.map((p) => (
            <button key={p.id} className="tray-thumb" onClick={() => onRemove(p.id)} title={`Remove ${p.name}`}>
              {p.image_path && <img src={p.image_path} alt={p.name} />}
              <span>×</span>
            </button>
          ))}
        </div>
        <button className="btn" onClick={onSaveInspo}>♡ Inspo</button>
        <button className="btn btn-primary" onClick={onSaveWorn}>Wore it</button>
        <button className="btn" onClick={onClear}>Clear</button>
      </div>
    </div>
  );
}
