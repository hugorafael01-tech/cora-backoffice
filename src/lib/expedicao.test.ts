import { describe, expect, it } from 'vitest';
import {
  agrupaPorRegiao,
  enderecoCurto,
  flattenComposicaoPontual,
  flattenComposition,
  itensAssinatura,
  linhaRota,
  normalizaRegiao,
  proximoStatus,
  resumoItens,
  statusAnterior,
  textoRota,
  type EntregaLite,
} from './expedicao';

const NOMES = new Map([
  ['original', 'Original'],
  ['focaccia', 'Focaccia'],
  ['integral', 'Integral'],
]);

describe('normalizaRegiao', () => {
  it('cidade com "niter" (com/sem acento, caixa) -> niteroi', () => {
    expect(normalizaRegiao('Niterói')).toBe('niteroi');
    expect(normalizaRegiao('NITEROI')).toBe('niteroi');
    expect(normalizaRegiao('  niteroi ')).toBe('niteroi');
  });
  it('qualquer outra cidade -> rio', () => {
    expect(normalizaRegiao('Rio de Janeiro')).toBe('rio');
    expect(normalizaRegiao('Sao Goncalo')).toBe('rio');
    expect(normalizaRegiao('')).toBe('rio');
    expect(normalizaRegiao(null)).toBe('rio');
  });
});

describe('flattenComposition', () => {
  it('mapa slug->qty: ignora qty 0 e resolve nome via produtos', () => {
    const itens = flattenComposition({ original: 3, focaccia: 0, integral: 1 }, [], NOMES);
    expect(itens).toEqual([
      { slug: 'original', nome: 'Original', qty: 3 },
      { slug: 'integral', nome: 'Integral', qty: 1 },
    ]);
  });

  it('fallback no slug quando o produto nao esta no mapa', () => {
    const itens = flattenComposition({ pizza: 2 }, [], NOMES);
    expect(itens).toEqual([{ slug: 'pizza', nome: 'pizza', qty: 2 }]);
  });

  it('extras [{id,qty,nome}] entram e somam no mesmo slug da composicao', () => {
    const itens = flattenComposition(
      { original: 2 },
      [
        { id: 'original', qty: 1, nome: 'Original' },
        { id: 'focaccia', qty: 1, nome: 'Focaccia' },
      ],
      NOMES
    );
    expect(itens).toEqual([
      { slug: 'original', nome: 'Original', qty: 3 },
      { slug: 'focaccia', nome: 'Focaccia', qty: 1 },
    ]);
  });

  it('composition null/extras null -> vazio', () => {
    expect(flattenComposition(null, null, NOMES)).toEqual([]);
  });

  it('extra com qty 0 e ignorado', () => {
    expect(flattenComposition({}, [{ id: 'focaccia', qty: 0 }], NOMES)).toEqual([]);
  });
});

describe('flattenComposicaoPontual', () => {
  it('objeto { slug: qty } sem extras', () => {
    expect(flattenComposicaoPontual({ integral: 2, original: 0 }, NOMES)).toEqual([
      { slug: 'integral', nome: 'Integral', qty: 2 },
    ]);
  });
});

describe('itensAssinatura', () => {
  it('sem weekly_order -> baseline puro (Original + Integral do plano)', () => {
    const itens = itensAssinatura(null, { original: 2, integral: 1 }, NOMES);
    expect(itens).toEqual([
      { slug: 'original', nome: 'Original', qty: 2 },
      { slug: 'integral', nome: 'Integral', qty: 1 },
    ]);
  });

  it('order rascunho com composicao e extras -> ignorado, cai no baseline puro (sem extras)', () => {
    const itens = itensAssinatura(
      {
        status: 'rascunho',
        composition: { original: 5, focaccia: 2 },
        extras: [{ id: 'focaccia', qty: 3, nome: 'Focaccia' }],
      },
      { original: 2, integral: 1 },
      NOMES
    );
    expect(itens).toEqual([
      { slug: 'original', nome: 'Original', qty: 2 },
      { slug: 'integral', nome: 'Integral', qty: 1 },
    ]);
  });

  it('order confirmado com composicao custom + extras -> usa o override', () => {
    const itens = itensAssinatura(
      {
        status: 'confirmado',
        composition: { original: 5, focaccia: 2 },
        extras: [{ id: 'focaccia', qty: 1, nome: 'Focaccia' }],
      },
      { original: 2, integral: 1 },
      NOMES
    );
    expect(itens).toEqual([
      { slug: 'original', nome: 'Original', qty: 5 },
      { slug: 'focaccia', nome: 'Focaccia', qty: 3 },
    ]);
  });

  it('order confirmado com composicao null -> cai no baseline, mas extras ainda entram', () => {
    const itens = itensAssinatura(
      { status: 'confirmado', composition: null, extras: [{ id: 'focaccia', qty: 2, nome: 'Focaccia' }] },
      { original: 2, integral: 1 },
      NOMES
    );
    expect(itens).toEqual([
      { slug: 'original', nome: 'Original', qty: 2 },
      { slug: 'integral', nome: 'Integral', qty: 1 },
      { slug: 'focaccia', nome: 'Focaccia', qty: 2 },
    ]);
  });

  it('baseline com qty 0 nao entra (ex: so Original no plano)', () => {
    const itens = itensAssinatura(null, { original: 3, integral: 0 }, NOMES);
    expect(itens).toEqual([{ slug: 'original', nome: 'Original', qty: 3 }]);
  });
});

describe('resumoItens / enderecoCurto', () => {
  it('resumo "3x Original · 1x Focaccia"', () => {
    expect(
      resumoItens([
        { slug: 'original', nome: 'Original', qty: 3 },
        { slug: 'focaccia', nome: 'Focaccia', qty: 1 },
      ])
    ).toBe('3x Original · 1x Focaccia');
  });
  it('endereco curto "rua, numero · bairro"', () => {
    expect(enderecoCurto({ rua: 'Rua A', numero: '10', bairro: 'Icarai' })).toBe(
      'Rua A, 10 · Icarai'
    );
  });
  it('endereco curto sem numero', () => {
    expect(enderecoCurto({ rua: 'Rua A', numero: null, bairro: 'Centro' })).toBe(
      'Rua A · Centro'
    );
  });
});

function entrega(p: Partial<EntregaLite>): EntregaLite {
  return {
    id: 'x',
    nome: 'Fulano',
    whatsapp: null,
    cep: null,
    rua: 'Rua A',
    numero: '10',
    complemento: null,
    bairro: 'Icarai',
    cidade: 'Niteroi',
    regiao: 'niteroi',
    itens: [{ slug: 'original', nome: 'Original', qty: 2 }],
    observacao: null,
    status: 'pendente',
    emRotaAt: null,
    entregueAt: null,
    ...p,
  };
}

describe('linhaRota / textoRota', () => {
  it('formato N. Nome — endereco — bairro — itens (sem obs)', () => {
    expect(linhaRota(1, entrega({ nome: 'Ana', numero: '20', complemento: 'ap 301' }))).toBe(
      '1. Ana — Rua A, 20, ap 301 — Icarai — 2x Original'
    );
  });
  it('inclui obs quando preenchida; "sem itens" quando vazio', () => {
    expect(linhaRota(2, entrega({ nome: 'Bia', itens: [], observacao: 'portao azul' }))).toBe(
      '2. Bia — Rua A, 10 — Icarai — sem itens — portao azul'
    );
  });
  it('textoRota numera na ordem da lista', () => {
    const txt = textoRota([entrega({ nome: 'Ana' }), entrega({ nome: 'Bia' })]);
    expect(txt.split('\n')).toHaveLength(2);
    expect(txt).toContain('1. Ana');
    expect(txt).toContain('2. Bia');
  });
});

describe('proximoStatus / statusAnterior', () => {
  it('avanca pendente -> em_rota -> entregue e trava em entregue', () => {
    expect(proximoStatus('pendente')).toBe('em_rota');
    expect(proximoStatus('em_rota')).toBe('entregue');
    expect(proximoStatus('entregue')).toBe('entregue');
  });
  it('volta entregue -> em_rota -> pendente e trava em pendente', () => {
    expect(statusAnterior('entregue')).toBe('em_rota');
    expect(statusAnterior('em_rota')).toBe('pendente');
    expect(statusAnterior('pendente')).toBe('pendente');
  });
});

describe('agrupaPorRegiao', () => {
  const lista: EntregaLite[] = [
    entrega({ id: '1', nome: 'Ana', bairro: 'Santa Rosa', regiao: 'niteroi', status: 'entregue' }),
    entrega({ id: '2', nome: 'Bia', bairro: 'Icarai', regiao: 'niteroi' }),
    entrega({ id: '3', nome: 'Caio', bairro: 'Botafogo', regiao: 'rio', cidade: 'Rio de Janeiro' }),
  ];

  it('Niteroi antes de Rio; bairros em ordem alfabetica', () => {
    const grupos = agrupaPorRegiao(lista);
    expect(grupos.map((g) => g.regiao)).toEqual(['niteroi', 'rio']);
    expect(grupos[0].entregas.map((e) => e.bairro)).toEqual(['Icarai', 'Santa Rosa']);
  });

  it('contadores total/entregues por grupo', () => {
    const grupos = agrupaPorRegiao(lista);
    expect(grupos[0]).toMatchObject({ total: 2, entregues: 1 });
    expect(grupos[1]).toMatchObject({ total: 1, entregues: 0 });
  });

  it('grupo sem entrega nao aparece', () => {
    const soNiteroi = agrupaPorRegiao([lista[1]]);
    expect(soNiteroi.map((g) => g.regiao)).toEqual(['niteroi']);
  });
});
