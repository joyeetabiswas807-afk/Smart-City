const env = import.meta.env;

export const CONFIG = {
  USE_MOCK: (env.VITE_USE_MOCK ?? "true") === "true",
  API_BASE: env.VITE_API_BASE ?? "/api",
  MAP_CENTER: (env.VITE_MAP_CENTER ?? "19.0760,72.8777").split(",").map(Number), // [lat, lng]
  MAP_ZOOM: 16,
  POLL_MS: 15000,
  MAX_PHOTO_MB: 5
};
