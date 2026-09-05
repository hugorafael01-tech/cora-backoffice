import { describe, expect, it } from 'vitest';
import { montaPrevia } from './previa';
import {
  conteudoParaHash,
  hashGolden,
  montaEntradaGolden,
  type Golden,
} from './previaGolden';
import bruto from './previa.golden.json';

/**
 * O contrato do gemeo.
 *
 * `previa.ts` foi copiado pro `cora-portal/api/_lib/previa.js` na Fase 3, e a
 * mesma conta passou a viver em dois lugares. O que amarra os dois NAO e uma
 * segunda suite de testes: as regras estao cobertas em `previa.test.ts`, deste
 * lado, onde ha framework de verdade. Duas suites em estilos diferentes seriam
 * duas coisas a manter, e elas divergiriam.
 *
 * O que amarra e o FIXTURE: uma entrada rica e a saida esperada, no mesmo JSON
 * commitado nos dois repos, com cada lado afirmando contra ele. O gemeo precisa
 * provar uma coisa so — mesma entrada, mesma saida.
 *
 * Mudou uma regra: muda aqui, roda `npm run golden`, copia o JSON pro portal,
 * roda `npm run test:previa` la.
 *
 * O FIXTURE VIAJA COM O GEMEO, NO MESMO PR. Como cada lado afirma contra a
 * propria copia, regenerar de um lado so deixa os DOIS verdes enquanto ja
 * divergiram. O hash impresso abaixo nao impede isso — torna visivel: os dois
 * testes imprimem o mesmo numero quando estao em sincronia.
 */
const golden = bruto as unknown as Golden;

describe('golden do gemeo', () => {
  it('o hash confere e fica visivel', () => {
    // Impresso de proposito: e o que se compara com a saida do
    // `npm run test:previa` do portal pra saber se os dois leem o MESMO fixture.
    console.log(`\n  golden hash: ${golden.hash}\n`);
    expect(hashGolden(conteudoParaHash(golden))).toBe(golden.hash);
  });

  it('a saida bate com o fixture', () => {
    expect(montaPrevia(montaEntradaGolden(golden), golden.periodoReferencia)).toEqual(golden.saida);
  });

  it('o fixture cobre os casos que ele promete cobrir', () => {
    // Guarda contra o fixture empobrecer sem ninguem notar: sem isto, alguem
    // podia tirar um caso da entrada e o golden continuaria verde com menos.
    const itens = golden.entrada.weeklyOrders.flatMap((w) => w.extras ?? []);
    expect(itens.some((e) => e.preco_unit === 0 && e.motivo === 'cortesia')).toBe(true);
    expect(itens.some((e) => e.preco_unit === 0 && !e.motivo)).toBe(true);
    expect(golden.entrada.subscriptions.some((s) => s.pagador_subscription_id !== null)).toBe(true);
    expect(golden.entrada.subscriptions.some((s) => s.forma_pagamento === 'cartao')).toBe(true);
    expect(golden.entrada.subscriptions.some((s) => s.next_billing_change_date !== null)).toBe(true);
    expect(golden.entrada.weeklyOrders.some((w) => w.delivery_date === '2026-10-29')).toBe(true);
    expect(golden.entrada.entregas.some((e) => e.status !== 'entregue')).toBe(true);
  });
});
