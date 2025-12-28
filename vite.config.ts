import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import { fileURLToPath } from "url";
import { dirname, resolve } from "path";

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

export default defineConfig({
  plugins: [react()],
  root: resolve(__dirname, "web"),
  resolve: {
    alias: {
      "@": resolve(__dirname, "web/src"),
    },
  },
  build: {
    outDir: resolve(__dirname, "dist/client"),
    emptyOutDir: true,
  },
  server: {
    port: 5173,
    proxy: {
      "/api": {
        target: "http://localhost:8787",
        changeOrigin: true,
      },
      "/css": {
        target: "http://localhost:8787",
        changeOrigin: true,
      },
    },
  },
  publicDir: resolve(__dirname, "public"),
});
