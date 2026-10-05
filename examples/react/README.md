# Exemplo React

App React (Vite) que usa o `BibleReferencesProvider` da biblioteca deste repositório (`../..`), não o pacote publicado.

## Uso

```sh
bun install
bun run dev
bun run build
```

`dev` e `build` primeiro rodam o build da biblioteca na raiz (`../../dist`), e o `vite.config.js` aponta `@coisasdoalto/bible-references` (e o subpath `/react`) para esse build. Não há autenticação do GitHub Packages nem `NODE_AUTH_TOKEN`: o pacote publicado não é usado.

As dependências da raiz precisam estar instaladas (`bun install` na raiz), porque o build da biblioteca roda lá. Depois de mudar o código em `src`, rode `bun run dev` de novo para refazer o build.

O `vite.config.js` também declara `resolve.dedupe` para `react` e `react-dom`: como a biblioteca fica fora deste diretório, sem isso ela resolveria o React da raiz e o app teria duas cópias.

Para testar no celular, use `bun run dev -- --host`.

## O que o exemplo mostra

Cada seção coloca um `BibleReferencesProvider` só em volta do texto bíblico. O parágrafo de introdução, fora de qualquer provider, não vira link.

- **Texto estático:** o provider liga as referências do texto que ele envolve.
- **Texto que muda:** o texto vem de um estado e muda enquanto você digita, sem `key`. A biblioteca refaz os links a cada atualização.
- **Conteúdo que chega depois:** simula uma resposta de API; o texto novo é ligado quando aparece.
- **Só em parte do conteúdo:** a prop `selector` restringe a busca a `.bible`.
- **Dentro de um modal:** num `<dialog>` modal, o tooltip anexado ao `body` aparece acima do modal (a biblioteca usa a camada superior do navegador, via Popover API), mas o navegador bloqueia o ponteiro nele. A prop `container`, com o `ref` do diálogo, anexa o tooltip dentro do modal e resolve isso; a caixa de seleção alterna os dois casos.

O `StrictMode` está ligado em `src/main.jsx` para garantir que montar e desmontar o provider é idempotente.
