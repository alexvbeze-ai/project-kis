import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

// DEV-прокси: клиент ходит на относительные пути /api/...,
// vite проксирует на core-server (в прод-сборке это делает nginx/edge).
export default defineConfig({
  plugins: [react()],
  server: {
    port: 5173,
    proxy: {
      "/api": {
        target: process.env.CORE_SERVER_URL ?? "http://localhost:8080",
        changeOrigin: true,
      },
    },
  },
});
