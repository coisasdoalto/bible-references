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
- hk
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

## Pacote

O escopo reservado para o pacote é:

```text
@coisasdoalto/bible-references
```

As versões iniciais serão publicadas no GitHub Packages. A publicação no npm será habilitada depois que a organização for criada por lá.

## Licença

MIT
