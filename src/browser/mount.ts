import clsx from "clsx/lite";

import { bibleReferenceKey, parseBibleReferences } from "../core/parser";
import type { BibleReference, Passage, PassageProvider } from "../core/types";
import { buildBibliasAppReadUrl, createBibliasAppPassageProvider } from "../providers/biblias.app";
import { createTooltipView, type LinkOpenIn, type TooltipTheme } from "./tooltip";

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

interface LinkState {
  hovered: boolean;
  focused: boolean;
}

/** Scroll events right after opening are ignored: focusing a link can scroll it into view. */
const SCROLL_CLOSE_GRACE_MS = 150;

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

  const eventController = new AbortController();
  const requestControllers = new Set<AbortController>();
  const cache = new Map<string, Passage>();
  const generatedLinks = new Set<HTMLAnchorElement>();
  const states = new WeakMap<HTMLAnchorElement, LinkState>();

  const view = createTooltipView(document, {
    id: `br-tooltip-${++tooltipSequence}`,
    translation: provider.translation,
    source: provider.source,
    openIn: options.openIn ?? "new-tab",
    getFallbackHref: getHref,
  });
  const tooltip = view.element;
  (options.container ?? document.body ?? document.documentElement).append(tooltip);

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
  let openedAt = 0;
  let keyboardModality = false;
  let hideTimeout: ReturnType<typeof setTimeout> | undefined;

  function closeTooltip(): void {
    clearTimeout(hideTimeout);
    const link = activeLink;
    if (!link) {
      return;
    }

    const state = states.get(link);
    if (state) {
      state.hovered = false;
      state.focused = false;
    }
    link.removeAttribute("aria-describedby");
    tooltipHovered = false;
    tooltipFocused = false;
    activeLink = null;
    view.close();
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
    view.close();
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
    openedAt = performance.now();
    clearTimeout(hideTimeout);
    link.setAttribute("aria-describedby", tooltip.id);
    view.open();
    view.showLoading(reference);
    view.place(link);

    const key = bibleReferenceKey(reference);
    const cached = cache.get(key);

    if (cached) {
      view.showPassage(cached, reference);
      view.place(link);
      return;
    }

    const controller = new AbortController();
    requestControllers.add(controller);

    try {
      const passage = await provider.getPassage(reference, controller.signal);
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

    // The reference never navigates: a click or tap opens the preview instead.
    link.addEventListener(
      "click",
      (event) => {
        event.preventDefault();
        void showTooltip(link, reference);
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
        // Programmatic focus (a dialog focusing its first control, an autofocus) is not a request
        // for a preview; only keyboard navigation opens it on focus.
        if (keyboardModality) {
          void showTooltip(link, reference);
        }
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
    activeLink.focus();
    closeTooltip();
  }

  function isInsideTooltipOrReference(target: EventTarget | null): boolean {
    if (!(target instanceof Element)) {
      return false;
    }
    const link = target.closest("a");
    return tooltip.contains(target) || (link !== null && generatedLinks.has(link));
  }

  function bindDismissEvents(): void {
    const listenerOptions = { signal: eventController.signal };

    // Scroll events do not bubble, so listen in the capture phase to catch any scroll container.
    document.defaultView?.addEventListener(
      "scroll",
      (event) => {
        if (
          activeLink &&
          !(event.target instanceof Node && tooltip.contains(event.target)) &&
          performance.now() - openedAt > SCROLL_CLOSE_GRACE_MS
        ) {
          closeTooltip();
        }
      },
      { ...listenerOptions, capture: true, passive: true },
    );

    // Only Tab navigation counts as keyboard focus. Other keys (Enter opening a dialog that then
    // focuses its first control) must not, and the flag is cleared as soon as the key is released.
    const captureOptions = { ...listenerOptions, capture: true, passive: true };
    document.addEventListener(
      "keydown",
      (event) => (keyboardModality = event.key === "Tab"),
      captureOptions,
    );
    document.addEventListener("keyup", () => (keyboardModality = false), captureOptions);
    document.addEventListener("pointerdown", () => (keyboardModality = false), captureOptions);

    // Taps outside do not reliably emit mouseleave/blur on touch devices.
    document.addEventListener(
      "pointerdown",
      (event) => {
        if (activeLink && !isInsideTooltipOrReference(event.target)) {
          closeTooltip();
        }
      },
      listenerOptions,
    );
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
  bindDismissEvents();
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
