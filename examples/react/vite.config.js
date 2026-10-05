import { fileURLToPath } from "node:url";
import react from "@vitejs/plugin-react";
import { defineConfig } from "vite";

// Com BIBLE_REFERENCES_LOCAL=1, o exemplo usa o build local da biblioteca (../../dist)
// em vez do pacote publicado no GitHub Packages.
const useLocalLibrary = process.env.BIBLE_REFERENCES_LOCAL === "1";
const dist = fileURLToPath(new URL("../../dist", import.meta.url));

export default defineConfig({
  plugins: [react()],
  resolve: {
    alias: useLocalLibrary
      ? [
          { find: "@coisasdoalto/bible-references/style.css", replacement: `${dist}/style.css` },
          { find: "@coisasdoalto/bible-references", replacement: `${dist}/index.js` },
        ]
      : [],
  },
});
