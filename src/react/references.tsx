import { cloneElement, isValidElement, type ReactNode } from "react";

import { parseBibleReferences } from "../core/parser";
import { BibleReferenceLink } from "./link";

const IGNORED_TAGS = new Set([
  "script",
  "style",
  "code",
  "pre",
  "textarea",
  "input",
  "select",
  "option",
  "a",
  "button",
]);

function linkString(text: string): ReactNode {
  const references = parseBibleReferences(text);
  if (references.length === 0) {
    return text;
  }

  const parts: ReactNode[] = [];
  let cursor = 0;
  references.forEach((reference) => {
    if (reference.start > cursor) {
      parts.push(text.slice(cursor, reference.start));
    }
    parts.push(<BibleReferenceLink key={reference.start} reference={reference} />);
    cursor = reference.end;
  });
  if (cursor < text.length) {
    parts.push(text.slice(cursor));
  }
  return parts;
}

function linkNode(node: ReactNode): ReactNode {
  if (typeof node === "string") {
    return linkString(node);
  }
  if (Array.isArray(node)) {
    return node.map(linkNode);
  }
  if (!isValidElement<{ children?: ReactNode }>(node)) {
    return node;
  }
  if (typeof node.type === "string" && IGNORED_TAGS.has(node.type)) {
    return node;
  }
  if ("data-bible-references-ignore" in (node.props as object)) {
    return node;
  }
  const { children } = node.props;
  return children == null ? node : cloneElement(node, undefined, linkNode(children));
}

/**
 * Link the references in the text of its children, at any depth, skipping code, links, buttons and
 * form controls. Example: <BibleReferences>Veja João 3:16.</BibleReferences>.
 */
export function BibleReferences({ children }: { readonly children?: ReactNode }) {
  return <>{linkNode(children)}</>;
}
