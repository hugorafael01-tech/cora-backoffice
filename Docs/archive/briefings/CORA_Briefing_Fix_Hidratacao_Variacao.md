# Briefing — Fix: hidratação alvo não reflete na linha de água da variação

Repo: `cora-backoffice`
Task ClickUp: 86e1uu99r
Tipo: correção de lógica. Sem schema. Sem UI nova.
Arquivo único afetado: `src/lib/producaoActions.ts` (função `criarVariacao`).

## Contexto

Achado no smoke runtime de 11/06/2026. `criarVariacao` clona a versão de origem via RPC `fork_versao_receita`, grava `hidratacao_alvo` em `versoes_receita` e sobrescreve o `percentual_baker` da linha de levain (override de prefermento). Mas NÃO sobrescreve a linha de água. Como o fork copia os ingredientes da origem, a linha de água fica com o valor da origem e a ficha (Preparação) mostra água errada numa variação de hidratação. É o caso de uso central de uma variação, então o bug invalida a ficha de bancada.

## Como o modelo realmente funciona (já verificado no schema e no seed, não reinvestigar)

- `ingredientes_receita` guarda apenas `percentual_baker NUMERIC(6,4)`. NÃO há coluna de gramas. As gramas da ficha são derivadas (percentual x farinha base x multiplicador). Portanto o fix NÃO grava gramas, só `percentual_baker`.
- Há UMA única linha de água por versão: o ingrediente de slug `agua-mineral`. A tabela tem `UNIQUE (versao_receita_id, ingrediente_id)`, então não existem linhas separadas de autólise/escaldar. O split (autólise/escaldar ou H2O1/H2O2) vive só no texto de `ingredientes_receita.notas`.
- O `percentual_baker` da linha `agua-mineral` JÁ É a hidratação total, sincronizado com `versoes_receita.hidratacao_alvo`. Conferido no seed: Original 0,70 / 70,00 · Integral 0,75 / 75,00 · Multigrãos 1,12 / 112,00 · Focaccia 0,75 / 75,00 · Ciabatta 0,76 / 76,00.
- O formulário (`NovaReceitaTesteModal`) envia `hidratacaoAlvo` como percentual total (ex.: 75, ou 112 no Multigrãos). É o mesmo número do `percentual_baker x 100`.

## Correção

Em `criarVariacao`, depois do override de levain que já existe, aplicar o override análogo na linha de água:

1. Resolver o id do ingrediente `agua-mineral`. Sugestão: generalizar o helper `getLevainId()` para `getIngredienteId(slug: string)` e chamá-lo com `'levain'` e `'agua-mineral'`. Manter `getLevainId` como wrapper se preferir não tocar nos call sites.
2. Se o id existir, `update ingredientes_receita set percentual_baker = input.hidratacaoAlvo / 100 where versao_receita_id = versaoId and ingrediente_id = aguaId`.
3. Mesma forma do bloco de levain: tratar o caso de a linha não existir (receita sem água, ex.: Brioche tem `hidratacao_alvo` NULL). O update simplesmente afeta 0 linhas. Não quebrar.

Não tocar em mais nada: sal, azeite, sementes, levain, crosta, etapas, `notas`.

## Fora de escopo (PARE e pergunte se achar que precisa)

- Qualquer mudança na RPC `fork_versao_receita` ou em qualquer tabela. Isso é schema, e schema não se mexe nesta task.
- Reescrever o texto de `notas` da linha de água ou da versão. A nota do Multigrãos ("autólise 58% + escaldar 54% = 112% total") fica desatualizada após variar a hidratação. É resíduo conhecido, decisão à parte do Hugo. NÃO tentar parsear ou reescrever a nota.
- Qualquer UI nova, marcação visual ou outro produto/módulo.

## Verificação (smoke no preview Vercel, nunca localhost)

Criar variações via modal "Nova receita de teste" e conferir na aba Preparação:
1. Variação de Integral, hidratação 78. Linha de água deve renderizar a 78% (gramas = 0,78 x farinha base; com farinha base 370g de 1 receita, ~289g). Origem (Integral 75%) intacta.
2. Variação de Original, hidratação 72. Água a 72%.
3. Variação de Multigrãos, hidratação 100. Linha de água única a 100% (era 112%).
4. Em todas: sal, levain, azeite e sementes inalterados. A versão de origem não muda.
5. Se houver teste em `src/lib/producao.test.ts` cobrindo `criarVariacao`, estender pra cobrir o override de água. Se não houver, propor um teste mínimo.

## Pare e pergunte (além dos pontos do template)

1. Se o slug do ingrediente de água no banco de produção não for exatamente `agua-mineral` (confirmar via SQL read-only no SQL Editor com o Hugo executando antes de assumir).
2. Se for tentado a mexer em `fork_versao_receita`, em `notas`, ou em qualquer tabela.
3. Se o override de água interferir de algum jeito com o de levain no código atual.
