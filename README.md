# Bible References

Uma pequena biblioteca web para detectar referências bíblicas em textos, transformá-las em links e, opcionalmente, exibir a passagem referenciada em um tooltip.

O projeto está sendo desenvolvido primeiro para HTML independente de framework, com uma integração para React que é um wrapper sobre a mesma camada DOM.

## Status

O primeiro MVP já está implementado. Ele inclui:

- parser de referências em português;
- nomes completos e abreviações dos 66 livros;
- referências no formato `livro capítulo`, `livro capítulo:versículo` e intervalos;
- `:` ou `.` como separador entre capítulo e versículo;
- transformação de text nodes em links sem reescrever `innerHTML`;
- tooltip por hover e foco;
- intervalos e listas de versículos (`Sl 119:1-20,29,32,34,37-40`) sem limite de versículos no preview;
- capítulos inteiros em tooltips com rolagem por mouse ou teclado;
- `selector` para buscar só em partes da página e `observe` para conteúdo dinâmico;
- integração com React (`@coisasdoalto/bible-references/react`), um wrapper sobre a camada DOM;
- provider HTTP para a API do biblias.app (tradução ACF);
- testes de parser, provider e DOM.

O tooltip mostra a referência e a tradução no cabeçalho, os versículos numerados em uma área com rolagem e um rodapé com o link "Ler em biblias.app". Ele tem estados de carregamento, erro (com "Tentar de novo") e passagem truncada, além de tema claro e escuro.

A API usada provisoriamente para os previews é:

```text
https://biblias.app/api/v1/bible/acf/passages
```

Por exemplo, `Rm 1:1-8` consulta:

```text
https://biblias.app/api/v1/bible/acf/passages/rm/1/1-8
```

A resposta atual da API contém os versículos em `data`:

```json
{
  "translation": "acf",
  "book": "rm",
  "chapter": 1,
  "verses": [1, 2],
  "data": [
    { "verse": 1, "text": "..." },
    { "verse": 2, "text": "..." }
  ]
}
```

## Uso

```ts
import { mountBibleReferences, parseBibleReferences } from "@coisasdoalto/bible-references";
import "@coisasdoalto/bible-references/style.css";

const references = parseBibleReferences("Leia Romanos 1:1-8 e João 3:16.");

const bibleReferences = mountBibleReferences(document.body, {
  // O href final do site ainda pode ser definido pelo consumidor.
  getHref(reference) {
    return `https://meu-site.example/${reference.bookId}/${reference.chapter}`;
  },
});

// Para varrer de novo manualmente (por exemplo, depois de mudar atributos):
bibleReferences.refresh();

// Remove listeners/tooltips e restaura o texto dos links criados:
bibleReferences.destroy();
```

#### Onde procurar e conteúdo dinâmico

Por padrão, a biblioteca lê todo o texto dentro do elemento informado. Com `selector`, só o texto dentro de elementos que casam com o seletor é lido, e o resto da página não é tocado:

```ts
mountBibleReferences(document.body, { selector: "article, .comment" });
```

O `selector` só restringe a busca dentro do elemento informado: um elemento que casa fora dele não conta. Um seletor inválido lança um erro no `mountBibleReferences`. Mudar os atributos de um elemento depois (por exemplo, adicionar uma classe) não o faz ser lido; chame `refresh()`.

Com `observe: true`, a biblioteca continua observando o elemento (`MutationObserver`) e liga as referências em conteúdo adicionado ou alterado depois, sem chamar `refresh()`. Ela também desfaz os links quando o conteúdo é removido ou reescrito por outro código. `observe` e `selector` combinam: elementos que casam e aparecem depois também são lidos.

```ts
const bibleReferences = mountBibleReferences(document.querySelector("#app")!, {
  selector: ".bible",
  observe: true,
});
```

Para ligar uma referência, o nó de texto original continua no DOM com o trecho antes da primeira referência, e os links e o restante do texto entram logo depois dele. Por isso um framework que mantém referência ao nó (React, por exemplo) pode atualizá-lo ou removê-lo sem erro, desde que `observe` esteja ligado: a biblioteca refaz os links a partir do novo texto. Sem `observe`, o texto novo só é lido em um `refresh()`.

O parser também aceita formas como:

```text
João 3:16
Jo 3:16
Jo. 3:16
Jo 3.16
1 Co 13:4
1Co 13:4
1 Coríntios 13:4-7
Sl 119:1-20,29,32,34,37-40
Sl 117
Salmos 119
```

Os versículos ficam em `verseRanges`: uma lista de `{ start, end }` ordenada, sem sobreposições (`37-40,1-20,10-25` vira `1-25` e `37-40`). Referências a capítulos inteiros têm `verseRanges` vazio. Em listas, vírgula seguida de espaço só continua a lista quando o número não começa outra referência ou uma palavra: `Jo 3:16, 1 Jo 4:8` são duas referências, e `Sl 119:1-20, 29` é uma só.

O preview não tem limite de versículos: o tooltip mostra toda a seleção, com rolagem. O provider busca capítulos inteiros e seleções com uma URL como `https://biblias.app/api/v1/bible/acf/passages/sl/119/1-20,29,32`.

A referência não navega ao ser clicada: clique ou toque abrem o tooltip (no desktop, hover e foco também abrem). O tooltip fecha ao rolar a página, ao tocar fora dele ou com `Escape`; rolar dentro do tooltip não o fecha.

O tooltip abre por foco apenas na navegação por teclado; um foco programático (por exemplo, o foco inicial de um `<dialog>`) não o abre. Ele permanece aberto enquanto o link ou o tooltip recebe hover ou foco.
Com o link focado, pressione `↓` para focar o tooltip e usar as teclas de rolagem;
`Escape` fecha o tooltip e devolve o foco ao link. A largura e a altura máximas podem ser
personalizadas com `--br-tooltip-width` e `--br-tooltip-max-height` (padrão: `24rem`), sempre limitadas à tela.

A camada DOM ignora referências dentro de `script`, `style`, `code`, `pre`, controles de formulário, links existentes, botões, conteúdo editável e elementos marcados com `data-bible-references-ignore`.

Quando `getHref` não é informado, o link aponta para a página de leitura do biblias.app, por exemplo `https://biblias.app/acf/rm/1/1-8`. O link do rodapé do tooltip sempre usa o `source` do provider.

### React

O adaptador React fica em um subpath do mesmo pacote. `react` (versão 18 ou superior) é uma dependência peer opcional: quem não usa React não precisa dele.

```tsx
import { BibleReferencesProvider } from "@coisasdoalto/bible-references/react";
import "@coisasdoalto/bible-references/style.css";

export function Article({ text }: { text: string }) {
  return (
    <BibleReferencesProvider>
      <p>{text}</p>
    </BibleReferencesProvider>
  );
}
```

O `BibleReferencesProvider` é um wrapper sobre o `mountBibleReferences` com `observe` ligado. Ele renderiza os filhos dentro de um elemento com `display: contents` e liga as referências de tudo que está dentro, inclusive texto que chega ou muda depois (resposta de API, estado). Não é preciso chamar nada em cada texto bíblico.

Coloque o provider só onde o app mostra texto bíblico. Quanto menor a região, menos a biblioteca precisa ler. Também é possível colocá-lo em volta do app inteiro, e `selector` restringe a busca (`<BibleReferencesProvider selector=".bible">`).

- Recebe as mesmas opções do `mountBibleReferences` (`provider`, `getHref`, `preview`, `theme`, `openIn`, `selector`). Mantenha `provider` e `getHref` estáveis (fora do componente, em `useMemo` ou `useCallback`): quando mudam, a instância é recriada.
- `container` aceita um elemento ou um `ref`, para anexar o tooltip dentro de um modal.
- `as` troca a tag do wrapper (`"div"` por padrão), e `className`, `style` e as demais props de `div` vão para ele. `display: contents` deixa o wrapper fora do layout, mas seletores como `.pai > p` deixam de enxergar os filhos; use `as` e `className` se precisar de um elemento de verdade.
- Os links são criados no navegador, depois da montagem. Na renderização no servidor (Astro, Next.js) o HTML sai sem links e sem tooltip, e eles aparecem depois da hidratação.
- Providers aninhados não fazem sentido: o de fora liga primeiro, e o de dentro não encontra mais texto para ligar.

**Limites conhecidos.** A biblioteca mantém o nó de texto que o React criou e adiciona os links depois dele, então o React consegue atualizar ou remover esse texto. Mesmo assim, ela mexe no DOM por fora do React: não use `normalize()` nos elementos do provider, porque juntar nós de texto desfaz a divisão, e os links não existem no HTML do servidor. O contexto e os casos testados estão em [#8](https://github.com/coisasdoalto/bible-references/issues/8).

### Provider

Um `PassageProvider` implementa `getPassage(reference, signal?)` e pode expor `translation` (`{ abbreviation, name }`, usada no cabeçalho e no rodapé) e `source` (`{ id, name, getUrl(reference) }`, usada no link do rodapé). O provider padrão é `createBibliasAppPassageProvider()`.

### Container do tooltip

Por padrão, o tooltip é anexado ao `body` e exibido na camada superior do navegador (Popover API, quando disponível), então aparece acima de modais e de qualquer `z-index`. Mesmo assim, modais bloqueiam o ponteiro fora deles: em páginas com modais ou popovers (por exemplo, Radix, vaul ou `<dialog>`), passe `container` com um elemento dentro deles. Assim, o hover e os toques no tooltip contam como interações dentro do modal, que não os bloqueia. A posição é corrigida automaticamente quando um ancestral usa `transform` com translação e escala; rotação e skew não são suportados.

```ts
mountBibleReferences(noteElement, { container: noteElement });
```

### Link do rodapé

`openIn: "new-tab" | "current-tab"` (padrão: `"new-tab"`) define onde o link "Ler em biblias.app" abre. Em nova aba, o link usa `rel="noopener noreferrer"`. A referência no texto não navega; clique ou toque abrem o tooltip.

### Tema e personalização

`mountBibleReferences` aceita `theme: "auto" | "light" | "dark"` (padrão: `"auto"`, que acompanha `prefers-color-scheme`).

O visual pode ser ajustado com estas custom properties: `--br-accent` (padrão: verde do biblias.app), `--br-reference-color`, `--br-tooltip-width`, `--br-tooltip-max-height`, `--br-tooltip-radius`, `--br-tooltip-background`, `--br-tooltip-color`, `--br-tooltip-muted-color`, `--br-tooltip-header-background`, `--br-tooltip-header-color`, `--br-tooltip-footer-background`, `--br-tooltip-border-color`, `--br-tooltip-link-color`, `--br-tooltip-verse-number-color`, `--br-tooltip-font-family` e `--br-tooltip-ui-font-family`.

## Ferramentas

- TypeScript
- Vite Library Mode
- Bun
- mise
- Vitest
- Biome
- Prettier
- hk
- Tailwind CSS v4
- clsx
- Lightning CSS
- GitHub Actions
- GitHub Packages primeiro; npm depois

## Desenvolvimento

Instale as ferramentas e dependências do projeto:

```sh
mise install
mise run setup
```

Comandos úteis:

```sh
mise run dev
mise run check
mise run test
mise run build
mise run fix
```

Todos os pontos de entrada da CI são expostos como tasks do mise, para que o desenvolvimento local e o GitHub Actions executem os mesmos comandos.

### Formatação

O pre-commit do hk formata automaticamente os arquivos staged antes do commit. TypeScript e JSON são formatados pelo Biome; Markdown, HTML e YAML são formatados pelo Prettier.

O hook preserva alterações não staged enquanto formata e adiciona novamente ao stage apenas o resultado aplicado aos arquivos do commit.

## Estilos

Tailwind CSS é usado apenas durante o desenvolvimento e o build. A biblioteca não exige Tailwind no projeto consumidor e não inclui o Preflight/reset global do framework.

Classes condicionais devem ser compostas com `clsx/lite`. O projeto inclui configuração de IntelliSense do Tailwind para chamadas a `clsx(...)` no VS Code.

O build gera CSS estático e minificado em:

```text
dist/style.css
```

O arquivo pode ser importado pelo consumidor como:

```ts
import "@coisasdoalto/bible-references/style.css";
```

A customização visual pública usa CSS custom properties com prefixo `--br-*`.

## Pacote

O escopo reservado para o pacote é:

```text
@coisasdoalto/bible-references
```

As versões iniciais são publicadas no GitHub Packages. A publicação no npm será habilitada depois que a organização for criada por lá.

### Instalação

O GitHub Packages exige autenticação mesmo para pacotes públicos. No projeto consumidor, aponte o escopo para o registry do GitHub e use um token com a permissão `read:packages`:

```ini
# .npmrc
@coisasdoalto:registry=https://npm.pkg.github.com
//npm.pkg.github.com/:_authToken=${NODE_AUTH_TOKEN}
```

```sh
bun add @coisasdoalto/bible-references
```

Não commite o token. Em CI, use uma variável de ambiente ou o `GITHUB_TOKEN` do workflow.

### Publicação de uma versão

A publicação é feita pelo workflow `Publish GitHub Package`, disparado quando uma release é publicada no GitHub. Ele roda `mise run ci`, valida a versão com `mise run release:verify` e publica com `mise run publish:github`, usando o `GITHUB_TOKEN` efêmero do workflow (`packages: write`), sem tokens de longa duração.

1. Atualize `version` em `package.json` por pull request (por exemplo, `0.1.0`) e faça o merge em `main`.
2. Crie uma release no GitHub com a tag `v<version>` (por exemplo, `v0.1.0`) apontando para esse commit.
3. Acompanhe o workflow. Se a tag não corresponder à versão do `package.json`, a publicação é interrompida antes de enviar o pacote.

Uma versão publicada não pode ser sobrescrita; para corrigir, publique uma nova versão.

## Licença

MIT
