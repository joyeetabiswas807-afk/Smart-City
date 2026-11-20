# API contract (frontend ⇄ Python backend)

Proposed from the project document (Ch. 3–4). Share this with your backend teammate; if they change a shape, only `js/api.js` (and field names in `js/app.js`) need updating.

Base URL is `API_BASE` in `js/config.js` (default `http://localhost:8000/api`). All responses are JSON, times are ISO-8601 UTC strings. The backend must enable **CORS** for the frontend origin (FastAPI: `CORSMiddleware`).

## Enums

| Field | Values |
|---|---|
| `report_type` | `waterlogged`, `cleared` |
| `water_depth` | `none`, `ankle` (<15 cm), `knee` (15–50 cm), `waist` (>50 cm). `cleared` reports use `none`; `waterlogged` reports use the other three. |
| `verification_status` | `verified`, `rejected`, `pending` |
| area `status` | `waterlogged`, `clear`, `reported_clear_pending`, `verified_clear`, `verified_still_waterlogged` |

## Endpoints

### `GET /areas`
GeoJSON `FeatureCollection`. Each feature: Polygon geometry (`[lng, lat]` order, as GeoJSON requires) and
```json
{ "id": "A1", "name": "Market Road", "status": "waterlogged",
  "last_updated": "2026-11-20T10:15:00Z", "pending_reports": 1 }
```

### `GET /reports?area_id=&status=&recent=1`
List of reports, newest first. `recent=1` means the last ~6 hours (used for map dots). Report object:
```json
{ "id": "R8F2K", "area_id": "A1", "lat": 19.0761, "lng": 72.8779,
  "report_type": "cleared", "water_depth": "none",
  "photo_url": "/uploads/R8F2K.jpg",
  "created_at": "2026-11-20T10:00:00Z",
  "verification_status": "pending",
  "confidence": 0.52,
  "explanation": "Evidence is conflicting: the sensor still reads 6 cm.",
  "evidence": [
    { "key": "rainfall", "label": "Recent rainfall", "score": 0.4, "detail": "9.5 mm in the last 3 h" },
    { "key": "terrain",  "label": "Terrain low-lying risk", "score": 0.3, "detail": "Low-lying; water tends to stay" },
    { "key": "sensor",   "label": "Water-level sensor (simulated)", "score": 0.45, "detail": "Reads 6 cm" },
    { "key": "nearby",   "label": "Nearby reports", "score": 0.5, "detail": "1 of 2 recent nearby reports agree" },
    { "key": "elapsed",  "label": "Time since waterlogging began", "score": 0.7, "detail": "Began about 4 h ago" }
  ],
  "decided_at": "2026-11-20T10:00:02Z" }
```
- `confidence` is 0–1 or `null`. `explanation` is a human-readable string (required for every decision; the UI shows it).
- `evidence[].score` is 0–1 = how strongly that factor **supports the submitted report**. `evidence` may be `[]`.
- `photo_url` may be relative (frontend prefixes the API origin) or absolute, or `null`.

### `GET /reports/{id}`
One report object (same shape). Used to poll "My reports" until `pending` resolves.

### `POST /reports`  (multipart/form-data)
Fields: `lat`, `lng` (float), `report_type`, `water_depth`, optional `photo` (JPEG/PNG/WebP, ≤5 MB).
Runs validation + verification **synchronously** and returns the report object with its first decision (`verified`/`rejected`/`pending`).
Errors: HTTP 4xx with `{"detail": "message"}` — e.g. 422 "That location is outside the demonstration area." The `detail` string is shown to the user.

### `GET /areas/{id}/history`
```json
[ { "id": "H12", "area_id": "A1", "previous_status": "clear", "updated_status": "waterlogged",
    "related_report_id": "R8F2K", "timestamp": "2026-11-20T09:00:00Z" } ]
```
Newest first.

### `GET /rainfall/latest`
`{ "last_1h_mm": 4.2, "last_3h_mm": 9.5, "updated_at": "...", "source": "open-meteo" }`

### `GET /sensors/latest`
`[ { "area_id": "A1", "area_name": "Market Road", "level_cm": 24, "updated_at": "...", "type": "simulated" } ]`

### `GET /admin/pending`
List of report objects with `verification_status = "pending"`.

### `POST /admin/recheck`
Triggers an immediate recheck of pending reports. Returns `{ "rechecked": 3, "resolved": 1 }`.
(The backend should also recheck automatically on a timer; the button is for demos.)

## Status rules the UI assumes (from Ch. 3.7 / 4.3.6)
- Unverified reports never change an area's confirmed `status`; only the verification result does.
- Verified `waterlogged` → area `waterlogged`. Verified `cleared` → `verified_clear`. Pending `cleared` → `reported_clear_pending`. Rejected `cleared` → `verified_still_waterlogged`.
- Every status change is written to the area's history with the related report id.

## Not in the contract yet (decide with your teammate)
- Admin authentication (the Admin tab is currently open to everyone, fine for a prototype demo).
- Live push (WebSocket/SSE). The UI polls every `POLL_MS` (15 s) instead.
