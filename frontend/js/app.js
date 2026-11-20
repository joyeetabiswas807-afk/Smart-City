(function () {
  const C = window.APP_CONFIG, api = window.Api;
  const $ = s => document.querySelector(s);
  const esc = s => String(s ?? "").replace(/[&<>"']/g, c => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));

  const STATUS = {
    waterlogged:                { label: "Waterlogged",              icon: "💧", color: "#d64545", dash: null },
    verified_still_waterlogged: { label: "Verified still waterlogged", icon: "⚠",  color: "#8f1d2c", dash: null },
    clear:                      { label: "Clear",                    icon: "○",  color: "#6fb3a0", dash: null },
    verified_clear:             { label: "Verified clear",           icon: "✔",  color: "#2c8a4b", dash: null },
    reported_clear_pending:     { label: "Reported clear (pending)", icon: "⏳", color: "#e0a100", dash: "6 5" }
  };
  const STATUS_ORDER = ["waterlogged", "verified_still_waterlogged", "reported_clear_pending", "clear", "verified_clear"];
  const OUTCOME = { verified: "Verified", rejected: "Rejected", pending: "Pending" };
  const DEPTHS = [
    { v: "none", l: "None", s: "cleared" }, { v: "ankle", l: "Ankle", s: "< 15 cm" },
    { v: "knee", l: "Knee", s: "15–50 cm" }, { v: "waist", l: "Waist+", s: "> 50 cm" }
  ];
  const DEPTH_LABEL = Object.fromEntries(DEPTHS.map(d => [d.v, d.l]));

  const state = { tab: "overview", areas: [], reports: [], selected: null, pin: null, mine: [], photo: null, submitting: false };
  try { state.mine = JSON.parse(localStorage.getItem("wt_mine") || "[]"); } catch (_) {}
  const saveMine = () => { try { localStorage.setItem("wt_mine", JSON.stringify(state.mine.slice(0, 50))); } catch (_) {} };

  const ago = iso => {
    if (!iso) return "—";
    const m = Math.max(0, Math.round((Date.now() - Date.parse(iso)) / 60000));
    return m < 1 ? "just now" : m < 60 ? m + " min ago" : m < 1440 ? Math.round(m / 60) + " h ago" : Math.round(m / 1440) + " d ago";
  };
  const badge = (k, map = STATUS) => `<span class="badge ${esc(k)}">${map === STATUS ? (STATUS[k]?.icon || "") + " " + esc(STATUS[k]?.label || k) : esc(OUTCOME[k] || k)}</span>`;
  const toast = (msg, ms = 3500) => { const t = $("#toast"); t.textContent = msg; t.hidden = false; clearTimeout(toast._t); toast._t = setTimeout(() => t.hidden = true, ms); };

  // ---------------- map ----------------
  const map = L.map("map").setView(C.MAP_CENTER, C.MAP_ZOOM);
  L.tileLayer("https://tile.openstreetmap.org/{z}/{x}/{y}.png", { maxZoom: 19, attribution: "&copy; OpenStreetMap contributors" }).addTo(map);
  let areaLayer = null, reportLayer = L.layerGroup().addTo(map), pinMarker = null;

  const areaStyle = (st, sel) => {
    const s = STATUS[st] || STATUS.clear;
    return { color: s.color, weight: sel ? 4 : 2, dashArray: s.dash, fillColor: s.color, fillOpacity: st === "clear" ? .18 : st === "reported_clear_pending" ? .28 : .38 };
  };
  function drawAreas() {
    if (areaLayer) map.removeLayer(areaLayer);
    areaLayer = L.geoJSON({ type: "FeatureCollection", features: state.areas }, {
      style: f => areaStyle(f.properties.status, f.properties.id === state.selected),
      onEachFeature: (f, layer) => {
        layer.bindTooltip(`${f.properties.name}: ${STATUS[f.properties.status]?.label || f.properties.status}`, { sticky: true });
        layer.on("click", e => { if (state.tab === "report") { setPin(e.latlng); return; } selectArea(f.properties.id, true); });
      }
    }).addTo(map);
    areaLayer.bringToBack();
  }
  function drawReports() {
    reportLayer.clearLayers();
    if (!$("#toggle-reports").checked) return;
    const col = { verified: "#2c8a4b", pending: "#e0a100", rejected: "#8a96a0" };
    state.reports.filter(r => r.verification_status !== "rejected" || state.selected === r.area_id).forEach(r => {
      L.circleMarker([r.lat, r.lng], { radius: 6, color: "#fff", weight: 2, fillColor: col[r.verification_status], fillOpacity: .95 })
        .bindTooltip(`${r.report_type === "cleared" ? "Clearance" : "Waterlogging"} report · ${OUTCOME[r.verification_status]} · ${ago(r.created_at)}`)
        .addTo(reportLayer);
    });
  }
  map.on("click", e => { if (state.tab === "report") setPin(e.latlng); });
  $("#toggle-reports").addEventListener("change", drawReports);

  $("#legend").innerHTML = STATUS_ORDER.map(k => `<div><i style="border-color:${STATUS[k].color};background:${STATUS[k].color}55;${STATUS[k].dash ? "border-style:dashed" : ""}"></i>${esc(STATUS[k].label)}</div>`).join("") +
    `<div style="margin-top:6px;border-top:1px solid #dbe3e9;padding-top:5px"><span style="color:#2c8a4b">●</span> verified &nbsp;<span style="color:#e0a100">●</span> pending report</div>`;

  // ---------------- tabs ----------------
  function setTab(t) {
    state.tab = t;
    document.querySelectorAll(".tabs button").forEach(b => b.classList.toggle("active", b.dataset.tab === t));
    document.querySelectorAll(".tabpane").forEach(p => p.hidden = p.id !== "tab-" + t);
    $("#map").classList.toggle("picking", t === "report");
    if (t === "report") { if (!pinMarker) setPin(state.pin ? L.latLng(state.pin.lat, state.pin.lng) : map.getCenter(), !state.pinSet); }
    else if (pinMarker) { map.removeLayer(pinMarker); pinMarker = null; }
    if (t === "admin") loadAdmin();
    if (t === "mine") renderMine();
  }
  document.querySelectorAll(".tabs button").forEach(b => b.addEventListener("click", () => setTab(b.dataset.tab)));

  // ---------------- overview ----------------
  function renderOverview() {
    const counts = {};
    state.areas.forEach(f => counts[f.properties.status] = (counts[f.properties.status] || 0) + 1);
    const wl = (counts.waterlogged || 0) + (counts.verified_still_waterlogged || 0);
    const pend = state.areas.reduce((n, f) => n + (f.properties.pending_reports || 0), 0);
    $("#summary").innerHTML =
      `<div class="stat"><b>${wl}</b><span>waterlogged</span></div>` +
      `<div class="stat"><b>${(counts.clear || 0) + (counts.verified_clear || 0)}</b><span>clear</span></div>` +
      `<div class="stat"><b>${pend}</b><span>reports awaiting verification</span></div>`;
    const sorted = [...state.areas].sort((a, b) => STATUS_ORDER.indexOf(a.properties.status) - STATUS_ORDER.indexOf(b.properties.status));
    $("#area-list").innerHTML = sorted.map(f => {
      const p = f.properties;
      return `<li><button data-id="${esc(p.id)}" class="${p.id === state.selected ? "sel" : ""}"><span><b>${esc(p.name)}</b><small>Updated ${ago(p.last_updated)}${p.pending_reports ? " · " + p.pending_reports + " pending" : ""}</small></span>${badge(p.status)}</button></li>`;
    }).join("");
    $("#area-list").querySelectorAll("button").forEach(b => b.addEventListener("click", () => selectArea(b.dataset.id, true)));
  }

  async function selectArea(id, fly) {
    state.selected = id;
    const f = state.areas.find(a => a.properties.id === id);
    if (!f) return;
    if (state.tab !== "overview") setTab("overview");
    drawAreas(); drawReports(); renderOverview();
    if (fly && areaLayer) areaLayer.eachLayer(l => { if (l.feature.properties.id === id) map.fitBounds(l.getBounds().pad(.4), { maxZoom: 17 }); });
    const p = f.properties, box = $("#area-detail");
    box.innerHTML = `<div class="card"><button class="close" aria-label="Close">×</button><h3>${esc(p.name)}</h3>${badge(p.status)}<p class="meta">Confirmed status updated ${ago(p.last_updated)}</p><div id="ad-body" class="note">Loading…</div></div>`;
    box.querySelector(".close").onclick = () => { state.selected = null; box.innerHTML = ""; drawAreas(); drawReports(); renderOverview(); };
    try {
      const [hist, reps] = await Promise.all([api.getAreaHistory(id), api.getReports({ area_id: id })]);
      if (state.selected !== id) return;
      const body = box.querySelector("#ad-body"); if (!body) return;
      body.className = "";
      body.innerHTML = `<h3 class="h3">Latest reports</h3>` +
        (reps.length ? reps.slice(0, 5).map(r => reportMini(r)).join("") : `<p class="note">No reports yet.</p>`) +
        `<h3 class="h3">Status history</h3>` +
        (hist.length ? hist.slice(0, 5).map(h => `<p class="hist">${ago(h.timestamp)}: ${esc(STATUS[h.previous_status]?.label || h.previous_status)} → <b>${esc(STATUS[h.updated_status]?.label || h.updated_status)}</b></p>`).join("") : `<p class="note">No changes recorded.</p>`);
    } catch (e) { toast(e.message); }
  }

  function reportMini(r) {
    return `<div class="meta">${badge(r.verification_status, OUTCOME)} ${r.report_type === "cleared" ? "Cleared" : "Waterlogged"} · ${esc(DEPTH_LABEL[r.water_depth] || r.water_depth)} · ${ago(r.created_at)}<br>${esc(r.explanation)}</div>`;
  }

  // ---------------- report form ----------------
  const form = $("#report-form");
  const typeVal = () => form.report_type.value;
  function renderDepths() {
    const cleared = typeVal() === "cleared";
    const cur = form.querySelector("[name=water_depth]:checked")?.value;
    const want = cleared ? "none" : (cur && cur !== "none" ? cur : "ankle");
    $("#depth-chips").innerHTML = DEPTHS.map(d => `<label><input type="radio" name="water_depth" value="${d.v}" ${d.v === want ? "checked" : ""} ${cleared !== (d.v === "none") ? "disabled" : ""}><span>${d.l}<small>${d.s}</small></span></label>`).join("");
  }
  form.querySelectorAll("[name=report_type]").forEach(r => r.addEventListener("change", renderDepths));
  renderDepths();

  function setPin(latlng, quiet) {
    state.pin = { lat: latlng.lat, lng: latlng.lng };
    if (!pinMarker) {
      pinMarker = L.marker(latlng, { draggable: true }).addTo(map);
      pinMarker.on("dragend", () => setPin(pinMarker.getLatLng()));
    } else pinMarker.setLatLng(latlng);
    const pt = $("#pin-text");
    pt.textContent = quiet ? "Tap the map to place your pin, or drag it." : `Pin placed: ${state.pin.lat.toFixed(5)}, ${state.pin.lng.toFixed(5)}`;
    pt.classList.toggle("set", !quiet);
    state.pinSet = !quiet;
  }
  $("#btn-locate").addEventListener("click", () => {
    if (!navigator.geolocation) return toast("Location is not available in this browser.");
    navigator.geolocation.getCurrentPosition(p => { const ll = L.latLng(p.coords.latitude, p.coords.longitude); setPin(ll); map.setView(ll, 18); },
      () => toast("Couldn't get your location. Tap the map instead."), { timeout: 8000 });
  });

  $("#photo").addEventListener("change", e => {
    const f = e.target.files[0], prev = $("#photo-preview");
    state.photo = null; prev.hidden = true;
    if (!f) return;
    if (!/^image\/(jpeg|png|webp)$/.test(f.type)) { e.target.value = ""; return showErr("Please choose a JPEG, PNG or WebP image."); }
    if (f.size > C.MAX_PHOTO_MB * 1048576) { e.target.value = ""; return showErr(`Photo must be under ${C.MAX_PHOTO_MB} MB.`); }
    showErr(""); state.photo = f; prev.src = URL.createObjectURL(f); prev.hidden = false;
  });
  const showErr = m => { const el = $("#form-error"); el.textContent = m; el.hidden = !m; };

  form.addEventListener("submit", async e => {
    e.preventDefault();
    if (state.submitting) return;
    if (!state.pinSet) return showErr("Please tap the map (or use your location) to place a pin.");
    showErr("");
    const btn = $("#btn-submit"); state.submitting = true; btn.disabled = true; btn.textContent = "Verifying…";
    try {
      const rep = await api.submitReport({ lat: state.pin.lat, lng: state.pin.lng, report_type: typeVal(), water_depth: form.querySelector("[name=water_depth]:checked").value, photo: state.photo });
      state.mine.unshift(rep.id); saveMine(); updateMineCount();
      $("#report-result").innerHTML = `<div class="card result ${esc(rep.verification_status)}"><h3>Report received</h3>${resultBody(rep, true)}</div>`;
      form.reset(); renderDepths(); $("#photo-preview").hidden = true; state.photo = null; state.pinSet = false;
      $("#pin-text").textContent = "Tap the map to place your pin, or drag it."; $("#pin-text").classList.remove("set");
      refresh();
    } catch (err) { showErr(err.message); }
    finally { state.submitting = false; btn.disabled = false; btn.textContent = "Submit report"; }
  });

  function evidenceHtml(ev) {
    if (!ev || !ev.length) return "";
    return `<ul class="evidence">` + ev.map(x => `<li><b>${esc(x.label)}</b><div class="meter" title="How strongly this supports the report"><i style="width:${Math.round(100 * (+x.score || 0))}%"></i></div><small>${esc(x.detail)}</small></li>`).join("") + `</ul>`;
  }
  function resultBody(r, open) {
    const pct = r.confidence == null ? null : Math.round(r.confidence * 100);
    return `<p>${badge(r.verification_status, OUTCOME)} ${r.report_type === "cleared" ? "Water cleared" : "Waterlogged"} · ${esc(DEPTH_LABEL[r.water_depth] || r.water_depth)} · <span class="meta">${ago(r.created_at)}</span></p>` +
      (pct != null ? `<div class="meta">Confidence ${pct}%</div><div class="meter"><i style="width:${pct}%"></i></div>` : "") +
      `<p>${esc(r.explanation || "Awaiting verification.")}</p>` +
      (r.photo_url ? `<img class="thumb" src="${esc(r.photo_url)}" alt="Submitted photo">` : "") +
      (r.evidence && r.evidence.length ? `<details ${open ? "open" : ""}><summary>Why this decision</summary>${evidenceHtml(r.evidence)}</details>` : "");
  }

  // ---------------- my reports ----------------
  const updateMineCount = () => { const c = $("#mine-count"); c.textContent = state.mine.length; c.hidden = !state.mine.length; };
  const mineData = {};
  async function refreshMine() {
    await Promise.all(state.mine.slice(0, 20).map(async id => {
      if (mineData[id] && mineData[id].verification_status !== "pending") return;
      try { mineData[id] = await api.getReport(id); } catch (_) {}
    }));
    if (state.tab === "mine") renderMine();
  }
  function renderMine() {
    $("#mine-empty").hidden = state.mine.length > 0;
    $("#mine-list").innerHTML = state.mine.map(id => mineData[id] ? `<div class="card result ${esc(mineData[id].verification_status)}">${resultBody(mineData[id])}</div>` : "").join("");
  }

  // ---------------- admin ----------------
  async function loadAdmin() {
    try {
      const [pend, sens, hist] = await Promise.all([api.getPending(), api.getSensors(), Promise.all(state.areas.map(f => api.getAreaHistory(f.properties.id)))]);
      $("#admin-pending").innerHTML = pend.length ? pend.map(r => `<div class="card"><b>${esc(state.areas.find(a => a.properties.id === r.area_id)?.properties.name || r.area_id)}</b><div class="meta">${r.report_type === "cleared" ? "Clearance" : "Waterlogging"} report · ${ago(r.created_at)}${r.confidence != null ? " · confidence " + Math.round(r.confidence * 100) + "%" : ""}</div><p>${esc(r.explanation)}</p></div>`).join("") : `<p class="note">No pending reports.</p>`;
      $("#admin-sensors").innerHTML = `<tr><th>Area</th><th>Level</th><th>Updated</th></tr>` + sens.map(s => `<tr><td>${esc(s.area_name)}</td><td>${esc(s.level_cm)} cm</td><td>${ago(s.updated_at)}</td></tr>`).join("");
      const names = Object.fromEntries(state.areas.map(f => [f.properties.id, f.properties.name]));
      const all = hist.flat().sort((a, b) => Date.parse(b.timestamp) - Date.parse(a.timestamp)).slice(0, 8);
      $("#admin-history").innerHTML = all.map(h => `<p class="hist">${ago(h.timestamp)} · <b>${esc(names[h.area_id] || h.area_id)}</b>: ${esc(STATUS[h.previous_status]?.label || h.previous_status)} → ${esc(STATUS[h.updated_status]?.label || h.updated_status)}</p>`).join("") || `<p class="note">No changes yet.</p>`;
    } catch (e) { toast(e.message); }
  }
  $("#btn-recheck").addEventListener("click", async () => {
    const b = $("#btn-recheck"); b.disabled = true;
    try { const r = await api.triggerRecheck(); $("#recheck-msg").textContent = `Rechecked ${r.rechecked}, resolved ${r.resolved}.`; await refresh(); loadAdmin(); }
    catch (e) { toast(e.message); } finally { b.disabled = false; }
  });

  // ---------------- refresh loop ----------------
  async function refresh() {
    try {
      const [fc, reps, rain] = await Promise.all([api.getAreas(), api.getReports({ recent: 1 }), api.getRainfall().catch(() => null)]);
      state.areas = fc.features; state.reports = reps;
      drawAreas(); drawReports(); renderOverview();
      if (rain) $("#rain-chip").textContent = `🌧 ${(+rain.last_3h_mm).toFixed(1)} mm / 3 h`;
      $("#live-dot").classList.remove("err"); $("#live-dot").textContent = "● live"; $("#live-dot").title = "Updated " + new Date().toLocaleTimeString();
      refreshMine();
    } catch (e) {
      $("#live-dot").classList.add("err"); $("#live-dot").textContent = "● offline"; $("#live-dot").title = e.message;
    }
  }

  if (C.USE_MOCK) $("#mode-badge").hidden = false;
  updateMineCount();
  refresh().then(() => { if (state.areas.length) { const b = L.geoJSON({ type: "FeatureCollection", features: state.areas }).getBounds(); map.fitBounds(b.pad(.15)); } });
  setInterval(refresh, C.POLL_MS);
  window.__app = { state, setTab, setPin, refresh };
})();
