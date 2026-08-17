import tailwindcss from "@tailwindcss/vite";
import react from "@vitejs/plugin-react";
import path from "path";
import { defineConfig } from "vite";

export default defineConfig({
  plugins: [react(), tailwindcss()],
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "./src"),
    },
  },
  server: {
    host: "0.0.0.0",
    port: 5173,
    allowedHosts: ["aurexviper.pro", "www.aurexviper.pro"],
    hmr: {
      host: "localhost",
    },
    proxy: {
      "/api": process.env.VITE_API_HOST || "http://localhost:8000",
      "/uploads": process.env.VITE_API_HOST || "http://localhost:8000",
    },
  },
});
