import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

export default defineConfig({
  plugins: [react()],
  // Ensure a single React instance (prevents "Invalid hook call" in dev when
  // libraries like lucide-react are pre-bundled separately).
  resolve: { dedupe: ["react", "react-dom"] },
  optimizeDeps: { include: ["react", "react-dom", "react/jsx-runtime", "lucide-react"] },
  server: {
    port: 5173,
    proxy: {
      "/api": { target: "http://127.0.0.1:8000", changeOrigin: true, rewrite: (p) => p.replace(/^\/api/, "") },
    },
  },
});
