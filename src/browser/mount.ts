import { parseBibleReferences } from "../core/parser";
import type { BibleReference, PassageProvider } from "../core/types";
import { createBibliasAppPassageProvider } from "../providers/biblias.app";
import { createPreviewController } from "./preview";
import { createReferenceLink, resolveGetHref } from "./reference-link";
import type { LinkOpenIn, TooltipTheme } from "./tooltip";

const SHOW_TEXT = 4;
const FILTER_ACCEPT = 1;
const FILTER_REJECT = 2;

const IGNORED_ANCESTORS =
  "script,style,code,pre,textarea,input,select,option,a,button,[contenteditable],[data-bible-references-ignore]";

export interface MountBibleReferencesOptions {
  readonly provider?: PassageProvider;
  readonly getHref?: (reference: BibleReference) => string;
  readonly preview?: boolean;
  readonly theme?: TooltipTheme;
  /**
   * Element that receives the tooltip. Defaults to the document body. Pass an element inside a
   * modal or popover so pointer events and hover inside the tooltip count as inside it.
   */
  readonly container?: HTMLElement;
  /** Where the tooltip footer link opens. Defaults to "new-tab". */
  readonly openIn?: LinkOpenIn;
}

export interface BibleReferencesHandle {
  refresh(): void;
  destroy(): void;
}

function getDocument(root: ParentNode): Document {
  if ((root as Node).nodeType === 9) {
    return root as Document;
  }

  const document = (root as Node).ownerDocument;
  if (!document) {
    throw new Error("Bible References requires a DOM document");
  }

  return document;
}

function shouldIgnoreTextNode(node: Text): boolean {
  const parent = node.parentElement;
  return parent === null || parent.closest(IGNORED_ANCESTORS) !== null;
}

/** Link references and display passage previews. Example: mountBibleReferences(document.body). */
export function mountBibleReferences(
  root: ParentNode,
  options: MountBibleReferencesOptions = {},
): BibleReferencesHandle {
  const document = getDocument(root);
  const provider = options.provider ?? createBibliasAppPassageProvider();
  const getHref = resolveGetHref(provider, options.getHref);

  const controller = createPreviewController({
    document,
    provider,
    getHref,
    preview: options.preview ?? true,
    theme: options.theme ?? "auto",
    container: options.container,
    openIn: options.openIn ?? "new-tab",
  });
  const generatedLinks = new Map<HTMLAnchorElement, () => void>();

  function replaceTextNode(node: Text): void {
    const text = node.data;
    const references = parseBibleReferences(text);
    if (references.length === 0) {
      return;
    }

    const fragment = document.createDocumentFragment();
    let cursor = 0;

    for (const reference of references) {
      if (reference.start > cursor) {
        fragment.append(document.createTextNode(text.slice(cursor, reference.start)));
      }

      const link = createReferenceLink(document, reference, getHref);
      generatedLinks.set(link, controller.bind(link, reference));
      fragment.append(link);
      cursor = reference.end;
    }

    if (cursor < text.length) {
      fragment.append(document.createTextNode(text.slice(cursor)));
    }

    node.replaceWith(fragment);
  }

  function refresh(): void {
    const walker = document.createTreeWalker(root as Node, SHOW_TEXT, {
      acceptNode(node) {
        return shouldIgnoreTextNode(node as Text) ? FILTER_REJECT : FILTER_ACCEPT;
      },
    });

    const nodes: Text[] = [];
    let current = walker.nextNode();

    while (current) {
      nodes.push(current as Text);
      current = walker.nextNode();
    }

    for (const node of nodes) {
      replaceTextNode(node);
    }
  }

  refresh();

  return {
    refresh,
    destroy() {
      controller.destroy();

      for (const [link, unbind] of generatedLinks) {
        unbind();
        if (link.isConnected) {
          link.replaceWith(document.createTextNode(link.textContent ?? ""));
        }
      }
      generatedLinks.clear();
    },
  };
}
