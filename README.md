# Bible References

Uma pequena biblioteca web para detectar referências bíblicas em textos, transformá-las em links e, opcionalmente, exibir a passagem referenciada em um tooltip.

O projeto está sendo desenvolvido primeiro para HTML independente de framework, com uma integração dedicada para React planejada sobre o mesmo parser e modelo central.

## Status

Planejamento inicial e configuração da infraestrutura. A API pública e o parser de referências bíblicas ainda não foram implementados.

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

A customização visual pública será exposta por CSS custom properties com prefixo `--br-*`, sem exigir que o consumidor conheça Tailwind.

## Pacote

O escopo reservado para o pacote é:

```text
@coisasdoalto/bible-references
```

As versões iniciais serão publicadas no GitHub Packages. A publicação no npm será habilitada depois que a organização for criada por lá.

## Licença

MIT
