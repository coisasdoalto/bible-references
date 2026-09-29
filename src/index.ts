export {
  type BibleReferencesHandle,
  type MountBibleReferencesOptions,
  mountBibleReferences,
} from "./browser/mount";
export {
  BIBLE_BOOKS,
  type BibleBook,
  type BibleBookId,
  getBibleBookByAlias,
  getBibleBookById,
} from "./core/books";
export {
  bibleReferenceKey,
  formatBibleReference,
  parseBibleReferences,
} from "./core/parser";
export type {
  BibleReference,
  Passage,
  PassageProvider,
  PassageVerse,
} from "./core/types";
export {
  type AcfPassageProviderOptions,
  buildAcfPassageUrl,
  createAcfPassageProvider,
  DEFAULT_ACF_API_BASE_URL,
} from "./providers/acf";
