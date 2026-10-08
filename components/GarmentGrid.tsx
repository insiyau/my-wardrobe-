"use client";
import { Garment, CATEGORIES } from "@/lib/types";

export function CategoryTabs({
  value, onChange,
}: { value: string; onChange: (c: string) => void }) {
  return (
    <div className="tabs">
      <button className={`tab ${value === "" ? "active" : ""}`} onClick={() => onChange("")}>All</button>
      {CATEGORIES.map((c) => (
        <button key={c} className={`tab ${value === c ? "active" : ""}`} onClick={() => onChange(c)}>
          {c}
        </button>
      ))}
    </div>
  );
}

export function GarmentCard({
  garment, selected, selectable, onToggle, onFavorite, onEdit, onDelete, showActions,
}: {
  garment: Garment;
  selected?: boolean;
  selectable?: boolean;
  onToggle?: () => void;
  onFavorite?: () => void;
  onEdit?: () => void;
  onDelete?: () => void;
  showActions?: boolean;
}) {
  return (
    <div
      className={`garment-card ${selected ? "selected" : ""}`}
      onClick={selectable ? onToggle : undefined}
      role={selectable ? "button" : undefined}
      tabIndex={selectable ? 0 : undefined}
      onKeyDown={selectable ? (e) => e.key === "Enter" && onToggle?.() : undefined}
    >
      {garment.image_path ? (
        <img src={garment.image_path} alt={garment.name} loading="lazy" />
      ) : (
        <div style={{ aspectRatio: "3/4", background: "#f3ede4" }} />
      )}
      {selected && <div className="sel-check">✓</div>}
      <button
        className="fav-btn"
        title={garment.is_favorite ? "Unfavorite" : "Favorite"}
        onClick={(e) => { e.stopPropagation(); onFavorite?.(); }}
      >
        {garment.is_favorite ? "★" : "☆"}
      </button>
      <div className="meta">
        <div className="name">{garment.name}</div>
        <div className="sub">{garment.category}{garment.color ? ` · ${garment.color}` : ""}</div>
        {showActions && (
          <div className="row" style={{ marginTop: 6 }}>
            <button className="btn" style={{ padding: "4px 10px", fontSize: 12 }} onClick={(e) => { e.stopPropagation(); onEdit?.(); }}>Edit</button>
            <button className="btn" style={{ padding: "4px 10px", fontSize: 12 }} onClick={(e) => { e.stopPropagation(); onDelete?.(); }}>Delete</button>
          </div>
        )}
      </div>
    </div>
  );
}

export function GarmentGrid(props: {
  garments: Garment[];
  selectedIds?: Set<number>;
  selectable?: boolean;
  onToggle?: (g: Garment) => void;
  onFavorite?: (g: Garment) => void;
  onEdit?: (g: Garment) => void;
  onDelete?: (g: Garment) => void;
  showActions?: boolean;
}) {
  if (props.garments.length === 0) return <p className="muted">Nothing here yet.</p>;
  return (
    <div className="grid">
      {props.garments.map((g) => (
        <GarmentCard
          key={g.id}
          garment={g}
          selected={props.selectedIds?.has(g.id)}
          selectable={props.selectable}
          onToggle={() => props.onToggle?.(g)}
          onFavorite={() => props.onFavorite?.(g)}
          onEdit={() => props.onEdit?.(g)}
          onDelete={() => props.onDelete?.(g)}
          showActions={props.showActions}
        />
      ))}
    </div>
  );
}
