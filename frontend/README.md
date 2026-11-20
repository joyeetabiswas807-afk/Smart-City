# Waterlogging Twin: frontend

Plain HTML/CSS/JavaScript + [Leaflet](https://leafletjs.com) (map). No build step, no npm, which matches the "HTML, CSS and JavaScript" presentation layer in your Chapter 4 and keeps the "start with a single command" goal easy.

## Run it
```bash
cd waterlogging-frontend
python3 -m http.server 5173
# open http://localhost:5173
```
It starts in **demo mode** (fake data, no backend needed). Needs internet for the map tiles and Leaflet (loaded from unpkg / OpenStreetMap).

## Connect the real backend
Edit `js/config.js`:
```js
USE_MOCK: false,
API_BASE: "http://localhost:8000/api",
MAP_CENTER: [lat, lng],   // your demonstration area
```
Backend needs CORS enabled and must follow `API_CONTRACT.md`. If it can't, adjust only `js/api.js`.

For the packaged single-command demo, the backend can serve this folder as static files (FastAPI: `app.mount("/", StaticFiles(directory="waterlogging-frontend", html=True))`), then `API_BASE` can be just `"/api"`.

## What's in it
| File | Purpose |
|---|---|
| `index.html` | Page layout: Overview / Report / My reports / Admin tabs + map |
| `css/styles.css` | All styling (responsive; map on top on phones) |
| `js/config.js` | The only file you normally edit |
| `js/api.js` | Real backend calls |
| `js/mock.js` | Fake backend with a toy verification engine, to demo every outcome |
| `js/app.js` | Map, status colours, report form, result + evidence view, polling |
| `API_CONTRACT.md` | Endpoint/JSON spec to agree with your teammate |

## Features mapped to your scope (Ch. 1.4)
- Interactive map with the five statuses (waterlogged, clear, reported clear (pending), verified clear, verified still waterlogged), distinct by colour, icon and dashed outline for pending.
- Report form: map pin or "use my location", report type, depth category, optional photo.
- Immediate result with confidence and **explanation + five-factor evidence** for every decision.
- "My reports" tracks your reports (stored in the browser) and updates pending ones automatically.
- Admin tab: pending queue, simulated sensor readings, status changes, manual recheck.
