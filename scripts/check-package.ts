import assert from "node:assert/strict";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import { join, resolve } from "node:path";
import { fileURLToPath } from "node:url";

export interface ParsedPropertyRule {
  readonly type: "property";
  readonly header: string;
  readonly body: string;
}

export interface ParsedStyleRule {
  readonly type: "style";
  readonly selector: string;
  readonly body: string;
}

export interface ParsedAtRule {
  readonly type: "at-rule";
  readonly header: string;
  readonly rules: readonly ParsedRule[];
  readonly body: string;
}

export type ParsedRule = ParsedPropertyRule | ParsedStyleRule | ParsedAtRule;

interface PackedArchive {
  readonly filename: string;
  readonly size: number;
  readonly files: readonly { readonly path: string }[];
}

interface PackageManifest {
  readonly name: string;
  readonly main: string;
  readonly types: string;
  readonly style: string;
  readonly exports: Readonly<Record<string, string | Readonly<Record<string, string>>>>;
  readonly publishConfig: { readonly registry: string; readonly access: string };
  readonly peerDependencies: { readonly react: string };
  readonly peerDependenciesMeta: { readonly react: { readonly optional: boolean } };
  readonly sideEffects: readonly string[];
  readonly devDependencies: Readonly<Record<"react" | "@types/react", string>>;
}

interface BlockSpan {
  readonly body: string;
  readonly nextIndex: number;
  readonly hasNestedBlocks: boolean;
}

interface ConsumerSmokeOptions {
  readonly flavor: "vanilla" | "react";
  readonly temporaryRoot: string;
  readonly manifest: PackageManifest;
  readonly archiveFilename: string;
}

const ALLOWED_UNIVERSAL_SELECTORS = new Set([
  "*",
  ":before",
  "::before",
  ":after",
  "::after",
  "::backdrop",
]);

function stripComments(css: string): string {
  return css.replace(/\/\*[\s\S]*?\*\//g, "");
}

function skipStringLiteral(css: string, startIndex: number, quote: string): number {
  let index = startIndex;
  while (index < css.length) {
    if (css[index] === "\\" && index + 1 < css.length) {
      index += 2;
      continue;
    }
    if (css[index++] === quote) break;
  }
  return index;
}

function findClosingBrace(css: string, startIndex: number): BlockSpan {
  let depth = 1;
  let index = startIndex;
  let hasNestedBlocks = false;
  while (index < css.length && depth > 0) {
    const char = css[index];
    if (char === '"' || char === "'") {
      index = skipStringLiteral(css, index + 1, char);
      continue;
    }
    if (char === "{") {
      depth++;
      hasNestedBlocks = true;
    } else if (char === "}") {
      depth--;
    }
    index++;
  }
  return { body: css.slice(startIndex, index - 1), nextIndex: index, hasNestedBlocks };
}

function createParsedRule(header: string, span: BlockSpan): ParsedRule {
  const trimmed = header.trim();
  if (trimmed.startsWith("@property")) {
    return { type: "property", header: trimmed, body: span.body };
  }
  if (trimmed.startsWith("@")) {
    const nested = span.hasNestedBlocks ? parseCssRules(span.body) : [];
    return { type: "at-rule", header: trimmed, rules: nested, body: span.body };
  }
  return { type: "style", selector: trimmed, body: span.body };
}

function parseCssRules(css: string): readonly ParsedRule[] {
  const rules: ParsedRule[] = [];
  let index = 0;
  let header = "";
  while (index < css.length) {
    const char = css[index++];
    if (char === ";") {
      header = "";
    } else if (char === "{") {
      const span = findClosingBrace(css, index);
      rules.push(createParsedRule(header, span));
      index = span.nextIndex;
      header = "";
    } else {
      header += char;
    }
  }
  return rules;
}

function flattenRules(
  rules: readonly ParsedRule[],
): readonly (ParsedPropertyRule | ParsedStyleRule)[] {
  const flat: (ParsedPropertyRule | ParsedStyleRule)[] = [];
  for (const rule of rules) {
    if (rule.type === "at-rule") {
      flat.push(...flattenRules(rule.rules));
    } else {
      flat.push(rule);
    }
  }
  return flat;
}

function stripBlockBodies(css: string): string {
  let stripped = css;
  while (stripped.includes("{")) {
    stripped = stripped.replace(/\{[^{}]*\}/g, "");
  }
  return stripped;
}

function validateScopedClasses(cleanCss: string): void {
  const selectors = stripBlockBodies(cleanCss).replace(/(?<!\\)\[[^\]]*\]/g, "");
  const unscopedClasses = [...selectors.matchAll(/\.((?:\\.|[\w-])+)/g)]
    .map(([, className = ""]) => className)
    .filter((className) => !/^br(-|\\:)/.test(className));
  assert.deepEqual(
    [...new Set(unscopedClasses)],
    [],
    `Stylesheet has classes without the br- or br: prefix: ${unscopedClasses.join(", ")}; expected all classes to start with br- or br:`,
  );
}

function validateNoRootOrHost(selector: string): void {
  assert.doesNotMatch(
    selector,
    /:root|:host/,
    `Stylesheet must not target :root or :host in selector "${selector}"; expected host-agnostic styling`,
  );
}

function validatePropertyRule(rule: ParsedPropertyRule): void {
  const propName = rule.header.replace(/^@property\s+/, "").trim();
  assert.match(
    propName,
    /^--tw-[\w-]+$/,
    `Disallowed @property rule "${rule.header}"; expected only --tw-* custom properties emitted by Tailwind`,
  );
}

function isUniversalSelector(selector: string): boolean {
  const parts = selector.split(",").map((s) => s.trim());
  return parts.some((part) => ALLOWED_UNIVERSAL_SELECTORS.has(part) || part.includes("*"));
}

function validateDeclaration(rule: ParsedStyleRule, decl: string): void {
  const colonIdx = decl.indexOf(":");
  const propName = (colonIdx === -1 ? decl : decl.slice(0, colonIdx)).trim();
  assert.match(
    propName,
    /^--tw-[\w-]+$/,
    `Universal selector "${rule.selector}" has disallowed declaration "${decl}"; expected only --tw-* custom properties`,
  );
}

function validateUniversalSelectorRule(rule: ParsedStyleRule): void {
  const parts = rule.selector.split(",").map((s) => s.trim());
  const invalidParts = parts.filter((part) => !ALLOWED_UNIVERSAL_SELECTORS.has(part));
  assert.deepEqual(
    invalidParts,
    [],
    `Disallowed universal selector "${rule.selector}" contains invalid part(s): ${invalidParts.join(", ")}; expected only *, :before, :after, ::backdrop`,
  );
  const declarations = rule.body
    .split(";")
    .map((d) => d.trim())
    .filter(Boolean);
  for (const decl of declarations) {
    validateDeclaration(rule, decl);
  }
}

function validateStyleRule(rule: ParsedStyleRule): void {
  validateNoRootOrHost(rule.selector);
  if (isUniversalSelector(rule.selector)) {
    validateUniversalSelectorRule(rule);
  }
}

/**
 * Validates that a published stylesheet adheres to isolation guardrails.
 *
 * Ensures all utility classes are namespaced (br: or br-), no rules target
 * :root or :host, @property rules only register internal --tw-* variables,
 * and universal selectors (*, :before, :after, ::backdrop) only set --tw-* fallbacks.
 *
 * @example
 * ```ts
 * validateStylesheet(".br-reference { color: red; }");
 * ```
 */
export function validateStylesheet(stylesheet: string): void {
  // The stylesheet runs inside host pages: every class must be namespaced, nothing may target
  // :root or :host, and universal rules are restricted to Tailwind's internal --tw-* properties.
  // Narrow exception: Tailwind v4 emits @property --tw-* definitions and universal fallback
  // selectors (*, :before, :after, ::backdrop in @layer properties) for custom properties.
  // These are allowed only when every declaration exclusively defines a --tw-* property.
  const clean = stripComments(stylesheet);
  const parsedRules = parseCssRules(clean);
  const flatRules = flattenRules(parsedRules);
  for (const rule of flatRules) {
    if (rule.type === "property") {
      validatePropertyRule(rule);
    } else {
      validateStyleRule(rule);
    }
  }
  validateScopedClasses(clean);
}

function validatePublishedFiles(manifest: PackageManifest, packed: PackedArchive): void {
  const publishedPaths = new Set(packed.files.map((entry) => entry.path));
  const requiredPaths = [manifest.main, manifest.types, manifest.style];
  for (const entry of Object.values(manifest.exports)) {
    requiredPaths.push(...(typeof entry === "string" ? [entry] : Object.values(entry)));
  }
  for (const required of requiredPaths) {
    assert(publishedPaths.has(required.replace(/^\.\//, "")), `Missing exported file: ${required}`);
  }
  for (const published of publishedPaths) {
    assert(
      published.startsWith("dist/") || ["package.json", "README.md", "LICENSE"].includes(published),
      `Unexpected published file: ${published}; expected dist/, package.json, README.md or LICENSE`,
    );
  }
}

function validatePackageManifest(manifest: PackageManifest): void {
  assert.equal(manifest.publishConfig.registry, "https://registry.npmjs.org/");
  assert.equal(manifest.publishConfig.access, "public");
  assert.equal(manifest.peerDependencies.react, ">=18");
  assert.equal(manifest.peerDependenciesMeta.react.optional, true);
  assert.deepEqual(manifest.sideEffects, ["**/*.css"]);
}

async function createConsumerSmokeFiles(options: ConsumerSmokeOptions): Promise<void> {
  const { flavor, temporaryRoot, manifest, archiveFilename } = options;
  const consumer = join(temporaryRoot, flavor);
  await mkdir(consumer);
  const dependencies: Record<string, string> = {
    [manifest.name]: `file:${join(temporaryRoot, archiveFilename)}`,
  };
  if (flavor === "react") {
    dependencies.react = manifest.devDependencies.react;
    dependencies["@types/react"] = manifest.devDependencies["@types/react"];
  }
  await writeFile(
    join(consumer, "package.json"),
    JSON.stringify({ private: true, type: "module", dependencies }),
  );
  const script =
    flavor === "vanilla"
      ? 'import { parseBibleReferences } from "@coisasdoalto/bible-references";\nif (parseBibleReferences("Jo 3:16").length !== 1) throw new Error("Expected one parsed reference");\n'
      : 'import { createElement } from "react";\nimport { BibleReferencesProvider } from "@coisasdoalto/bible-references/react";\ncreateElement(BibleReferencesProvider, { selector: ".bible" }, "Jo 3:16");\n';
  await writeFile(join(consumer, "smoke.ts"), script);
  await writeFile(
    join(consumer, "browser.ts"),
    `${script}import "@coisasdoalto/bible-references/style.css";\n`,
  );
  await writeFile(
    join(consumer, "index.html"),
    '<script type="module" src="/browser.ts"></script>',
  );
}

export async function runPackageCheck(temporaryRoot: string): Promise<void> {
  const archives: readonly PackedArchive[] = JSON.parse(
    await readFile(join(temporaryRoot, "pack.json"), "utf8"),
  );
  const packed = archives[0];
  assert(packed, `Invalid pack metadata ${JSON.stringify(archives)}; expected a nonempty array`);
  const manifest: PackageManifest = JSON.parse(await readFile("package.json", "utf8"));

  validatePublishedFiles(manifest, packed);
  validatePackageManifest(manifest);
  assert.match(await readFile("dist/react.js", "utf8"), /from ["']react["']/);

  const stylesheet = await readFile(manifest.style, "utf8");
  validateStylesheet(stylesheet);

  for (const flavor of ["vanilla", "react"] as const) {
    await createConsumerSmokeFiles({
      flavor,
      temporaryRoot,
      manifest,
      archiveFilename: packed.filename,
    });
  }
  console.log(`Validated ${packed.files.length} packaged files (${packed.size} bytes).`);
}

const isMain = process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url);
if (isMain) {
  const temporaryRoot = process.argv[2];
  assert(temporaryRoot, "Missing temporary directory; expected node check-package.ts <directory>");
  await runPackageCheck(temporaryRoot);
}
