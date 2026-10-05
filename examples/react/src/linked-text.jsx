import { mountBibleReferences } from "@coisasdoalto/bible-references";
import "@coisasdoalto/bible-references/style.css";
import { useEffect, useRef } from "react";

/**
 * Texto com referências bíblicas ligadas pela biblioteca.
 *
 * A biblioteca troca nós de texto por links no DOM. Por isso, o React nunca deve atualizar o
 * texto de um elemento já montado pela biblioteca: quando o texto muda, use `key={text}` para
 * que o React descarte o elemento e crie outro (veja `App.jsx`).
 *
 * Com `tooltipInside`, o tooltip é anexado ao próprio elemento. Isso é necessário dentro de
 * modais (`<dialog>`, Radix, vaul), que bloqueiam ou escondem o que está fora deles.
 */
export function LinkedText({ text, tooltipInside = false }) {
  const ref = useRef(null);

  useEffect(() => {
    const element = ref.current;
    if (!element) return;
    const handle = mountBibleReferences(element, tooltipInside ? { container: element } : {});
    return () => handle.destroy();
  }, [tooltipInside]);

  return <p ref={ref}>{text}</p>;
}
