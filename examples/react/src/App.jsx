import { BibleReferencesProvider } from "@coisasdoalto/bible-references/react";
import "@coisasdoalto/bible-references/style.css";
import { useEffect, useRef, useState } from "react";

const verses = [
  "Leia Romanos 1:1-8, João 3:16 e 1Co 13:4-7. Capítulo inteiro: Sl 117.",
  "O Senhor é o meu pastor (Sl 23). Também em Jo 10:11.",
  "Sl 119:1-20,29,32,34,37-40",
];

/** Simula uma resposta de API que chega depois da primeira renderização. */
function useRemoteText() {
  const [index, setIndex] = useState(0);
  const [text, setText] = useState(null);

  useEffect(() => {
    setText(null);
    const timeout = setTimeout(() => setText(verses[index % verses.length]), 600);
    return () => clearTimeout(timeout);
  }, [index]);

  return { text, next: () => setIndex((current) => current + 1) };
}

export function App() {
  const [text, setText] = useState("Experimente editar: Rm 8:28 e Sl 119:1-20,29,32.");
  const [tooltipInside, setTooltipInside] = useState(true);
  const dialogRef = useRef(null);
  const remote = useRemoteText();

  return (
    <main>
      <h1>Bible References — React</h1>

      <p>
        Cada seção abaixo usa um <code>BibleReferencesProvider</code> só em volta do texto bíblico.
        Este parágrafo está fora de qualquer provider: Jo 3:16 não vira link.
      </p>

      <section>
        <h2>Texto estático</h2>
        <BibleReferencesProvider>
          <p>Leia Romanos 1:1-8, João 3:16 e 1Co 13:4-7. Capítulo inteiro: Sl 117.</p>
        </BibleReferencesProvider>
      </section>

      <section>
        <h2>Texto que muda</h2>
        <label>
          Texto
          <input value={text} onChange={(event) => setText(event.target.value)} />
        </label>
        {/* Sem key: o React atualiza o texto e a biblioteca liga os links de novo. */}
        <BibleReferencesProvider>
          <p>{text}</p>
        </BibleReferencesProvider>
      </section>

      <section>
        <h2>Conteúdo que chega depois</h2>
        <button type="button" onClick={remote.next}>
          Carregar outro texto
        </button>
        <BibleReferencesProvider>
          <p>{remote.text ?? "Carregando…"}</p>
        </BibleReferencesProvider>
      </section>

      <section>
        <h2>Só em parte do conteúdo</h2>
        <BibleReferencesProvider selector=".bible">
          <p>Ignorado: Jo 1:1.</p>
          <p className="bible">Lido: Jo 1:1-5.</p>
        </BibleReferencesProvider>
      </section>

      <section>
        <h2>Dentro de um modal</h2>
        <label>
          <input
            type="checkbox"
            checked={tooltipInside}
            onChange={(event) => setTooltipInside(event.target.checked)}
          />{" "}
          Anexar o tooltip dentro do modal (<code>container</code>)
        </label>
        <button type="button" onClick={() => dialogRef.current?.showModal()}>
          Abrir modal
        </button>
        <dialog ref={dialogRef}>
          <h3>Nota</h3>
          <BibleReferencesProvider container={tooltipInside ? dialogRef : undefined}>
            <p>Compare com Jo 3:16 e Sl 23.</p>
          </BibleReferencesProvider>
          <button type="button" onClick={() => dialogRef.current?.close()}>
            Fechar
          </button>
        </dialog>
        <p>
          O tooltip aparece acima do modal nos dois casos. Sem <code>container</code>, ele fica fora
          do modal, e o navegador bloqueia o ponteiro nele: não dá para clicar em "Ler em
          biblias.app".
        </p>
      </section>
    </main>
  );
}
