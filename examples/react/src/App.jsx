import { useRef, useState } from "react";

import { LinkedText } from "./linked-text.jsx";

export function App() {
  const [text, setText] = useState("Experimente editar: Rm 8:28 e Sl 119:1-20,29,32.");
  const [tooltipInside, setTooltipInside] = useState(true);
  const dialogRef = useRef(null);

  return (
    <main>
      <h1>Bible References — React</h1>

      <section>
        <h2>Texto estático</h2>
        <LinkedText text="Leia Romanos 1:1-8, João 3:16 e 1Co 13:4-7. Capítulo inteiro: Sl 117." />
      </section>

      <section>
        <h2>Texto que muda</h2>
        <label>
          Texto
          <input value={text} onChange={(event) => setText(event.target.value)} />
        </label>
        {/* key: um novo texto cria um novo elemento, que a biblioteca monta do zero. */}
        <LinkedText key={text} text={text} />
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
          {/* key: remonta a biblioteca quando a opção muda. */}
          <LinkedText
            key={String(tooltipInside)}
            text="Compare com Jo 3:16 e Sl 23."
            tooltipInside={tooltipInside}
          />
          <button type="button" onClick={() => dialogRef.current?.close()}>
            Fechar
          </button>
        </dialog>
        <p>
          Sem <code>container</code>, o tooltip fica fora do modal: o navegador o esconde atrás do
          modal e bloqueia o ponteiro nele.
        </p>
      </section>
    </main>
  );
}
