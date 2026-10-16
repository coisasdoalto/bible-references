import { readFile } from "node:fs/promises";

interface ReleaseManifest {
  readonly version: string;
}

const manifest: ReleaseManifest = JSON.parse(await readFile("package.json", "utf8"));
const expected = `v${manifest.version}`;
const actual = process.env.RELEASE_TAG;

if (!actual || actual !== expected) {
  console.error(`Release tag ${actual ?? "<missing>"} does not match package version ${expected}`);
  process.exit(1);
}
