import { BIBLE_BOOKS, getBibleBookByAlias } from "./books";
import type { BibleReference, VerseRange } from "./types";
import { formatVerseRanges, normalizeVerseRanges } from "./verses";

function escapeRegExp(value: string): string {
  return value.replace(/[\\^$.*+?()[\]{}|]/g, "\\$&");
}

const aliasPattern = BIBLE_BOOKS.flatMap((book) => book.aliases)
  .sort((left, right) => right.length - left.length)
  .map((alias) => escapeRegExp(alias).replace(/\\ /g, "\\s*"))
  .join("|");

const VERSE_ITEM = "\\d{1,3}(?:\\s*[-–—‑]\\s*\\d{1,3})?";
// A comma followed by a space only continues the list when the number does not start another
// reference or a word, so "Jo 3:16, 1 Jo 4:8" and "Jo 3:16, 2 vezes" stop at the first verse.
// A comma directly followed by a digit always continues the list, so a malformed continuation
// ("Sl 119:1,2-") rejects the reference instead of backtracking to "Sl 119:1".
const VERSE_FOLLOWING_BOUNDARY = `(?=\\s+e\\s+\\d|(?!\\s*[\\p{L}\\p{N}]|\\s*[:.]\\s*\\d))`;
const VERSE_LIST_SEPARATOR = `,(?=\\d)|(?:,\\s+|\\s+e\\s+)(?=${VERSE_ITEM}${VERSE_FOLLOWING_BOUNDARY})`;
const VERSE_CONTINUATION = `(?:(?:${VERSE_LIST_SEPARATOR})${VERSE_ITEM})*`;
const VERSE_SELECTION = `${VERSE_ITEM}${VERSE_CONTINUATION}`;
const BARE_VERSE_SUFFIX = `(?:\\s*[-–—‑]\\s*\\d{1,3})?${VERSE_CONTINUATION}`;
const SINGLE_CHAPTER_BOOKS = new Set(["OBA", "PHM", "2JN", "3JN", "JUD"]);

const REFERENCE_PATTERN = new RegExp(
  `(?<![\\p{L}\\p{N}])(${aliasPattern})\\.?\\s+(\\d{1,3})(?:\\s*[:.]\\s*(${VERSE_SELECTION})|(${BARE_VERSE_SUFFIX}))?(?![\\p{L}\\p{N}]|\\s*[:–—‑-]|\\s*\\.\\s*\\d|,\\d)`,
  "giu",
);

/** Parse "1-20,29" into normalized ranges. Returns undefined for invalid ranges. */
function parseVerseRanges(selection: string | undefined): VerseRange[] | undefined {
  if (selection === undefined) {
    return [];
  }

  const ranges: VerseRange[] = [];
  for (const item of selection.split(/,|\s+e\s+/i)) {
    const [startText, endText] = item.split(/[-–—‑]/);
    const start = Number(startText);
    const end = endText === undefined ? start : Number(endText);
    if (start < 1 || end < start) {
      return undefined;
    }
    ranges.push({ start, end });
  }

  return normalizeVerseRanges(ranges);
}

function parseReferenceMatch(match: RegExpMatchArray): BibleReference | undefined {
  const [raw, bookAlias, chapterText, verseSelection, bareSuffix] = match;
  const start = match.index;
  const book = bookAlias === undefined ? undefined : getBibleBookByAlias(bookAlias);
  if (start === undefined || !book || chapterText === undefined) return undefined;
  const isBareVerse = verseSelection === undefined && SINGLE_CHAPTER_BOOKS.has(book.id);
  if (!isBareVerse && bareSuffix) return undefined;
  const chapter = isBareVerse ? 1 : Number(chapterText);
  const verseRanges = parseVerseRanges(
    isBareVerse ? chapterText + (bareSuffix ?? "") : verseSelection,
  );
  if (chapter < 1 || !verseRanges) {
    return undefined;
  }
  const location = {
    raw,
    bookId: book.id,
    bookName: book.name,
    chapter,
    verseRanges,
    start,
    end: start + raw.length,
  };
  return location;
}

/** Detect verse selections and whole chapters. Example: parseBibleReferences("Sl 117"). */
export function parseBibleReferences(text: string): BibleReference[] {
  return Array.from(text.matchAll(REFERENCE_PATTERN), parseReferenceMatch).filter(
    (reference): reference is BibleReference => reference !== undefined,
  );
}

/** Format a reference for display. Example: formatBibleReference(parseBibleReferences("Sl 117")[0]!). */
export function formatBibleReference(reference: BibleReference): string {
  const label = `${reference.bookName} ${reference.chapter}`;
  return reference.verseRanges.length === 0
    ? label
    : `${label}:${formatVerseRanges(reference.verseRanges)}`;
}

/** Identify a passage for caching. Example: bibleReferenceKey(parseBibleReferences("Sl 117")[0]!). */
export function bibleReferenceKey(reference: BibleReference): string {
  const key = `${reference.bookId}.${reference.chapter}`;
  return reference.verseRanges.length === 0
    ? key
    : `${key}.${formatVerseRanges(reference.verseRanges)}`;
}
