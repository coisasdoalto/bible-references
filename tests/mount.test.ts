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

describe("mountBibleReferences", () => {
  it("loads all chapter verses and preserves content when reopened from cache", async () => {
    document.body.innerHTML = "<p>Sl 119</p>";
    const provider = new FakeChapterProvider();
    const handle = mountBibleReferences(document.body, { provider, maxPreviewVerses: 1 });
    const link = requireFixtureElement<HTMLAnchorElement>(".br-reference");
    link.focus();
    await vi.waitFor(() =>
      expect(document.querySelector(".br-tooltip")?.textContent).toContain("12 Versículo 12."),
    );
    expect(link.href).toBe("https://biblias.app/acf/119");
    expect(provider.requests[0]).toMatchObject({ verseStart: null, verseEnd: null });
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

  it("loads at most the configured preview range on focus", async () => {
    document.body.innerHTML = "<p>Romanos 1:1-12</p>";

    const getPassage = vi.fn<PassageProvider["getPassage"]>(async (reference) => ({
      reference,
      verses: [{ number: 1, text: "Paulo, servo de Jesus Cristo." }],
      text: "Paulo, servo de Jesus Cristo.",
    }));

    const handle = mountBibleReferences(document.body, {
      provider: { getPassage },
      maxPreviewVerses: 8,
    });

    const link = document.querySelector<HTMLAnchorElement>(".br-reference");
    expect(link).not.toBeNull();

    link?.dispatchEvent(new FocusEvent("focus"));
    await vi.waitFor(() => expect(getPassage).toHaveBeenCalledOnce());

    expect(getPassage.mock.calls[0]?.[0]).toMatchObject({
      verseStart: 1,
      verseEnd: 8,
    });
    expect(document.querySelector(".br-tooltip")?.textContent).toContain(
      "Paulo, servo de Jesus Cristo.",
    );
    expect(document.querySelector(".br-tooltip")?.textContent).toContain(" …");
    link?.dispatchEvent(new FocusEvent("focus"));
    expect(getPassage).toHaveBeenCalledOnce();
    expect(document.querySelector(".br-tooltip")?.textContent).toContain(" …");

    handle.destroy();
  });

  it("renders header, numbered verses and a branded footer link", async () => {
    document.body.innerHTML = "<p>Sl 23</p>";
    const handle = mountBibleReferences(document.body, { provider: new FakeChapterProvider() });
    const link = requireFixtureElement<HTMLAnchorElement>(".br-reference");
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
    requireFixtureElement<HTMLAnchorElement>(".br-reference").dispatchEvent(
      new FocusEvent("focus"),
    );
    await vi.waitFor(() =>
      expect(document.querySelector(".br-tooltip-body")?.textContent).toContain("Porque Deus"),
    );
    expect(document.querySelector(".br-verse-number")).toBeNull();
    handle.destroy();
  });

  it("reports how many verses were shown when the preview is truncated", async () => {
    document.body.innerHTML = "<p>Jo 1:1-18</p>";
    const provider = new FakeChapterProvider();
    const handle = mountBibleReferences(document.body, { provider, maxPreviewVerses: 3 });
    requireFixtureElement<HTMLAnchorElement>(".br-reference").dispatchEvent(
      new FocusEvent("focus"),
    );
    await vi.waitFor(() =>
      expect(document.querySelector(".br-tooltip-link")?.textContent).toBe(
        "Continuar em biblias.app →",
      ),
    );
    expect(document.querySelector(".br-tooltip-note")?.textContent).toBe("3 de 18 versículos");
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
});
