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
  /** The text this mount left in the original node. */
  readonly prefix: string;
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
  // Host rewrites of split nodes that arrived while only `refresh()` is looking (no `observe`).
  const rewritten: MutationRecord[] = [];
  let destroyed = false;

  function findSelectorMatch(element: Element): Element | null {
    const match = selector === undefined ? null : element.closest(selector);
    // The nearest match can be an ancestor above the root, which is outside the search area.
    return match !== null && rootNode.contains(match) ? match : null;
  }

  /** Whether a text node is in a place this mount reads, ignoring whether it already split it. */
  function isReadable(node: Text): boolean {
    const parent = node.parentElement;
    if (parent === null || parent.closest(IGNORED_ANCESTORS) !== null) {
      return false;
    }

    return selector === undefined || findSelectorMatch(parent) !== null;
  }

  function isEligible(node: Text): boolean {
    return !owned.has(node) && isReadable(node);
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
    const prefix = text.slice(0, first.start);
    splits.set(node, { original: text, prefix, nodes, unbinds });

    node.after(...nodes);
    node.data = prefix;
    if (!options.observe) {
      // Without observe, still notice the host writing to this node, even the same text.
      observer?.observe(node, { characterData: true });
    }
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

  /** Whether the generated nodes still follow their original node, in order. */
  function followsOriginal(node: Text, split: SplitText): boolean {
    let next = node.nextSibling;
    for (const generated of split.nodes) {
      if (generated !== next) {
        return false;
      }
      next = next.nextSibling;
    }
    return true;
  }

  /**
   * Undo the splits the host broke, whether or not anything was observed: the node left the
   * root, was rewritten, or was moved away from its generated nodes. Nodes that need another
   * look are added to `rescan`. With `recheckLocation`, a split node that is no longer in a place
   * this mount reads (its element stopped matching the selector, or became ignored) is undone too.
   */
  function reconcile(
    records: readonly MutationRecord[],
    rescan: Set<Node>,
    recheckLocation = false,
  ): void {
    for (const record of records) {
      if (record.type === "characterData" && splits.has(record.target as Text)) {
        // The host rewrote a split node: its text is now the whole new text.
        unsplit(record.target as Text, false);
        rescan.add(record.target);
      }
    }

    for (const [node, split] of [...splits]) {
      if (!rootNode.contains(node)) {
        // Back to its original text, so it is linked again if it returns.
        unsplit(node, true);
      } else if (node.data !== split.prefix) {
        unsplit(node, false);
        rescan.add(node);
      } else if (!followsOriginal(node, split)) {
        // Moved without the generated nodes: its text is the prefix, so restore the whole text.
        unsplit(node, true);
        rescan.add(node);
      } else if (recheckLocation && !isReadable(node)) {
        unsplit(node, true);
      }
    }
  }

  function handleRecords(records: readonly MutationRecord[]): void {
    const rescan = new Set<Node>();
    reconcile(records, rescan);

    for (const record of records) {
      for (const added of record.addedNodes) {
        rescan.add(added);
      }
      if (record.type === "characterData") {
        rescan.add(record.target);
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

  function takePendingRecords(): MutationRecord[] {
    return [...rewritten.splice(0), ...(observer?.takeRecords() ?? [])];
  }

  function refresh(): void {
    if (destroyed) {
      return;
    }

    // Settle what the host did since the last scan; the full scan below covers the rest.
    reconcile(takePendingRecords(), new Set(), true);
    for (const region of regionsWithin(rootNode)) {
      scan(region);
    }
    // Drop the records of this mount's own changes.
    observer?.takeRecords();
  }

  const ObserverConstructor = document.defaultView?.MutationObserver;
  if (ObserverConstructor) {
    observer = new ObserverConstructor((records) => {
      if (options.observe) {
        handleRecords(records);
      } else {
        rewritten.push(...records.filter((record) => record.type === "characterData"));
      }
      // Drop the records of this mount's own changes.
      observer?.takeRecords();
    });
  }

  refresh();

  if (options.observe) {
    observer?.observe(rootNode, { childList: true, subtree: true, characterData: true });
  }

  return {
    refresh,
    destroy() {
      destroyed = true;
      // Keep the host's pending edits: only the splits that are still intact get their text back.
      reconcile(takePendingRecords(), new Set());
      observer?.disconnect();
      for (const node of [...splits.keys()]) {
        unsplit(node, true);
      }
      controller.destroy();
    },
  };
}
