import { afterEach, describe, expect, it, vi } from "vitest";

import { mountBibleReferences } from "../src/browser/mount";
import type { BibleReference, Passage, PassageProvider } from "../src/core/types";

class FakeChapterProvider implements PassageProvider {
  readonly requests: BibleReference[] = [];
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
    expect(link.href).toBe("https://biblias.app/api/v1/bible/acf/passages/sl/119");
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
    link.focus();
    link.dispatchEvent(new KeyboardEvent("keydown", { key: "ArrowDown" }));
    await vi.advanceTimersByTimeAsync(200);
    expect(document.activeElement).toBe(tooltip);
    expect(tooltip.hidden).toBe(false);
    tooltip.dispatchEvent(new KeyboardEvent("keydown", { key: "Escape" }));
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
});
