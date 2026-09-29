import tailwindcss from "@tailwindcss/vite";
import { defineConfig } from "vite";

export default defineConfig({
  plugins: [
    tailwindcss({
      // Vite performs the final CSS optimization/minification with Lightning CSS.
      optimize: false,
    }),
  ],
  build: {
    lib: {
      entry: "src/entry.ts",
      formats: ["es"],
      fileName: "index",
      cssFileName: "style",
    },
    cssMinify: "lightningcss",
    sourcemap: true,
  },
});
