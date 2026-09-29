# AGENTS.md

## Project

`@coisasdoalto/bible-references` is a browser-first TypeScript library that will detect Bible references in text, turn them into links, and optionally render passage previews in tooltips. Vanilla HTML/DOM support comes first; React support will be an adapter over the same core parser and normalized reference model.

The repository is currently in infrastructure/bootstrap phase. Do not invent the final parser or public API unless the task explicitly asks for it.

## Toolchain

Use the versions and commands declared by mise. Do not require contributors to install project tools globally.

- TypeScript
- Vite Library Mode
- Bun
- Vitest
- Biome
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

## Package management

Use Bun for JavaScript package management. Keep dependency versions exact. Commit `bun.lock` after dependency changes once it has been generated locally.

Do not add npm, pnpm, or Yarn lockfiles.

## Styling

Tailwind CSS v4 is a build-time implementation detail. Consumers must receive ordinary static CSS and must not be required to install or configure Tailwind.

Use `@tailwindcss/vite` for Tailwind integration. Vite is responsible for final CSS optimization/minification with Lightning CSS and emits the library stylesheet as `dist/style.css`.

Do not include Tailwind Preflight or another global reset in the distributed stylesheet. Library styles must not unexpectedly alter the host application's global styles.

Use `clsx/lite` for conditional class composition. Keep Tailwind class names complete and statically discoverable; do not construct class fragments with interpolation such as `bg-${color}-500`. Map variants to complete class strings instead.

The public customization contract should use stable CSS custom properties prefixed with `--br-`. Keep Tailwind utility classes an internal implementation detail.

Prefer scoped semantic hooks such as `br-*` classes or `data-br-*` attributes only when consumers need a stable selector. Do not expose generated or incidental utility-class combinations as public API.

The Tailwind stylesheet explicitly scans `src` and intentionally omits Preflight. Keep source detection narrow so the generated CSS contains only utilities used by this package.

VS Code configuration includes Tailwind IntelliSense support for classes inside `clsx(...)`.

## Architecture

Keep the core parser and normalized Bible-reference model independent from the DOM, tooltip implementation, network provider, and React.

Expected direction:

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

React must remain optional and should eventually be a peer dependency rather than bundled into the core package.

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

Package publishing to GitHub Packages must use the ephemeral GitHub Actions `GITHUB_TOKEN` with least-privilege `packages: write`. Do not introduce a long-lived PAT for publishing.

When npm publishing is added later, prefer npm Trusted Publishing/OIDC instead of a long-lived `NPM_TOKEN`.

## Releases

The package version in `package.json` must match a release tag in the form `v<version>`. The publish workflow validates this before publishing.

Do not publish from pull-request workflows.
