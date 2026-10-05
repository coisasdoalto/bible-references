import { parseBibleReferences } from "../core/parser";
import type { BibleReference, PassageProvider } from "../core/types";
import { createBibliasAppPassageProvider } from "../providers/biblias.app";
import { createPreviewController } from "./preview";
import { createReferenceLink, resolveGetHref } from "./reference-link";
import type { LinkOpenIn, TooltipTheme } from "./tooltip";

const ELEMENT_NODE = 1;
const TEXT_NODE = 3;
const DOCUMENT_NODE = 9;
const DOCUMENT_FRAGMENT_NODE = 11;
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
  /**
   * CSS selector of the elements to search, inside the root. Only text within a matching element
   * is linked, so the rest of the page is never read. Without it the whole root is searched.
   * Changing an element's attributes later does not rescan it; call `refresh()`.
   */
  readonly selector?: string;
  /**
   * Keep watching the root and link references in content added or changed after mounting. Also
   * cleans up when the content is removed or rewritten by a framework. Defaults to false.
   */
  readonly observe?: boolean;
}

export interface BibleReferencesHandle {
  refresh(): void;
  destroy(): void;
}

/**
 * A text node that was split around its references. The original node stays in the DOM holding
 * the text before the first reference, so a framework that owns it keeps working: when it
 * rewrites or removes the node, the generated nodes after it are cleaned up.
 */
interface SplitText {
  readonly original: string;
  readonly nodes: Node[];
  readonly unbinds: Array<() => void>;
}

function getDocument(root: ParentNode): Document {
  if ((root as Node).nodeType === DOCUMENT_NODE) {
    return root as Document;
  }

  const document = (root as Node).ownerDocument;
  if (!document) {
    throw new Error("Bible References requires a DOM document");
  }

  return document;
}

function isInsideIgnored(node: Node): boolean {
  const element = node.nodeType === ELEMENT_NODE ? (node as Element) : node.parentElement;
  return element !== null && element.closest(IGNORED_ANCESTORS) !== null;
}

/** Link references and display passage previews. Example: mountBibleReferences(document.body). */
export function mountBibleReferences(
  root: ParentNode,
  options: MountBibleReferencesOptions = {},
): BibleReferencesHandle {
  const document = getDocument(root);
  const rootNode = root as Node;
  const { selector } = options;

  if (selector !== undefined) {
    // Fail before anything is created when the selector is invalid.
    document.createDocumentFragment().querySelector(selector);
  }

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
  const splits = new Map<Text, SplitText>();
  // Nodes this mount created or split: never searched again.
  const owned = new WeakSet<Node>();
  let observer: MutationObserver | undefined;
  let destroyed = false;

  function findSelectorMatch(element: Element): Element | null {
    const match = selector === undefined ? null : element.closest(selector);
    // The nearest match can be an ancestor above the root, which is outside the search area.
    return match !== null && rootNode.contains(match) ? match : null;
  }

  function isEligible(node: Text): boolean {
    if (owned.has(node)) {
      return false;
    }

    const parent = node.parentElement;
    if (parent === null || parent.closest(IGNORED_ANCESTORS) !== null) {
      return false;
    }

    return selector === undefined || findSelectorMatch(parent) !== null;
  }

  /** The parts of a node to walk: the node itself, or only the elements matching the selector. */
  function regionsWithin(node: Node): Node[] {
    if (node.nodeType === TEXT_NODE) {
      return [node];
    }
    if (
      node.nodeType !== ELEMENT_NODE &&
      node.nodeType !== DOCUMENT_NODE &&
      node.nodeType !== DOCUMENT_FRAGMENT_NODE
    ) {
      return [];
    }
    if (
      selector === undefined ||
      (node.nodeType === ELEMENT_NODE && findSelectorMatch(node as Element))
    ) {
      return [node];
    }

    const regions: Element[] = [];
    for (const match of (node as ParentNode).querySelectorAll(selector)) {
      // Matches come in document order, so a nested match follows the region that contains it.
      if (!regions.at(-1)?.contains(match)) {
        regions.push(match);
      }
    }
    return regions;
  }

  function splitText(node: Text): void {
    const text = node.data;
    const references = parseBibleReferences(text);
    const first = references[0];
    if (first === undefined) {
      return;
    }

    const nodes: Node[] = [];
    const unbinds: Array<() => void> = [];
    let cursor = first.start;

    for (const reference of references) {
      if (reference.start > cursor) {
        nodes.push(document.createTextNode(text.slice(cursor, reference.start)));
      }

      const link = createReferenceLink(document, reference, getHref);
      unbinds.push(controller.bind(link, reference));
      nodes.push(link);
      cursor = reference.end;
    }

    if (cursor < text.length) {
      nodes.push(document.createTextNode(text.slice(cursor)));
    }

    for (const created of nodes) {
      owned.add(created);
    }
    owned.add(node);
    splits.set(node, { original: text, nodes, unbinds });

    node.after(...nodes);
    node.data = text.slice(0, first.start);
  }

  /** Remove what was generated for a node. `restore` puts its original text back. */
  function unsplit(node: Text, restore: boolean): void {
    const split = splits.get(node);
    if (!split) {
      return;
    }

    splits.delete(node);
    owned.delete(node);
    for (const unbind of split.unbinds) {
      unbind();
    }
    for (const generated of split.nodes) {
      owned.delete(generated);
      generated.parentNode?.removeChild(generated);
    }
    if (restore) {
      node.data = split.original;
    }
  }

  function scan(region: Node): void {
    if (region.nodeType === TEXT_NODE) {
      if (isEligible(region as Text)) {
        splitText(region as Text);
      }
      return;
    }

    const walker = document.createTreeWalker(region, SHOW_TEXT, {
      acceptNode(node) {
        return isEligible(node as Text) ? FILTER_ACCEPT : FILTER_REJECT;
      },
    });

    const nodes: Text[] = [];
    let current = walker.nextNode();

    while (current) {
      nodes.push(current as Text);
      current = walker.nextNode();
    }

    for (const node of nodes) {
      splitText(node);
    }
  }

  function handleRecords(records: readonly MutationRecord[]): void {
    const rescan = new Set<Node>();
    let removedAny = false;

    for (const record of records) {
      if (record.type === "characterData") {
        // The host rewrote a text node. If it was split, its text is now the whole new text.
        const target = record.target as Text;
        unsplit(target, false);
        rescan.add(target);
        continue;
      }

      removedAny ||= record.removedNodes.length > 0;
      for (const added of record.addedNodes) {
        rescan.add(added);
      }
    }

    if (removedAny) {
      // Content that left the root takes its split nodes with it; undo them so a node that comes
      // back is linked again and no link stays bound.
      for (const node of [...splits.keys()]) {
        if (!rootNode.contains(node)) {
          unsplit(node, true);
        }
      }
    }

    for (const node of rescan) {
      if (rootNode.contains(node) && !isInsideIgnored(node)) {
        for (const region of regionsWithin(node)) {
          scan(region);
        }
      }
    }
  }

  function refresh(): void {
    if (destroyed) {
      return;
    }

    if (observer) {
      handleRecords(observer.takeRecords());
    }
    for (const region of regionsWithin(rootNode)) {
      scan(region);
    }
    // Drop the records of this mount's own changes.
    observer?.takeRecords();
  }

  refresh();

  const ObserverConstructor = document.defaultView?.MutationObserver;
  if (options.observe && ObserverConstructor) {
    observer = new ObserverConstructor((records) => {
      handleRecords(records);
      observer?.takeRecords();
    });
    observer.observe(rootNode, { childList: true, subtree: true, characterData: true });
  }

  return {
    refresh,
    destroy() {
      destroyed = true;
      observer?.disconnect();
      for (const node of [...splits.keys()]) {
        unsplit(node, true);
      }
      controller.destroy();
    },
  };
}
