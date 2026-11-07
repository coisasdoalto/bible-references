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
    "Sl 117‑118",
    "Sl 119:1,2-",
    "Sl 119:1,2‑",
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

  it.each([
    ["Obadias", "OBA"],
    ["Filemom", "PHM"],
    ["2 João", "2JN"],
    ["3 João", "3JN"],
    ["Judas", "JUD"],
  ])("treats a bare number in %s as a verse", (book, bookId) => {
    const [reference] = parseBibleReferences(`${book} 1`);
    expect(reference).toMatchObject({ bookId, chapter: 1, verseRanges: [{ start: 1, end: 1 }] });
    expect(parseBibleReferences(`${book} 7`)[0]).toMatchObject({
      chapter: 1,
      verseRanges: [{ start: 7, end: 7 }],
    });
    expect(parseBibleReferences(`${book} 1:3`)[0]).toMatchObject({
      chapter: 1,
      verseRanges: [{ start: 3, end: 3 }],
    });
  });

  it("parses bare verse ranges and lists in single-chapter books", () => {
    const text = "Leia 2 João 3-4, 7 e 9.";
    const [reference] = parseBibleReferences(text);
    expect(reference).toMatchObject({
      chapter: 1,
      raw: "2 João 3-4, 7 e 9",
      verseRanges: [
        { start: 3, end: 4 },
        { start: 7, end: 7 },
        { start: 9, end: 9 },
      ],
    });
    expect(text.slice(reference?.start, reference?.end)).toBe(reference?.raw);
  });

  it("parses e as a verse-list separator and normalizes its ranges", () => {
    const [reference] = parseBibleReferences("Ver João 3:16 e 17.");
    expect(reference?.raw).toBe("João 3:16 e 17");
    expect(reference?.verseRanges).toEqual([{ start: 16, end: 17 }]);
    expect(reference && bibleReferenceKey(reference)).toBe("JHN.3.16-17");
    expect(parseBibleReferences("João 3:16, 18 e 20-21")[0]?.verseRanges).toEqual([
      { start: 16, end: 16 },
      { start: 18, end: 18 },
      { start: 20, end: 21 },
    ]);
  });

  it("does not absorb a subsequent numbered reference after e", () => {
    const references = parseBibleReferences("João 3:16 e 1 João 4:8 e 2 João 7");
    expect(references.map((reference) => reference.raw)).toEqual([
      "João 3:16",
      "1 João 4:8",
      "2 João 7",
    ]);
  });

  it("does not interpret multiple chapters as verse lists", () => {
    expect(parseBibleReferences("João 3-4")).toEqual([]);
    expect(parseBibleReferences("João 3 e 4")).toEqual([]);
  });

  it("does not take the next reference or a following word as part of the list", () => {
    const references = parseBibleReferences("Jo 3:16, 1 Jo 4:8 e Rm 8:1, 2 vezes");
    expect(references.map((reference) => reference.raw)).toEqual(["Jo 3:16", "1 Jo 4:8", "Rm 8:1"]);
    expect(references[0]?.verseRanges).toEqual([{ start: 16, end: 16 }]);
  });

  it("supports non-breaking hyphens, en dashes, and em dashes in verse ranges (#25)", () => {
    // U+2011 non-breaking hyphen from biblias.app footnotes (#25)
    const [footnoteRef] = parseBibleReferences("Sl 91:11‑12.");
    expect(footnoteRef).toMatchObject({
      bookId: "PSA",
      chapter: 91,
      verseRanges: [{ start: 11, end: 12 }],
      raw: "Sl 91:11‑12",
    });

    const [enDashRef] = parseBibleReferences("Rm 8:28–30");
    expect(enDashRef?.verseRanges).toEqual([{ start: 28, end: 30 }]);

    const [emDashRef] = parseBibleReferences("Jo 1:1—5");
    expect(emDashRef?.verseRanges).toEqual([{ start: 1, end: 5 }]);

    const [singleChapterRef] = parseBibleReferences("Judas 1‑3");
    expect(singleChapterRef).toMatchObject({
      bookId: "JUD",
      chapter: 1,
      verseRanges: [{ start: 1, end: 3 }],
      raw: "Judas 1‑3",
    });
  });
});
