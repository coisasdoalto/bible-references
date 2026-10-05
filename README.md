# Bible References

Uma pequena biblioteca web para detectar referências bíblicas em textos, transformá-las em links e, opcionalmente, exibir a passagem referenciada em um tooltip.

O projeto está sendo desenvolvido primeiro para HTML independente de framework, com uma integração dedicada para React planejada sobre o mesmo parser e modelo central.

## Status

O primeiro MVP já está implementado. Ele inclui:

- parser de referências em português;
- nomes completos e abreviações dos 66 livros;
- referências no formato `livro capítulo`, `livro capítulo:versículo` e intervalos;
- `:` ou `.` como separador entre capítulo e versículo;
- transformação de text nodes em links sem reescrever `innerHTML`;
- tooltip por hover e foco;
- preview de intervalos limitado a 8 versículos por padrão;
- capítulos inteiros em tooltips com rolagem por mouse ou teclado;
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
  maxPreviewVerses: 8,

  // O href final do site ainda pode ser definido pelo consumidor.
  getHref(reference) {
    const chapterUrl = `https://meu-site.example/${reference.bookId}/${reference.chapter}`;
    return reference.verseStart === null ? chapterUrl : `${chapterUrl}/${reference.verseStart}`;
  },
});

// Para conteúdo inserido posteriormente:
bibleReferences.refresh();

// Remove listeners/tooltips e restaura o texto dos links criados:
bibleReferences.destroy();
```

O parser também aceita formas como:

```text
João 3:16
Jo 3:16
Jo. 3:16
Jo 3.16
1 Co 13:4
1Co 13:4
1 Coríntios 13:4-7
Sl 117
Salmos 119
```

Referências sem versículos têm `verseStart` e `verseEnd` iguais a `null`. O provider
carrega o capítulo inteiro, sem aplicar `maxPreviewVerses`, usando uma URL como
`https://biblias.app/api/v1/bible/acf/passages/sl/117`.

A referência não navega ao ser clicada: clique ou toque abrem o tooltip (no desktop, hover e foco também abrem). O tooltip fecha ao rolar a página, ao tocar fora dele ou com `Escape`; rolar dentro do tooltip não o fecha.

O tooltip permanece aberto enquanto o link ou o tooltip recebe hover ou foco.
Com o link focado, pressione `↓` para focar o tooltip e usar as teclas de rolagem;
`Escape` fecha o tooltip e devolve o foco ao link. A largura e a altura máximas podem ser
personalizadas com `--br-tooltip-width` e `--br-tooltip-max-height` (padrão: `24rem`), sempre limitadas à tela.

A camada DOM ignora referências dentro de `script`, `style`, `code`, `pre`, controles de formulário, links existentes, botões, conteúdo editável e elementos marcados com `data-bible-references-ignore`.

Quando `getHref` não é informado, o link aponta para a página de leitura do biblias.app, por exemplo `https://biblias.app/acf/rm/1/1-8`. O link do rodapé do tooltip sempre usa o `source` do provider.

### Provider

Um `PassageProvider` implementa `getPassage(reference, signal?)` e pode expor `translation` (`{ abbreviation, name }`, usada no cabeçalho e no rodapé) e `source` (`{ id, name, getUrl(reference) }`, usada no link do rodapé). O provider padrão é `createBibliasAppPassageProvider()`.

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

As versões iniciais serão publicadas no GitHub Packages. A publicação no npm será habilitada depois que a organização for criada por lá.

## Licença

MIT
