import clsx from "clsx/lite";

import { bibleReferenceKey } from "../core/parser";
import type { BibleReference, PassageProvider } from "../core/types";
import { buildBibliasAppReadUrl } from "../providers/biblias.app";

export const referenceClassName = clsx(
  "br-reference",
  "br:cursor-help br:underline br:decoration-dotted br:underline-offset-2",
  "br:focus-visible:outline-2 br:focus-visible:outline-offset-2",
);

export type GetHref = (reference: BibleReference) => string;

/** The href of a reference link: the consumer's, else the provider's reading page. */
export function resolveGetHref(
  provider: PassageProvider | undefined,
  getHref: GetHref | undefined,
): GetHref {
  return (
    getHref ??
    ((reference) => provider?.source?.getUrl(reference) ?? buildBibliasAppReadUrl(reference))
  );
}

/** Build the anchor of a reference. Example: createReferenceLink(document, reference, getHref). */
export function createReferenceLink(
  document: Document,
  reference: BibleReference,
  getHref: GetHref,
): HTMLAnchorElement {
  const link = document.createElement("a");
  link.href = getHref(reference);
  link.className = referenceClassName;
  link.dataset.brReference = bibleReferenceKey(reference);
  link.textContent = reference.raw;
  return link;
}
