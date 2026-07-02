import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

// Served under /dashboard/ on the gateway origin; the dev server proxies the
// platform REST API to the local wrangler dev server (apps/gateway).
export default defineConfig({
  base: "/dashboard/",
  plugins: [react()],
  server: {
    port: 5173,
    proxy: {
      "/api": {
        target: "http://127.0.0.1:8787",
        changeOrigin: true,
      },
    },
  },
  build: {
    outDir: "dist",
    sourcemap: false,
  },
});
