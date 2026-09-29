import { describe, expect, it } from "vitest";

import { formatBibleReference, parseBibleReferences } from "../src/core/parser";

describe("parseBibleReferences", () => {
  it("parses Portuguese names, abbreviations, separators and ranges", () => {
    const text = "Leia Romanos 1:1-8, Rm 8.28 e 1Co 13:4-7.";
    const references = parseBibleReferences(text);

    expect(references).toHaveLength(3);
    expect(references[0]).toMatchObject({
      bookId: "ROM",
      chapter: 1,
      verseStart: 1,
      verseEnd: 8,
      raw: "Romanos 1:1-8",
    });
    expect(references[1]).toMatchObject({
      bookId: "ROM",
      chapter: 8,
      verseStart: 28,
      verseEnd: 28,
      raw: "Rm 8.28",
    });
    expect(references[2]).toMatchObject({
      bookId: "1CO",
      chapter: 13,
      verseStart: 4,
      verseEnd: 7,
      raw: "1Co 13:4-7",
    });
  });

  it("accepts an optional period after an abbreviation", () => {
    expect(parseBibleReferences("Jo. 3:16")[0]).toMatchObject({
      bookId: "JHN",
      chapter: 3,
      verseStart: 16,
      verseEnd: 16,
    });
  });

  it("keeps offsets relative to the original text", () => {
    const text = "Antes João 3:16 depois";
    const [reference] = parseBibleReferences(text);

    expect(reference).toBeDefined();
    if (!reference) {
      return;
    }

    expect(text.slice(reference.start, reference.end)).toBe("João 3:16");
    expect(formatBibleReference(reference)).toBe("João 3:16");
  });

  it("rejects reversed ranges", () => {
    expect(parseBibleReferences("Romanos 1:8-1")).toEqual([]);
  });
});
