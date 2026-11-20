// Fake backend so the UI runs without the Python service. Mimics the contract in API_CONTRACT.md.
// The scoring below is a toy version of the real verification engine, just enough to demo every outcome.
(function () {
  const C = window.APP_CONFIG;
  const [clat, clng] = C.MAP_CENTER;
  const dLat = 0.0022, dLng = 0.0024;
  const H = 3600e3;
  const now = () => Date.now();
  const iso = t => new Date(t).toISOString();
  const clamp = (x, a = 0, b = 1) => Math.max(a, Math.min(b, x));
  const delay = ms => new Promise(r => setTimeout(r, ms));
  const uid = () => "R" + Math.random().toString(36).slice(2, 7).toUpperCase();

  const names = ["Market Road", "Station Approach", "Temple Street", "Canal Side", "School Lane", "Low Bridge Underpass"];
  const terrain = [0.85, 0.7, 0.3, 0.6, 0.2, 0.9];          // low-lying risk 0..1
  const status0 = ["waterlogged", "waterlogged", "clear", "reported_clear_pending", "verified_clear", "verified_still_waterlogged"];
  const sensor0 = [24, 12, 0, 6, 0, 30];                       // cm
  const since0 = [3, 1.5, null, 4, null, 6];                   // hours ago waterlogging began

  const areas = names.map((name, k) => {
    const i = k % 3, j = Math.floor(k / 3);
    const lng0 = clng + (i - 1.5) * dLng, lat0 = clat + (j - 1) * dLat;
    return {
      id: "A" + (k + 1), name, terrain: terrain[k], status: status0[k], sensor_cm: sensor0[k],
      since: since0[k] == null ? null : now() - since0[k] * H,
      last_updated: now() - (k + 1) * 0.4 * H,
      bounds: [lng0, lat0, lng0 + dLng, lat0 + dLat]
    };
  });
  const rain = { last_1h_mm: 4.2, last_3h_mm: 9.5 };
  const reports = [];
  const history = [];

  const areaAt = (lat, lng) => areas.find(a => lng >= a.bounds[0] && lng <= a.bounds[2] && lat >= a.bounds[1] && lat <= a.bounds[3]);
  const inside = (a) => [a.bounds[0] + dLng / 2, a.bounds[1] + dLat / 2];

  function seed() {
    const mk = (a, type, depth, minsAgo, vs, conf, expl) => {
      const [lng, lat] = inside(a);
      reports.push({
        id: uid(), area_id: a.id, lat: lat + (Math.random() - .5) * dLat * .6, lng: lng + (Math.random() - .5) * dLng * .6,
        report_type: type, water_depth: depth, photo_url: null, created_at: iso(now() - minsAgo * 60e3),
        verification_status: vs, confidence: conf, explanation: expl, evidence: [], decided_at: iso(now() - (minsAgo - 1) * 60e3)
      });
    };
    mk(areas[0], "waterlogged", "knee", 80, "verified", .82, "Rain and the sensor reading both support standing water here.");
    mk(areas[0], "waterlogged", "waist", 35, "verified", .88, "Nearby reports agree and the sensor shows 24 cm.");
    mk(areas[1], "waterlogged", "ankle", 50, "verified", .71, "Low-lying area with recent rain; sensor shows water.");
    mk(areas[3], "cleared", "none", 12, "pending", .5, "Evidence is conflicting: the sensor still reads 6 cm. Will recheck automatically.");
    mk(areas[4], "cleared", "none", 200, "verified", .86, "Sensor reads 0 cm and rainfall has stopped.");
    mk(areas[5], "cleared", "none", 90, "rejected", .18, "Contradicted: the sensor still reads 30 cm and the area is very low-lying.");
    areas.forEach(a => history.push({ id: "H" + a.id, area_id: a.id, previous_status: "clear", updated_status: a.status, related_report_id: null, timestamp: iso(a.last_updated) }));
  }
  seed();

  function evidenceFor(type, rep, area) {
    const cleared = type === "cleared";
    const recent = reports.filter(r => r.id !== rep.id && r.area_id === area.id && now() - Date.parse(r.created_at) < 3 * H && r.verification_status !== "rejected");
    const agree = recent.filter(r => r.report_type === type).length;
    const hrs = area.since ? (now() - area.since) / H : null;
    const sens = area.sensor_cm;
    const sc = cleared ? (sens <= 3 ? 1 : sens <= 10 ? .45 : .05) : (sens >= 10 ? 1 : sens >= 3 ? .5 : .1);
    return [
      { key: "rainfall", label: "Recent rainfall", score: cleared ? clamp(1 - rain.last_3h_mm / 10) : clamp(rain.last_3h_mm / 10), detail: `${rain.last_3h_mm.toFixed(1)} mm in the last 3 h` },
      { key: "terrain", label: "Terrain low-lying risk", score: cleared ? 1 - area.terrain : area.terrain, detail: area.terrain > .6 ? "Low-lying; water tends to stay" : area.terrain > .35 ? "Moderately low" : "Higher ground; drains quickly" },
      { key: "sensor", label: "Water-level sensor (simulated)", score: sc, detail: `Reads ${sens} cm` },
      { key: "nearby", label: "Nearby reports", score: recent.length ? agree / recent.length : .5, detail: recent.length ? `${agree} of ${recent.length} recent nearby reports agree` : "No other recent reports nearby" },
      { key: "elapsed", label: "Time since waterlogging began", score: cleared ? (hrs == null ? .5 : clamp(hrs / 3)) : .6, detail: hrs == null ? "No active waterlogging event on record" : `Began about ${hrs.toFixed(1)} h ago` }
    ];
  }

  function decide(rep) {
    const area = areas.find(a => a.id === rep.area_id);
    const ev = evidenceFor(rep.report_type, rep, area);
    const w = [.2, .15, .3, .2, .15];
    const conf = ev.reduce((s, e, i) => s + e.score * w[i], 0);
    const vs = conf >= .65 ? "verified" : conf <= .35 ? "rejected" : "pending";
    const best = [...ev].sort((a, b) => (vs === "rejected" ? a.score - b.score : b.score - a.score))[0];
    const lead = { verified: "Supported", rejected: "Contradicted", pending: "Inconclusive" }[vs];
    rep.confidence = +conf.toFixed(2);
    rep.verification_status = vs;
    rep.evidence = ev;
    rep.explanation = `${lead}: ${best.label.toLowerCase()} — ${best.detail.toLowerCase()}.` + (vs === "pending" ? " Will be rechecked automatically as new data arrive." : "");
    rep.decided_at = iso(now());
    applyStatus(rep, area);
  }

  function applyStatus(rep, area) {
    const prev = area.status;
    let next = prev;
    if (rep.report_type === "waterlogged") {
      if (rep.verification_status === "verified") { next = "waterlogged"; if (!area.since) area.since = now(); }
    } else {
      if (rep.verification_status === "verified") { next = "verified_clear"; area.since = null; }
      else if (rep.verification_status === "rejected") next = "verified_still_waterlogged";
      else next = "reported_clear_pending";
    }
    if (next !== prev) {
      area.status = next; area.last_updated = now();
      history.push({ id: "H" + uid(), area_id: area.id, previous_status: prev, updated_status: next, related_report_id: rep.id, timestamp: iso(now()) });
    }
  }

  function recheck() {
    // simulate new data: sensors drain when rain is light, rain decays
    rain.last_1h_mm = Math.max(0, rain.last_1h_mm - 1.2); rain.last_3h_mm = Math.max(0, rain.last_3h_mm - 1.5);
    areas.forEach(a => { if (a.sensor_cm > 0) a.sensor_cm = Math.max(0, a.sensor_cm - Math.round(2 + Math.random() * 3)); });
    let n = 0, m = 0;
    reports.filter(r => r.verification_status === "pending").forEach(r => { n++; decide(r); if (r.verification_status !== "pending") m++; });
    return { rechecked: n, resolved: m };
  }
  setInterval(recheck, 45000); // "automatic rechecking"

  const feature = a => ({
    type: "Feature",
    geometry: { type: "Polygon", coordinates: [[[a.bounds[0], a.bounds[1]], [a.bounds[2], a.bounds[1]], [a.bounds[2], a.bounds[3]], [a.bounds[0], a.bounds[3]], [a.bounds[0], a.bounds[1]]]] },
    properties: { id: a.id, name: a.name, status: a.status, last_updated: iso(a.last_updated), pending_reports: reports.filter(r => r.area_id === a.id && r.verification_status === "pending").length }
  });
  const clone = o => JSON.parse(JSON.stringify(o));

  window.MockApi = {
    async getAreas() { await delay(120); return { type: "FeatureCollection", features: areas.map(feature) }; },
    async getReports(p = {}) {
      await delay(100);
      let l = reports.filter(r => (!p.area_id || r.area_id === p.area_id) && (!p.status || r.verification_status === p.status));
      return clone(l.sort((a, b) => Date.parse(b.created_at) - Date.parse(a.created_at)));
    },
    async getReport(id) { await delay(60); const r = reports.find(r => r.id === id); if (!r) throw new Error("Report not found"); return clone(r); },
    async submitReport({ lat, lng, report_type, water_depth, photo }) {
      await delay(900);
      const area = areaAt(lat, lng);
      if (!area) throw new Error("That location is outside the demonstration area.");
      const rep = {
        id: uid(), area_id: area.id, lat, lng, report_type, water_depth,
        photo_url: photo ? URL.createObjectURL(photo) : null, created_at: iso(now()),
        verification_status: "pending", confidence: null, explanation: "", evidence: [], decided_at: null
      };
      reports.push(rep); decide(rep);
      return clone(rep);
    },
    async getAreaHistory(id) { await delay(60); return clone(history.filter(h => h.area_id === id).sort((a, b) => Date.parse(b.timestamp) - Date.parse(a.timestamp))); },
    async getRainfall() { await delay(40); return { ...rain, updated_at: iso(now()), source: "mock" }; },
    async getSensors() { await delay(40); return areas.map(a => ({ area_id: a.id, area_name: a.name, level_cm: a.sensor_cm, updated_at: iso(now()), type: "simulated" })); },
    async getPending() { await delay(60); return clone(reports.filter(r => r.verification_status === "pending")); },
    async triggerRecheck() { await delay(500); return recheck(); },
    _history: () => clone(history)
  };
})();
