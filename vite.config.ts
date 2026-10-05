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
      entry: { index: "src/entry.ts", react: "src/react/index.ts" },
      formats: ["es"],
      fileName: (_format, entryName) => `${entryName}.js`,
      cssFileName: "style",
    },
    rollupOptions: {
      // React is an optional peer dependency of the "react" entry.
      external: ["react", "react/jsx-runtime"],
    },
    cssMinify: "lightningcss",
    sourcemap: true,
  },
});
