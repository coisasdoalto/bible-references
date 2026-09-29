export {
  BIBLE_BOOKS,
  getBibleBookByAlias,
  getBibleBookById,
  type BibleBook,
  type BibleBookId,
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
  type BibleReferencesHandle,
  type MountBibleReferencesOptions,
  mountBibleReferences,
} from "./browser/mount";
export {
  type AcfPassageProviderOptions,
  buildAcfPassageUrl,
  createAcfPassageProvider,
  DEFAULT_ACF_API_BASE_URL,
} from "./providers/acf";
