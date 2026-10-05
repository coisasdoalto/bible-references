import { createContext } from "react";

import type { PreviewController } from "../browser/preview";
import type { GetHref } from "../browser/reference-link";

export interface BibleReferencesContextValue {
  /** Null on the server and before the provider mounts: links render, but without previews. */
  readonly controller: PreviewController | null;
  readonly getHref: GetHref;
}

export const BibleReferencesContext = createContext<BibleReferencesContextValue | null>(null);
