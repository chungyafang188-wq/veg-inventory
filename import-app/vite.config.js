import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import tailwindcss from "@tailwindcss/vite";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));

/** 建置成可掛在主站 #import-root 的單檔（含 React + Tailwind） */
export default defineConfig({
  plugins: [react(), tailwindcss()],
  define: {
    "process.env.NODE_ENV": JSON.stringify("production"),
  },
  build: {
    outDir: path.resolve(__dirname, "../import-dist"),
    emptyOutDir: true,
    cssCodeSplit: false,
    lib: {
      entry: path.resolve(__dirname, "src/mount.jsx"),
      name: "VegImportApp",
      formats: ["es"],
      fileName: () => "import-app.js",
    },
    rollupOptions: {
      output: {
        assetFileNames: "import-app.[ext]",
      },
    },
  },
});
