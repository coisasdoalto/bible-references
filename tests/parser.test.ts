import { describe, expect, it } from "vitest";

import { bibleReferenceKey, formatBibleReference, parseBibleReferences } from "../src/core/parser";

describe("parseBibleReferences", () => {
  it("recognizes whole chapters with names, abbreviations and offsets", () => {
    const text = "Leia Sl 117, Salmos 119 e João 3.";
    const references = parseBibleReferences(text);
    expect(references).toHaveLength(3);
    expect(references[0]).toMatchObject({
      bookId: "PSA",
      chapter: 117,
      verseStart: null,
      verseEnd: null,
    });
    for (const reference of references) {
      expect(text.slice(reference.start, reference.end)).toBe(reference.raw);
    }
    const chapter = references[0];
    const range = parseBibleReferences("Sl 117:1-2")[0];
    if (!chapter || !range) throw new Error("Expected parsed chapter and verse range");
    expect(formatBibleReference(chapter)).toBe("Salmos 117");
    expect(bibleReferenceKey(chapter)).toBe("PSA.117");
    expect(bibleReferenceKey(range)).toBe("PSA.117.1-2");
  });

  it.each(["Sl 0", "Sl 1170", "Sl 117abc", "Sl 117:", "Sl 117:0", "Sl 117:2-1", "Sl 117-118"])(
    "does not fall back to a chapter for malformed reference %s",
    (text) => {
      expect(parseBibleReferences(text)).toEqual([]);
    },
  );
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
