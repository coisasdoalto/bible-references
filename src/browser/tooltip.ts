import clsx from "clsx/lite";

import { formatBibleReference } from "../core/parser";
import type { BibleReference, Passage, PassageSource, PassageTranslation } from "../core/types";

export type TooltipTheme = "auto" | "light" | "dark";
export type LinkOpenIn = "current-tab" | "new-tab";
export type ResolvedTooltipTheme = Exclude<TooltipTheme, "auto">;

export interface TooltipViewOptions {
  readonly id: string;
  readonly translation?: PassageTranslation | undefined;
  readonly source?: PassageSource | undefined;
  readonly openIn: LinkOpenIn;
  readonly getFallbackHref: (reference: BibleReference) => string;
}

export interface TooltipView {
  readonly element: HTMLElement;
  readonly body: HTMLElement;
  showLoading(reference: BibleReference): void;
  showPassage(passage: Passage, reference: BibleReference): void;
  showError(reference: BibleReference, onRetry: () => void): void;
  open(): void;
  close(): void;
  place(anchor: HTMLElement): void;
  setTheme(theme: ResolvedTooltipTheme): void;
}

const VIEWPORT_MARGIN = 16;
const ANCHOR_GAP = 12;
const ARROW_INSET = 16;
const SKELETON_WIDTHS = ["br:w-full", "br:w-11/12", "br:w-full", "br:w-3/5"];

const rootClassName = clsx(
  "br-tooltip",
  "br:fixed br:z-[2147483647] br:text-sm br:leading-relaxed",
);
const cardClassName = clsx("br-tooltip-card", "br:flex br:flex-col br:overflow-hidden");
const headerClassName = clsx(
  "br-tooltip-header",
  "br:flex br:shrink-0 br:items-center br:justify-between br:gap-3 br:px-3.5 br:py-2.5",
);
const titleClassName = clsx(
  "br-tooltip-title",
  "br:min-w-0 br:text-base br:font-bold br:break-words",
);
const badgeClassName = clsx(
  "br-tooltip-badge",
  "br:rounded-sm br:px-1.5 br:text-xs br:font-bold br:tracking-wide",
);
const bodyClassName = clsx(
  "br-tooltip-body",
  "br:min-h-0 br:flex-1 br:overflow-y-auto br:px-4 br:pt-3.5",
);
const verseClassName = clsx("br-verse", "br:mb-2 br:block");
const verseNumberClassName = clsx(
  "br-verse-number",
  "br:mr-0.5 br:align-super br:text-[0.7em] br:font-bold",
);
const skeletonClassName = clsx("br-skeleton", "br:mb-3 br:block br:h-3 br:rounded-full");
const messageClassName = clsx("br-tooltip-message", "br:flex br:flex-col br:items-start br:gap-3");
const retryClassName = clsx(
  "br-tooltip-retry",
  "br:min-h-9 br:cursor-pointer br:rounded-lg br:border br:px-4 br:text-sm br:font-semibold",
);
const footerClassName = clsx(
  "br-tooltip-footer",
  "br:flex br:shrink-0 br:items-center br:justify-between br:gap-3 br:px-3.5 br:py-2.5",
);
const linkClassName = clsx(
  "br-tooltip-link",
  "br:inline-flex br:shrink-0 br:items-center br:gap-2 br:font-semibold br:whitespace-nowrap",
);
const iconClassName = clsx(
  "br-tooltip-icon",
  "br:block br:size-[1.125rem] br:shrink-0 br:rounded-[0.25rem]",
);
const noteClassName = clsx("br-tooltip-note", "br:text-xs");
const arrowClassName = clsx("br-tooltip-arrow", "br:absolute br:size-3 br:rotate-45");

function clamp(value: number, min: number, max: number): number {
  return Math.max(min, Math.min(value, Math.max(min, max)));
}

interface PlacementLayout {
  readonly placement: "bottom" | "top";
  readonly height: number;
  readonly maxHeight?: number | undefined;
}

/**
 * Chooses whether to place the tooltip below or above the anchor, and
 * calculates the maximum height when available space is constrained.
 *
 * @example
 * ```ts
 * const layout = resolvePlacement(150, 100, 300);
 * // layout.placement === "bottom", layout.maxHeight === 150
 * ```
 */
function resolvePlacement(
  spaceBelow: number,
  spaceAbove: number,
  naturalHeight: number,
): PlacementLayout {
  if (spaceBelow >= naturalHeight) {
    return { placement: "bottom", height: naturalHeight };
  }
  if (spaceAbove >= naturalHeight) {
    return { placement: "top", height: naturalHeight };
  }
  const placement = spaceBelow >= spaceAbove ? "bottom" : "top";
  const availableSpace = Math.max(0, placement === "bottom" ? spaceBelow : spaceAbove);
  return {
    placement,
    height: Math.min(naturalHeight, availableSpace),
    maxHeight: availableSpace,
  };
}

function createElement<Name extends keyof HTMLElementTagNameMap>(
  document: Document,
  name: Name,
  className: string,
  text?: string,
): HTMLElementTagNameMap[Name] {
  const element = document.createElement(name);
  element.className = className;
  if (text !== undefined) {
    element.textContent = text;
  }
  return element;
}

/** Create the tooltip DOM and the operations that update its states. */
export function createTooltipView(document: Document, options: TooltipViewOptions): TooltipView {
  const root = createElement(document, "div", rootClassName);
  root.id = options.id;
  root.setAttribute("role", "tooltip");
  // The tooltip can live inside the mounted root; keep its own text from being linked.
  root.setAttribute("data-bible-references-ignore", "");
  root.dataset.brTheme = "light";
  root.dataset.brPlacement = "bottom";
  root.hidden = true;
  // Manual popovers render in the top layer, above modal dialogs and any z-index.
  const usesPopover = typeof root.showPopover === "function";
  if (usesPopover) {
    root.setAttribute("popover", "manual");
  }
  // The browser is the source of truth: a manual popover does not react to its dialog closing,
  // so the tracked flag can go stale. Fall back to the flag where :popover-open is unsupported.
  let popoverOpen = false;
  const isPopoverOpen = (): boolean => {
    try {
      return root.matches(":popover-open");
    } catch {
      return popoverOpen;
    }
  };

  const card = createElement(document, "div", cardClassName);
  const header = createElement(document, "div", headerClassName);
  const title = createElement(document, "strong", titleClassName);
  header.append(title);

  if (options.translation) {
    header.append(
      createElement(document, "span", badgeClassName, options.translation.abbreviation),
    );
  }

  const body = createElement(document, "div", bodyClassName);
  body.tabIndex = 0;
  body.setAttribute("aria-label", "Passagem");

  const footer = createElement(document, "div", footerClassName);
  const link = createElement(document, "a", linkClassName);
  const note = createElement(document, "span", noteClassName);
  if (options.openIn === "new-tab") {
    link.target = "_blank";
    link.rel = "noopener noreferrer";
  }
  footer.append(link, note);

  card.append(header, body, footer);
  root.append(card, createElement(document, "span", arrowClassName));

  function setState(state: "loading" | "ready" | "error"): void {
    root.dataset.brState = state;
    root.setAttribute("aria-busy", String(state === "loading"));
  }

  function setFooter(
    reference: BibleReference,
    label: { readonly verb: string; readonly fallback: string },
    noteText: string,
  ): void {
    const { source } = options;
    link.replaceChildren();
    link.href = source ? source.getUrl(reference) : options.getFallbackHref(reference);

    if (source) {
      const icon = createElement(document, "span", iconClassName);
      icon.dataset.brSource = source.id;
      icon.setAttribute("aria-hidden", "true");
      link.append(icon, `${label.verb} ${source.name} →`);
    } else {
      link.append(`${label.fallback} →`);
    }

    note.textContent = noteText;
  }

  const translationName = options.translation?.name ?? "";

  return {
    element: root,
    body,

    showLoading(reference) {
      setState("loading");
      title.textContent = formatBibleReference(reference);
      body.replaceChildren(
        ...SKELETON_WIDTHS.map((width) =>
          createElement(document, "span", clsx(skeletonClassName, width)),
        ),
      );
      body.scrollTop = 0;
      setFooter(reference, { verb: "Ler em", fallback: "Ler passagem" }, "Carregando passagem…");
    },

    showPassage(passage, reference) {
      setState("ready");
      const numbered = passage.verses.length > 1;

      body.replaceChildren(
        ...passage.verses.map((verse) => {
          const element = createElement(document, "span", verseClassName);
          if (numbered) {
            element.append(
              createElement(document, "sup", verseNumberClassName, String(verse.number)),
              " ",
            );
          }
          element.append(verse.text);
          return element;
        }),
      );

      setFooter(reference, { verb: "Ler em", fallback: "Ler passagem" }, translationName);
    },

    showError(reference, onRetry) {
      setState("error");
      const message = createElement(document, "div", messageClassName);
      const retry = createElement(document, "button", retryClassName, "Tentar de novo");
      retry.type = "button";
      retry.addEventListener("click", onRetry);
      message.append(
        createElement(
          document,
          "span",
          "br-tooltip-error",
          "Não foi possível carregar a passagem.",
        ),
        retry,
      );
      body.replaceChildren(message);
      setFooter(reference, { verb: "Abrir em", fallback: "Abrir passagem" }, translationName);
    },

    open() {
      root.hidden = false;
      if (usesPopover && !isPopoverOpen()) {
        try {
          root.showPopover();
          popoverOpen = true;
        } catch {
          // Not connected or not allowed; the tooltip still works as a fixed element.
        }
      }
    },

    close() {
      if (usesPopover && (popoverOpen || isPopoverOpen())) {
        try {
          root.hidePopover();
        } catch {
          // Already hidden or disconnected.
        }
      }
      popoverOpen = false;
      card.style.maxHeight = "";
      root.hidden = true;
    },

    setTheme(theme) {
      root.dataset.brTheme = theme;
    },

    place(anchor) {
      card.style.maxHeight = "";
      // A transformed ancestor becomes the containing block of fixed elements and scales their
      // coordinates and size. Measure where the origin lands and how much the ancestor scales,
      // constrain the size in the tooltip's own units, then convert the viewport coordinates into
      // that space. Translation and scale are supported; rotation and skew are not.
      root.style.top = "0px";
      root.style.left = "0px";
      const origin = root.getBoundingClientRect();
      const scaleX = root.offsetWidth > 0 ? origin.width / root.offsetWidth : 1;
      const scaleY = root.offsetHeight > 0 ? origin.height / root.offsetHeight : 1;
      root.style.setProperty("--br-scale-x", String(scaleX));
      root.style.setProperty("--br-scale-y", String(scaleY));

      const rect = anchor.getBoundingClientRect();
      const viewportWidth =
        document.documentElement.clientWidth || document.defaultView?.innerWidth || 1024;
      const viewportHeight =
        document.documentElement.clientHeight || document.defaultView?.innerHeight || 768;
      const { width, height: naturalHeight } = root.getBoundingClientRect();

      const spaceBelow = viewportHeight - rect.bottom - ANCHOR_GAP - VIEWPORT_MARGIN;
      const spaceAbove = rect.top - ANCHOR_GAP - VIEWPORT_MARGIN;
      const layout = resolvePlacement(spaceBelow, spaceAbove, naturalHeight);

      if (layout.maxHeight !== undefined) {
        card.style.maxHeight = `${layout.maxHeight / scaleY}px`;
      }

      const preferredTop =
        layout.placement === "bottom"
          ? rect.bottom + ANCHOR_GAP
          : rect.top - ANCHOR_GAP - layout.height;
      const top = clamp(
        preferredTop,
        VIEWPORT_MARGIN,
        viewportHeight - layout.height - VIEWPORT_MARGIN,
      );

      const anchorCenter = rect.left + rect.width / 2;
      const left = clamp(
        anchorCenter - width / 2,
        VIEWPORT_MARGIN,
        viewportWidth - width - VIEWPORT_MARGIN,
      );

      root.dataset.brPlacement = layout.placement;
      root.style.top = `${(top - origin.top) / scaleY}px`;
      root.style.left = `${(left - origin.left) / scaleX}px`;
      root.style.setProperty(
        "--br-arrow-x",
        `${clamp(anchorCenter - left, ARROW_INSET, width - ARROW_INSET) / scaleX}px`,
      );
    },
  };
}
