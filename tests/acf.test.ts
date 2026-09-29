import { describe, expect, it, vi } from "vitest";

import type { BibleReference } from "../src/core/types";
import {
  buildAcfPassageUrl,
  createAcfPassageProvider,
  decodeAcfVerses,
} from "../src/providers/acf";

const reference: BibleReference = {
  raw: "Rm 1:1-8",
  bookId: "ROM",
  bookName: "Romanos",
  chapter: 1,
  verseStart: 1,
  verseEnd: 8,
  start: 0,
  end: 8,
};

describe("ACF passage provider", () => {
  it("builds the range URL used by the MVP API", () => {
    expect(buildAcfPassageUrl(reference)).toBe(
      "https://8b6197d1-ler-traducaoliteral-com-br.pablodinella.workers.dev/api/v1/bible/acf/passages/rm/1/1-8",
    );
  });

  it("allows book slug overrides without changing the core model", () => {
    expect(buildAcfPassageUrl(reference, { bookSlugs: { ROM: "rom" } })).toContain("/rom/1/1-8");
  });

  it("decodes common verse payload shapes", () => {
    expect(
      decodeAcfVerses(
        {
          data: {
            verses: [
              { verse: 1, text: "Primeiro verso" },
              { verse: 2, text: "Segundo verso" },
            ],
          },
        },
        { ...reference, verseEnd: 2 },
      ),
    ).toEqual([
      { number: 1, text: "Primeiro verso" },
      { number: 2, text: "Segundo verso" },
    ]);
  });

  it("fetches and normalizes passages", async () => {
    const fetcher = vi.fn(
      async () =>
        new Response(
          JSON.stringify({
            verses: {
              "1": "Primeiro verso",
              "2": "Segundo verso",
            },
          }),
          { status: 200, headers: { "content-type": "application/json" } },
        ),
    );

    const provider = createAcfPassageProvider({
      fetch: fetcher as typeof fetch,
    });
    const passage = await provider.getPassage({ ...reference, verseEnd: 2 });

    expect(fetcher).toHaveBeenCalledOnce();
    expect(passage.text).toBe("Primeiro verso Segundo verso");
  });
});
