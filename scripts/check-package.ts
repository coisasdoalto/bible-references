import assert from "node:assert/strict";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import { join } from "node:path";

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

const temporaryRoot = process.argv[2];
assert(temporaryRoot, "Missing temporary directory; expected node check-package.ts <directory>");

const archives: readonly PackedArchive[] = JSON.parse(
  await readFile(join(temporaryRoot, "pack.json"), "utf8"),
);
const packed = archives[0];
assert(packed, `Invalid pack metadata ${JSON.stringify(archives)}; expected a nonempty array`);
const manifest: PackageManifest = JSON.parse(await readFile("package.json", "utf8"));
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
assert.equal(manifest.publishConfig.registry, "https://registry.npmjs.org/");
assert.equal(manifest.publishConfig.access, "public");
assert.equal(manifest.peerDependencies.react, ">=18");
assert.equal(manifest.peerDependenciesMeta.react.optional, true);
assert.deepEqual(manifest.sideEffects, ["**/*.css"]);
assert.match(await readFile("dist/react.js", "utf8"), /from ["']react["']/);

// The stylesheet runs inside host pages: every class must be namespaced and nothing may target
// :root, so it cannot clash with the host's own utilities or theme variables.
const stylesheet = await readFile(manifest.style, "utf8");
// Keep only selectors: attribute values and declarations may contain dots that are not classes.
const selectors = stylesheet
  .replace(/\/\*[\s\S]*?\*\//g, "")
  .replace(/\{[^{}]*\}/g, "{}")
  .replace(/(?<!\\)\[[^\]]*\]/g, "");
const unscopedClasses = [...selectors.matchAll(/\.((?:\\.|[\w-])+)/g)]
  .map(([, className = ""]) => className)
  .filter((className) => !/^br(-|\\:)/.test(className));
assert.deepEqual(
  [...new Set(unscopedClasses)],
  [],
  "Stylesheet has classes without the br- or br: prefix",
);
assert.doesNotMatch(selectors, /:root|:host/, "Stylesheet must not target :root or :host");

for (const flavor of ["vanilla", "react"] as const) {
  const consumer = join(temporaryRoot, flavor);
  await mkdir(consumer);
  const dependencies: Record<string, string> = {
    [manifest.name]: `file:${join(temporaryRoot, packed.filename)}`,
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
console.log(`Validated ${packed.files.length} packaged files (${packed.size} bytes).`);
