// API layer. app.js only talks to window.Api, so swapping mock <-> real is a config flag.
// Endpoint shapes are documented in API_CONTRACT.md.
(function () {
  const C = window.APP_CONFIG;
  if (C.USE_MOCK) { window.Api = window.MockApi; return; }

  const origin = new URL(C.API_BASE, location.href).origin;
  const fixPhoto = r => {
    if (r && r.photo_url && r.photo_url.startsWith("/")) r.photo_url = origin + r.photo_url;
    return r;
  };

  async function req(path, opts) {
    let res;
    try { res = await fetch(C.API_BASE + path, opts); }
    catch (e) { throw new Error("Cannot reach the server. Is the backend running?"); }
    if (!res.ok) {
      let msg = res.statusText;
      try {
        const j = await res.json();
        const d = j.detail ?? j.message ?? msg;
        // FastAPI validation errors come back as a list of {msg, loc}
        msg = Array.isArray(d) ? d.map(x => x.msg).join("; ") : (typeof d === "string" ? d : JSON.stringify(d));
      } catch (_) {}
      throw new Error(msg);
    }
    return res.json();
  }

  const qs = p => {
    const s = new URLSearchParams(Object.entries(p || {}).filter(([, v]) => v != null)).toString();
    return s ? "?" + s : "";
  };

  window.Api = {
    getAreas: () => req("/areas"),                                    // GeoJSON FeatureCollection
    getReports: p => req("/reports" + qs(p)).then(l => l.map(fixPhoto)),
    getReport: id => req("/reports/" + encodeURIComponent(id)).then(fixPhoto),
    submitReport: ({ lat, lng, report_type, water_depth, photo }) => {
      const fd = new FormData();
      fd.append("lat", lat); fd.append("lng", lng);
      fd.append("report_type", report_type); fd.append("water_depth", water_depth);
      if (photo) fd.append("photo", photo);
      return req("/reports", { method: "POST", body: fd }).then(fixPhoto);
    },
    getAreaHistory: id => req("/areas/" + encodeURIComponent(id) + "/history"),
    getRainfall: () => req("/rainfall/latest"),
    getSensors: () => req("/sensors/latest"),
    getPending: () => req("/admin/pending").then(l => l.map(fixPhoto)),
    triggerRecheck: () => req("/admin/recheck", { method: "POST" })
  };
})();
