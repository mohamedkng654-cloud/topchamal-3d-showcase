import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import tailwindcss from "@tailwindcss/vite";

export default defineConfig({
  root: ".",
  plugins: [react(), tailwindcss()],
  resolve: { tsconfigPaths: true },
  build: {
    outDir: "dist-static",
    emptyOutDir: true,
    rollupOptions: { input: "_static-entry.html" },
  },
  base: "./",
});
