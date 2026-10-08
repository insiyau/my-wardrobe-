"use client";
import { useCallback, useEffect, useState } from "react";
import { CATEGORIES, Category, Garment } from "@/lib/types";
import { CategoryTabs, GarmentGrid } from "@/components/GarmentGrid";

const SEASONS = ["spring", "summer", "fall", "winter", "all-season"];

export default function ClosetPage() {
  const [garments, setGarments] = useState<Garment[]>([]);
  const [category, setCategory] = useState("");
  const [q, setQ] = useState("");
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");

  // add form
  const [showAdd, setShowAdd] = useState(false);
  const [addMode, setAddMode] = useState<"photo" | "link">("photo");

  // edit modal
  const [editing, setEditing] = useState<Garment | null>(null);

  const load = useCallback(async () => {
    const params = new URLSearchParams();
    if (category) params.set("category", category);
    if (q) params.set("q", q);
    const res = await fetch(`/api/garments?${params}`);
    setGarments((await res.json()).garments ?? []);
  }, [category, q]);

  useEffect(() => { load(); }, [load]);

  async function toggleFav(g: Garment) {
    const res = await fetch(`/api/garments/${g.id}/favorite`, { method: "POST" });
    const data = await res.json();
    if (res.ok) setGarments((gs) => gs.map((x) => (x.id === g.id ? data.garment : x)));
  }

  async function remove(g: Garment) {
    if (!confirm(`Delete "${g.name}"?`)) return;
    const res = await fetch(`/api/garments/${g.id}`, { method: "DELETE" });
    if (res.ok) setGarments((gs) => gs.filter((x) => x.id !== g.id));
  }

  return (
    <div>
      <div className="row" style={{ marginBottom: 8 }}>
        <div>
          <div className="eyebrow">Closet</div>
          <h1 style={{ margin: "0 0 4px" }}>{garments.length} pieces</h1>
        </div>
        <div className="spacer" />
        <button className="btn btn-primary" onClick={() => setShowAdd((s) => !s)}>
          + Add piece
        </button>
      </div>

      {showAdd && <AddForm onDone={(msg) => { setNotice(msg); setShowAdd(false); load(); }} onError={setError} />}

      <div className="row" style={{ margin: "12px 0 6px" }}>
        <input className="input" placeholder="Search by name, color…" value={q}
          onChange={(e) => setQ(e.target.value)} style={{ maxWidth: 260 }} />
      </div>
      <CategoryTabs value={category} onChange={setCategory} />

      {error && <div className="error">{error}</div>}
      {notice && <div className="notice">{notice}</div>}

      <GarmentGrid
        garments={garments}
        showActions
        onFavorite={toggleFav}
        onEdit={setEditing}
        onDelete={remove}
      />

      {editing && (
        <EditModal
          garment={editing}
          onClose={() => setEditing(null)}
          onSaved={(g) => { setEditing(null); setGarments((gs) => gs.map((x) => (x.id === g.id ? g : x))); setNotice("Saved ✓"); }}
          onError={setError}
        />
      )}
    </div>
  );
}

function AddForm({ onDone, onError }: { onDone: (msg: string) => void; onError: (m: string) => void }) {
  const [mode, setMode] = useState<"photo" | "link">("photo");
  const [name, setName] = useState("");
  const [url, setUrl] = useState("");
  const [file, setFile] = useState<File | null>(null);
  const [busy, setBusy] = useState(false);
  const [progress, setProgress] = useState("");

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true); onError(""); setProgress(mode === "link" ? "Fetching product page…" : "Uploading…");
    try {
      let res: Response;
      if (mode === "link") {
        if (!url.trim()) throw new Error("Paste a product URL first");
        res = await fetch("/api/garments/from-url", {
          method: "POST", headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ url: url.trim(), name: name.trim() || undefined }),
        });
      } else {
        if (!file) throw new Error("Choose a photo first");
        if (!name.trim()) throw new Error("Give the piece a name");
        const form = new FormData();
        form.append("image", file);
        form.append("name", name.trim());
        form.append("category", "other");
        form.append("color", "");
        form.append("seasons", JSON.stringify([]));
        form.append("notes", "");
        res = await fetch("/api/garments", { method: "POST", body: form });
      }
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Add failed");
      onDone(`Added "${data.garment.name}" ✓ — edit it to set category, color & seasons.`);
    } catch (err: any) {
      onError(err.message);
    } finally {
      setBusy(false); setProgress("");
    }
  }

  return (
    <form className="card" onSubmit={submit} style={{ marginBottom: 14 }}>
      <div className="row" style={{ marginBottom: 8 }}>
        <button type="button" className={`btn ${mode === "photo" ? "btn-primary" : ""}`} onClick={() => setMode("photo")}>📷 Photo upload</button>
        <button type="button" className={`btn ${mode === "link" ? "btn-primary" : ""}`} onClick={() => setMode("link")}>🔗 Paste product link</button>
      </div>
      {mode === "link" ? (
        <>
          <label className="field">Product URL</label>
          <input className="input" placeholder="https://…" value={url} onChange={(e) => setUrl(e.target.value)} />
          <p className="muted">We fetch the listing's main image server-side and add it to your closet. Edit the piece after to set its category.</p>
        </>
      ) : (
        <>
          <label className="field">Photo</label>
          <input className="input" type="file" accept="image/jpeg,image/png,image/webp" onChange={(e) => setFile(e.target.files?.[0] ?? null)} />
        </>
      )}
      <label className="field">Name {mode === "link" ? "(optional — auto-detected)" : ""}</label>
      <input className="input" value={name} onChange={(e) => setName(e.target.value)} placeholder="e.g. Black strapless jumpsuit" />
      {progress && <div className="notice">{progress}</div>}
      <div className="row" style={{ marginTop: 12 }}>
        <button className="btn btn-primary" disabled={busy}>{busy ? "Working…" : "Add to closet"}</button>
      </div>
    </form>
  );
}

function EditModal({ garment, onClose, onSaved, onError }: {
  garment: Garment; onClose: () => void; onSaved: (g: Garment) => void; onError: (m: string) => void;
}) {
  const [name, setName] = useState(garment.name);
  const [cat, setCat] = useState<Category>(garment.category);
  const [color, setColor] = useState(garment.color);
  const [seasons, setSeasons] = useState<string[]>(garment.seasons);
  const [notes, setNotes] = useState(garment.notes);
  const [busy, setBusy] = useState(false);

  function toggleSeason(s: string) {
    setSeasons((prev) => prev.includes(s) ? prev.filter((x) => x !== s) : [...prev, s]);
  }

  async function save() {
    setBusy(true);
    const res = await fetch(`/api/garments/${garment.id}`, {
      method: "PATCH", headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ name, category: cat, color, seasons, notes }),
    });
    const data = await res.json();
    setBusy(false);
    if (!res.ok) onError(data.error || "Save failed");
    else onSaved(data.garment);
  }

  return (
    <div className="modal-backdrop" onClick={onClose}>
      <div className="modal" onClick={(e) => e.stopPropagation()}>
        <div className="eyebrow">Edit piece</div>
        {garment.image_path && <img src={garment.image_path} alt="" style={{ width: "100%", maxHeight: 220, objectFit: "contain", borderRadius: 10, background: "#f3ede4", marginBottom: 8 }} />}
        <label className="field">Name</label>
        <input className="input" value={name} onChange={(e) => setName(e.target.value)} />
        <label className="field">Category</label>
        <select className="select" value={cat} onChange={(e) => setCat(e.target.value as Category)}>
          {CATEGORIES.map((c) => <option key={c} value={c}>{c}</option>)}
        </select>
        <label className="field">Color</label>
        <input className="input" value={color} onChange={(e) => setColor(e.target.value)} placeholder="e.g. black" />
        <label className="field">Seasons</label>
        <div className="row">
          {SEASONS.map((s) => (
            <button key={s} type="button" className={`tab ${seasons.includes(s) ? "active" : ""}`} onClick={() => toggleSeason(s)}>{s}</button>
          ))}
        </div>
        <label className="field">Notes</label>
        <textarea className="textarea" value={notes} onChange={(e) => setNotes(e.target.value)} placeholder="Cut, fabric, fit details…" />
        <div className="row" style={{ marginTop: 14 }}>
          <button className="btn btn-primary" disabled={busy} onClick={save}>{busy ? "Saving…" : "Save"}</button>
          <button className="btn" onClick={onClose}>Cancel</button>
        </div>
      </div>
    </div>
  );
}
