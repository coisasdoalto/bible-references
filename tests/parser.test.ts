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
      verseRanges: [],
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

  it.each([
    "Sl 0",
    "Sl 1170",
    "Sl 117abc",
    "Sl 117:",
    "Sl 117:0",
    "Sl 117:2-1",
    "Sl 117-118",
    "Sl 119:1,2-",
    "Sl 119:1,2:3",
  ])("does not fall back to a chapter for malformed reference %s", (text) => {
    expect(parseBibleReferences(text)).toEqual([]);
  });
  it("parses Portuguese names, abbreviations, separators and ranges", () => {
    const text = "Leia Romanos 1:1-8, Rm 8.28 e 1Co 13:4-7.";
    const references = parseBibleReferences(text);

    expect(references).toHaveLength(3);
    expect(references[0]).toMatchObject({
      bookId: "ROM",
      chapter: 1,
      verseRanges: [{ start: 1, end: 8 }],
      raw: "Romanos 1:1-8",
    });
    expect(references[1]).toMatchObject({
      bookId: "ROM",
      chapter: 8,
      verseRanges: [{ start: 28, end: 28 }],
      raw: "Rm 8.28",
    });
    expect(references[2]).toMatchObject({
      bookId: "1CO",
      chapter: 13,
      verseRanges: [{ start: 4, end: 7 }],
      raw: "1Co 13:4-7",
    });
  });

  it("accepts an optional period after an abbreviation", () => {
    expect(parseBibleReferences("Jo. 3:16")[0]).toMatchObject({
      bookId: "JHN",
      chapter: 3,
      verseRanges: [{ start: 16, end: 16 }],
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
    expect(parseBibleReferences("Sl 119:1-20,9-2")).toEqual([]);
  });

  it("parses lists of verses and ranges", () => {
    const text = "Leia Sl 119:1-20,29,32,34,37-40 hoje.";
    const [reference] = parseBibleReferences(text);
    if (!reference) throw new Error("Expected a parsed reference");

    expect(reference.verseRanges).toEqual([
      { start: 1, end: 20 },
      { start: 29, end: 29 },
      { start: 32, end: 32 },
      { start: 34, end: 34 },
      { start: 37, end: 40 },
    ]);
    expect(reference.raw).toBe("Sl 119:1-20,29,32,34,37-40");
    expect(text.slice(reference.start, reference.end)).toBe(reference.raw);
    expect(formatBibleReference(reference)).toBe("Salmos 119:1-20,29,32,34,37-40");
    expect(bibleReferenceKey(reference)).toBe("PSA.119.1-20,29,32,34,37-40");
  });

  it("accepts a space after the comma between verses", () => {
    const [reference] = parseBibleReferences("Sl 119:1-20, 29, 32.");
    expect(reference?.verseRanges).toEqual([
      { start: 1, end: 20 },
      { start: 29, end: 29 },
      { start: 32, end: 32 },
    ]);
  });

  it("sorts and merges overlapping and adjacent ranges", () => {
    const [reference] = parseBibleReferences("Sl 119:37-40,1-20,10-25,26,29");
    expect(reference?.verseRanges).toEqual([
      { start: 1, end: 26 },
      { start: 29, end: 29 },
      { start: 37, end: 40 },
    ]);
  });

  it("does not take the next reference or a following word as part of the list", () => {
    const references = parseBibleReferences("Jo 3:16, 1 Jo 4:8 e Rm 8:1, 2 vezes");
    expect(references.map((reference) => reference.raw)).toEqual(["Jo 3:16", "1 Jo 4:8", "Rm 8:1"]);
    expect(references[0]?.verseRanges).toEqual([{ start: 16, end: 16 }]);
  });
});
