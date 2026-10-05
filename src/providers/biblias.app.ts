import { type BibleBookId, getBibleBookById } from "../core/books";
import type {
  BibleReference,
  PassageProvider,
  PassageTranslation,
  PassageVerse,
} from "../core/types";

export const DEFAULT_BIBLIAS_APP_API_BASE_URL = "https://biblias.app/api/v1/bible/acf/passages";
export const DEFAULT_BIBLIAS_APP_READ_BASE_URL = "https://biblias.app/acf";

const DEFAULT_TRANSLATION: PassageTranslation = {
  abbreviation: "ACF",
  name: "Almeida Corrigida Fiel",
};

export interface BibliasAppPassageProviderOptions {
  /** API endpoint that serves passages. */
  readonly baseUrl?: string;
  /** Site page where a passage can be read. */
  readonly readBaseUrl?: string;
  readonly translation?: PassageTranslation;
  readonly bookSlugs?: Partial<Record<BibleBookId, string>>;
  readonly fetch?: typeof globalThis.fetch;
}

type UrlOptions = Pick<BibliasAppPassageProviderOptions, "baseUrl" | "readBaseUrl" | "bookSlugs">;

function buildPassagePath(
  baseUrl: string,
  reference: BibleReference,
  bookSlugs: UrlOptions["bookSlugs"],
): string {
  const book = getBibleBookById(reference.bookId);
  const slug = bookSlugs?.[reference.bookId] ?? book.apiSlug;
  const base = baseUrl.replace(/\/$/, "");
  const chapterUrl = `${base}/${encodeURIComponent(slug)}/${reference.chapter}`;
  if (reference.verseStart === null) {
    return chapterUrl;
  }
  const verses =
    reference.verseStart === reference.verseEnd
      ? String(reference.verseStart)
      : `${reference.verseStart}-${reference.verseEnd}`;
  return `${chapterUrl}/${verses}`;
}

/** Build the API URL for a passage or chapter. Example: buildBibliasAppPassageUrl(reference). */
export function buildBibliasAppPassageUrl(
  reference: BibleReference,
  options: Pick<UrlOptions, "baseUrl" | "bookSlugs"> = {},
): string {
  return buildPassagePath(
    options.baseUrl ?? DEFAULT_BIBLIAS_APP_API_BASE_URL,
    reference,
    options.bookSlugs,
  );
}

/** Build the biblias.app page URL where a passage is read. Example: buildBibliasAppReadUrl(reference). */
export function buildBibliasAppReadUrl(
  reference: BibleReference,
  options: Pick<UrlOptions, "readBaseUrl" | "bookSlugs"> = {},
): string {
  return buildPassagePath(
    options.readBaseUrl ?? DEFAULT_BIBLIAS_APP_READ_BASE_URL,
    reference,
    options.bookSlugs,
  );
}

/** Fetch verse selections and whole chapters. Example: createBibliasAppPassageProvider({ fetch }).getPassage(reference). */
export function createBibliasAppPassageProvider(
  options: BibliasAppPassageProviderOptions = {},
): PassageProvider {
  const fetcher = options.fetch ?? globalThis.fetch;

  if (typeof fetcher !== "function") {
    throw new Error("No fetch implementation is available for the biblias.app passage provider");
  }

  return {
    translation: options.translation ?? DEFAULT_TRANSLATION,
    source: {
      id: "biblias.app",
      name: "biblias.app",
      getUrl: (reference) => buildBibliasAppReadUrl(reference, options),
    },
    async getPassage(reference, signal) {
      const init: RequestInit = signal ? { signal } : {};
      const response = await fetcher(buildBibliasAppPassageUrl(reference, options), init);

      if (!response.ok) {
        throw new Error(
          `biblias.app passage request failed with HTTP ${response.status} for ${reference.raw}`,
        );
      }

      const payload: unknown = await response.json();
      const verses = decodeBibliasAppVerses(payload, reference);

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

/** Normalize the selected verses, or the entire chapter. Example: decodeBibliasAppVerses(payload, reference). */
export function decodeBibliasAppVerses(
  payload: unknown,
  reference: BibleReference,
): PassageVerse[] {
  const collection = unwrapVerseCollection(payload);
  if (collection === undefined) {
    throw new Error("Unsupported biblias.app passage response shape");
  }

  const verses: PassageVerse[] = [];

  if (Array.isArray(collection)) {
    collection.forEach((value, index) => {
      const verse = decodeVerse(value, (reference.verseStart ?? 1) + index);
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
    .filter(
      (verse) =>
        reference.verseStart === null ||
        (verse.number >= reference.verseStart && verse.number <= reference.verseEnd),
    )
    .sort((left, right) => left.number - right.number);

  if (filtered.length === 0) {
    throw new Error("biblias.app passage response did not contain the requested verses");
  }

  return filtered;
}
