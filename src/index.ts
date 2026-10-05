export {
  type BibleReferencesHandle,
  type MountBibleReferencesOptions,
  mountBibleReferences,
} from "./browser/mount";
export type { LinkOpenIn, TooltipTheme } from "./browser/tooltip";
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
  PassageSource,
  PassageTranslation,
  PassageVerse,
} from "./core/types";
export {
  type BibliasAppPassageProviderOptions,
  buildBibliasAppPassageUrl,
  buildBibliasAppReadUrl,
  createBibliasAppPassageProvider,
  DEFAULT_BIBLIAS_APP_API_BASE_URL,
  DEFAULT_BIBLIAS_APP_READ_BASE_URL,
} from "./providers/biblias.app";
