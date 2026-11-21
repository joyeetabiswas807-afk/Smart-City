# Waterlogging Twin: frontend (React + Vite + MapLibre GL JS)

Matches the stack table: JavaScript frontend with **React + Vite**, map with **MapLibre GL JS** (free OpenStreetMap raster tiles, no API key), talking to the **FastAPI** backend.

## Run
```bash
npm install
cp .env.example .env.local     # optional; defaults already use demo mode
npm run dev                    # http://localhost:5173
```
Starts in **demo mode** (`VITE_USE_MOCK=true`): fake areas, reports and a toy verification engine, so you can build and demo the UI without the backend.

## Connect to your teammates' FastAPI
1. In `.env.local` set `VITE_USE_MOCK=false` and `VITE_MAP_CENTER=lat,lng` (your demonstration area).
2. Run FastAPI on port 8000 (or `BACKEND_URL=http://localhost:9000 npm run dev`). The Vite dev server proxies `/api` and `/uploads` to it, so **no CORS setup is needed in development**.
3. Compare their `http://localhost:8000/docs` (auto-generated) with `API_CONTRACT.md`. If a path or field differs, change it in **`src/api/index.js`** (one file) rather than in components.

Production build: `npm run build` creates `dist/`. FastAPI can serve it with `app.mount("/", StaticFiles(directory="dist", html=True))` for the single-command demo.

## Structure
| Path | Purpose |
|---|---|
| `src/api/index.js` | All backend calls (real) and switch to mock |
| `src/api/mock.js` | Fake backend for demo mode |
| `src/App.jsx` | State, 15 s polling, tabs |
| `src/components/MapView.jsx` | MapLibre map: status polygons, report dots, draggable pin, hover/click |
| `src/components/Overview.jsx` | Summary, area list, area detail with history |
| `src/components/ReportForm.jsx` | Report type, map pin / geolocation, depth, photo, result + explanation |
| `src/components/MyReports.jsx` | Your reports; pending ones update automatically |
| `src/components/Admin.jsx` | Pending queue, simulated sensors, status history, manual recheck |
| `src/constants.js` | Status names, colours, depth categories |
| `API_CONTRACT.md` | Endpoint and JSON shapes to agree with the backend |

## Where the other layers of your stack show up in the UI
- **Open-Meteo rainfall**: header chip, from `GET /rainfall/latest` (backend calls Open-Meteo).
- **DEM / terrain risk (rasterio + pysheds)**: shown inside each report's "Why this decision" evidence list. A terrain-risk map layer would need an extra endpoint (not included yet).
- **Sensor simulation script**: Admin tab reads `GET /sensors/latest`.
- **PostGIS**: areas arrive as GeoJSON polygons from `GET /areas`; MapLibre draws them directly.
