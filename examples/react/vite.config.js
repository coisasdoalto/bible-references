import { fileURLToPath } from "node:url";
import react from "@vitejs/plugin-react";
import { defineConfig } from "vite";

// O exemplo usa a biblioteca deste repositório (build em ../../dist), não o pacote publicado.
const dist = fileURLToPath(new URL("../../dist", import.meta.url));

export default defineConfig({
  plugins: [react()],
  resolve: {
    alias: [
      { find: "@coisasdoalto/bible-references/style.css", replacement: `${dist}/style.css` },
      { find: "@coisasdoalto/bible-references/react", replacement: `${dist}/react.js` },
      { find: /^@coisasdoalto\/bible-references$/, replacement: `${dist}/index.js` },
    ],
    // Uma única cópia do React: a biblioteca fica fora deste diretório e, sem isso, resolveria o
    // `react` do repositório raiz.
    dedupe: ["react", "react-dom"],
  },
  server: { fs: { allow: ["../.."] } },
});
