import clsx from "clsx/lite";

import { bibleReferenceKey, formatBibleReference, parseBibleReferences } from "../core/parser";
import type { BibleReference, Passage, PassageProvider } from "../core/types";
import { buildAcfPassageUrl, createAcfPassageProvider } from "../providers/acf";

const SHOW_TEXT = 4;
const FILTER_ACCEPT = 1;
const FILTER_REJECT = 2;

const IGNORED_ANCESTORS =
  "script,style,code,pre,textarea,input,select,option,a,button,[contenteditable],[data-bible-references-ignore]";

const referenceClassName = clsx(
  "br-reference",
  "cursor-help underline decoration-dotted underline-offset-2",
  "focus-visible:outline-2 focus-visible:outline-offset-2",
);

const tooltipClassName = clsx(
  "br-tooltip",
  "fixed z-[2147483647] w-max px-3 py-2",
  "text-sm leading-relaxed shadow-lg",
);

const tooltipLabelClassName = clsx("mb-1 block font-semibold");
const tooltipTextClassName = clsx("block");

export interface MountBibleReferencesOptions {
  readonly provider?: PassageProvider;
  readonly getHref?: (reference: BibleReference) => string;
  readonly preview?: boolean;
  readonly maxPreviewVerses?: number;
}

export interface BibleReferencesHandle {
  refresh(): void;
  destroy(): void;
}

interface LinkState {
  hovered: boolean;
  focused: boolean;
}

let tooltipSequence = 0;

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

function previewReference(reference: BibleReference, maxVerses: number): BibleReference {
  if (reference.verseStart === null) {
    return reference;
  }
  return {
    ...reference,
    verseEnd: Math.min(reference.verseEnd, reference.verseStart + maxVerses - 1),
  };
}

function formatPassageText(passage: Passage): string {
  return passage.verses.map((verse) => `${verse.number} ${verse.text}`).join(" ");
}

/** Link references and display passage previews. Example: mountBibleReferences(document.body). */
export function mountBibleReferences(
  root: ParentNode,
  options: MountBibleReferencesOptions = {},
): BibleReferencesHandle {
  const document = getDocument(root);
  const provider = options.provider ?? createAcfPassageProvider();
  const getHref = options.getHref ?? ((reference: BibleReference) => buildAcfPassageUrl(reference));
  const preview = options.preview ?? true;
  const maxPreviewVerses = options.maxPreviewVerses ?? 8;

  if (!Number.isSafeInteger(maxPreviewVerses) || maxPreviewVerses < 1) {
    throw new Error("maxPreviewVerses must be a positive integer");
  }

  const eventController = new AbortController();
  const requestControllers = new Set<AbortController>();
  const cache = new Map<string, Passage>();
  const generatedLinks = new Set<HTMLAnchorElement>();
  const states = new WeakMap<HTMLAnchorElement, LinkState>();

  const tooltip = document.createElement("div");
  tooltip.id = `br-tooltip-${++tooltipSequence}`;
  tooltip.className = tooltipClassName;
  tooltip.setAttribute("role", "tooltip");
  tooltip.tabIndex = 0;
  tooltip.hidden = true;

  const tooltipLabel = document.createElement("strong");
  tooltipLabel.className = tooltipLabelClassName;

  const tooltipText = document.createElement("span");
  tooltipText.className = tooltipTextClassName;

  tooltip.append(tooltipLabel, tooltipText);
  (document.body ?? document.documentElement).append(tooltip);

  let activeLink: HTMLAnchorElement | null = null;
  let tooltipHovered = false;
  let tooltipFocused = false;
  let hideTimeout: ReturnType<typeof setTimeout> | undefined;

  function positionTooltip(link: HTMLAnchorElement): void {
    const rect = link.getBoundingClientRect();
    const viewportWidth =
      document.documentElement.clientWidth || document.defaultView?.innerWidth || 1024;
    const viewportHeight =
      document.documentElement.clientHeight || document.defaultView?.innerHeight || 768;
    const { width, height } = tooltip.getBoundingClientRect();
    const preferredTop = rect.top >= height + 16 ? rect.top - height : rect.bottom;
    const top = Math.max(16, Math.min(preferredTop, viewportHeight - height - 16));
    const left = Math.max(
      16,
      Math.min(rect.left + rect.width / 2 - width / 2, viewportWidth - width - 16),
    );

    tooltip.style.top = `${top}px`;
    tooltip.style.left = `${left}px`;
  }

  function hideTooltip(link: HTMLAnchorElement): void {
    const state = states.get(link);
    if (
      !state ||
      state.hovered ||
      state.focused ||
      tooltipHovered ||
      tooltipFocused ||
      activeLink !== link
    ) {
      return;
    }

    link.removeAttribute("aria-describedby");
    activeLink = null;
    tooltip.hidden = true;
  }

  function scheduleTooltipHide(link: HTMLAnchorElement): void {
    clearTimeout(hideTimeout);
    hideTimeout = setTimeout(() => hideTooltip(link), 150);
  }

  function renderTooltipPassage(passage: Passage, original: BibleReference): void {
    const selected = passage.reference;
    const truncated =
      selected.verseEnd !== null &&
      original.verseEnd !== null &&
      selected.verseEnd < original.verseEnd;
    tooltipText.textContent = `${formatPassageText(passage)}${truncated ? " …" : ""}`;
  }

  async function showTooltip(link: HTMLAnchorElement, reference: BibleReference): Promise<void> {
    if (!preview) {
      return;
    }

    activeLink = link;
    clearTimeout(hideTimeout);
    link.setAttribute("aria-describedby", tooltip.id);
    tooltip.hidden = false;
    tooltipLabel.textContent = formatBibleReference(reference);
    tooltipText.textContent = "Carregando passagem…";
    tooltip.scrollTop = 0;
    positionTooltip(link);

    const previewed = previewReference(reference, maxPreviewVerses);
    const key = bibleReferenceKey(previewed);
    const cached = cache.get(key);

    if (cached) {
      renderTooltipPassage(cached, reference);
      positionTooltip(link);
      return;
    }

    const controller = new AbortController();
    requestControllers.add(controller);

    try {
      const passage = await provider.getPassage(previewed, controller.signal);
      cache.set(key, passage);

      if (activeLink === link) {
        renderTooltipPassage(passage, reference);
        positionTooltip(link);
      }
    } catch {
      if (!controller.signal.aborted && activeLink === link) {
        tooltipText.textContent = "Não foi possível carregar a passagem.";
      }
    } finally {
      requestControllers.delete(controller);
    }
  }

  function bindLink(link: HTMLAnchorElement, reference: BibleReference): void {
    const state: LinkState = { hovered: false, focused: false };
    states.set(link, state);
    link.addEventListener(
      "keydown",
      (event) => {
        if (event.key === "ArrowDown" && activeLink === link && !tooltip.hidden) {
          event.preventDefault();
          tooltip.focus();
        }
        handleTooltipKeys(event);
      },
      { signal: eventController.signal },
    );

    link.addEventListener(
      "mouseenter",
      () => {
        state.hovered = true;
        void showTooltip(link, reference);
      },
      { signal: eventController.signal },
    );

    link.addEventListener(
      "mouseleave",
      () => {
        state.hovered = false;
        scheduleTooltipHide(link);
      },
      { signal: eventController.signal },
    );

    link.addEventListener(
      "focus",
      () => {
        state.focused = true;
        void showTooltip(link, reference);
      },
      { signal: eventController.signal },
    );

    link.addEventListener(
      "blur",
      () => {
        state.focused = false;
        scheduleTooltipHide(link);
      },
      { signal: eventController.signal },
    );
  }

  function handleTooltipKeys(event: KeyboardEvent): void {
    if (event.key !== "Escape" || !activeLink) {
      return;
    }
    const link = activeLink;
    link.focus();
    link.removeAttribute("aria-describedby");
    tooltipHovered = false;
    tooltipFocused = false;
    activeLink = null;
    tooltip.hidden = true;
  }

  function updateTooltipInteraction(event: Event): void {
    if (event.type === "mouseenter" || event.type === "mouseleave") {
      tooltipHovered = event.type === "mouseenter";
    } else {
      tooltipFocused = event.type === "focus";
    }
    if (activeLink && !tooltipHovered && !tooltipFocused) {
      scheduleTooltipHide(activeLink);
    }
  }

  function bindTooltipEvents(): void {
    const listenerOptions = { signal: eventController.signal };
    for (const eventName of ["mouseenter", "mouseleave", "focus", "blur"] as const) {
      tooltip.addEventListener(eventName, updateTooltipInteraction, listenerOptions);
    }
    tooltip.addEventListener("keydown", handleTooltipKeys, listenerOptions);
  }

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

      const link = document.createElement("a");
      link.href = getHref(reference);
      link.className = referenceClassName;
      link.dataset.brReference = bibleReferenceKey(reference);
      link.textContent = reference.raw;

      generatedLinks.add(link);
      bindLink(link, reference);
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

  bindTooltipEvents();
  refresh();

  return {
    refresh,
    destroy() {
      clearTimeout(hideTimeout);
      eventController.abort();

      for (const controller of requestControllers) {
        controller.abort();
      }
      requestControllers.clear();

      tooltip.remove();

      for (const link of generatedLinks) {
        if (link.isConnected) {
          link.replaceWith(document.createTextNode(link.textContent ?? ""));
        }
      }
      generatedLinks.clear();
    },
  };
}
