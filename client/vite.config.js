import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

export default defineConfig({
  plugins: [react()],
  server: {
    proxy: {
      "/live": { target: "http://localhost:4000", ws: true, changeOrigin: true },
      "/ssh":  { target: "http://localhost:4000", ws: true, changeOrigin: true },
      "/ingest":  { target: "http://localhost:4000", ws: true, changeOrigin: true }
    }
  }
});
