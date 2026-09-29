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
  `(?<![\\p{L}\\p{N}])(${aliasPattern})\\.?\\s+(\\d{1,3})\\s*[:.]\\s*(\\d{1,3})(?:\\s*[-–—]\\s*(\\d{1,3}))?(?!\\d)`,
  "giu",
);

export function parseBibleReferences(text: string): BibleReference[] {
  const references: BibleReference[] = [];

  for (const match of text.matchAll(REFERENCE_PATTERN)) {
    const [raw, bookAlias, chapterText, verseStartText, verseEndText] = match;
    const start = match.index;

    if (
      start === undefined ||
      bookAlias === undefined ||
      chapterText === undefined ||
      verseStartText === undefined
    ) {
      continue;
    }

    const book = getBibleBookByAlias(bookAlias);
    if (!book) {
      continue;
    }

    const chapter = Number(chapterText);
    const verseStart = Number(verseStartText);
    const verseEnd = verseEndText === undefined ? verseStart : Number(verseEndText);

    if (
      !Number.isSafeInteger(chapter) ||
      !Number.isSafeInteger(verseStart) ||
      !Number.isSafeInteger(verseEnd) ||
      chapter < 1 ||
      verseStart < 1 ||
      verseEnd < verseStart
    ) {
      continue;
    }

    references.push({
      raw,
      bookId: book.id,
      bookName: book.name,
      chapter,
      verseStart,
      verseEnd,
      start,
      end: start + raw.length,
    });
  }

  return references;
}

export function formatBibleReference(reference: BibleReference): string {
  const verses =
    reference.verseStart === reference.verseEnd
      ? String(reference.verseStart)
      : `${reference.verseStart}-${reference.verseEnd}`;

  return `${reference.bookName} ${reference.chapter}:${verses}`;
}

export function bibleReferenceKey(reference: BibleReference): string {
  return `${reference.bookId}.${reference.chapter}.${reference.verseStart}-${reference.verseEnd}`;
}
