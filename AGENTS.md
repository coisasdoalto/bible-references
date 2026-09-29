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

## Package management

Use Bun for JavaScript package management. Keep dependency versions exact. Commit `bun.lock` after dependency changes once it has been generated locally.

Do not add npm, pnpm, or Yarn lockfiles.

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
