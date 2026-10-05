import { bibleReferenceKey } from "../core/parser";
import type { BibleReference, Passage, PassageProvider } from "../core/types";
import type { GetHref } from "./reference-link";
import { createTooltipView, type LinkOpenIn, type TooltipTheme } from "./tooltip";

export interface PreviewControllerOptions {
  readonly document: Document;
  readonly provider: PassageProvider;
  readonly getHref: GetHref;
  readonly preview: boolean;
  readonly theme: TooltipTheme;
  readonly container?: HTMLElement | undefined;
  readonly openIn: LinkOpenIn;
}

export interface PreviewController {
  /** Attach hover, focus, click and keyboard handling to a link. Returns a function that detaches it. */
  bind(link: HTMLAnchorElement, reference: BibleReference): () => void;
  destroy(): void;
}

interface LinkState {
  hovered: boolean;
  focused: boolean;
}

/** Scroll events right after opening are ignored: focusing a link can scroll it into view. */
const SCROLL_CLOSE_GRACE_MS = 150;

let tooltipSequence = 0;

/**
 * Own the tooltip and its behavior (hover, focus, click, dismissal, loading and caching) for any
 * set of reference links. The DOM and React integrations bind their own links to it.
 */
export function createPreviewController(options: PreviewControllerOptions): PreviewController {
  const { document, provider, getHref, preview } = options;

  const eventController = new AbortController();
  const requestControllers = new Set<AbortController>();
  const linkControllers = new Map<HTMLAnchorElement, AbortController>();
  const cache = new Map<string, Passage>();
  const states = new WeakMap<HTMLAnchorElement, LinkState>();

  const view = createTooltipView(document, {
    id: `br-tooltip-${++tooltipSequence}`,
    translation: provider.translation,
    source: provider.source,
    openIn: options.openIn,
    getFallbackHref: getHref,
  });
  const tooltip = view.element;
  (options.container ?? document.body ?? document.documentElement).append(tooltip);

  const colorScheme =
    options.theme === "auto"
      ? document.defaultView?.matchMedia?.("(prefers-color-scheme: dark)")
      : null;
  if (colorScheme) {
    view.setTheme(colorScheme.matches ? "dark" : "light");
    colorScheme.addEventListener(
      "change",
      (event) => view.setTheme(event.matches ? "dark" : "light"),
      { signal: eventController.signal },
    );
  } else if (options.theme !== "auto") {
    view.setTheme(options.theme);
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

  function handleTooltipKeys(event: KeyboardEvent): void {
    if (event.key !== "Escape" || !activeLink) {
      return;
    }
    activeLink.focus();
    closeTooltip();
  }

  function bind(link: HTMLAnchorElement, reference: BibleReference): () => void {
    const state: LinkState = { hovered: false, focused: false };
    states.set(link, state);
    const linkController = new AbortController();
    linkControllers.set(link, linkController);
    const listenerOptions = { signal: linkController.signal };

    link.addEventListener(
      "keydown",
      (event) => {
        if (event.key === "ArrowDown" && activeLink === link && !tooltip.hidden) {
          event.preventDefault();
          view.body.focus();
        }
        handleTooltipKeys(event);
      },
      listenerOptions,
    );

    // The reference never navigates: a click or tap opens the preview instead.
    link.addEventListener(
      "click",
      (event) => {
        event.preventDefault();
        void showTooltip(link, reference);
      },
      listenerOptions,
    );

    link.addEventListener(
      "mouseenter",
      () => {
        state.hovered = true;
        void showTooltip(link, reference);
      },
      listenerOptions,
    );

    link.addEventListener(
      "mouseleave",
      () => {
        state.hovered = false;
        scheduleTooltipHide(link);
      },
      listenerOptions,
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
      listenerOptions,
    );

    link.addEventListener(
      "blur",
      () => {
        state.focused = false;
        scheduleTooltipHide(link);
      },
      listenerOptions,
    );

    return () => {
      linkController.abort();
      linkControllers.delete(link);
      if (activeLink === link) {
        closeTooltip();
      }
    };
  }

  function isInsideTooltipOrReference(target: EventTarget | null): boolean {
    if (!(target instanceof Element)) {
      return false;
    }
    const link = target.closest("a");
    return tooltip.contains(target) || (link !== null && linkControllers.has(link));
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

    // A dialog closing hides its content without telling the preview (a manual popover would stay
    // in the top layer), so close it when the dialog that contains the tooltip or the active
    // reference closes.
    document.addEventListener(
      "close",
      (event) => {
        const dialog = event.target;
        if (
          dialog instanceof Node &&
          (dialog.contains(tooltip) || (activeLink !== null && dialog.contains(activeLink)))
        ) {
          closeTooltip();
        }
      },
      captureOptions,
    );

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

  const tooltipListenerOptions = { signal: eventController.signal };
  for (const eventName of ["mouseenter", "mouseleave", "focusin", "focusout"] as const) {
    tooltip.addEventListener(eventName, updateTooltipInteraction, tooltipListenerOptions);
  }
  tooltip.addEventListener("keydown", handleTooltipKeys, tooltipListenerOptions);
  bindDismissEvents();

  return {
    bind,
    destroy() {
      clearTimeout(hideTimeout);
      eventController.abort();

      for (const controller of linkControllers.values()) {
        controller.abort();
      }
      linkControllers.clear();

      for (const controller of requestControllers) {
        controller.abort();
      }
      requestControllers.clear();

      tooltip.remove();
    },
  };
}
