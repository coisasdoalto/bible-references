import { describe, expect, it, vi } from "vitest";

import type { BibleReference } from "../src/core/types";
import {
  buildBibliasAppPassageUrl,
  buildBibliasAppReadUrl,
  createBibliasAppPassageProvider,
  decodeBibliasAppVerses,
} from "../src/providers/biblias.app";

const reference: BibleReference = {
  raw: "Rm 1:1-8",
  bookId: "ROM",
  bookName: "Romanos",
  chapter: 1,
  verseRanges: [{ start: 1, end: 8 }],
  start: 0,
  end: 8,
};

const apiPayload = {
  translation: "acf",
  book: "rm",
  chapter: 1,
  verses: [1, 2],
  data: [
    { verse: 1, text: "Primeiro verso" },
    { verse: 2, text: "Segundo verso" },
  ],
};

class FakeChapterFetch {
  readonly requests: string[] = [];
  readonly fetch: typeof globalThis.fetch = async (input): Promise<Response> => {
    this.requests.push(String(input));
    return new Response(
      JSON.stringify({
        data: [
          { verse: 1, text: "Louvai ao SENHOR todas as nações." },
          { verse: 2, text: "Louvai ao SENHOR." },
        ],
      }),
    );
  };
}

describe("biblias.app passage provider", () => {
  it("fetches an entire chapter without a verse URL suffix", async () => {
    const chapter: BibleReference = {
      ...reference,
      raw: "Sl 117",
      bookId: "PSA",
      bookName: "Salmos",
      chapter: 117,
      verseRanges: [],
    };
    const fake = new FakeChapterFetch();
    const passage = await createBibliasAppPassageProvider({ fetch: fake.fetch }).getPassage(
      chapter,
    );
    expect(fake.requests).toEqual(["https://biblias.app/api/v1/bible/acf/passages/sl/117"]);
    expect(passage.verses.map((verse) => verse.number)).toEqual([1, 2]);
    expect(decodeBibliasAppVerses({ data: ["Primeiro", "Segundo"] }, chapter)).toEqual([
      { number: 1, text: "Primeiro" },
      { number: 2, text: "Segundo" },
    ]);
  });
  it("builds the range URL used by the MVP API", () => {
    expect(buildBibliasAppPassageUrl(reference)).toBe(
      "https://biblias.app/api/v1/bible/acf/passages/rm/1/1-8",
    );
  });

  it("allows book slug overrides without changing the core model", () => {
    expect(buildBibliasAppPassageUrl(reference, { bookSlugs: { ROM: "rom" } })).toContain(
      "/rom/1/1-8",
    );
  });

  it("decodes the current biblias.app API response shape", () => {
    expect(
      decodeBibliasAppVerses(apiPayload, { ...reference, verseRanges: [{ start: 1, end: 2 }] }),
    ).toEqual([
      { number: 1, text: "Primeiro verso" },
      { number: 2, text: "Segundo verso" },
    ]);
  });

  it("fetches and normalizes passages", async () => {
    const fetcher = vi.fn(
      async () =>
        new Response(JSON.stringify(apiPayload), {
          status: 200,
          headers: { "content-type": "application/json" },
        }),
    );

    const provider = createBibliasAppPassageProvider({
      fetch: fetcher as typeof fetch,
    });
    const passage = await provider.getPassage({
      ...reference,
      verseRanges: [{ start: 1, end: 2 }],
    });

    expect(fetcher).toHaveBeenCalledOnce();
    expect(passage.text).toBe("Primeiro verso Segundo verso");
  });

  it("exposes the translation and the page where a passage is read", () => {
    const provider = createBibliasAppPassageProvider({ fetch: new FakeChapterFetch().fetch });
    expect(provider.translation).toEqual({ abbreviation: "ACF", name: "Almeida Corrigida Fiel" });
    expect(provider.source).toMatchObject({ id: "biblias.app", name: "biblias.app" });
    expect(provider.source?.getUrl(reference)).toBe("https://biblias.app/acf/rm/1/1-8");
    expect(buildBibliasAppReadUrl({ ...reference, verseRanges: [] })).toBe(
      "https://biblias.app/acf/rm/1",
    );
  });

  it("requests several ranges and keeps only the selected verses", async () => {
    const selected: BibleReference = {
      ...reference,
      raw: "Rm 1:1-2,4",
      verseRanges: [
        { start: 1, end: 2 },
        { start: 4, end: 4 },
      ],
    };
    expect(buildBibliasAppPassageUrl(selected)).toBe(
      "https://biblias.app/api/v1/bible/acf/passages/rm/1/1-2,4",
    );
    expect(buildBibliasAppReadUrl(selected)).toBe("https://biblias.app/acf/rm/1/1-2,4");

    const payload = {
      data: [
        { verse: 1, text: "Um" },
        { verse: 2, text: "Dois" },
        { verse: 3, text: "Três" },
        { verse: 4, text: "Quatro" },
      ],
    };
    expect(decodeBibliasAppVerses(payload, selected).map((verse) => verse.number)).toEqual([
      1, 2, 4,
    ]);
    expect(decodeBibliasAppVerses({ data: ["Um", "Dois", "Quatro"] }, selected)).toEqual([
      { number: 1, text: "Um" },
      { number: 2, text: "Dois" },
      { number: 4, text: "Quatro" },
    ]);
  });
});
