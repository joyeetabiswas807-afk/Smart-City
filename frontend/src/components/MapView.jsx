import { useEffect, useRef, useState } from "react";
import maplibregl from "maplibre-gl";
import { CONFIG } from "../config";
import { STATUS, STATUS_ORDER, OUTCOME } from "../constants";
import { bboxOf } from "../utils";

const STYLE = {
  version: 8,
  sources: {
    osm: {
      type: "raster",
      tiles: ["https://tile.openstreetmap.org/{z}/{x}/{y}.png"],
      tileSize: 256,
      maxzoom: 19,
      attribution: "© OpenStreetMap contributors"
    }
  },
  layers: [{ id: "osm", type: "raster", source: "osm" }]
};

const EMPTY = { type: "FeatureCollection", features: [] };
const byStatus = (fn, fallback) => ["match", ["get", "status"], ...Object.entries(STATUS).flatMap(([k, v]) => [k, fn(k, v)]), fallback];
const byOutcome = ["match", ["get", "verification_status"], ...Object.entries(OUTCOME).flatMap(([k, v]) => [k, v.color]), "#8a96a0"];

const reportsToGeoJSON = reports => ({
  type: "FeatureCollection",
  features: reports.map(r => ({
    type: "Feature",
    geometry: { type: "Point", coordinates: [r.lng, r.lat] },
    properties: { id: r.id, area_id: r.area_id, verification_status: r.verification_status }
  }))
});

export default function MapView({ areas, reports, selectedId, reportMode, pin, showReports, fly, onSelectArea, onPick }) {
  const el = useRef(null);
  const mapRef = useRef(null);
  const markerRef = useRef(null);
  const fitted = useRef(false);
  const [loaded, setLoaded] = useState(false);
  // latest callbacks/mode for map event handlers registered once
  const live = useRef({});
  live.current = { onSelectArea, onPick, reportMode };

  // ---- create map once ----
  useEffect(() => {
    const [lat, lng] = CONFIG.MAP_CENTER;
    const map = new maplibregl.Map({ container: el.current, style: STYLE, center: [lng, lat], zoom: CONFIG.MAP_ZOOM });
    mapRef.current = map;
    map.addControl(new maplibregl.NavigationControl({ showCompass: false }), "top-left");

    map.on("load", () => {
      map.addSource("areas", { type: "geojson", data: EMPTY });
      map.addSource("reports", { type: "geojson", data: EMPTY });
      map.addLayer({
        id: "areas-fill", type: "fill", source: "areas",
        paint: {
          "fill-color": byStatus((k, v) => v.color, "#999"),
          "fill-opacity": byStatus(k => (k === "clear" ? 0.18 : k === "reported_clear_pending" ? 0.28 : 0.38), 0.3)
        }
      });
      map.addLayer({
        id: "areas-line", type: "line", source: "areas",
        filter: ["!=", ["get", "status"], "reported_clear_pending"],
        paint: { "line-color": byStatus((k, v) => v.color, "#999"), "line-width": 2 }
      });
      map.addLayer({
        id: "areas-line-pending", type: "line", source: "areas",
        filter: ["==", ["get", "status"], "reported_clear_pending"],
        paint: { "line-color": STATUS.reported_clear_pending.color, "line-width": 2.5, "line-dasharray": [2, 1.5] }
      });
      map.addLayer({
        id: "areas-selected", type: "line", source: "areas", filter: ["==", ["get", "id"], ""],
        paint: { "line-color": "#14212b", "line-width": 4 }
      });
      map.addLayer({
        id: "reports-dots", type: "circle", source: "reports",
        paint: { "circle-radius": 6, "circle-color": byOutcome, "circle-stroke-color": "#fff", "circle-stroke-width": 2 }
      });

      const popup = new maplibregl.Popup({ closeButton: false, closeOnClick: false, offset: 8 });
      map.on("mousemove", "areas-fill", e => {
        if (live.current.reportMode) return;
        map.getCanvas().style.cursor = "pointer";
        const p = e.features[0].properties;
        const div = document.createElement("div");
        const b = document.createElement("b"); b.textContent = p.name;
        div.append(b, document.createElement("br"), document.createTextNode(STATUS[p.status]?.label || p.status));
        popup.setLngLat(e.lngLat).setDOMContent(div).addTo(map);
      });
      map.on("mouseleave", "areas-fill", () => { popup.remove(); map.getCanvas().style.cursor = live.current.reportMode ? "crosshair" : ""; });

      map.on("click", e => {
        if (live.current.reportMode) { live.current.onPick({ lat: e.lngLat.lat, lng: e.lngLat.lng }); return; }
        const f = map.queryRenderedFeatures(e.point, { layers: ["areas-fill"] })[0];
        if (f) live.current.onSelectArea(f.properties.id);
      });
      setLoaded(true);
    });

    return () => { map.remove(); mapRef.current = null; };
  }, []);

  // ---- push data into sources ----
  useEffect(() => {
    if (!loaded) return;
    const map = mapRef.current;
    map.getSource("areas").setData(areas);
    if (!fitted.current && areas.features.length) {
      fitted.current = true;
      map.fitBounds(bboxOf(areas), { padding: 60, duration: 0 });
    }
  }, [loaded, areas]);

  useEffect(() => {
    if (loaded) mapRef.current.getSource("reports").setData(reportsToGeoJSON(reports));
  }, [loaded, reports]);

  // ---- selection highlight + hide rejected dots unless area selected + layer toggle ----
  useEffect(() => {
    if (!loaded) return;
    const map = mapRef.current;
    map.setFilter("areas-selected", ["==", ["get", "id"], selectedId || ""]);
    map.setFilter("reports-dots", ["any", ["!=", ["get", "verification_status"], "rejected"], ["==", ["get", "area_id"], selectedId || ""]]);
  }, [loaded, selectedId]);

  useEffect(() => {
    if (loaded) mapRef.current.setLayoutProperty("reports-dots", "visibility", showReports ? "visible" : "none");
  }, [loaded, showReports]);

  // ---- report pin (draggable marker, only while on the Report tab) ----
  useEffect(() => {
    const map = mapRef.current;
    if (!map) return;
    map.getCanvas().style.cursor = reportMode ? "crosshair" : "";
    if (!reportMode || !pin) {
      markerRef.current?.remove(); markerRef.current = null;
      return;
    }
    if (!markerRef.current) {
      const m = new maplibregl.Marker({ draggable: true, color: "#0b5c8a" }).setLngLat([pin.lng, pin.lat]).addTo(map);
      m.on("dragend", () => { const ll = m.getLngLat(); live.current.onPick({ lat: ll.lat, lng: ll.lng }); });
      markerRef.current = m;
    } else markerRef.current.setLngLat([pin.lng, pin.lat]);
  }, [reportMode, pin]);

  // ---- programmatic camera moves ----
  useEffect(() => {
    if (!loaded || !fly) return;
    const map = mapRef.current;
    if (fly.bounds) map.fitBounds(fly.bounds, { padding: 80, maxZoom: 17.5 });
    else map.flyTo({ center: [fly.lng, fly.lat], zoom: fly.zoom || 18 });
  }, [loaded, fly]);

  return (
    <div className="mapwrap">
      <div ref={el} className="map" aria-label="Interactive waterlogging map" />
      <Legend />
    </div>
  );
}

function Legend() {
  return (
    <div className="legend">
      {STATUS_ORDER.map(k => (
        <div key={k}>
          <i style={{ borderColor: STATUS[k].color, background: STATUS[k].color + "55", borderStyle: STATUS[k].dashed ? "dashed" : "solid" }} />
          {STATUS[k].label}
        </div>
      ))}
      <div className="legend-dots">
        <span style={{ color: OUTCOME.verified.color }}>●</span> verified&nbsp;
        <span style={{ color: OUTCOME.pending.color }}>●</span> pending report
      </div>
    </div>
  );
}
