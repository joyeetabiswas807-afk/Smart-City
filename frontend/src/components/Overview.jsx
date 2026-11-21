import { useEffect, useState } from "react";
import { api } from "../api";
import { STATUS, STATUS_ORDER } from "../constants";
import { ago } from "../utils";
import { StatusBadge, ReportMini } from "./ui";

export default function Overview({ areas, selectedId, onSelect, onClose, onError }) {
  const feats = areas.features;
  const counts = {};
  feats.forEach(f => { counts[f.properties.status] = (counts[f.properties.status] || 0) + 1; });
  const waterlogged = (counts.waterlogged || 0) + (counts.verified_still_waterlogged || 0);
  const clear = (counts.clear || 0) + (counts.verified_clear || 0);
  const pending = feats.reduce((n, f) => n + (f.properties.pending_reports || 0), 0);
  const sorted = [...feats].sort((a, b) => STATUS_ORDER.indexOf(a.properties.status) - STATUS_ORDER.indexOf(b.properties.status));
  const selected = feats.find(f => f.properties.id === selectedId);

  return (
    <section className="tabpane">
      <div className="summary">
        <div className="stat"><b>{waterlogged}</b><span>waterlogged</span></div>
        <div className="stat"><b>{clear}</b><span>clear</span></div>
        <div className="stat"><b>{pending}</b><span>reports awaiting verification</span></div>
      </div>

      {selected && <AreaDetail feature={selected} onClose={onClose} onError={onError} />}

      <h2 className="h2">Areas</h2>
      <ul className="area-list">
        {sorted.map(f => {
          const p = f.properties;
          return (
            <li key={p.id}>
              <button className={p.id === selectedId ? "sel" : ""} onClick={() => onSelect(p.id)}>
                <span>
                  <b>{p.name}</b>
                  <small>Updated {ago(p.last_updated)}{p.pending_reports ? ` · ${p.pending_reports} pending` : ""}</small>
                </span>
                <StatusBadge status={p.status} />
              </button>
            </li>
          );
        })}
      </ul>
      <p className="note">Status only changes after a report passes verification. Unverified reports never change the confirmed status.</p>
    </section>
  );
}

function AreaDetail({ feature, onClose, onError }) {
  const p = feature.properties;
  const [data, setData] = useState(null);

  // reload when switching area or when the area's status/pending count changes (after a poll)
  useEffect(() => {
    let alive = true;
    Promise.all([api.getAreaHistory(p.id), api.getReports({ area_id: p.id })])
      .then(([history, reports]) => alive && setData({ history, reports }))
      .catch(e => alive && onError(e.message));
    return () => { alive = false; };
  }, [p.id, p.status, p.pending_reports]); // eslint-disable-line react-hooks/exhaustive-deps

  return (
    <div className="card">
      <button className="close" aria-label="Close" onClick={onClose}>×</button>
      <h3>{p.name}</h3>
      <StatusBadge status={p.status} />
      <p className="meta">Confirmed status updated {ago(p.last_updated)}</p>
      {!data ? <div className="note">Loading…</div> : (
        <>
          <h3 className="h3">Latest reports</h3>
          {data.reports.length ? data.reports.slice(0, 5).map(r => <ReportMini key={r.id} r={r} />) : <p className="note">No reports yet.</p>}
          <h3 className="h3">Status history</h3>
          {data.history.length ? data.history.slice(0, 5).map(h => (
            <p className="hist" key={h.id}>
              {ago(h.timestamp)}: {STATUS[h.previous_status]?.label || h.previous_status} → <b>{STATUS[h.updated_status]?.label || h.updated_status}</b>
            </p>
          )) : <p className="note">No changes recorded.</p>}
        </>
      )}
    </div>
  );
}
