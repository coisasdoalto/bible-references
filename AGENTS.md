# AGENTS.md

## Project

`@coisasdoalto/bible-references` is a browser-first TypeScript library that detects Bible references in text, turns them into links, and optionally renders passage previews in tooltips. React support is a thin wrapper over the DOM integration (`src/react`, exported as `@coisasdoalto/bible-references/react`): `BibleReferencesProvider` renders a `display: contents` element and runs `mountBibleReferences` on it with `observe`.

The library includes a PT-BR parser, normalized reference model, DOM integration, tooltip previews, and a biblias.app HTTP provider using the ACF translation.

## Writing agent instructions

Describe the project's current behavior and enduring constraints in the present tense. Include instructions that help agents make decisions or perform recurring work.

Keep development history, migration narratives, one-off setup history, and future plans out of this file. Preserve setup and automation details that affect an agent's work, such as hooks changing staged files or temporarily stashing unstaged changes. Omit implementation details or automated checks that do not help agents choose an action or avoid a mistake. Document the required outcome rather than how the project arrived at it, and update existing instructions when decisions change.

## Toolchain

Use the versions and commands declared by mise. Do not require contributors to install project tools globally.

- TypeScript
- Vite Library Mode
- Bun
- Vitest
- Biome
- Prettier
- hk
- Tailwind CSS
- clsx
- Lightning CSS
- actionlint
- pinact

Run project commands through mise when possible:

```sh
mise install
mise run setup
mise run check
mise run test
mise run build
mise run fix
```

GitHub Actions must call mise tasks rather than duplicate build, lint, test, or publish commands in workflow YAML.

### mise tasks

Keep short, readable commands directly in `mise.toml`.

When a task grows beyond a simple command or task composition — for example it contains multi-line logic, branching, validation, or becomes difficult to read inline — implement it as an executable file task under `.mise/tasks`.

Use subdirectories to preserve grouped task names. For example:

```text
.mise/tasks/release/verify -> release:verify
```

Keep a matching metadata entry in `mise.toml` even for file tasks:

```toml
[tasks."release:verify"]
description = "Verify release metadata"
```

Do not add `run` or `file` to that metadata-only entry unless intentionally overriding the discovered file task. This keeps task discovery and implementation in `.mise/tasks` while preserving descriptions, dependencies, environment, and other high-level metadata in `mise.toml`.

Prefer human-readable scripts with clear failures and useful output. File tasks must be executable on Unix.

### Supporting scripts

Use `scripts/` for TypeScript tooling such as package validation and release checks. Run these files directly with Node's native TypeScript support, using `node:` imports and types that do not require compilation. Keep them included in the project's typecheck.

Keep mise tasks as the public command interface. Short commands stay in `mise.toml`; shell orchestration and temporary-directory cleanup belong in `.mise/tasks/`. Put JavaScript/TypeScript logic in `scripts/` rather than embedding it in shell scripts or task definitions.

## Package management

Use Bun for JavaScript package management. Keep dependency versions exact. Commit `bun.lock` after dependency changes once it has been generated locally.

Do not add npm, pnpm, or Yarn lockfiles.

## Formatting

The hk pre-commit hook formats staged files, stages formatter changes, and stashes unstaged work while the hook runs.

Use Biome for TypeScript/JavaScript and JSON/JSONC formatting and linting. Use Prettier only for Markdown, HTML, and YAML so the two formatters do not overlap.

Prettier is installed as an exact-version mise tool rather than a package dependency. Keep its project defaults in `.prettierrc.json`.

Do not bypass formatting failures by disabling hooks. Use `mise run fix` when formatting or safe automatic fixes are needed across the working tree.

## Styling

Tailwind CSS v4 is a build-time implementation detail. Consumers must receive ordinary static CSS and must not be required to install or configure Tailwind.

Use `@tailwindcss/vite` for Tailwind integration. Vite is responsible for final CSS optimization/minification with Lightning CSS and emits the library stylesheet as `dist/style.css`.

Do not include Tailwind Preflight or another global reset in the distributed stylesheet. Library styles must not unexpectedly alter the host application's global styles.

Use `clsx/lite` for conditional class composition. Keep Tailwind class names complete and statically discoverable; do not construct class fragments with interpolation such as `bg-${color}-500`. Map variants to complete class strings instead.

The public customization contract should use stable CSS custom properties prefixed with `--br-`. Keep Tailwind utility classes an internal implementation detail.

Write every utility class with the `br:` prefix (`br:flex`, `br:focus-visible:outline-2`); the stylesheet imports the theme with `prefix(br) theme(inline)`, so unprefixed utilities are not generated and theme values are inlined instead of set on `:root`. Hand-written classes use the `br-` prefix. This keeps the stylesheet from clashing with a host's own utilities or theme variables, including hosts that also use Tailwind. `package:check` rejects a published stylesheet with any other class or a `:root` selector.

Prefer scoped semantic hooks such as `br-*` classes or `data-br-*` attributes only when consumers need a stable selector. Do not expose generated or incidental utility-class combinations as public API.

The Tailwind stylesheet explicitly scans `src` and intentionally omits Preflight. Keep source detection narrow so the generated CSS contains only utilities used by this package.

## Architecture

Keep the core parser and normalized Bible-reference model independent from the DOM, tooltip implementation, network provider, and React.

Module responsibilities:

```text
core
  parser
  normalization
  book metadata
  types

browser
  DOM traversal
  link rendering
  tooltip integration
  observation of dynamic content

react
  React-specific adapter/components
```

Keep React as an optional peer dependency and external to the library bundle.

For DOM integration, do not rewrite container `innerHTML` to inject references. Operate on text nodes so existing DOM state, event listeners, and framework ownership are preserved.

## Quality

Add focused tests for every parser rule and regression. Browser behavior should be tested against DOM fixtures. Keep public exports deliberate and small.

Before finishing a code change, run:

```sh
mise run check
```

## Security and CI

Never commit tokens, credentials, registry passwords, private keys, or generated auth files.

CI for pull requests must remain read-only and must not expose publishing credentials. Do not use `pull_request_target` for untrusted code.

Third-party GitHub Actions must be pinned to a full commit SHA and retain a version comment. `pinact` enforces this.

## Releases

Package releases are published to npm by the GitHub Actions release workflow.

The package version in `package.json` must match a release tag in the form `v<version>`. The publish workflow validates this before publishing.

Do not publish from pull-request workflows.
