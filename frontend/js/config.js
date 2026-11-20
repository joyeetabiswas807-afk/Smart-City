// ---- Edit these values; nothing else needs changing to connect the backend ----
window.APP_CONFIG = {
  // Base URL of the Python backend (include the /api prefix if the backend uses one).
  API_BASE: "http://localhost:8000/api",

  // true  = use built-in fake data (works with no backend; good for UI work and demos)
  // false = call the real backend at API_BASE
  USE_MOCK: true,

  // Demonstration area. PLACEHOLDER: replace with your chosen area's centre [lat, lng].
  MAP_CENTER: [19.0760, 72.8777],
  MAP_ZOOM: 16,

  // How often the map/status refreshes from the backend (ms).
  POLL_MS: 15000,

  MAX_PHOTO_MB: 5
};
