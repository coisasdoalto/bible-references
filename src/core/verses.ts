import type { VerseRange } from "./types";

/** Sort ranges and merge overlapping or adjacent ones. Example: normalizeVerseRanges([{ start: 3, end: 4 }, { start: 1, end: 3 }]). */
export function normalizeVerseRanges(ranges: readonly VerseRange[]): VerseRange[] {
  const merged: VerseRange[] = [];

  for (const range of [...ranges].sort((left, right) => left.start - right.start)) {
    const previous = merged[merged.length - 1];
    if (previous && range.start <= previous.end + 1) {
      merged[merged.length - 1] = { start: previous.start, end: Math.max(previous.end, range.end) };
    } else {
      merged.push({ start: range.start, end: range.end });
    }
  }

  return merged;
}

/** Format ranges as a verse selection. Example: formatVerseRanges([{ start: 1, end: 20 }, { start: 29, end: 29 }]) is "1-20,29". */
export function formatVerseRanges(ranges: readonly VerseRange[]): string {
  return ranges
    .map(({ start, end }) => (start === end ? String(start) : `${start}-${end}`))
    .join(",");
}

/** List every verse number in the ranges. Example: expandVerseRanges([{ start: 1, end: 2 }]) is [1, 2]. */
export function expandVerseRanges(ranges: readonly VerseRange[]): number[] {
  return ranges.flatMap(({ start, end }) =>
    Array.from({ length: end - start + 1 }, (_, offset) => start + offset),
  );
}

/** Check whether a verse number belongs to any range. An empty list selects the whole chapter. */
export function isVerseSelected(ranges: readonly VerseRange[], verse: number): boolean {
  return ranges.length === 0 || ranges.some(({ start, end }) => verse >= start && verse <= end);
}
