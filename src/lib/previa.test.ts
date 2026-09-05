import { describe, expect, it } from 'vitest';
import { formatBRL } from './financeiro';
import {
  corteDoMes,
  janelaDoCiclo,
  mesAnterior,
  montaPrevia,
  quintaLegivel,
  quintasDoMes,
  reais,
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
    total_paes: 1,
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
    composition: null,
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

describe('escopo dos alertas', () => {
  it('alerta de extra de quem e cartao nao vaza pra tela dos 27', () => {
    // A leitura NAO filtra cartao (pra que forma nula apareca), entao os
    // pedidos dos 13 passam por aqui. Mas a tela lista so os 27: alerta sobre
    // quem nao esta ali treina a ignorar alerta.
    const cartao = sub({ id: 'c', nome: 'Cartao', forma_pagamento: 'cartao' });
    const p = pedido({
      id: 'wo-c', subscription_id: 'c',
      extras: [{ id: 'brioche', nome: 'Brioche', qty: 1, preco_unit: 0 }],
    });
    const previa = montaPrevia(
      entrada({ subscriptions: [cartao], weeklyOrders: [p], entregas: entregues([p]) }),
      '2026-10',
    );
    expect(previa.grupos).toEqual([]);
    expect(codigos(previa)).not.toContain('preco_zero');
  });

  it('alerta de entrega pendente de quem e cartao tambem nao vaza', () => {
    const cartao = sub({ id: 'c', nome: 'Cartao', forma_pagamento: 'cartao' });
    const p = pedido({ id: 'wo-c', subscription_id: 'c' });
    const previa = montaPrevia(
      entrada({
        subscriptions: [cartao], weeklyOrders: [p],
        entregas: [{ weekly_order_id: p.id, status: 'em_rota' }],
      }),
      '2026-10',
    );
    expect(codigos(previa)).not.toContain('entrega_nao_confirmada');
  });

  it('o mesmo alerta aparece quando quem pediu entra na previa', () => {
    // Espelho do teste acima: prova que o corte e pelo escopo, nao um bug que
    // apagou o alerta pra todo mundo.
    const p = pedido({
      extras: [{ id: 'brioche', nome: 'Brioche', qty: 1, preco_unit: 0 }],
    });
    const previa = montaPrevia(
      entrada({ weeklyOrders: [p], entregas: entregues([p]) }), '2026-10');
    expect(codigos(previa)).toContain('preco_zero');
  });
});

describe('pagador ausente', () => {
  it('quem aponta pra pagador inativo e cobrado separado, com alerta', () => {
    // A assinatura da pagadora foi cancelada/pausada e nao veio na leitura de
    // ativas. Antes, o `?? sub` remontava o grupo em silencio com o nome e a
    // forma do dependente.
    const orfa = sub({
      id: 'orf', nome: 'Orfa', forma_pagamento: 'boleto',
      pagador_subscription_id: 'sumiu',
    });
    const previa = montaPrevia(entrada({ subscriptions: [orfa] }), '2026-10');
    expect(codigos(previa)).toContain('pagador_nao_encontrado');
    // nao some da previa: vira pagadora de si mesma
    expect(previa.grupos).toHaveLength(1);
    expect(previa.grupos[0].pagadorId).toBe('orf');
    expect(previa.grupos[0].pagadorNome).toBe('Orfa');
  });

  it('pagador presente nao levanta o alerta', () => {
    const a = sub({ id: 'ald', nome: 'Aldina', forma_pagamento: 'boleto' });
    const f = sub({ id: 'fer', nome: 'Fernanda', forma_pagamento: 'boleto',
      pagador_subscription_id: 'ald' });
    const previa = montaPrevia(entrada({ subscriptions: [a, f] }), '2026-10');
    expect(codigos(previa)).not.toContain('pagador_nao_encontrado');
  });
});

describe('ajuste irreconstruivel', () => {
  it('alerta quando falta o dado que permitiria reconstruir o ajuste', () => {
    // Hoje NADA popula next_billing_*: o PATCH do portal sobrescreve
    // valor_mensal e nao grava as duas colunas. Sem o alerta, "nao houve
    // ajuste" e "nao da pra saber se houve" viram o mesmo 0 na tela.
    const previa = montaPrevia(entrada(), '2026-10');
    expect(previa.grupos[0].assinaturas[0].ajuste).toBe(0);
    expect(codigos(previa)).toContain('ajuste_nao_reconstruivel');
    expect(previa.alertas.find((a) => a.codigo === 'ajuste_nao_reconstruivel')!.subscriptionId)
      .toBeNull();
  });

  it('se aposenta sozinho quando todas as linhas tem o dado', () => {
    const previa = montaPrevia(
      entrada({
        subscriptions: [sub({
          next_billing_change_date: '2026-09-17', next_billing_value: 134,
        })],
      }),
      '2026-10',
    );
    expect(codigos(previa)).not.toContain('ajuste_nao_reconstruivel');
    expect(previa.grupos[0].assinaturas[0].ajuste).toBe(10);
  });
});

describe('formatadores da tela', () => {
  it('reais tem a MESMA saida de formatBRL', () => {
    // As duas existem porque previa.ts nao pode importar financeiro.ts: ele tem
    // um gemeo no portal e arrastaria codigo de app pra travessia. Este teste e
    // o que impede as duas de divergirem — foi assim que apareceu, na revisao do
    // Hugo, que uma punha separador de milhar e a outra nao.
    for (const n of [0, 28, 114, 1234.5, 1234.56, 99999.99, 0.5]) {
      expect(reais(n)).toBe(formatBRL(n));
    }
  });

  it('quintaLegivel escreve a quinta como a tela le', () => {
    expect(quintaLegivel('2026-09-03')).toBe('quinta 03/09');
    expect(quintaLegivel('2026-10-29')).toBe('quinta 29/10');
  });
});

describe('troca de produto e cortesia', () => {
  // Os cinco casos reais que a previa de 2026-10 levantou na tela, conferidos
  // um a um contra o banco em 04/09. Nenhum deles e erro.

  it('Isabel: 2 paes, 1 na cesta, 1 slot vago — o zerado e troca, sem alerta', () => {
    const isabel = sub({ id: 'isa', nome: 'Isabel Considera', total_paes: 2 });
    const p = pedido({
      subscription_id: 'isa',
      composition: { original: 1, integral: 0 },
      extras: [{ id: 'brioche', nome: 'Brioche', qty: 1, preco_unit: 0 }],
    });
    const previa = montaPrevia(
      entrada({
        subscriptions: [isabel], weeklyOrders: [p], entregas: entregues([p]),
        precos: new Map([['2026-09-03', new Map([['brioche', 36]])]]),
      }),
      '2026-10',
    );
    expect(codigos(previa)).not.toContain('preco_zero');
    expect(codigos(previa)).not.toContain('preco_divergente');
    expect(previa.grupos[0].assinaturas[0].extras[0].tipo).toBe('troca');
    expect(previa.grupos[0].assinaturas[0].totalExtras).toBe(0);
  });

  it('Arouca: 1 pao, composition 0/0, 1 slot vago — troca', () => {
    const arouca = sub({ id: 'aro', nome: 'Arouca', total_paes: 1 });
    const p = pedido({
      subscription_id: 'aro',
      composition: { original: 0, integral: 0 },
      extras: [{ id: 'ciabatta', nome: 'Ciabatta', qty: 1, preco_unit: 0 }],
    });
    const previa = montaPrevia(
      entrada({ subscriptions: [arouca], weeklyOrders: [p], entregas: entregues([p]) }),
      '2026-10',
    );
    expect(codigos(previa)).not.toContain('preco_zero');
    expect(previa.grupos[0].assinaturas[0].extras[0].tipo).toBe('troca');
  });

  it('Julia: composition nula, sem slot vago — cortesia so quando o motivo esta gravado', () => {
    const julia = sub({ id: 'jul', nome: 'Julia', total_paes: 1 });
    const semMotivo = pedido({
      subscription_id: 'jul', composition: null,
      extras: [{ id: 'brioche', nome: 'Brioche', qty: 1, preco_unit: 0 }],
    });
    const semNada = montaPrevia(
      entrada({ subscriptions: [julia], weeklyOrders: [semMotivo], entregas: entregues([semMotivo]) }),
      '2026-10',
    );
    // Estado de HOJE no banco: o motivo ainda nao foi gravado, entao alerta.
    expect(codigos(semNada)).toContain('preco_zero');
    expect(semNada.grupos[0].assinaturas[0].extras[0].tipo).toBe('pago');

    const comMotivo = pedido({
      subscription_id: 'jul', composition: null,
      extras: [{ id: 'brioche', nome: 'Brioche', qty: 1, preco_unit: 0, motivo: 'cortesia' }],
    });
    const declarada = montaPrevia(
      entrada({
        subscriptions: [julia], weeklyOrders: [comMotivo], entregas: entregues([comMotivo]),
        precos: new Map([['2026-09-03', new Map([['brioche', 36]])]]),
      }),
      '2026-10',
    );
    expect(codigos(declarada)).not.toContain('preco_zero');
    expect(codigos(declarada)).not.toContain('preco_divergente');
    expect(declarada.grupos[0].assinaturas[0].extras[0].tipo).toBe('cortesia');
  });

  it('David: dois zerados sem slot vago, os dois como cortesia declarada', () => {
    const david = sub({ id: 'dav', nome: 'David Hertz', total_paes: 1 });
    const p = pedido({
      subscription_id: 'dav', composition: null,
      extras: [
        { id: 'ciabatta', nome: 'Ciabatta', qty: 1, preco_unit: 0, motivo: 'cortesia' },
        { id: 'focaccia', nome: 'Focaccia', qty: 1, preco_unit: 0, motivo: 'cortesia' },
      ],
    });
    const previa = montaPrevia(
      entrada({ subscriptions: [david], weeklyOrders: [p], entregas: entregues([p]) }),
      '2026-10',
    );
    expect(codigos(previa)).not.toContain('preco_zero');
    expect(previa.grupos[0].assinaturas[0].extras.map((e) => e.tipo)).toEqual([
      'cortesia', 'cortesia',
    ]);
  });

  it('zerado sem slot vago e sem motivo AINDA alerta', () => {
    // O caso que o alerta sempre quis pegar: preco que faltou cadastrar.
    const p = pedido({
      composition: null,
      extras: [{ id: 'brioche', nome: 'Brioche', qty: 1, preco_unit: 0 }],
    });
    const previa = montaPrevia(
      entrada({ weeklyOrders: [p], entregas: entregues([p]) }), '2026-10');
    expect(codigos(previa)).toContain('preco_zero');
  });

  it('zerados acima dos slots vagos: alerta so nos excedentes', () => {
    const dois = sub({ id: 'd2', nome: 'Dois paes', total_paes: 2 });
    const p = pedido({
      subscription_id: 'd2',
      composition: { original: 1, integral: 0 }, // 1 slot vago
      extras: [
        { id: 'brioche', nome: 'Brioche', qty: 1, preco_unit: 0 },
        { id: 'focaccia', nome: 'Focaccia', qty: 1, preco_unit: 0 },
      ],
    });
    const previa = montaPrevia(
      entrada({ subscriptions: [dois], weeklyOrders: [p], entregas: entregues([p]) }),
      '2026-10',
    );
    const tipos = previa.grupos[0].assinaturas[0].extras.map((e) => e.tipo);
    expect(tipos).toEqual(['troca', 'pago']); // o primeiro consome o slot
    expect(previa.alertas.filter((a) => a.codigo === 'preco_zero')).toHaveLength(1);
  });

  it('extra pago normal segue pago, e a divergencia de preco continua valendo', () => {
    const p = pedido({
      composition: null,
      extras: [{ id: 'brioche', nome: 'Brioche', qty: 1, preco_unit: 30 }],
    });
    const previa = montaPrevia(
      entrada({
        weeklyOrders: [p], entregas: entregues([p]),
        precos: new Map([['2026-09-03', new Map([['brioche', 36]])]]),
      }),
      '2026-10',
    );
    expect(previa.grupos[0].assinaturas[0].extras[0].tipo).toBe('pago');
    expect(codigos(previa)).toContain('preco_divergente');
  });

  it('troca so vale quando o item cabe inteiro no slot', () => {
    const dois = sub({ id: 'd2', nome: 'Dois paes', total_paes: 2 });
    const p = pedido({
      subscription_id: 'd2',
      composition: { original: 1, integral: 0 }, // 1 slot vago
      extras: [{ id: 'brioche', nome: 'Brioche', qty: 2, preco_unit: 0 }],
    });
    const previa = montaPrevia(
      entrada({ subscriptions: [dois], weeklyOrders: [p], entregas: entregues([p]) }),
      '2026-10',
    );
    // 2 unidades nao cabem em 1 slot: a linha nao se parte, cai no alerta.
    expect(previa.grupos[0].assinaturas[0].extras[0].tipo).toBe('pago');
    expect(codigos(previa)).toContain('preco_zero');
  });
});
