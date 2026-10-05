import {
  type ComponentPropsWithoutRef,
  createElement,
  type ElementType,
  type ReactNode,
  type RefObject,
  useEffect,
  useReducer,
  useRef,
  useState,
} from "react";

import { mountBibleReferences } from "../browser/mount";
import type { GetHref } from "../browser/reference-link";
import type { LinkOpenIn, TooltipTheme } from "../browser/tooltip";
import type { PassageProvider } from "../core/types";

export interface BibleReferencesProviderProps
  extends Omit<ComponentPropsWithoutRef<"div">, "children"> {
  /** Source of the passages. Keep it stable (module scope or useMemo). Defaults to biblias.app. */
  readonly provider?: PassageProvider;
  /** Keep it stable (module scope or useCallback). */
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
  /** CSS selector of the elements to search inside the provider. Defaults to all of its content. */
  readonly selector?: string;
  /** Tag of the wrapper element. Defaults to "div". */
  readonly as?: ElementType;
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

/**
 * Link the Bible references in everything it renders, including content that changes later.
 * Example: <BibleReferencesProvider><Article /></BibleReferencesProvider>.
 *
 * It wraps its children in an element with `display: contents` and runs `mountBibleReferences`
 * on it in the browser, so there are no links in server-rendered HTML.
 */
export function BibleReferencesProvider({
  provider,
  getHref,
  preview = true,
  theme = "auto",
  container,
  openIn = "new-tab",
  selector,
  as = "div",
  style,
  children,
  ...elementProps
}: BibleReferencesProviderProps) {
  // The wrapper element is state, not a ref object, so a new element (a different `as`) remounts.
  const [wrapper, setWrapper] = useState<HTMLElement | null>(null);
  const mountedContainer = useRef<HTMLElement | undefined>(undefined);
  const [containerVersion, containerChanged] = useReducer((version: number) => version + 1, 0);

  // biome-ignore lint/correctness/useExhaustiveDependencies: containerVersion remounts when a container ref points to another element.
  useEffect(() => {
    if (!wrapper) {
      return;
    }

    const tooltipContainer = resolveContainer(container);
    mountedContainer.current = tooltipContainer;
    const handle = mountBibleReferences(wrapper, {
      ...(provider && { provider }),
      ...(getHref && { getHref }),
      ...(selector !== undefined && { selector }),
      ...(tooltipContainer && { container: tooltipContainer }),
      preview,
      theme,
      openIn,
      observe: true,
    });

    return () => handle.destroy();
  }, [wrapper, provider, getHref, preview, theme, container, openIn, selector, containerVersion]);

  // A ref keeps its identity when its element changes (a modal that mounts later), so compare the
  // element after every render and remount the tooltip when it is not the one in use.
  useEffect(() => {
    if (resolveContainer(container) !== mountedContainer.current) {
      containerChanged();
    }
  });

  return createElement(
    as,
    { ...elementProps, ref: setWrapper, style: { display: "contents", ...style } },
    children,
  );
}
