import { act, type ReactNode, StrictMode, useRef, useState } from "react";
import { createRoot, type Root } from "react-dom/client";
import { renderToString } from "react-dom/server";
import { afterEach, beforeAll, describe, expect, it, vi } from "vitest";

import type { BibleReference, Passage, PassageProvider } from "../src/core/types";
import { BibleReferenceLink, BibleReferences, BibleReferencesProvider } from "../src/react";

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

describe("BibleReferences on the server", () => {
  it("renders reference links without a provider and without touching the DOM", () => {
    const html = renderToString(
      <BibleReferences>
        Leia Rm 1:1-8 e <code>Sl 23</code>.
      </BibleReferences>,
    );

    expect(html).toContain('href="https://biblias.app/acf/rm/1/1-8"');
    expect(html).toContain('data-br-reference="ROM.1.1-8"');
    expect(html).toContain(">Rm 1:1-8</a>");
    expect(html).toContain("<code>Sl 23</code>");
  });
});

describe("BibleReferences", () => {
  it("links text at any depth and skips code, links, buttons and ignored elements", async () => {
    const container = await render(
      <BibleReferences>
        <p>
          Veja Jo 3:16 e <strong>Sl 23</strong>
        </p>
        <pre>Rm 8:1</pre>
        <a href="/x">Rm 8:2</a>
        <button type="button">Rm 8:3</button>
        <p data-bible-references-ignore>Rm 8:4</p>
        {["Gn 1:1", " e Êx 20"]}
      </BibleReferences>,
    );

    const linked = [...container.querySelectorAll(".br-reference")].map((link) => link.textContent);
    expect(linked).toEqual(["Jo 3:16", "Sl 23", "Gn 1:1", "Êx 20"]);
    expect(container.querySelector("pre")?.textContent).toBe("Rm 8:1");
  });

  it("links the text children of a custom component", async () => {
    function Card({ children }: { children?: ReactNode }) {
      return <section>{children}</section>;
    }
    const container = await render(
      <BibleReferences>
        <Card>Compare com Jo 1:1-5.</Card>
      </BibleReferences>,
    );

    expect(container.querySelector("section .br-reference")?.textContent).toBe("Jo 1:1-5");
  });

  it("keeps the DOM correct when the text changes, without remounting", async () => {
    function Example() {
      const [text, setText] = useState("Leia Rm 1:1.");
      return (
        <>
          <button type="button" onClick={() => setText("Agora Sl 23 e Jo 3:16.")}>
            mudar
          </button>
          <p>
            <BibleReferences>{text}</BibleReferences>
          </p>
        </>
      );
    }
    const container = await render(<Example />);
    expect(container.querySelector("p")?.textContent).toBe("Leia Rm 1:1.");

    await act(async () => requireElement<HTMLButtonElement>("button").click());

    expect(container.querySelector("p")?.textContent).toBe("Agora Sl 23 e Jo 3:16.");
    expect(
      [...container.querySelectorAll(".br-reference")].map((link) => link.textContent),
    ).toEqual(["Sl 23", "Jo 3:16"]);
  });
});

describe("BibleReferencesProvider", () => {
  it("opens a preview on hover and removes the tooltip on unmount", async () => {
    const provider = new FakeProvider();
    await render(
      <BibleReferencesProvider provider={provider}>
        <BibleReferences>Leia Sl 23.</BibleReferences>
      </BibleReferencesProvider>,
    );

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
    expect(provider.requests).toHaveLength(1);

    await act(async () => root?.unmount());
    expect(document.querySelector(".br-tooltip")).toBeNull();
  });

  it("does not navigate when a reference is clicked", async () => {
    await render(
      <BibleReferencesProvider provider={new FakeProvider()}>
        <BibleReferences>Leia Sl 23.</BibleReferences>
      </BibleReferencesProvider>,
    );

    const click = new MouseEvent("click", { bubbles: true, cancelable: true });
    await act(async () => {
      requireElement(".br-reference").dispatchEvent(click);
    });

    expect(click.defaultPrevented).toBe(true);
    expect(requireElement(".br-tooltip").hidden).toBe(false);
  });

  it("keeps a single tooltip under StrictMode", async () => {
    await render(
      <StrictMode>
        <BibleReferencesProvider provider={new FakeProvider()}>
          <BibleReferences>Leia Sl 23.</BibleReferences>
        </BibleReferencesProvider>
      </StrictMode>,
    );

    expect(document.querySelectorAll(".br-tooltip")).toHaveLength(1);
  });

  it("appends the tooltip to the given container ref", async () => {
    function Example() {
      const container = useRef<HTMLDivElement>(null);
      return (
        <div ref={container} id="modal">
          <BibleReferencesProvider provider={new FakeProvider()} container={container}>
            <BibleReferences>Leia Sl 23.</BibleReferences>
          </BibleReferencesProvider>
        </div>
      );
    }
    await render(<Example />);

    expect(requireElement(".br-tooltip").parentElement?.id).toBe("modal");
  });

  it("renders a standalone reference link without a provider", async () => {
    const reference = {
      raw: "Jo 3:16",
      bookId: "JHN",
      bookName: "João",
      chapter: 3,
      verseRanges: [{ start: 16, end: 16 }],
      start: 0,
      end: 7,
    } as const satisfies BibleReference;
    const container = await render(<BibleReferenceLink reference={reference} />);

    const link = container.querySelector<HTMLAnchorElement>("a");
    expect(link?.textContent).toBe("Jo 3:16");
    expect(link?.href).toBe("https://biblias.app/acf/jo/3/16");
  });
});
