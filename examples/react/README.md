# Exemplo React

App React (Vite) que usa `@coisasdoalto/bible-references` publicado no GitHub Packages. Ele serve para testar o uso da biblioteca em projetos React enquanto não existe um adaptador dedicado.

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

> A seção "Dentro de um modal" usa a opção `container`, que existe a partir da versão `0.2.0`. Com uma versão anterior instalada, use `bun run dev:local`.

Para testar no celular, use `bun run dev -- --host`.

## O que o exemplo mostra

- **Texto estático:** `LinkedText` monta a biblioteca em um elemento com `useEffect` e a destrói na limpeza. O `StrictMode` (que monta, desmonta e monta de novo) está ligado para garantir que isso é idempotente.
- **Texto que muda:** a biblioteca troca nós de texto por links, então o React não pode atualizar o texto de um elemento já montado. Use `key={text}` para que o React crie um elemento novo quando o texto muda.
- **Dentro de um modal:** num `<dialog>` modal, o tooltip anexado ao `body` aparece acima do modal (a biblioteca usa a camada superior do navegador, via Popover API), mas o navegador bloqueia o ponteiro nele. A opção `container` anexa o tooltip dentro do modal e resolve isso; a caixa de seleção alterna os dois casos.
