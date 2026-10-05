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
const SKELETON_WIDTHS = ["w-full", "w-11/12", "w-full", "w-3/5"];

const rootClassName = clsx("br-tooltip", "fixed z-[2147483647] text-sm leading-relaxed");
const cardClassName = clsx("br-tooltip-card", "flex flex-col overflow-hidden");
const headerClassName = clsx(
  "br-tooltip-header",
  "flex shrink-0 items-center justify-between gap-3 px-3.5 py-2.5",
);
const titleClassName = clsx("br-tooltip-title", "min-w-0 text-base font-bold break-words");
const badgeClassName = clsx(
  "br-tooltip-badge",
  "rounded-sm px-1.5 text-xs font-bold tracking-wide",
);
const bodyClassName = clsx("br-tooltip-body", "min-h-0 flex-1 overflow-y-auto px-4 pt-3.5");
const verseClassName = clsx("br-verse", "mb-2 block");
const verseNumberClassName = clsx("br-verse-number", "mr-0.5 align-super text-[0.7em] font-bold");
const skeletonClassName = clsx("br-skeleton", "mb-3 block h-3 rounded-full");
const messageClassName = clsx("br-tooltip-message", "flex flex-col items-start gap-3");
const retryClassName = clsx(
  "br-tooltip-retry",
  "min-h-9 cursor-pointer rounded-lg border px-4 text-sm font-semibold",
);
const footerClassName = clsx(
  "br-tooltip-footer",
  "flex shrink-0 items-center justify-between gap-3 px-3.5 py-2.5",
);
const linkClassName = clsx(
  "br-tooltip-link",
  "inline-flex shrink-0 items-center gap-2 font-semibold whitespace-nowrap",
);
const iconClassName = clsx("br-tooltip-icon", "block size-[1.125rem] shrink-0 rounded-[0.25rem]");
const noteClassName = clsx("br-tooltip-note", "text-xs");
const arrowClassName = clsx("br-tooltip-arrow", "absolute size-3 rotate-45");

function clamp(value: number, min: number, max: number): number {
  return Math.max(min, Math.min(value, Math.max(min, max)));
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
  let popoverOpen = false;

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
      if (usesPopover && !popoverOpen) {
        popoverOpen = true;
        root.showPopover();
      }
    },

    close() {
      if (usesPopover && popoverOpen) {
        popoverOpen = false;
        root.hidePopover();
      }
      root.hidden = true;
    },

    setTheme(theme) {
      root.dataset.brTheme = theme;
    },

    place(anchor) {
      const rect = anchor.getBoundingClientRect();
      const viewportWidth =
        document.documentElement.clientWidth || document.defaultView?.innerWidth || 1024;
      const viewportHeight =
        document.documentElement.clientHeight || document.defaultView?.innerHeight || 768;
      const { width, height } = root.getBoundingClientRect();

      const spaceBelow = viewportHeight - rect.bottom - ANCHOR_GAP - VIEWPORT_MARGIN;
      const spaceAbove = rect.top - ANCHOR_GAP - VIEWPORT_MARGIN;
      const placement = spaceBelow >= height || spaceBelow >= spaceAbove ? "bottom" : "top";

      const preferredTop =
        placement === "bottom" ? rect.bottom + ANCHOR_GAP : rect.top - ANCHOR_GAP - height;
      const top = clamp(preferredTop, VIEWPORT_MARGIN, viewportHeight - height - VIEWPORT_MARGIN);

      const anchorCenter = rect.left + rect.width / 2;
      const left = clamp(
        anchorCenter - width / 2,
        VIEWPORT_MARGIN,
        viewportWidth - width - VIEWPORT_MARGIN,
      );

      root.dataset.brPlacement = placement;

      // A transformed ancestor becomes the containing block of fixed elements and scales their
      // coordinates. Measure where the origin lands and how much the ancestor scales, then
      // convert the viewport coordinates into the tooltip's own coordinate space. Translation
      // and scale are supported; rotation and skew are not.
      root.style.top = "0px";
      root.style.left = "0px";
      const origin = root.getBoundingClientRect();
      const scaleX = root.offsetWidth > 0 ? origin.width / root.offsetWidth : 1;
      const scaleY = root.offsetHeight > 0 ? origin.height / root.offsetHeight : 1;

      root.style.top = `${(top - origin.top) / scaleY}px`;
      root.style.left = `${(left - origin.left) / scaleX}px`;
      root.style.setProperty(
        "--br-arrow-x",
        `${clamp(anchorCenter - left, ARROW_INSET, width - ARROW_INSET) / scaleX}px`,
      );
    },
  };
}
