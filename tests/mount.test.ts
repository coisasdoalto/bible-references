import { afterEach, describe, expect, it, vi } from "vitest";

import { mountBibleReferences } from "../src/browser/mount";
import type { BibleReference, Passage, PassageProvider } from "../src/core/types";

class FakeChapterProvider implements PassageProvider {
  readonly requests: BibleReference[] = [];
  readonly translation = { abbreviation: "ACF", name: "Almeida Corrigida Fiel" };
  readonly source = {
    id: "biblias.app",
    name: "biblias.app",
    getUrl: (reference: BibleReference) => `https://biblias.app/acf/${reference.chapter}`,
  };
  async getPassage(reference: BibleReference): Promise<Passage> {
    this.requests.push(reference);
    const verses = Array.from({ length: 12 }, (_, index) => ({
      number: index + 1,
      text: `Versículo ${index + 1}.`,
    }));
    return { reference, verses, text: verses.map((verse) => verse.text).join(" ") };
  }
}

function requireFixtureElement<ElementType extends HTMLElement>(selector: string): ElementType {
  const element = document.querySelector<ElementType>(selector);
  if (!element) throw new Error(`Fixture selector ${selector} must match an HTMLElement`);
  return element;
}

afterEach(() => vi.useRealTimers());

/** Simulate keyboard navigation: a preview opens on focus only after a key press. */
function pressTab(): void {
  document.dispatchEvent(new KeyboardEvent("keydown", { key: "Tab" }));
}

describe("mountBibleReferences", () => {
  it("loads all chapter verses and preserves content when reopened from cache", async () => {
    document.body.innerHTML = "<p>Sl 119</p>";
    const provider = new FakeChapterProvider();
    const handle = mountBibleReferences(document.body, { provider });
    const link = requireFixtureElement<HTMLAnchorElement>(".br-reference");
    pressTab();
    link.focus();
    await vi.waitFor(() =>
      expect(document.querySelector(".br-tooltip")?.textContent).toContain("12 Versículo 12."),
    );
    expect(link.href).toBe("https://biblias.app/acf/119");
    expect(provider.requests[0]).toMatchObject({ verseRanges: [] });
    pressTab();
    link.dispatchEvent(new FocusEvent("focus"));
    expect(provider.requests).toHaveLength(1);
    expect(document.querySelector(".br-tooltip")?.textContent).toContain("Salmos 119");
    handle.destroy();
  });

  it("keeps the tooltip open while hovered and closes after leaving", async () => {
    vi.useFakeTimers();
    document.body.innerHTML = "<p>Sl 117</p>";
    const handle = mountBibleReferences(document.body, { provider: new FakeChapterProvider() });
    const link = requireFixtureElement<HTMLAnchorElement>(".br-reference");
    const tooltip = requireFixtureElement<HTMLElement>(".br-tooltip");
    link.dispatchEvent(new MouseEvent("mouseenter"));
    link.dispatchEvent(new MouseEvent("mouseleave"));
    tooltip.dispatchEvent(new MouseEvent("mouseenter"));
    await vi.advanceTimersByTimeAsync(200);
    expect(tooltip.hidden).toBe(false);
    tooltip.dispatchEvent(new MouseEvent("mouseleave"));
    await vi.advanceTimersByTimeAsync(200);
    expect(tooltip.hidden).toBe(true);
    handle.destroy();
  });

  it("allows keyboard focus, scrolling and Escape dismissal", async () => {
    vi.useFakeTimers();
    document.body.innerHTML = "<p>Sl 117</p>";
    const handle = mountBibleReferences(document.body, { provider: new FakeChapterProvider() });
    const link = requireFixtureElement<HTMLAnchorElement>(".br-reference");
    const tooltip = requireFixtureElement<HTMLElement>(".br-tooltip");
    const body = requireFixtureElement<HTMLElement>(".br-tooltip-body");
    pressTab();
    link.focus();
    link.dispatchEvent(new KeyboardEvent("keydown", { key: "ArrowDown" }));
    await vi.advanceTimersByTimeAsync(200);
    expect(document.activeElement).toBe(body);
    expect(tooltip.hidden).toBe(false);
    body.dispatchEvent(new KeyboardEvent("keydown", { key: "Escape", bubbles: true }));
    expect(document.activeElement).toBe(link);
    expect(tooltip.hidden).toBe(true);
    handle.destroy();
    await vi.runAllTimersAsync();
  });
  it("replaces references in text nodes and ignores protected elements", () => {
    document.body.innerHTML = `
      <p id="content">Leia Rm 1:1-8 e João 3:16.</p>
      <code>Rm 8:1</code>
      <a href="/existing">Rm 8:2</a>
    `;

    const handle = mountBibleReferences(document.body, { preview: false });

    const links = document.querySelectorAll<HTMLAnchorElement>(".br-reference");
    expect(links).toHaveLength(2);
    expect(links[0]?.textContent).toBe("Rm 1:1-8");
    expect(document.querySelector("code")?.querySelector(".br-reference")).toBeNull();
    expect(document.querySelector('a[href="/existing"]')?.textContent).toBe("Rm 8:2");

    handle.destroy();

    expect(document.querySelectorAll(".br-reference")).toHaveLength(0);
    expect(document.querySelector("#content")?.textContent).toBe("Leia Rm 1:1-8 e João 3:16.");
  });

  it("requests the whole selection without a preview limit", async () => {
    document.body.innerHTML = "<p>Sl 119:1-20,29,32,34,37-40</p>";
    const getPassage = vi.fn<PassageProvider["getPassage"]>(async (reference) => ({
      reference,
      verses: [
        { number: 1, text: "Bem-aventurados os retos." },
        { number: 29, text: "Afasta de mim o caminho da falsidade." },
      ],
      text: "x",
    }));
    const handle = mountBibleReferences(document.body, { provider: { getPassage } });
    const link = requireFixtureElement<HTMLAnchorElement>(".br-reference");

    pressTab();
    link.dispatchEvent(new FocusEvent("focus"));
    await vi.waitFor(() => expect(getPassage).toHaveBeenCalledOnce());

    expect(getPassage.mock.calls[0]?.[0].verseRanges).toEqual([
      { start: 1, end: 20 },
      { start: 29, end: 29 },
      { start: 32, end: 32 },
      { start: 34, end: 34 },
      { start: 37, end: 40 },
    ]);
    await vi.waitFor(() =>
      expect(document.querySelector(".br-tooltip-title")?.textContent).toBe(
        "Salmos 119:1-20,29,32,34,37-40",
      ),
    );
    expect(document.querySelector(".br-tooltip-body")?.textContent).toContain("29 Afasta");
    pressTab();
    link.dispatchEvent(new FocusEvent("focus"));
    expect(getPassage).toHaveBeenCalledOnce();
    handle.destroy();
  });

  it("renders header, numbered verses and a branded footer link", async () => {
    document.body.innerHTML = "<p>Sl 23</p>";
    const handle = mountBibleReferences(document.body, { provider: new FakeChapterProvider() });
    const link = requireFixtureElement<HTMLAnchorElement>(".br-reference");
    pressTab();
    link.dispatchEvent(new FocusEvent("focus"));
    expect(document.querySelector(".br-tooltip")?.getAttribute("data-br-state")).toBe("loading");
    await vi.waitFor(() =>
      expect(document.querySelector(".br-tooltip")?.getAttribute("data-br-state")).toBe("ready"),
    );

    expect(document.querySelector(".br-tooltip-title")?.textContent).toBe("Salmos 23");
    expect(document.querySelector(".br-tooltip-badge")?.textContent).toBe("ACF");
    expect(document.querySelectorAll(".br-verse-number")).toHaveLength(12);
    const footerLink = requireFixtureElement<HTMLAnchorElement>(".br-tooltip-link");
    expect(footerLink.textContent).toBe("Ler em biblias.app →");
    expect(footerLink.href).toBe("https://biblias.app/acf/23");
    expect(document.querySelector(".br-tooltip-note")?.textContent).toBe("Almeida Corrigida Fiel");
    handle.destroy();
  });

  it("omits the verse number for a single verse", async () => {
    document.body.innerHTML = "<p>Jo 3:16</p>";
    const provider: PassageProvider = {
      getPassage: async (reference) => ({
        reference,
        verses: [{ number: 16, text: "Porque Deus amou o mundo." }],
        text: "Porque Deus amou o mundo.",
      }),
    };
    const handle = mountBibleReferences(document.body, { provider });
    pressTab();
    requireFixtureElement<HTMLAnchorElement>(".br-reference").dispatchEvent(
      new FocusEvent("focus"),
    );
    await vi.waitFor(() =>
      expect(document.querySelector(".br-tooltip-body")?.textContent).toContain("Porque Deus"),
    );
    expect(document.querySelector(".br-verse-number")).toBeNull();
    handle.destroy();
  });

  it("shows an error state and retries the request", async () => {
    document.body.innerHTML = "<p>Sl 91</p>";
    let calls = 0;
    const provider: PassageProvider = {
      getPassage: async (reference) => {
        calls += 1;
        if (calls === 1) throw new Error("offline");
        return { reference, verses: [{ number: 1, text: "Aquele que habita." }], text: "x" };
      },
    };
    const handle = mountBibleReferences(document.body, { provider });
    pressTab();
    requireFixtureElement<HTMLAnchorElement>(".br-reference").dispatchEvent(
      new FocusEvent("focus"),
    );
    await vi.waitFor(() => expect(document.querySelector(".br-tooltip-retry")).not.toBeNull());
    expect(document.querySelector(".br-tooltip")?.getAttribute("data-br-state")).toBe("error");

    requireFixtureElement<HTMLButtonElement>(".br-tooltip-retry").click();
    await vi.waitFor(() =>
      expect(document.querySelector(".br-tooltip-body")?.textContent).toContain("Aquele que"),
    );
    expect(calls).toBe(2);
    handle.destroy();
  });

  it("applies the requested theme", () => {
    document.body.innerHTML = "<p>Sl 1</p>";
    const handle = mountBibleReferences(document.body, {
      provider: new FakeChapterProvider(),
      theme: "dark",
    });
    expect(document.querySelector(".br-tooltip")?.getAttribute("data-br-theme")).toBe("dark");
    handle.destroy();
  });

  it("opens the preview on click or tap without navigating", () => {
    document.body.innerHTML = "<p>Sl 117</p>";
    const handle = mountBibleReferences(document.body, { provider: new FakeChapterProvider() });
    const link = requireFixtureElement<HTMLAnchorElement>(".br-reference");
    const tooltip = requireFixtureElement<HTMLElement>(".br-tooltip");

    const click = new MouseEvent("click", { bubbles: true, cancelable: true });
    link.dispatchEvent(click);

    expect(click.defaultPrevented).toBe(true);
    expect(tooltip.hidden).toBe(false);
    handle.destroy();
  });

  it("closes when the page scrolls but not when the tooltip scrolls", async () => {
    vi.useFakeTimers();
    document.body.innerHTML = "<p>Sl 117</p>";
    const handle = mountBibleReferences(document.body, { provider: new FakeChapterProvider() });
    const link = requireFixtureElement<HTMLAnchorElement>(".br-reference");
    const tooltip = requireFixtureElement<HTMLElement>(".br-tooltip");
    const body = requireFixtureElement<HTMLElement>(".br-tooltip-body");

    link.dispatchEvent(new MouseEvent("mouseenter"));
    window.dispatchEvent(new Event("scroll"));
    expect(tooltip.hidden).toBe(false);

    await vi.advanceTimersByTimeAsync(200);
    body.dispatchEvent(new Event("scroll"));
    expect(tooltip.hidden).toBe(false);

    document.body.dispatchEvent(new Event("scroll"));
    expect(tooltip.hidden).toBe(true);
    expect(link.hasAttribute("aria-describedby")).toBe(false);

    link.dispatchEvent(new MouseEvent("click", { bubbles: true, cancelable: true }));
    expect(tooltip.hidden).toBe(false);
    handle.destroy();
    await vi.runAllTimersAsync();
  });

  it("closes when pressing outside the tooltip and its references", () => {
    document.body.innerHTML = "<p>Sl 117</p><div id='outside'>Fora</div>";
    const handle = mountBibleReferences(document.body, { provider: new FakeChapterProvider() });
    const link = requireFixtureElement<HTMLAnchorElement>(".br-reference");
    const tooltip = requireFixtureElement<HTMLElement>(".br-tooltip");
    const outside = requireFixtureElement<HTMLElement>("#outside");

    link.dispatchEvent(new MouseEvent("click", { bubbles: true, cancelable: true }));
    tooltip.dispatchEvent(new MouseEvent("pointerdown", { bubbles: true }));
    link.dispatchEvent(new MouseEvent("pointerdown", { bubbles: true }));
    expect(tooltip.hidden).toBe(false);

    outside.dispatchEvent(new MouseEvent("pointerdown", { bubbles: true }));
    expect(tooltip.hidden).toBe(true);
    handle.destroy();
  });

  it("opens the footer link in a new tab by default and in the current tab on request", () => {
    const footerLink = (openIn?: "current-tab" | "new-tab") => {
      document.body.innerHTML = "<p>Sl 1</p>";
      const handle = mountBibleReferences(document.body, {
        provider: new FakeChapterProvider(),
        ...(openIn ? { openIn } : {}),
      });
      const element = requireFixtureElement<HTMLAnchorElement>(".br-tooltip-link");
      const attributes = { target: element.getAttribute("target"), rel: element.rel };
      handle.destroy();
      return attributes;
    };

    expect(footerLink()).toEqual({ target: "_blank", rel: "noopener noreferrer" });
    expect(footerLink("current-tab")).toEqual({ target: null, rel: "" });
  });

  it("appends the tooltip to the given container", () => {
    document.body.innerHTML = "<div id='modal'><p>Sl 1</p></div>";
    const container = requireFixtureElement<HTMLElement>("#modal");
    const handle = mountBibleReferences(container, {
      provider: new FakeChapterProvider(),
      container,
    });
    expect(requireFixtureElement<HTMLElement>(".br-tooltip").parentElement).toBe(container);
    handle.destroy();
    expect(document.querySelector(".br-tooltip")).toBeNull();
  });

  it("places the tooltip correctly inside a translated and scaled ancestor", () => {
    document.body.innerHTML = "<div id='modal'><p>Sl 1</p></div>";
    const container = requireFixtureElement<HTMLElement>("#modal");
    // Simulate transform: translate(100px, 50px) scale(0.5) on the container.
    const rectOf = (left: number, top: number, width: number, height: number) =>
      ({
        left,
        top,
        right: left + width,
        bottom: top + height,
        width,
        height,
        x: left,
        y: top,
      }) as DOMRect;
    const rectSpy = vi
      .spyOn(HTMLElement.prototype, "getBoundingClientRect")
      .mockImplementation(function (this: HTMLElement) {
        if (this.classList.contains("br-tooltip")) {
          const left = Number.parseFloat(this.style.left) || 0;
          const top = Number.parseFloat(this.style.top) || 0;
          return rectOf(100 + left * 0.5, 50 + top * 0.5, 200, 50);
        }
        return this.classList.contains("br-reference")
          ? rectOf(300, 200, 40, 20)
          : rectOf(0, 0, 0, 0);
      });
    const widthDescriptor = Object.getOwnPropertyDescriptor(HTMLElement.prototype, "offsetWidth");
    const heightDescriptor = Object.getOwnPropertyDescriptor(HTMLElement.prototype, "offsetHeight");
    const layoutSize = (width: number, height: number) => {
      Object.defineProperty(HTMLElement.prototype, "offsetWidth", {
        configurable: true,
        get(this: HTMLElement) {
          return this.classList.contains("br-tooltip") ? width : 0;
        },
      });
      Object.defineProperty(HTMLElement.prototype, "offsetHeight", {
        configurable: true,
        get(this: HTMLElement) {
          return this.classList.contains("br-tooltip") ? height : 0;
        },
      });
    };
    layoutSize(400, 100);

    const handle = mountBibleReferences(container, {
      provider: new FakeChapterProvider(),
      container,
    });
    requireFixtureElement<HTMLAnchorElement>(".br-reference").dispatchEvent(
      new MouseEvent("click", { bubbles: true, cancelable: true }),
    );
    const tooltip = requireFixtureElement<HTMLElement>(".br-tooltip");

    // Wanted viewport position: left = 320 - 200 / 2 = 220, top = 220 + 12 = 232.
    expect(Number.parseFloat(tooltip.style.left)).toBeCloseTo((220 - 100) / 0.5);
    expect(Number.parseFloat(tooltip.style.top)).toBeCloseTo((232 - 50) / 0.5);
    // The size limits are expressed in the tooltip's own (unscaled) units.
    expect(tooltip.style.getPropertyValue("--br-scale-x")).toBe("0.5");
    expect(tooltip.style.getPropertyValue("--br-scale-y")).toBe("0.5");

    handle.destroy();
    rectSpy.mockRestore();
    if (widthDescriptor)
      Object.defineProperty(HTMLElement.prototype, "offsetWidth", widthDescriptor);
    if (heightDescriptor)
      Object.defineProperty(HTMLElement.prototype, "offsetHeight", heightDescriptor);
  });

  it("does not link references inside its own tooltip when refreshed", async () => {
    document.body.innerHTML = "<div id='root'><p>Sl 23</p></div>";
    const root = requireFixtureElement<HTMLElement>("#root");
    const handle = mountBibleReferences(root, {
      provider: new FakeChapterProvider(),
      container: root,
    });
    requireFixtureElement<HTMLAnchorElement>(".br-reference").dispatchEvent(
      new MouseEvent("click", { bubbles: true, cancelable: true }),
    );
    await vi.waitFor(() =>
      expect(document.querySelector(".br-tooltip")?.getAttribute("data-br-state")).toBe("ready"),
    );

    handle.refresh();

    expect(document.querySelectorAll(".br-tooltip .br-reference")).toHaveLength(0);
    expect(document.querySelector(".br-tooltip-title")?.textContent).toBe("Salmos 23");
    expect(document.querySelectorAll(".br-reference")).toHaveLength(1);
    handle.destroy();
  });

  it("does not open on programmatic focus, only after keyboard navigation", () => {
    document.body.innerHTML = "<button id='before'>Antes</button><p>Sl 1</p>";
    const handle = mountBibleReferences(document.body, { provider: new FakeChapterProvider() });
    const link = requireFixtureElement<HTMLAnchorElement>(".br-reference");
    const tooltip = requireFixtureElement<HTMLElement>(".br-tooltip");

    // A dialog or an autofocus moving focus to the link is not a request for a preview.
    link.focus();
    expect(tooltip.hidden).toBe(true);

    link.blur();
    document.dispatchEvent(new MouseEvent("pointerdown", { bubbles: true }));
    link.focus();
    expect(tooltip.hidden).toBe(true);

    // Enter on a dialog opener, then the dialog focusing its first control: not navigation.
    link.blur();
    document.dispatchEvent(new KeyboardEvent("keydown", { key: "Enter" }));
    link.focus();
    expect(tooltip.hidden).toBe(true);

    // The flag does not outlive the key press.
    link.blur();
    pressTab();
    document.dispatchEvent(new KeyboardEvent("keyup", { key: "Tab" }));
    link.focus();
    expect(tooltip.hidden).toBe(true);

    link.blur();
    pressTab();
    link.focus();
    expect(tooltip.hidden).toBe(false);
    handle.destroy();
  });

  it("shows the tooltip in the top layer when the Popover API is available", () => {
    const showPopover = vi.fn();
    const hidePopover = vi.fn();
    Object.assign(HTMLElement.prototype, { showPopover, hidePopover });
    try {
      document.body.innerHTML = "<p>Sl 1</p>";
      const handle = mountBibleReferences(document.body, { provider: new FakeChapterProvider() });
      const tooltip = requireFixtureElement<HTMLElement>(".br-tooltip");
      expect(tooltip.getAttribute("popover")).toBe("manual");

      requireFixtureElement<HTMLAnchorElement>(".br-reference").dispatchEvent(
        new MouseEvent("click", { bubbles: true, cancelable: true }),
      );
      expect(showPopover).toHaveBeenCalledOnce();
      expect(tooltip.hidden).toBe(false);

      document.body.dispatchEvent(new MouseEvent("pointerdown", { bubbles: true }));
      expect(hidePopover).toHaveBeenCalledOnce();
      expect(tooltip.hidden).toBe(true);
      handle.destroy();
    } finally {
      Reflect.deleteProperty(HTMLElement.prototype, "showPopover");
      Reflect.deleteProperty(HTMLElement.prototype, "hidePopover");
    }
  });

  it("closes the preview when the dialog that contains it closes", () => {
    document.body.innerHTML = "<dialog id='dialog' open><p>Sl 1</p></dialog>";
    const dialog = requireFixtureElement<HTMLElement>("#dialog");
    const handle = mountBibleReferences(dialog, {
      provider: new FakeChapterProvider(),
      container: dialog,
    });
    const tooltip = requireFixtureElement<HTMLElement>(".br-tooltip");
    requireFixtureElement<HTMLAnchorElement>(".br-reference").dispatchEvent(
      new MouseEvent("click", { bubbles: true, cancelable: true }),
    );
    expect(tooltip.hidden).toBe(false);

    dialog.dispatchEvent(new Event("close"));

    expect(tooltip.hidden).toBe(true);
    handle.destroy();
  });

  it("closes a body-mounted preview when the dialog with its reference closes", () => {
    document.body.innerHTML = "<dialog id='dialog' open><p>Sl 1</p></dialog>";
    const dialog = requireFixtureElement<HTMLElement>("#dialog");
    const handle = mountBibleReferences(dialog, { provider: new FakeChapterProvider() });
    const tooltip = requireFixtureElement<HTMLElement>(".br-tooltip");
    expect(tooltip.parentElement).toBe(document.body);
    requireFixtureElement<HTMLAnchorElement>(".br-reference").dispatchEvent(
      new MouseEvent("click", { bubbles: true, cancelable: true }),
    );
    expect(tooltip.hidden).toBe(false);

    dialog.dispatchEvent(new Event("close"));

    expect(tooltip.hidden).toBe(true);
    handle.destroy();
  });
});

/** Let MutationObserver callbacks run. */
const settle = () => new Promise<void>((resolve) => setTimeout(resolve));

function referenceTexts(): string[] {
  return [...document.querySelectorAll(".br-reference")].map((link) => link.textContent ?? "");
}

describe("mountBibleReferences selector", () => {
  it("only searches inside the matching elements", () => {
    document.body.innerHTML = `
      <nav id="outside">Sl 1</nav>
      <article class="bible" id="a"><p>Rm 1:1 <span>e Sl 23</span></p></article>
      <aside>Jo 3:16</aside>
    `;

    const handle = mountBibleReferences(document.body, { preview: false, selector: ".bible" });

    expect(referenceTexts()).toEqual(["Rm 1:1", "Sl 23"]);
    expect(requireFixtureElement("#outside").querySelector(".br-reference")).toBeNull();
    handle.destroy();
  });

  it("does not process nested matches twice", () => {
    document.body.innerHTML = `<div class="x"><div class="x">Rm 1:1</div> e <div class="x">Sl 23</div></div>`;

    const handle = mountBibleReferences(document.body, { preview: false, selector: ".x" });

    expect(referenceTexts()).toEqual(["Rm 1:1", "Sl 23"]);
    handle.destroy();
    expect(document.body.textContent).toBe("Rm 1:1 e Sl 23");
  });

  it("ignores a match that is an ancestor of the root", () => {
    document.body.innerHTML = `<div class="bible"><section id="root">Rm 1:1</section></div>`;

    const handle = mountBibleReferences(requireFixtureElement("#root"), {
      preview: false,
      selector: ".bible",
    });

    expect(referenceTexts()).toEqual([]);
    handle.destroy();
  });

  it("still skips protected elements inside a match", () => {
    document.body.innerHTML = `<div class="bible"><code>Rm 1:1</code> Sl 23</div>`;

    const handle = mountBibleReferences(document.body, { preview: false, selector: ".bible" });

    expect(referenceTexts()).toEqual(["Sl 23"]);
    handle.destroy();
  });

  it("rejects an invalid selector before creating anything", () => {
    document.body.innerHTML = "<p>Rm 1:1</p>";

    expect(() => mountBibleReferences(document.body, { selector: "[" })).toThrow();
    expect(document.querySelector(".br-tooltip")).toBeNull();
    expect(referenceTexts()).toEqual([]);
  });

  it("links matching elements added later and leaves the rest alone", async () => {
    document.body.innerHTML = `<main id="main"></main>`;
    const main = requireFixtureElement("#main");
    const handle = mountBibleReferences(main, {
      preview: false,
      selector: ".bible",
      observe: true,
    });

    main.insertAdjacentHTML("beforeend", `<p>Sl 1</p><div class="bible"><p>Sl 2</p></div>`);
    await settle();
    expect(referenceTexts()).toEqual(["Sl 2"]);

    requireFixtureElement(".bible").append("e Sl 3");
    await settle();
    expect(referenceTexts()).toEqual(["Sl 2", "Sl 3"]);
    handle.destroy();
  });
});

describe("mountBibleReferences observe", () => {
  it("does not react to changes by default", async () => {
    document.body.innerHTML = `<div id="host"></div>`;
    const host = requireFixtureElement("#host");
    const handle = mountBibleReferences(host, { preview: false });

    host.textContent = "Rm 1:1";
    await settle();

    expect(referenceTexts()).toEqual([]);
    handle.destroy();
  });

  it("links content added after mounting", async () => {
    document.body.innerHTML = `<div id="host"></div>`;
    const host = requireFixtureElement("#host");
    const handle = mountBibleReferences(host, { preview: false, observe: true });

    host.innerHTML = "<p>Leia Rm 1:1.</p>";
    await settle();
    host.append("Veja Sl 23");
    await settle();

    expect(referenceTexts()).toEqual(["Rm 1:1", "Sl 23"]);
    handle.destroy();
  });

  it("links a text node whose text changes in place", async () => {
    document.body.innerHTML = `<p id="p">Sem referência</p>`;
    const text = requireFixtureElement("#p").firstChild as Text;
    const handle = mountBibleReferences(document.body, { preview: false, observe: true });

    text.data = "Agora Rm 8:1";
    await settle();

    expect(referenceTexts()).toEqual(["Rm 8:1"]);
    handle.destroy();
  });

  it("does not loop on its own changes", async () => {
    document.body.innerHTML = `<p>Rm 1:1 e Sl 23</p>`;
    const handle = mountBibleReferences(document.body, { preview: false, observe: true });
    const before = document.body.innerHTML;

    await settle();
    await settle();

    expect(document.body.innerHTML).toBe(before);
    expect(referenceTexts()).toEqual(["Rm 1:1", "Sl 23"]);
    handle.destroy();
  });

  it("leaves the tooltip and ignored areas alone", async () => {
    document.body.innerHTML = `<div id="host"></div>`;
    const host = requireFixtureElement("#host");
    const handle = mountBibleReferences(host, {
      provider: new FakeChapterProvider(),
      observe: true,
      container: host,
    });

    host.insertAdjacentHTML(
      "beforeend",
      `<div data-bible-references-ignore>Sl 1</div><code>Sl 2</code><p>Sl 3</p>`,
    );
    await settle();

    expect(referenceTexts()).toEqual(["Sl 3"]);
    handle.destroy();
  });

  it("unbinds links removed with their content and closes their tooltip", async () => {
    document.body.innerHTML = `<div id="host"><p id="p">Sl 117</p></div>`;
    const host = requireFixtureElement("#host");
    const handle = mountBibleReferences(host, {
      provider: new FakeChapterProvider(),
      observe: true,
    });
    const tooltip = requireFixtureElement<HTMLElement>(".br-tooltip");
    requireFixtureElement(".br-reference").dispatchEvent(new MouseEvent("mouseenter"));
    expect(tooltip.hidden).toBe(false);

    requireFixtureElement("#p").remove();
    await settle();

    expect(tooltip.hidden).toBe(true);
    handle.destroy();
  });

  it("links again content that is removed and put back", async () => {
    document.body.innerHTML = `<div id="host"><p id="p">Sl 117</p></div>`;
    const host = requireFixtureElement("#host");
    const handle = mountBibleReferences(host, { preview: false, observe: true });
    const paragraph = requireFixtureElement("#p");

    paragraph.remove();
    await settle();
    expect(paragraph.textContent).toBe("Sl 117");
    expect(paragraph.querySelector(".br-reference")).toBeNull();

    host.append(paragraph);
    await settle();
    expect(referenceTexts()).toEqual(["Sl 117"]);
    handle.destroy();
  });

  it("keeps links when the host moves content", async () => {
    document.body.innerHTML = `<div id="host"><p id="a">Sl 1</p><p id="b">Sl 2</p></div>`;
    const host = requireFixtureElement("#host");
    const handle = mountBibleReferences(host, { preview: false, observe: true });

    host.append(requireFixtureElement("#a"));
    await settle();

    expect(host.textContent).toBe("Sl 2Sl 1");
    expect(referenceTexts()).toEqual(["Sl 2", "Sl 1"]);
    handle.destroy();
  });

  it("stops observing after destroy", async () => {
    document.body.innerHTML = `<div id="host"></div>`;
    const host = requireFixtureElement("#host");
    const handle = mountBibleReferences(host, { preview: false, observe: true });

    handle.destroy();
    host.textContent = "Rm 1:1";
    await settle();
    handle.refresh();

    expect(referenceTexts()).toEqual([]);
  });
});

describe("mountBibleReferences text ownership", () => {
  it("keeps the original text node and restores it on destroy", () => {
    document.body.innerHTML = `<p id="p">Leia Rm 1:1 e Sl 23.</p>`;
    const paragraph = requireFixtureElement("#p");
    const original = paragraph.firstChild;

    const handle = mountBibleReferences(document.body, { preview: false });

    expect(paragraph.firstChild).toBe(original);
    expect((original as Text).data).toBe("Leia ");
    expect(paragraph.textContent).toBe("Leia Rm 1:1 e Sl 23.");

    handle.destroy();

    expect(paragraph.childNodes).toHaveLength(1);
    expect(paragraph.firstChild).toBe(original);
    expect((original as Text).data).toBe("Leia Rm 1:1 e Sl 23.");
  });

  it("relinks when a framework rewrites a text node it owns", async () => {
    document.body.innerHTML = `<p id="p">Leia Rm 1:1 agora</p>`;
    const text = requireFixtureElement("#p").firstChild as Text;
    const handle = mountBibleReferences(document.body, { preview: false, observe: true });

    text.nodeValue = "Leia Sl 23 agora";
    await settle();

    expect(requireFixtureElement("#p").textContent).toBe("Leia Sl 23 agora");
    expect(referenceTexts()).toEqual(["Sl 23"]);
    handle.destroy();
  });

  it("does not leave stale text when the rewrite equals the kept prefix", async () => {
    document.body.innerHTML = `<p id="p">Leia Rm 1:1 agora</p>`;
    const text = requireFixtureElement("#p").firstChild as Text;
    const handle = mountBibleReferences(document.body, { preview: false, observe: true });

    text.nodeValue = "Leia ";
    await settle();

    expect(requireFixtureElement("#p").textContent).toBe("Leia ");
    expect(referenceTexts()).toEqual([]);
    handle.destroy();
  });

  it("cleans up generated nodes when a framework removes the text node", async () => {
    document.body.innerHTML = `<p id="p">Leia Rm 1:1 agora<b>fim</b></p>`;
    const paragraph = requireFixtureElement("#p");
    const text = paragraph.firstChild as Text;
    const handle = mountBibleReferences(document.body, { preview: false, observe: true });

    paragraph.removeChild(text);
    await settle();

    expect(paragraph.innerHTML).toBe("<b>fim</b>");
    expect(referenceTexts()).toEqual([]);
    handle.destroy();
  });
});
