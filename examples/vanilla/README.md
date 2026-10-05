# Exemplo vanilla

Página HTML simples que usa `@coisasdoalto/bible-references` publicado no GitHub Packages.

## Instalação

O GitHub Packages exige autenticação. Com o GitHub CLI logado, conceda ao token a permissão `read:packages` (uma vez) e instale as dependências:

```sh
gh auth refresh -s read:packages
NODE_AUTH_TOKEN=$(gh auth token) bun install
```

O `.npmrc` deste diretório aponta o escopo `@coisasdoalto` para o registry do GitHub e lê o token da variável `NODE_AUTH_TOKEN`. Não commite o token.

## Uso

```sh
bun run dev          # usa a versão publicada
bun run dev:local    # usa o build local da biblioteca (../../dist)
bun run build
```

Para testar no celular, use `bun run dev -- --host`.
