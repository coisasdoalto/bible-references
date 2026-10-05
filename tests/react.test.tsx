import { act, type ReactNode, StrictMode, useRef, useState } from "react";
import { createRoot, type Root } from "react-dom/client";
import { renderToString } from "react-dom/server";
import { afterEach, beforeAll, describe, expect, it, vi } from "vitest";

import type { BibleReference, Passage, PassageProvider } from "../src/core/types";
import { BibleReferencesProvider } from "../src/react";

class FakeProvider implements PassageProvider {
  readonly requests: BibleReference[] = [];
  readonly translation = { abbreviation: "ACF", name: "Almeida Corrigida Fiel" };
  readonly source = {
    id: "biblias.app",
    name: "biblias.app",
    getUrl: (reference: BibleReference) => `https://biblias.app/acf/${reference.chapter}`,
  };

  async getPassage(reference: BibleReference): Promise<Passage> {
    this.requests.push(reference);
    const verses = [{ number: 1, text: "Texto." }];
    return { reference, verses, text: "Texto." };
  }
}

let root: Root | undefined;
let host: HTMLElement | undefined;

beforeAll(() => {
  (globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;
});

afterEach(async () => {
  await act(async () => root?.unmount());
  host?.remove();
  root = undefined;
  host = undefined;
});

async function render(node: ReactNode): Promise<HTMLElement> {
  host = document.createElement("div");
  document.body.append(host);
  root = createRoot(host);
  await act(async () => root?.render(node));
  return host;
}

function requireElement<ElementType extends HTMLElement>(selector: string): ElementType {
  const element = document.querySelector<ElementType>(selector);
  if (!element) throw new Error(`Selector ${selector} must match an element`);
  return element;
}

const provider = new FakeProvider();

function linkedTexts(container: ParentNode = document): string[] {
  return [...container.querySelectorAll(".br-reference")].map((link) => link.textContent ?? "");
}

describe("BibleReferencesProvider on the server", () => {
  it("renders its children in a wrapper, without links or a tooltip", () => {
    const html = renderToString(
      <BibleReferencesProvider className="bible">Leia Rm 1:1-8.</BibleReferencesProvider>,
    );

    expect(html).toBe('<div class="bible" style="display:contents">Leia Rm 1:1-8.</div>');
  });
});

describe("BibleReferencesProvider", () => {
  it("links text at any depth and skips code, links, buttons and ignored elements", async () => {
    const container = await render(
      <BibleReferencesProvider provider={provider}>
        <p>
          Veja Jo 3:16 e <strong>Sl 23</strong>
        </p>
        <pre>Rm 8:1</pre>
        <a href="/x">Rm 8:2</a>
        <button type="button">Rm 8:3</button>
        <p data-bible-references-ignore>Rm 8:4</p>
        {["Gn 1:1", " e Êx 20"]}
      </BibleReferencesProvider>,
    );

    expect(linkedTexts(container)).toEqual(["Jo 3:16", "Sl 23", "Gn 1:1", "Êx 20"]);
    expect(container.querySelector("pre")?.textContent).toBe("Rm 8:1");
  });

  it("links the text of any component below it", async () => {
    function Card({ children }: { children?: ReactNode }) {
      return <section>{children}</section>;
    }
    const container = await render(
      <BibleReferencesProvider provider={provider}>
        <Card>Compare com Jo 1:1-5.</Card>
      </BibleReferencesProvider>,
    );

    expect(container.querySelector("section .br-reference")?.textContent).toBe("Jo 1:1-5");
  });

  it("forwards element props and the tag, keeping display: contents", async () => {
    const container = await render(
      <BibleReferencesProvider
        provider={provider}
        as="article"
        id="devotional"
        className="x"
        style={{ color: "red" }}
      >
        Sl 23
      </BibleReferencesProvider>,
    );

    const element = requireElement("#devotional");
    expect(element.tagName).toBe("ARTICLE");
    expect(element.className).toBe("x");
    expect(element.style.display).toBe("contents");
    expect(element.style.color).toBe("red");
    expect(container.contains(element)).toBe(true);
  });

  it("only searches the elements that match the selector", async () => {
    const container = await render(
      <BibleReferencesProvider provider={provider} selector=".bible">
        <p>Sl 1</p>
        <p className="bible">Sl 2</p>
      </BibleReferencesProvider>,
    );

    expect(linkedTexts(container)).toEqual(["Sl 2"]);
  });
});

describe("BibleReferencesProvider with content that React updates", () => {
  function Example({ children }: { children: (text: string) => ReactNode }) {
    const [text, setText] = useState("Leia Rm 1:1 agora");
    const [show, setShow] = useState(true);
    return (
      <BibleReferencesProvider provider={provider}>
        <button type="button" id="text" onClick={() => setText("Leia Sl 23 agora")} />
        <button type="button" id="hide" onClick={() => setShow(false)} />
        {show ? children(text) : null}
      </BibleReferencesProvider>
    );
  }

  async function click(selector: string): Promise<void> {
    await act(async () => requireElement<HTMLButtonElement>(selector).click());
    // Let the observer finish its microtask.
    await act(async () => {});
  }

  it("relinks a single text child that React replaces", async () => {
    const container = await render(<Example>{(text) => <p>{text}</p>}</Example>);
    expect(linkedTexts(container)).toEqual(["Rm 1:1"]);

    await click("#text");

    expect(container.querySelector("p")?.textContent).toBe("Leia Sl 23 agora");
    expect(linkedTexts(container)).toEqual(["Sl 23"]);
  });

  it("shows the new text when React updates a text next to other children", async () => {
    const container = await render(
      <Example>
        {(text) => (
          <p>
            Leia {text} <b>agora</b>
          </p>
        )}
      </Example>,
    );
    expect(container.querySelector("p")?.textContent).toBe("Leia Leia Rm 1:1 agora agora");

    await click("#text");

    expect(container.querySelector("p")?.textContent).toBe("Leia Leia Sl 23 agora agora");
    expect(linkedTexts(container)).toEqual(["Sl 23"]);
  });

  it("does not break React when a text child is removed from a parent that stays", async () => {
    function Toggle() {
      const [show, setShow] = useState(true);
      return (
        <BibleReferencesProvider provider={provider}>
          <button type="button" id="toggle" onClick={() => setShow(false)} />
          <p id="p">
            {show ? "Leia Rm 1:1 agora" : null} <b>fim</b>
          </p>
        </BibleReferencesProvider>
      );
    }
    const container = await render(<Toggle />);
    expect(linkedTexts(container)).toEqual(["Rm 1:1"]);

    await click("#toggle");

    expect(container.querySelector("#p")?.textContent).toBe(" fim");
    expect(linkedTexts(container)).toEqual([]);
  });

  it("links content that arrives later, such as an API response", async () => {
    function Remote() {
      const [response, setResponse] = useState<string | null>(null);
      return (
        <BibleReferencesProvider provider={provider}>
          <button type="button" id="load" onClick={() => setResponse("Veja Jo 3:16 e Sl 23.")} />
          {response ? <p>{response}</p> : <p>carregando</p>}
        </BibleReferencesProvider>
      );
    }
    const container = await render(<Remote />);
    expect(linkedTexts(container)).toEqual([]);

    await click("#load");

    expect(linkedTexts(container)).toEqual(["Jo 3:16", "Sl 23"]);
  });

  it("restores the original text when it unmounts", async () => {
    const container = await render(
      <BibleReferencesProvider provider={provider}>
        <p>Leia Rm 1:1.</p>
      </BibleReferencesProvider>,
    );
    const paragraph = requireElement("p");
    expect(linkedTexts(container)).toEqual(["Rm 1:1"]);

    await act(async () => root?.unmount());
    root = undefined;

    expect(paragraph.querySelector(".br-reference")).toBeNull();
    expect(document.querySelector(".br-tooltip")).toBeNull();
  });
});

describe("BibleReferencesProvider options that change", () => {
  it("links the new wrapper when the tag changes", async () => {
    function Example() {
      const [tag, setTag] = useState<"div" | "section">("div");
      return (
        <>
          <button type="button" id="swap" onClick={() => setTag("section")} />
          <BibleReferencesProvider provider={provider} as={tag}>
            Leia Sl 23.
          </BibleReferencesProvider>
        </>
      );
    }
    const container = await render(<Example />);
    expect(linkedTexts(container)).toEqual(["Sl 23"]);

    await act(async () => requireElement<HTMLButtonElement>("#swap").click());
    await act(async () => {});

    expect(container.querySelector("section")?.textContent).toBe("Leia Sl 23.");
    expect(linkedTexts(container.querySelector("section") ?? container)).toEqual(["Sl 23"]);
    expect(document.querySelectorAll(".br-tooltip")).toHaveLength(1);
  });

  it("moves the tooltip when the element behind a container ref mounts later", async () => {
    function Example() {
      const modal = useRef<HTMLDivElement>(null);
      const [open, setOpen] = useState(false);
      return (
        <>
          <button type="button" id="open" onClick={() => setOpen(true)} />
          <BibleReferencesProvider provider={provider} container={modal}>
            Leia Sl 23.
          </BibleReferencesProvider>
          {open ? <div ref={modal} id="modal" /> : null}
        </>
      );
    }
    await render(<Example />);
    expect(requireElement(".br-tooltip").parentElement).toBe(document.body);

    await act(async () => requireElement<HTMLButtonElement>("#open").click());
    await act(async () => {});

    expect(document.querySelectorAll(".br-tooltip")).toHaveLength(1);
    expect(requireElement(".br-tooltip").parentElement?.id).toBe("modal");
  });
});

describe("BibleReferencesProvider tooltip", () => {
  it("opens a preview on hover and removes the tooltip on unmount", async () => {
    const fake = new FakeProvider();
    await render(<BibleReferencesProvider provider={fake}>Leia Sl 23.</BibleReferencesProvider>);

    const tooltip = requireElement(".br-tooltip");
    expect(tooltip.hidden).toBe(true);

    await act(async () => {
      requireElement(".br-reference").dispatchEvent(new MouseEvent("mouseenter"));
    });
    await vi.waitFor(() => expect(tooltip.getAttribute("data-br-state")).toBe("ready"));

    expect(tooltip.hidden).toBe(false);
    expect(requireElement(".br-tooltip-title").textContent).toBe("Salmos 23");
    expect(requireElement<HTMLAnchorElement>(".br-tooltip-link").href).toBe(
      "https://biblias.app/acf/23",
    );
    expect(fake.requests).toHaveLength(1);

    await act(async () => root?.unmount());
    root = undefined;
    expect(document.querySelector(".br-tooltip")).toBeNull();
  });

  it("does not navigate when a reference is clicked", async () => {
    await render(
      <BibleReferencesProvider provider={provider}>Leia Sl 23.</BibleReferencesProvider>,
    );

    const click = new MouseEvent("click", { bubbles: true, cancelable: true });
    await act(async () => {
      requireElement(".br-reference").dispatchEvent(click);
    });

    expect(click.defaultPrevented).toBe(true);
    expect(requireElement(".br-tooltip").hidden).toBe(false);
  });

  it("keeps a single tooltip and a single set of links under StrictMode", async () => {
    const container = await render(
      <StrictMode>
        <BibleReferencesProvider provider={provider}>Leia Sl 23.</BibleReferencesProvider>
      </StrictMode>,
    );

    expect(document.querySelectorAll(".br-tooltip")).toHaveLength(1);
    expect(linkedTexts(container)).toEqual(["Sl 23"]);
    expect(container.textContent).toBe("Leia Sl 23.");
  });

  it("appends the tooltip to the given container ref", async () => {
    function Modal() {
      const container = useRef<HTMLDivElement>(null);
      return (
        <div ref={container} id="modal">
          <BibleReferencesProvider provider={provider} container={container}>
            Leia Sl 23.
          </BibleReferencesProvider>
        </div>
      );
    }
    await render(<Modal />);

    expect(requireElement(".br-tooltip").parentElement?.id).toBe("modal");
  });
});
