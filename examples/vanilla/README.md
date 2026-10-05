# Exemplo vanilla

Página HTML simples que usa a biblioteca deste repositório (`../..`), não o pacote publicado.

## Uso

```sh
bun install
bun run dev
bun run build
```

`dev` e `build` primeiro rodam o build da biblioteca na raiz (`../../dist`), e o `vite.config.js` aponta `@coisasdoalto/bible-references` para esse build. Não há autenticação do GitHub Packages nem `NODE_AUTH_TOKEN`: o pacote publicado não é usado.

As dependências da raiz precisam estar instaladas (`bun install` na raiz), porque o build da biblioteca roda lá. Depois de mudar o código em `src`, rode `bun run dev` de novo para refazer o build.

Para testar no celular, use `bun run dev -- --host`.
