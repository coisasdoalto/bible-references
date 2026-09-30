import { mountBibleReferences } from "@coisasdoalto/bible-references";
import "@coisasdoalto/bible-references/style.css";

const root = document.querySelector("main");

if (!root) {
  throw new Error("Example root element was not found");
}

mountBibleReferences(root);
