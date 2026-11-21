export function ago(iso) {
  if (!iso) return "—";
  const m = Math.max(0, Math.round((Date.now() - Date.parse(iso)) / 60000));
  if (m < 1) return "just now";
  if (m < 60) return m + " min ago";
  if (m < 1440) return Math.round(m / 60) + " h ago";
  return Math.round(m / 1440) + " d ago";
}

// [[west, south], [east, north]] for a GeoJSON feature or collection (Polygon / MultiPolygon / Point)
export function bboxOf(geo) {
  let w = 180, s = 90, e = -180, n = -90;
  const walk = c => {
    if (typeof c[0] === "number") { w = Math.min(w, c[0]); e = Math.max(e, c[0]); s = Math.min(s, c[1]); n = Math.max(n, c[1]); }
    else c.forEach(walk);
  };
  (geo.features || [geo]).forEach(f => walk(f.geometry.coordinates));
  return [[w, s], [e, n]];
}

export function loadMine() {
  try { return JSON.parse(localStorage.getItem("wt_mine") || "[]"); } catch { return []; }
}
export function saveMine(ids) {
  try { localStorage.setItem("wt_mine", JSON.stringify(ids.slice(0, 50))); } catch { /* storage blocked */ }
}
