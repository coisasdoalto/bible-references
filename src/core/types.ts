import type { BibleBookId } from "./books";

export interface BibleReference {
  readonly raw: string;
  readonly bookId: BibleBookId;
  readonly bookName: string;
  readonly chapter: number;
  readonly verseStart: number;
  readonly verseEnd: number;
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

export interface PassageProvider {
  getPassage(reference: BibleReference, signal?: AbortSignal): Promise<Passage>;
}
