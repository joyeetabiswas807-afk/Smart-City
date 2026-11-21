import { useCallback, useEffect, useRef, useState } from "react";
import { api } from "./api";
import { CONFIG } from "./config";
import { bboxOf, loadMine, saveMine } from "./utils";
import MapView from "./components/MapView";
import Overview from "./components/Overview";
import ReportForm from "./components/ReportForm";
import MyReports from "./components/MyReports";
import Admin from "./components/Admin";

const EMPTY = { type: "FeatureCollection", features: [] };
const TABS = [["overview", "Overview"], ["report", "Report"], ["mine", "My reports"], ["admin", "Admin"]];

export default function App() {
  const [tab, setTab] = useState("overview");
  const [areas, setAreas] = useState(EMPTY);
  const [reports, setReports] = useState([]);
  const [rain, setRain] = useState(null);
  const [online, setOnline] = useState(true);
  const [selectedId, setSelectedId] = useState(null);
  const [pin, setPin] = useState(null);
  const [showReports, setShowReports] = useState(true);
  const [fly, setFly] = useState(null);
  const [mine, setMine] = useState(loadMine);
  const [mineData, setMineData] = useState({});
  const [toast, setToast] = useState("");
  const toastTimer = useRef();
  const mineRef = useRef(mine);
  const mineDataRef = useRef(mineData);
  mineRef.current = mine;
  mineDataRef.current = mineData;

  const showToast = useCallback(msg => {
    setToast(msg);
    clearTimeout(toastTimer.current);
    toastTimer.current = setTimeout(() => setToast(""), 3500);
  }, []);

  const refresh = useCallback(async () => {
    try {
      const [fc, reps, r] = await Promise.all([api.getAreas(), api.getReports({ recent: 1 }), api.getRainfall().catch(() => null)]);
      setAreas(fc); setReports(reps); if (r) setRain(r);
      setOnline(true);
      // re-check my reports that are still pending (or never loaded)
      const todo = mineRef.current.slice(0, 20).filter(id => mineDataRef.current[id]?.verification_status !== "verified" && mineDataRef.current[id]?.verification_status !== "rejected");
      const fresh = await Promise.all(todo.map(id => api.getReport(id).catch(() => null)));
      if (fresh.some(Boolean)) setMineData(d => ({ ...d, ...Object.fromEntries(fresh.filter(Boolean).map(x => [x.id, x])) }));
    } catch { setOnline(false); }
  }, []);

  useEffect(() => {
    refresh();
    const t = setInterval(refresh, CONFIG.POLL_MS);
    return () => clearInterval(t);
  }, [refresh]);

  const selectArea = id => {
    setSelectedId(id);
    setTab("overview");
    const f = areas.features.find(a => a.properties.id === id);
    if (f) setFly({ bounds: bboxOf(f), n: Date.now() });
  };

  const onSubmitted = rep => {
    const next = [rep.id, ...mineRef.current];
    setMine(next); saveMine(next);
    setMineData(d => ({ ...d, [rep.id]: rep }));
    setPin(null);
    refresh();
  };

  const locate = ll => { setPin(ll); setFly({ lat: ll.lat, lng: ll.lng, zoom: 18, n: Date.now() }); };

  return (
    <div className="app">
      <header className="topbar">
        <div className="brand">
          <svg viewBox="0 0 24 24" width="26" height="26" aria-hidden="true"><path d="M12 2.5c3.2 4.2 6 7.6 6 11a6 6 0 0 1-12 0c0-3.4 2.8-6.8 6-11z" fill="currentColor" /></svg>
          <div><strong>Waterlogging Twin</strong><span>Citizen-verified flood status</span></div>
        </div>
        <div className="topbar-right">
          {rain && <span className="chip" title="Recent rainfall">🌧 {(+rain.last_3h_mm).toFixed(1)} mm / 3 h</span>}
          {CONFIG.USE_MOCK && <span className="chip chip-mock">Demo data</span>}
          <span className={"live" + (online ? "" : " err")}>{online ? "● live" : "● offline"}</span>
        </div>
      </header>

      <main className="layout">
        <aside className="panel">
          <nav className="tabs" role="tablist">
            {TABS.map(([k, label]) => (
              <button key={k} role="tab" aria-selected={tab === k} className={tab === k ? "active" : ""} onClick={() => setTab(k)}>
                {label}{k === "mine" && mine.length > 0 && <span className="count">{mine.length}</span>}
              </button>
            ))}
          </nav>
          {tab === "overview" && (
            <Overview areas={areas} selectedId={selectedId} onSelect={selectArea}
              onClose={() => setSelectedId(null)} onError={showToast} />
          )}
          {tab === "report" && <ReportForm pin={pin} onLocate={locate} onSubmitted={onSubmitted} />}
          {tab === "mine" && <MyReports ids={mine} data={mineData} />}
          {tab === "admin" && <Admin areas={areas} onRecheck={refresh} onError={showToast} />}
        </aside>

        <div className="mapcol">
          <MapView areas={areas} reports={reports} selectedId={selectedId} reportMode={tab === "report"}
            pin={pin} showReports={showReports} fly={fly} onSelectArea={selectArea} onPick={setPin} />
          <label className="layer-toggle">
            <input type="checkbox" checked={showReports} onChange={e => setShowReports(e.target.checked)} /> Show citizen reports
          </label>
        </div>
      </main>

      {toast && <div className="toast" role="status">{toast}</div>}
    </div>
  );
}
