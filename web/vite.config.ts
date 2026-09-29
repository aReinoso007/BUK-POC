import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

export default defineConfig({
  plugins: [react()],
  server: {
    port: 5173,
    proxy: {
      "/demo": "http://localhost:3000",
      "/assets": "http://localhost:3000",
    },
  },
});
