import path from "path";
import { fileURLToPath } from "url";
import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import tidewave from 'tidewave/vite-plugin';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const PORT = 8081;

export default defineConfig({
  plugins: [
    tidewave(), react(),
  ],
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "src"),
      src: path.resolve(__dirname, "src"),
      // Force node-fetch to use browser-safe version (exports window.fetch)
      "node-fetch": path.resolve(__dirname, "node_modules/node-fetch/browser.js"),
    },
  },
  optimizeDeps: {
    include: ["react-pdf", "jszip"],
    esbuildOptions: {
      define: {
        global: "globalThis",
      },
    },
  },
  worker: {
    format: "es",
  },
  server: {
    port: PORT,
    host: true,
    proxy: {
      "/api/copilotkit": {
        target: "http://127.0.0.1:3000",
        changeOrigin: true,
        secure: false,
        ws: true,
      },
      "/api/upload": {
        target: "http://127.0.0.1:4000",
        changeOrigin: true,
        secure: false,
      },
      "/api/sts-token": {
        target: "http://127.0.0.1:4000",
        changeOrigin: true,
        secure: false,
      },
      "/api/health": {
        target: "http://127.0.0.1:4000",
        changeOrigin: true,
        secure: false,
      },
      "/api/ag-ui": {
        target: "http://127.0.0.1:4000",
        changeOrigin: true,
        secure: false,
      },
      "/api/assistant": {
        target: "http://127.0.0.1:4000",
        changeOrigin: true,
        secure: false,
        // SSE / streaming — disable buffering & compression
        configure: (proxy) => {
          proxy.on("proxyRes", (proxyRes) => {
            if (proxyRes.headers["content-type"]?.includes("text/event-stream")) {
              proxyRes.headers["cache-control"] = "no-cache, no-transform";
              proxyRes.headers["x-accel-buffering"] = "no";
              delete proxyRes.headers["content-encoding"];
            }
          });
        },
      },
      "/rpc": {
        target: "http://127.0.0.1:4000",
        changeOrigin: true,
        secure: false,
      },

      "/api": {
        target: "http://127.0.0.1:4000",
        changeOrigin: true,
        secure: false,
      },
      // Agent migrated to Phoenix :4000 (was agent-server :5050)
      "/agent": {
        target: "http://127.0.0.1:4000",
        changeOrigin: true,
        secure: false,
        rewrite: (path) => path.replace(/^\/agent/, ""),
        configure: (proxy) => {
          proxy.on("proxyRes", (proxyRes) => {
            if (proxyRes.headers["content-type"]?.includes("text/event-stream")) {
              proxyRes.headers["cache-control"] = "no-cache, no-transform";
              proxyRes.headers["x-accel-buffering"] = "no";
              delete proxyRes.headers["content-encoding"];
            }
          });
        },
      },
      "/competency-graph": {
        target: "http://127.0.0.1:4000",
        changeOrigin: true,
        secure: false,
      },
      "/curriculum": {
        target: "http://127.0.0.1:4000",
        changeOrigin: true,
        secure: false,
      },
    },
  },
  build: {
    chunkSizeWarningLimit: 1000,
    minify: "esbuild",
    // 现代浏览器基线（与 package.json browserslist 一致）：es2022 原生输出，
    // 不再为旧浏览器做转译/polyfill，构建更快、产物更小
    target: "es2022",
    modulePreload: { polyfill: false },
  },
  css: {
    postcss: "./postcss.config.js",
  },
  preview: { port: PORT, host: true },
});
