import { BIBLE_BOOKS, getBibleBookByAlias } from "./books";
import type { BibleReference } from "./types";

function escapeRegExp(value: string): string {
  return value.replace(/[\\^$.*+?()[\]{}|]/g, "\\$&");
}

const aliasPattern = BIBLE_BOOKS.flatMap((book) => book.aliases)
  .sort((left, right) => right.length - left.length)
  .map((alias) => escapeRegExp(alias).replace(/\\ /g, "\\s*"))
  .join("|");

const REFERENCE_PATTERN = new RegExp(
  `(?<![\\p{L}\\p{N}])(${aliasPattern})\\.?\\s+(\\d{1,3})(?:\\s*[:.]\\s*(\\d{1,3})(?:\\s*[-–—]\\s*(\\d{1,3}))?)?(?![\\p{L}\\p{N}]|\\s*[:–—-]|\\s*\\.\\s*\\d)`,
  "giu",
);

type VerseSelection =
  | { readonly verseStart: number; readonly verseEnd: number }
  | { readonly verseStart: null; readonly verseEnd: null };

function parseVerseSelection(startText?: string, endText?: string): VerseSelection | undefined {
  if (startText === undefined) {
    return { verseStart: null, verseEnd: null };
  }
  const verseStart = Number(startText);
  const verseEnd = endText === undefined ? verseStart : Number(endText);
  if (verseStart < 1 || verseEnd < verseStart) {
    return undefined;
  }
  return { verseStart, verseEnd };
}

function parseReferenceMatch(match: RegExpMatchArray): BibleReference | undefined {
  const [raw, bookAlias, chapterText, verseStartText, verseEndText] = match;
  const start = match.index;
  const book = bookAlias === undefined ? undefined : getBibleBookByAlias(bookAlias);
  const chapter = Number(chapterText);
  const selection = parseVerseSelection(verseStartText, verseEndText);
  if (start === undefined || !book || chapter < 1 || !selection) {
    return undefined;
  }
  const location = {
    raw,
    bookId: book.id,
    bookName: book.name,
    chapter,
    start,
    end: start + raw.length,
  };
  return { ...location, ...selection };
}

/** Detect verse ranges and whole chapters. Example: parseBibleReferences("Sl 117"). */
export function parseBibleReferences(text: string): BibleReference[] {
  return Array.from(text.matchAll(REFERENCE_PATTERN), parseReferenceMatch).filter(
    (reference): reference is BibleReference => reference !== undefined,
  );
}

/** Format a reference for display. Example: formatBibleReference(parseBibleReferences("Sl 117")[0]!). */
export function formatBibleReference(reference: BibleReference): string {
  if (reference.verseStart === null) {
    return `${reference.bookName} ${reference.chapter}`;
  }
  const verses =
    reference.verseStart === reference.verseEnd
      ? String(reference.verseStart)
      : `${reference.verseStart}-${reference.verseEnd}`;

  return `${reference.bookName} ${reference.chapter}:${verses}`;
}

/** Identify a passage for caching. Example: bibleReferenceKey(parseBibleReferences("Sl 117")[0]!). */
export function bibleReferenceKey(reference: BibleReference): string {
  if (reference.verseStart === null) {
    return `${reference.bookId}.${reference.chapter}`;
  }
  return `${reference.bookId}.${reference.chapter}.${reference.verseStart}-${reference.verseEnd}`;
}
