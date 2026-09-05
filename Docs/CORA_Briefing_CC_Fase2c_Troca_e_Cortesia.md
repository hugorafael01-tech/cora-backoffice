# Briefing CC — Fase 2c: troca de produto e cortesia

**04/09/2026** · Fase 2 (2a e 2b) mergeada. Isto é um ajuste da regra de extras
descoberto ao conferir a prévia de outubro na tela. Arquitetura:
`docs/CORA_Plano_Cobranca_Unica_v2_1.md`. Go/no-go: **21/09**.

## Regras da sessão

Feature branch; squash pelo Hugo; commits ASCII sem acento; parar no fim e
reportar. `previa.ts` tem gêmeo — toda mudança de conta entra na nota de
espelhamento.

---

## O que a conferência da tela revelou

A prévia de 2026-10 levantou 4 alertas de `preco_zero` e 4 de
`preco_divergente`. **Nenhum deles é erro.** Investigados um a um contra o
banco:

| assinante | quinta | total_paes | na cesta | extras zerados | é |
|---|---|---|---|---|---|
| Isabel Considera | 27/08 | 2 | 1 | 1 | troca |
| Isabel Considera | 03/09 | 2 | 1 | 1 | troca |
| Arouca | 03/09 | 1 | 0 | 1 | troca |
| Julia | 27/08 | 1 | composition nula | 1 | cortesia |
| David Hertz | 03/09 | 1 | composition nula | 2 | cortesia |

**Troca de produto** é modelo de assinatura em teste (setembro/2026): quem tem
2 pães pode trocar um deles livremente; quem tem 1 pão troca só por focaccia ou
ciabatta. O produto trocado entra como extra com `preco_unit` 0 e o slot
correspondente fica vago na `composition`. **Não é cobrança perdida.**

**Cortesia** é decisão pontual do Hugo (David é influenciador em cortesia de uma
semana; Julia foi compensação por uma focaccia que faltou).

Nota de origem: os pedidos zerados foram criados por **escrita SQL direta**, não
pelo portal. Escrita direta pula a regra de negócio (`resolveExtrasPrecos` e a
restrição de quais produtos podem ser trocados). Registrar no STATUS como
armadilha conhecida.

---

## TAREFA 1 — Verificar a semântica de `composition` nula

Antes de codar. No `cora-portal`, descobrir o que `weekly_orders.composition =
null` significa: **cesta padrão com todos os slots usados**, ou **ainda não
escolhida**?

A regra abaixo assume a primeira leitura (bate com Julia em 13 e 20/08, que têm
composition nula e extras pagos normalmente). Se for a segunda, **pare e
reporte** — a regra precisa de outro desenho.

## TAREFA 2 — Regra de troca por slots vagos (`previa.ts`)

```
slots_vagos = total_paes - (composition.original + composition.integral)
              // composition nula => slots_vagos = 0
```

- Extras com `preco_unit = 0` até o limite de `slots_vagos` são **troca**:
  cobrados como zero, **sem alerta**, e marcados na linha para a tela poder
  exibi-los como troca e não como produto grátis.
- Zerados **acima** de `slots_vagos` continuam levantando alerta.
- `subscriptions.total_paes` entra na `SubscriptionPrevia` e na query do
  `usePrevia`.
- `preco_divergente` **não dispara para troca**: hoje ele acusa "gravado R$ 0,
  cardápio diz R$ 25" em toda troca, o que é ruído por construção.

## TAREFA 3 — Cortesia explícita

Zerado acima dos slots vagos pode ser cortesia deliberada. Ler `motivo` do
item no jsonb de `extras`:

- `motivo: 'cortesia'` → cobrado zero, **sem alerta**, marcado como cortesia
- sem `motivo` → alerta `preco_zero` como hoje

**Só leitura nesta fase.** Quem escreve o campo é o Hugo, por SQL, enquanto não
existir tela. Sem migration: é jsonb.

Efeito combinado: o alerta `preco_zero` passa a disparar **apenas** para preço
que faltou cadastrar. Nos 5 casos reais acima, zero alerta.

## TAREFA 4 — Testes e STATUS

Casos obrigatórios, com os dados reais acima: troca com 2 pães (1 slot vago),
troca com 1 pão (composition 0/0), cortesia com composition nula, zerado sem
motivo e sem slot vago (**tem** que alertar), zerados acima dos slots vagos
(alerta só nos excedentes).

STATUS: a regra de slots vagos, a leitura de `motivo`, e a armadilha da escrita
SQL direta.

---

## Fora de escopo (registrar como pendência, não desenvolver)

1. **Preço riscado na tela** para cortesia (mostrar R$ 36 riscado). Só faz
   sentido depois da Tarefa 3 — riscar antes faria erro parecer presente.
2. **Prévia sob Financeiro.** A tela está solta no nível de Semana/Produção.
   Com Fase 3 e Fase 5, o Financeiro vira área com Panorama, Prévia e Cobranças.
3. **Bloco "não entram nesta cobrança"** no fim da prévia, fora do total:
   cortesias, trocas e pausados com entrega. O Hugo quer acompanhar o histórico
   sem poluir a contagem de cobranças (a conciliação da Fase 4 conta grupos
   contra cobranças criadas).
4. **Restrição de troca no servidor.** Hoje "1 pão só troca por focaccia ou
   ciabatta" vive na tela do portal. Escrita direta fura.

Os quatro entram **depois de outubro no ar**. Nenhum impede a cobrança de sair
correta.

## Critério de pronto

Prévia de 2026-10 sem nenhum alerta de `preco_zero` ou `preco_divergente`, com
as 5 linhas acima exibidas como troca ou cortesia, e teste garantindo que um
zerado sem justificativa ainda alerta.
