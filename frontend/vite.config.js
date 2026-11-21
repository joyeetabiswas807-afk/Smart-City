import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

// In dev, forward /api and /uploads to the FastAPI backend so the browser sees one origin (no CORS setup needed).
// Change the target if your teammate runs FastAPI on another port.
const BACKEND = process.env.BACKEND_URL || "http://localhost:8000";

export default defineConfig({
  plugins: [react()],
  server: {
    port: 5173,
    proxy: {
      "/api": { target: BACKEND, changeOrigin: true },
      "/uploads": { target: BACKEND, changeOrigin: true }
    }
  }
});
