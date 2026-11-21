import { useCallback, useEffect, useState } from "react";
import { api } from "../api";
import { STATUS } from "../constants";
import { ago } from "../utils";

export default function Admin({ areas, onRecheck, onError }) {
  const [data, setData] = useState(null);
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState("");
  const names = Object.fromEntries(areas.features.map(f => [f.properties.id, f.properties.name]));
  const ids = areas.features.map(f => f.properties.id).join(",");

  const load = useCallback(async () => {
    try {
      const [pending, sensors, hist] = await Promise.all([
        api.getPending(), api.getSensors(), Promise.all(ids.split(",").filter(Boolean).map(id => api.getAreaHistory(id)))
      ]);
      setData({ pending, sensors, history: hist.flat().sort((a, b) => Date.parse(b.timestamp) - Date.parse(a.timestamp)).slice(0, 8) });
    } catch (e) { onError(e.message); }
  }, [ids]); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => { load(); }, [load]);

  const recheck = async () => {
    setBusy(true);
    try {
      const r = await api.triggerRecheck();
      setMsg(`Rechecked ${r.rechecked}, resolved ${r.resolved}.`);
      await onRecheck();
      await load();
    } catch (e) { onError(e.message); }
    finally { setBusy(false); }
  };

  return (
    <section className="tabpane">
      <h2 className="h2">Administrator</h2>
      <div className="row">
        <button className="btn btn-primary" onClick={recheck} disabled={busy}>{busy ? "Rechecking…" : "Recheck pending now"}</button>
        <span className="note">{msg}</span>
      </div>

      <h3 className="h3">Pending reports</h3>
      {!data ? <p className="note">Loading…</p> : data.pending.length ? data.pending.map(r => (
        <div className="card" key={r.id}>
          <b>{names[r.area_id] || r.area_id}</b>
          <div className="meta">
            {r.report_type === "cleared" ? "Clearance" : "Waterlogging"} report · {ago(r.created_at)}
            {r.confidence != null && ` · confidence ${Math.round(r.confidence * 100)}%`}
          </div>
          <p>{r.explanation}</p>
        </div>
      )) : <p className="note">No pending reports.</p>}

      <h3 className="h3">Water-level sensors <span className="opt">(simulated)</span></h3>
      <table className="tbl">
        <thead><tr><th>Area</th><th>Level</th><th>Updated</th></tr></thead>
        <tbody>
          {data?.sensors.map(s => <tr key={s.area_id}><td>{s.area_name}</td><td>{s.level_cm} cm</td><td>{ago(s.updated_at)}</td></tr>)}
        </tbody>
      </table>

      <h3 className="h3">Recent status changes</h3>
      {data?.history.length ? data.history.map(h => (
        <p className="hist" key={h.id}>
          {ago(h.timestamp)} · <b>{names[h.area_id] || h.area_id}</b>: {STATUS[h.previous_status]?.label || h.previous_status} → {STATUS[h.updated_status]?.label || h.updated_status}
        </p>
      )) : <p className="note">No changes yet.</p>}
    </section>
  );
}
