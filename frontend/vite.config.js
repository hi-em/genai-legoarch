import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

export default defineConfig({
  // GitHub Pages serves the site from /<repo>/, not /, so the asset URLs need
  // that prefix baked in at build time:  VITE_BASE=/genai-legoarch/ npm run build
  // Vercel/Netlify serve from the root and need nothing. See docs/deploy.md.
  base: process.env.VITE_BASE || "/",
  plugins: [react()],
  // Ensure a single React instance (prevents "Invalid hook call" in dev when
  // libraries like lucide-react are pre-bundled separately).
  resolve: { dedupe: ["react", "react-dom"] },
  optimizeDeps: { include: ["react", "react-dom", "react/jsx-runtime", "lucide-react"] },
  server: {
    port: 5173,
    proxy: {
      // no rewrite: the backend serves these under /api too, so dev and the
      // deployed one-origin build hit identical paths.
      "/api": { target: "http://127.0.0.1:8000", changeOrigin: true },
    },
  },
});
