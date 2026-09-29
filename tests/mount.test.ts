import { describe, expect, it, vi } from "vitest";

import { mountBibleReferences } from "../src/browser/mount";
import type { PassageProvider } from "../src/core/types";

describe("mountBibleReferences", () => {
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

    handle.destroy();
  });
});
