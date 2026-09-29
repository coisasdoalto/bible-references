import { type BibleBookId, getBibleBookById } from "../core/books";
import type { BibleReference, PassageProvider, PassageVerse } from "../core/types";

export const DEFAULT_ACF_API_BASE_URL =
  "https://8b6197d1-ler-traducaoliteral-com-br.pablodinella.workers.dev/api/v1/bible/acf/passages";

export interface AcfPassageProviderOptions {
  readonly baseUrl?: string;
  readonly bookSlugs?: Partial<Record<BibleBookId, string>>;
  readonly fetch?: typeof globalThis.fetch;
}

export function buildAcfPassageUrl(
  reference: BibleReference,
  options: Pick<AcfPassageProviderOptions, "baseUrl" | "bookSlugs"> = {},
): string {
  const book = getBibleBookById(reference.bookId);
  const slug = options.bookSlugs?.[reference.bookId] ?? book.apiSlug;
  const verses =
    reference.verseStart === reference.verseEnd
      ? String(reference.verseStart)
      : `${reference.verseStart}-${reference.verseEnd}`;
  const baseUrl = (options.baseUrl ?? DEFAULT_ACF_API_BASE_URL).replace(/\/$/, "");

  return `${baseUrl}/${encodeURIComponent(slug)}/${reference.chapter}/${verses}`;
}

export function createAcfPassageProvider(options: AcfPassageProviderOptions = {}): PassageProvider {
  const fetcher = options.fetch ?? globalThis.fetch;

  if (typeof fetcher !== "function") {
    throw new Error("No fetch implementation is available for the ACF passage provider");
  }

  return {
    async getPassage(reference, signal) {
      const init: RequestInit = signal ? { signal } : {};
      const response = await fetcher(buildAcfPassageUrl(reference, options), init);

      if (!response.ok) {
        throw new Error(
          `ACF passage request failed with HTTP ${response.status} for ${reference.raw}`,
        );
      }

      const payload: unknown = await response.json();
      const verses = decodeAcfVerses(payload, reference);

      return {
        reference,
        verses,
        text: verses.map((verse) => verse.text).join(" "),
      };
    },
  };
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function getString(record: Record<string, unknown>, keys: readonly string[]): string | undefined {
  for (const key of keys) {
    const value = record[key];
    if (typeof value === "string" && value.trim() !== "") {
      return value.trim();
    }
  }

  return undefined;
}

function getNumber(record: Record<string, unknown>, keys: readonly string[]): number | undefined {
  for (const key of keys) {
    const value = record[key];

    if (typeof value === "number" && Number.isSafeInteger(value)) {
      return value;
    }

    if (typeof value === "string" && /^\d+$/.test(value)) {
      return Number(value);
    }
  }

  return undefined;
}

function unwrapVerseCollection(payload: unknown): unknown[] | Record<string, unknown> | undefined {
  if (Array.isArray(payload)) {
    return payload;
  }

  if (!isRecord(payload)) {
    return undefined;
  }

  for (const key of ["data", "result", "passage", "chapter"]) {
    const nested = unwrapVerseCollection(payload[key]);
    if (nested !== undefined) {
      return nested;
    }
  }

  for (const key of ["verses", "passages"]) {
    const value = payload[key];
    if (Array.isArray(value) || isRecord(value)) {
      return value;
    }
  }

  const entries = Object.entries(payload);
  if (
    entries.length > 0 &&
    entries.every(
      ([key, value]) => /^\d+$/.test(key) && (typeof value === "string" || isRecord(value)),
    )
  ) {
    return payload;
  }

  return undefined;
}

function decodeVerse(
  value: unknown,
  fallbackNumber: number,
  explicitNumber?: number,
): PassageVerse | undefined {
  if (typeof value === "string") {
    const text = value.trim();
    return text === "" ? undefined : { number: explicitNumber ?? fallbackNumber, text };
  }

  if (!isRecord(value)) {
    return undefined;
  }

  const number =
    explicitNumber ??
    getNumber(value, ["number", "verseNumber", "verse_number", "verse", "id"]) ??
    fallbackNumber;

  const text =
    getString(value, ["text", "content", "verseText", "verse_text", "texto", "value"]) ??
    (typeof value.verse === "string" && !/^\d+$/.test(value.verse)
      ? value.verse.trim()
      : undefined);

  if (!text) {
    return undefined;
  }

  return { number, text };
}

export function decodeAcfVerses(payload: unknown, reference: BibleReference): PassageVerse[] {
  const collection = unwrapVerseCollection(payload);
  if (collection === undefined) {
    throw new Error("Unsupported ACF passage response shape");
  }

  const verses: PassageVerse[] = [];

  if (Array.isArray(collection)) {
    collection.forEach((value, index) => {
      const verse = decodeVerse(value, reference.verseStart + index);
      if (verse) {
        verses.push(verse);
      }
    });
  } else {
    for (const [key, value] of Object.entries(collection)) {
      const verseNumber = Number(key);
      const verse = decodeVerse(value, verseNumber, verseNumber);
      if (verse) {
        verses.push(verse);
      }
    }
  }

  const filtered = verses
    .filter((verse) => verse.number >= reference.verseStart && verse.number <= reference.verseEnd)
    .sort((left, right) => left.number - right.number);

  if (filtered.length === 0) {
    throw new Error("ACF passage response did not contain the requested verses");
  }

  return filtered;
}
