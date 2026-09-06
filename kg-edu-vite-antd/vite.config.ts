import path from "path";
import { fileURLToPath } from "url";
import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import legacy from "@vitejs/plugin-legacy";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const PORT = 8081;

export default defineConfig({
  plugins: [
    react(),
    legacy({
      // 兼容 Chrome 95 内核（常见政企/教育信创浏览器），同时覆盖 Safari 14 / Edge 95 / Firefox 95
      targets: ["chrome >= 95", "edge >= 95", "firefox >= 95", "safari >= 14", "ios >= 14"],
      modernPolyfills: true,
      // 为旧浏览器额外注入 regenerator-runtime，兼容 async/await 转换后的代码
      additionalLegacyPolyfills: ["regenerator-runtime/runtime"],
      renderLegacyChunks: true,
      polyfills: true,
    }),
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
    // 兼容性：现代包以 es2015 为底线，CSS 目标锁定 chrome95，避免输出旧浏览器不支持的语法
    target: "es2015",
    cssTarget: "chrome95",
    modulePreload: { polyfill: true },
  },
  css: {
    // 让 postcss/autoprefixer 按 browserslist 处理 backdrop-filter / gap 等前缀
    postcss: "./postcss.config.js",
  },
  preview: { port: PORT, host: true },
});
