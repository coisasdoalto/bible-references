import { fileURLToPath } from "node:url";
import { defineConfig } from "vite";

// O exemplo usa a biblioteca deste repositório (build em ../../dist), não o pacote publicado.
const dist = fileURLToPath(new URL("../../dist", import.meta.url));

export default defineConfig({
  resolve: {
    alias: [
      { find: "@coisasdoalto/bible-references/style.css", replacement: `${dist}/style.css` },
      { find: /^@coisasdoalto\/bible-references$/, replacement: `${dist}/index.js` },
    ],
  },
  server: { fs: { allow: ["../.."] } },
});
