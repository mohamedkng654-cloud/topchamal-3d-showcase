import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import tailwindcss from "@tailwindcss/vite";

function manualChunks(id: string) {
  const normalized = id.replaceAll("\\", "/");
  const marker = "/node_modules/";
  const markerIndex = normalized.lastIndexOf(marker);
  if (markerIndex === -1) return undefined;

  const path = normalized.slice(markerIndex + marker.length).split("/");
  const packageName = path[0].startsWith("@") ? `${path[0]}/${path[1]}` : path[0];
  if (packageName.startsWith("@supabase/") || packageName === "iceberg-js")
    return "vendor-supabase";
  if (packageName === "gsap" || packageName === "lenis") return "vendor-motion";
  if (
    ["react", "react-dom", "scheduler"].includes(packageName) ||
    packageName.startsWith("@tanstack/")
  ) {
    return "vendor-framework";
  }
  if (
    packageName.startsWith("@radix-ui/") ||
    ["class-variance-authority", "lucide-react", "tailwind-merge"].includes(packageName)
  ) {
    return "vendor-ui";
  }
  return undefined;
}

export default defineConfig({
  root: ".",
  plugins: [react(), tailwindcss()],
  resolve: { tsconfigPaths: true },
  build: {
    outDir: "dist-static",
    emptyOutDir: true,
    rollupOptions: {
      input: "_static-entry.html",
      output: { manualChunks },
    },
  },
  base: "./",
});
