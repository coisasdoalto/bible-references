import { type ReactNode, useContext, useEffect, useRef } from "react";

import { referenceClassName } from "../browser/reference-link";
import { bibleReferenceKey } from "../core/parser";
import type { BibleReference } from "../core/types";
import { buildBibliasAppReadUrl } from "../providers/biblias.app";
import { BibleReferencesContext } from "./context";

export interface BibleReferenceLinkProps {
  readonly reference: BibleReference;
  /** Defaults to the text of the reference as written. */
  readonly children?: ReactNode;
}

/** Link of one reference, with a passage preview inside a BibleReferencesProvider. */
export function BibleReferenceLink({ reference, children }: BibleReferenceLinkProps) {
  const context = useContext(BibleReferencesContext);
  const controller = context?.controller ?? null;
  const getHref = context?.getHref ?? buildBibliasAppReadUrl;
  const anchor = useRef<HTMLAnchorElement>(null);
  const latest = useRef(reference);
  latest.current = reference;
  const key = bibleReferenceKey(reference);

  // Bind by the reference key, not its identity: parsing again on every render creates new objects.
  // biome-ignore lint/correctness/useExhaustiveDependencies: key identifies latest.current
  useEffect(() => {
    const element = anchor.current;
    if (!element || !controller) {
      return;
    }
    return controller.bind(element, latest.current);
  }, [controller, key]);

  return (
    <a
      ref={anchor}
      className={referenceClassName}
      href={getHref(reference)}
      data-br-reference={key}
    >
      {children ?? reference.raw}
    </a>
  );
}
