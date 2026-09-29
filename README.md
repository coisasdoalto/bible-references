# Bible References

A small web library for detecting Bible references in text, turning them into links, and optionally showing the referenced passage in a tooltip.

The project is being designed for framework-agnostic HTML first, with dedicated React integration planned on top of the same parser and core model.

## Status

Early planning and infrastructure bootstrap. The public API and Bible-reference parser are not implemented yet.

## Toolchain

- TypeScript
- Vite Library Mode
- Bun
- mise
- Vitest
- Biome
- hk
- GitHub Actions
- GitHub Packages first; npm later

## Development

Install the project toolchain and dependencies:

```sh
mise install
mise run setup
```

Useful commands:

```sh
mise run dev
mise run check
mise run test
mise run build
mise run fix
```

All CI entry points are exposed as mise tasks so local development and GitHub Actions execute the same commands.

## Package

The package scope is reserved as:

```text
@coisasdoalto/bible-references
```

Initial releases will target GitHub Packages. npm publishing will be enabled later after the organization is created there.

## License

MIT
