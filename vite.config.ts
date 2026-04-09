import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import tailwindcss from "@tailwindcss/vite";

// @ts-expect-error process is a nodejs global
const host = process.env.TAURI_DEV_HOST;

// https://vite.dev/config/
export default defineConfig(async () => ({
  plugins: [react(), tailwindcss()],
  clearScreen: false,
  server: {
    port: 1420,
    strictPort: true,
    host: host || false,
    hmr: host
      ? {
        protocol: "ws",
        host,
        port: 1421,
      }
      : undefined,
    watch: {
      ignored: ["**/src-tauri/**"],
    },
  },
  build: {
    // Optimized for better caching and smaller main bundle
    chunkSizeWarningLimit: 1000,
    rollupOptions: {
      output: {
        manualChunks(id) {
          if (id.includes("node_modules")) {
            if (id.includes("react-dom") || id.includes("react/")) {
              return "vendor-react";
            }
            if (id.includes("framer-motion")) {
              return "vendor-ui";
            }
            if (id.includes("recharts")) {
              return "vendor-charts";
            }
            if (id.includes("lucide-react")) {
              return "vendor-icons";
            }
            if (id.includes("@tauri-apps")) {
              return "vendor-tauri";
            }
            if (id.includes("@dnd-kit")) {
              return "vendor-dnd";
            }
            return "vendor";
          }
        },
      },
    },
  },
}));
