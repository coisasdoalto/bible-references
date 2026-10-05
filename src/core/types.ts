import type { BibleBookId } from "./books";

export interface VerseRange {
  readonly start: number;
  readonly end: number;
}

export interface BibleReference {
  readonly raw: string;
  readonly bookId: BibleBookId;
  readonly bookName: string;
  readonly chapter: number;
  /** Sorted, non-overlapping verse ranges. Empty when the reference is a whole chapter. */
  readonly verseRanges: readonly VerseRange[];
  readonly start: number;
  readonly end: number;
}

export interface PassageVerse {
  readonly number: number;
  readonly text: string;
}

export interface Passage {
  readonly reference: BibleReference;
  readonly verses: readonly PassageVerse[];
  readonly text: string;
}

export interface PassageTranslation {
  readonly abbreviation: string;
  readonly name: string;
}

export interface PassageSource {
  readonly id: string;
  readonly name: string;
  /** Public page where the passage can be read in full. */
  getUrl(reference: BibleReference): string;
}

export interface PassageProvider {
  readonly translation?: PassageTranslation;
  readonly source?: PassageSource;
  getPassage(reference: BibleReference, signal?: AbortSignal): Promise<Passage>;
}
