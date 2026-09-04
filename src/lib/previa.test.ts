import { describe, expect, it } from 'vitest';
import {
  corteDoMes,
  janelaDoCiclo,
  mesAnterior,
  montaPrevia,
  quintasDoMes,
  type EntradaPrevia,
  type SubscriptionPrevia,
  type WeeklyOrderPrevia,
} from './previa';

// ---------------------------------------------------------------------------
// Fixtures minimas: cada teste sobrescreve so o que lhe interessa.
// ---------------------------------------------------------------------------

function sub(over: Partial<SubscriptionPrevia> = {}): SubscriptionPrevia {
  return {
    id: 's1',
    nome: 'Assinante',
    forma_pagamento: 'boleto_pix',
    valor_mensal: 114,
    valor_frete: 15,
    activated_at: '2026-07-27T12:00:00Z',
    next_billing_change_date: null,
    next_billing_value: null,
    pagador_subscription_id: null,
    asaas_customer_id: 'cus_1',
    ...over,
  };
}

function pedido(over: Partial<WeeklyOrderPrevia> = {}): WeeklyOrderPrevia {
  const extras = over.extras ?? [{ id: 'focaccia', nome: 'Focaccia', qty: 1, preco_unit: 28 }];
  return {
    id: 'wo1',
    subscription_id: 's1',
    delivery_date: '2026-09-03',
    status: 'confirmado',
    total_extras: extras.reduce((s, e) => s + e.qty * e.preco_unit, 0),
    ...over,
    extras,
  };
}

function entrada(over: Partial<EntradaPrevia> = {}): EntradaPrevia {
  return {
    subscriptions: [sub()],
    weeklyOrders: [],
    entregas: [],
    precos: new Map(),
    ...over,
  };
}

/** Marca todos os pedidos como entregues, que e o caso normal. */
function entregues(pedidos: WeeklyOrderPrevia[]) {
  return pedidos.map((p) => ({ weekly_order_id: p.id, status: 'entregue' }));
}

const codigos = (p: ReturnType<typeof montaPrevia>) => p.alertas.map((a) => a.codigo);

// ---------------------------------------------------------------------------

describe('janela do ciclo', () => {
  it('setembro real: as 4 quintas de setembro entram, e o 27/08 tambem', () => {
    // Referencia 2026-10 = mensalidade de outubro + extras do ciclo encerrado.
    // O corte de agosto foi 20/08, entao a quinta 27/08 ficou de fora da
    // cobranca de setembro e abre esta. Janela sem buraco.
    const j = janelaDoCiclo('2026-10');
    expect(j.quintas).toEqual([
      '2026-08-27', '2026-09-03', '2026-09-10', '2026-09-17', '2026-09-24',
    ]);
    expect(j.ultimaQuinta).toBe('2026-09-24');
  });

  it('outubro tem quinta 29: ela cai no ciclo seguinte', () => {
    const j = janelaDoCiclo('2026-11');
    expect(j.quintas).toEqual([
      '2026-10-01', '2026-10-08', '2026-10-15', '2026-10-22',
    ]);
    expect(j.quintas).not.toContain('2026-10-29');
    // e a 29/10 aparece no ciclo de dezembro, sem se perder
    expect(janelaDoCiclo('2026-12').quintas).toContain('2026-10-29');
  });

  it('as janelas de meses seguidos nao tem buraco nem sobreposicao', () => {
    const out = janelaDoCiclo('2026-11').quintas;
    const dez = janelaDoCiclo('2026-12').quintas;
    expect(out[out.length - 1]).toBe('2026-10-22');
    expect(dez[0]).toBe('2026-10-29');
    expect(out.filter((q) => dez.includes(q))).toEqual([]);
  });

  it('corte e a ultima quinta <= dia 25, e vira o ano corretamente', () => {
    expect(corteDoMes('2026-09')).toBe('2026-09-24');
    expect(corteDoMes('2026-08')).toBe('2026-08-20');
    expect(mesAnterior('2026-01')).toBe('2025-12');
    expect(janelaDoCiclo('2026-01').ultimaQuinta.slice(0, 7)).toBe('2025-12');
  });

  it('quintasDoMes conta as quintas do mes inteiro', () => {
    expect(quintasDoMes('2026-10')).toHaveLength(5);
    expect(quintasDoMes('2026-09')).toHaveLength(4);
  });
});

describe('portao do pos-consumo', () => {
  it('rascunho com extras nao e cobrado', () => {
    // Caso real: 2 rascunhos com total_extras > 0 em agosto/2026.
    const p = pedido({ status: 'rascunho' });
    const previa = montaPrevia(
      entrada({ weeklyOrders: [p], entregas: entregues([p]) }),
      '2026-10',
    );
    expect(previa.grupos[0].assinaturas[0].totalExtras).toBe(0);
  });

  it('confirmado sem entrega entregue nao cobra, mas alerta', () => {
    const p = pedido();
    const previa = montaPrevia(
      entrada({ weeklyOrders: [p], entregas: [{ weekly_order_id: p.id, status: 'em_rota' }] }),
      '2026-10',
    );
    expect(previa.grupos[0].assinaturas[0].totalExtras).toBe(0);
    expect(codigos(previa)).toContain('entrega_nao_confirmada');
  });

  it('confirmado e entregue dentro da janela e cobrado', () => {
    const p = pedido();
    const previa = montaPrevia(
      entrada({ weeklyOrders: [p], entregas: entregues([p]) }),
      '2026-10',
    );
    expect(previa.grupos[0].assinaturas[0].totalExtras).toBe(28);
    expect(previa.grupos[0].total).toBe(142); // 114 mensalidade + 28
  });

  it('entrega fora da janela nao entra', () => {
    const p = pedido({ delivery_date: '2026-10-29' });
    const previa = montaPrevia(
      entrada({ weeklyOrders: [p], entregas: entregues([p]) }),
      '2026-11',
    );
    expect(previa.grupos[0].assinaturas[0].totalExtras).toBe(0);
    expect(codigos(previa)).not.toContain('entrega_nao_confirmada');
  });
});

describe('preco gravado', () => {
  it('preco zero e cobrado como zero e levanta alerta proprio', () => {
    // Caso real de 27/08: brioche a 0 com o cardapio dizendo 36.
    const p = pedido({
      extras: [{ id: 'brioche', nome: 'Brioche', qty: 1, preco_unit: 0 }],
    });
    const previa = montaPrevia(
      entrada({ weeklyOrders: [p], entregas: entregues([p]) }),
      '2026-10',
    );
    expect(previa.grupos[0].assinaturas[0].totalExtras).toBe(0);
    expect(codigos(previa)).toContain('preco_zero');
  });

  it('preco zero alerta mesmo quando o cardapio tambem diz zero', () => {
    // O alerta de zero e INDEPENDENTE do de divergencia: cortesia e erro de
    // cadastro tem o mesmo simbolo hoje, entao zero sempre pede olho humano.
    const p = pedido({
      extras: [{ id: 'brioche', nome: 'Brioche', qty: 1, preco_unit: 0 }],
    });
    const previa = montaPrevia(
      entrada({
        weeklyOrders: [p],
        entregas: entregues([p]),
        precos: new Map([['2026-09-03', new Map([['brioche', 0]])]]),
      }),
      '2026-10',
    );
    expect(codigos(previa)).toContain('preco_zero');
    expect(codigos(previa)).not.toContain('preco_divergente');
  });

  it('divergencia do cardapio cobra o gravado e alerta', () => {
    const p = pedido({
      extras: [{ id: 'brioche', nome: 'Brioche', qty: 1, preco_unit: 0 }],
    });
    const previa = montaPrevia(
      entrada({
        weeklyOrders: [p],
        entregas: entregues([p]),
        precos: new Map([['2026-09-03', new Map([['brioche', 36]])]]),
      }),
      '2026-10',
    );
    expect(previa.grupos[0].assinaturas[0].totalExtras).toBe(0); // o gravado, nao 36
    expect(codigos(previa)).toContain('preco_divergente');
    expect(codigos(previa)).toContain('preco_zero');
  });

  it('total_extras gravado divergente da soma dos itens levanta alerta', () => {
    const p = pedido({ total_extras: 999 });
    const previa = montaPrevia(
      entrada({ weeklyOrders: [p], entregas: entregues([p]) }),
      '2026-10',
    );
    expect(previa.grupos[0].assinaturas[0].totalExtras).toBe(28); // a soma manda
    expect(codigos(previa)).toContain('total_extras_divergente');
  });
});

describe('quem entra na previa', () => {
  it('cartao fica de fora', () => {
    const previa = montaPrevia(
      entrada({ subscriptions: [sub({ forma_pagamento: 'cartao' })] }),
      '2026-10',
    );
    expect(previa.grupos).toEqual([]);
    expect(previa.totalGeral).toBe(0);
  });

  it('boleto, pix e boleto_pix entram', () => {
    const previa = montaPrevia(
      entrada({
        subscriptions: [
          sub({ id: 'a', nome: 'A', forma_pagamento: 'boleto' }),
          sub({ id: 'b', nome: 'B', forma_pagamento: 'pix' }),
          sub({ id: 'c', nome: 'C', forma_pagamento: 'boleto_pix' }),
        ],
      }),
      '2026-10',
    );
    expect(previa.grupos).toHaveLength(3);
  });

  it('forma nula aparece na previa com alerta, nunca some', () => {
    const previa = montaPrevia(
      entrada({ subscriptions: [sub({ forma_pagamento: null, nome: 'Nova' })] }),
      '2026-10',
    );
    expect(previa.grupos).toHaveLength(1);
    expect(codigos(previa)).toContain('forma_pagamento_ausente');
  });

  it('pagador sem cliente no Asaas monta a previa e alerta', () => {
    // Caso real: a Fernanda e a unica das 27 sem asaas_customer_id.
    const previa = montaPrevia(
      entrada({ subscriptions: [sub({ nome: 'Fernanda', asaas_customer_id: null })] }),
      '2026-10',
    );
    expect(previa.grupos).toHaveLength(1);
    expect(codigos(previa)).toContain('sem_cliente_asaas');
  });
});

describe('agrupamento por pagador', () => {
  const aldina = sub({ id: 'ald', nome: 'Aldina', forma_pagamento: 'boleto' });
  const fernanda = sub({
    id: 'fer', nome: 'Fernanda', forma_pagamento: 'boleto',
    pagador_subscription_id: 'ald', asaas_customer_id: null,
  });

  it('Aldina + Fernanda viram um grupo so, com as duas cestas e o total somado', () => {
    const previa = montaPrevia(entrada({ subscriptions: [aldina, fernanda] }), '2026-10');
    expect(previa.grupos).toHaveLength(1);
    const g = previa.grupos[0];
    expect(g.pagadorNome).toBe('Aldina');
    expect(g.assinaturas.map((a) => a.nome)).toEqual(['Aldina', 'Fernanda']);
    expect(g.total).toBe(228); // os R$ 228 da assinatura unica no Asaas
    expect(previa.totalGeral).toBe(228);
  });

  it('extras de cada assinatura ficam na propria linha, e o total sobe pro grupo', () => {
    const p = pedido({ id: 'wo-fer', subscription_id: 'fer' });
    const previa = montaPrevia(
      entrada({
        subscriptions: [aldina, fernanda],
        weeklyOrders: [p],
        entregas: entregues([p]),
      }),
      '2026-10',
    );
    const g = previa.grupos[0];
    expect(g.assinaturas.find((a) => a.nome === 'Aldina')!.totalExtras).toBe(0);
    expect(g.assinaturas.find((a) => a.nome === 'Fernanda')!.totalExtras).toBe(28);
    expect(g.total).toBe(256);
  });

  it('grupo inteiro de cartao fica fora (Sabina + Maria Helena)', () => {
    const sabina = sub({ id: 'sab', nome: 'Sabina', forma_pagamento: 'cartao' });
    const helena = sub({
      id: 'mh', nome: 'Maria Helena', forma_pagamento: 'cartao',
      pagador_subscription_id: 'sab',
    });
    const previa = montaPrevia(entrada({ subscriptions: [sabina, helena] }), '2026-10');
    expect(previa.grupos).toEqual([]);
  });

  it('CPF duplicado nao agrupa sozinho: so a coluna de pagador agrupa', () => {
    // A Sabina e a Maria Helena tem o MESMO CPF; a Aldina e a Fernanda tem CPFs
    // diferentes. Se o agrupamento fosse por CPF, um par se juntava e o outro
    // nao. Sem a coluna preenchida, cada uma e seu proprio pagador.
    const a = sub({ id: 'a', nome: 'A', pagador_subscription_id: null });
    const b = sub({ id: 'b', nome: 'B', pagador_subscription_id: null });
    const previa = montaPrevia(entrada({ subscriptions: [a, b] }), '2026-10');
    expect(previa.grupos).toHaveLength(2);
  });

  it('grupo com formas diferentes cobra pela do pagador e alerta', () => {
    const paga = sub({ id: 'p', nome: 'Pagador', forma_pagamento: 'boleto' });
    const paga2 = sub({
      id: 'q', nome: 'Dependente', forma_pagamento: 'pix',
      pagador_subscription_id: 'p',
    });
    const previa = montaPrevia(entrada({ subscriptions: [paga, paga2] }), '2026-10');
    expect(previa.grupos).toHaveLength(1);
    expect(previa.grupos[0].formaPagamento).toBe('boleto');
    expect(codigos(previa)).toContain('grupo_forma_mista');
  });
});

describe('mensalidade', () => {
  it('entrada no meio do mes rateia por quintas restantes', () => {
    // Outubro tem 5 quintas (1, 8, 15, 22, 29). Ativada em 09/10, ela perde a
    // do dia 8 tambem — a entrega ja tinha passado quando ela entrou — e fica
    // com 3: 15, 22 e 29. O corte e `quinta >= ativacao`, nao "quintas que
    // sobram no calendario".
    const previa = montaPrevia(
      entrada({ subscriptions: [sub({ activated_at: '2026-10-09T10:00:00Z' })] }),
      '2026-10',
    );
    const linha = previa.grupos[0].assinaturas[0];
    expect(linha.proporcional).toBe(true);
    expect(linha.mensalidade).toBe(68.4); // 114 * 3/5
  });

  it('quem entrou antes do mes paga cheio', () => {
    const previa = montaPrevia(entrada(), '2026-10');
    expect(previa.grupos[0].assinaturas[0].proporcional).toBe(false);
    expect(previa.grupos[0].assinaturas[0].mensalidade).toBe(114);
  });

  it('mudanca ja vigente no mes de referencia vale', () => {
    const previa = montaPrevia(
      entrada({
        subscriptions: [sub({
          next_billing_change_date: '2026-10-01',
          next_billing_value: 150,
        })],
      }),
      '2026-10',
    );
    expect(previa.grupos[0].assinaturas[0].mensalidade).toBe(150);
  });

  it('aumento no meio do mes anterior gera ajuste proporcional', () => {
    // Setembro tem 4 quintas; aumento a partir de 17/09 pega 2 (17 e 24).
    const previa = montaPrevia(
      entrada({
        subscriptions: [sub({
          next_billing_change_date: '2026-09-17',
          next_billing_value: 134,
        })],
      }),
      '2026-10',
    );
    const linha = previa.grupos[0].assinaturas[0];
    expect(linha.ajuste).toBe(10); // (134-114) * 2/4
    // E a mensalidade de outubro ja e a NOVA, cheia: a regra de 29/08 diz
    // "proporcional no mes corrente + cheio na renovacao", e outubro e a
    // renovacao. As duas metades da regra aparecem na mesma linha.
    expect(linha.mensalidade).toBe(134);
    expect(linha.total).toBe(144);
  });

  it('reducao nao gera ajuste no mes corrente', () => {
    const previa = montaPrevia(
      entrada({
        subscriptions: [sub({
          next_billing_change_date: '2026-09-17',
          next_billing_value: 90,
        })],
      }),
      '2026-10',
    );
    expect(previa.grupos[0].assinaturas[0].ajuste).toBe(0);
  });
});
