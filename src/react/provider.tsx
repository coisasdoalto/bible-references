import { type ReactNode, type RefObject, useEffect, useMemo, useState } from "react";

import { createPreviewController, type PreviewController } from "../browser/preview";
import { type GetHref, resolveGetHref } from "../browser/reference-link";
import type { LinkOpenIn, TooltipTheme } from "../browser/tooltip";
import type { PassageProvider } from "../core/types";
import { createBibliasAppPassageProvider } from "../providers/biblias.app";
import { BibleReferencesContext } from "./context";

export interface BibleReferencesProviderProps {
  /** Source of the passages. Keep it stable (module scope or useMemo). Defaults to biblias.app. */
  readonly provider?: PassageProvider;
  readonly getHref?: GetHref;
  readonly preview?: boolean;
  readonly theme?: TooltipTheme;
  /**
   * Element (or ref to one) that receives the tooltip. Defaults to the document body. Use an
   * element inside a modal or popover so hover and taps on the tooltip count as inside it.
   */
  readonly container?: HTMLElement | RefObject<HTMLElement | null> | null;
  /** Where the tooltip footer link opens. Defaults to "new-tab". */
  readonly openIn?: LinkOpenIn;
  readonly children?: ReactNode;
}

function resolveContainer(
  container: BibleReferencesProviderProps["container"],
): HTMLElement | undefined {
  if (!container) {
    return undefined;
  }
  const element = "current" in container ? container.current : container;
  return element ?? undefined;
}

/** Shared tooltip and settings for the reference links below it. Example: <BibleReferencesProvider>. */
export function BibleReferencesProvider({
  provider,
  getHref,
  preview = true,
  theme = "auto",
  container,
  openIn = "new-tab",
  children,
}: BibleReferencesProviderProps) {
  const [controller, setController] = useState<PreviewController | null>(null);
  const resolvedGetHref = useMemo(() => resolveGetHref(provider, getHref), [provider, getHref]);

  useEffect(() => {
    const element = resolveContainer(container);
    const next = createPreviewController({
      document: element?.ownerDocument ?? document,
      provider: provider ?? createBibliasAppPassageProvider(),
      getHref: resolvedGetHref,
      preview,
      theme,
      container: element,
      openIn,
    });
    setController(next);

    return () => {
      next.destroy();
      setController(null);
    };
  }, [provider, resolvedGetHref, preview, theme, container, openIn]);

  const value = useMemo(
    () => ({ controller, getHref: resolvedGetHref }),
    [controller, resolvedGetHref],
  );

  return (
    <BibleReferencesContext.Provider value={value}>{children}</BibleReferencesContext.Provider>
  );
}
