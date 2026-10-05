import clsx from "clsx/lite";

import { bibleReferenceKey, parseBibleReferences } from "../core/parser";
import type { BibleReference, Passage, PassageProvider } from "../core/types";
import { buildBibliasAppReadUrl, createBibliasAppPassageProvider } from "../providers/biblias.app";
import { createTooltipView, type TooltipTheme } from "./tooltip";

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

export interface MountBibleReferencesOptions {
  readonly provider?: PassageProvider;
  readonly getHref?: (reference: BibleReference) => string;
  readonly preview?: boolean;
  readonly maxPreviewVerses?: number;
  readonly theme?: TooltipTheme;
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

/** Link references and display passage previews. Example: mountBibleReferences(document.body). */
export function mountBibleReferences(
  root: ParentNode,
  options: MountBibleReferencesOptions = {},
): BibleReferencesHandle {
  const document = getDocument(root);
  const provider = options.provider ?? createBibliasAppPassageProvider();
  const getHref =
    options.getHref ??
    ((reference: BibleReference) =>
      provider.source?.getUrl(reference) ?? buildBibliasAppReadUrl(reference));
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

  const view = createTooltipView(document, {
    id: `br-tooltip-${++tooltipSequence}`,
    translation: provider.translation,
    source: provider.source,
    getFallbackHref: getHref,
  });
  const tooltip = view.element;
  (document.body ?? document.documentElement).append(tooltip);

  const theme = options.theme ?? "auto";
  const colorScheme =
    theme === "auto" ? document.defaultView?.matchMedia?.("(prefers-color-scheme: dark)") : null;
  if (colorScheme) {
    view.setTheme(colorScheme.matches ? "dark" : "light");
    colorScheme.addEventListener(
      "change",
      (event) => view.setTheme(event.matches ? "dark" : "light"),
      { signal: eventController.signal },
    );
  } else if (theme !== "auto") {
    view.setTheme(theme);
  }

  let activeLink: HTMLAnchorElement | null = null;
  let tooltipHovered = false;
  let tooltipFocused = false;
  let hideTimeout: ReturnType<typeof setTimeout> | undefined;

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

  async function showTooltip(link: HTMLAnchorElement, reference: BibleReference): Promise<void> {
    if (!preview) {
      return;
    }

    activeLink = link;
    clearTimeout(hideTimeout);
    link.setAttribute("aria-describedby", tooltip.id);
    tooltip.hidden = false;
    view.showLoading(reference);
    view.place(link);

    const previewed = previewReference(reference, maxPreviewVerses);
    const key = bibleReferenceKey(previewed);
    const cached = cache.get(key);

    if (cached) {
      view.showPassage(cached, reference);
      view.place(link);
      return;
    }

    const controller = new AbortController();
    requestControllers.add(controller);

    try {
      const passage = await provider.getPassage(previewed, controller.signal);
      cache.set(key, passage);

      if (activeLink === link) {
        view.showPassage(passage, reference);
        view.place(link);
      }
    } catch {
      if (!controller.signal.aborted && activeLink === link) {
        view.showError(reference, () => void showTooltip(link, reference));
        view.place(link);
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
          view.body.focus();
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
    } else if (event.type === "focusin") {
      tooltipFocused = true;
    } else {
      const next = (event as FocusEvent).relatedTarget;
      tooltipFocused = next instanceof Node && tooltip.contains(next);
    }
    if (activeLink && !tooltipHovered && !tooltipFocused) {
      scheduleTooltipHide(activeLink);
    }
  }

  function bindTooltipEvents(): void {
    const listenerOptions = { signal: eventController.signal };
    for (const eventName of ["mouseenter", "mouseleave", "focusin", "focusout"] as const) {
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
