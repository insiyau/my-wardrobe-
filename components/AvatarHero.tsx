"use client";
import { useState } from "react";

export function AvatarHero({ initialPath }: { initialPath: string | null }) {
  const [path, setPath] = useState(initialPath);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  async function upload(file: File) {
    setBusy(true); setError("");
    const form = new FormData();
    form.append("image", file);
    const res = await fetch("/api/avatar", { method: "POST", body: form });
    const data = await res.json();
    setBusy(false);
    if (!res.ok) setError(data.error || "Upload failed");
    else setPath(data.avatar.image_path);
  }

  return (
    <section className="hero">
      {path ? (
        <img className="hero-img" src={path} alt="Your style avatar" />
      ) : (
        <div className="hero-img" style={{ display: "flex", alignItems: "center", justifyContent: "center", minHeight: 240 }}>
          <span className="muted">No avatar yet — upload one below</span>
        </div>
      )}
      <div className="card hero-card">
        <div className="eyebrow">Your style avatar</div>
        <h2 style={{ margin: "0 0 6px", fontSize: 28 }}>Meet your closet muse.</h2>
        <p className="muted" style={{ margin: "0 0 10px" }}>
          Tap closet pieces below to build an outfit board on her, or let a suggestion dress her.
        </p>
        <div className="row">
          <label className="btn" style={{ cursor: "pointer" }}>
            {busy ? "Uploading…" : path ? "Replace avatar" : "Upload avatar"}
            <input
              type="file" accept="image/jpeg,image/png,image/webp" hidden
              onChange={(e) => { const f = e.target.files?.[0]; if (f) upload(f); e.target.value = ""; }}
            />
          </label>
        </div>
        {error && <div className="error">{error}</div>}
      </div>
    </section>
  );
}
