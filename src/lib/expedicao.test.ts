import { describe, expect, it } from 'vitest';
import {
  agrupaPorOnda,
  enderecoCurto,
  flattenComposicaoPontual,
  flattenComposition,
  itensAssinatura,
  linhaRota,
  normalizaRegiao,
  proximoStatus,
  resumoItens,
  ocupacaoBag,
  ordemCarregamento,
  rotuloSequencia,
  statusAnterior,
  textoRota,
  type EntregaLite,
  type GrupoEntregas,
} from './expedicao';
import { indexaZonas, type Zona } from './zonas';

function zona(p: Partial<Zona> & { codigo: string }): Zona {
  return {
    nome: p.codigo,
    cidade: 'Niterói',
    onda: 'niteroi',
    ordem: 1,
    corHex: '#000000',
    forma: 'circulo',
    entraNaOnda: true,
    ativo: true,
    ...p,
  };
}

const ZONAS = indexaZonas([
  zona({ codigo: 'H', onda: 'niteroi', ordem: 0, entraNaOnda: false }),
  zona({ codigo: 'N1', onda: 'niteroi', ordem: 1 }),
  zona({ codigo: 'N3', onda: 'niteroi', ordem: 3 }),
  zona({ codigo: 'R2', cidade: 'Rio de Janeiro', onda: 'rio', ordem: 2 }),
]);

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
    zona: null,
    sequencia: null,
    itens: [{ slug: 'original', nome: 'Original', qty: 2 }],
    observacao: null,
    status: 'pendente',
    emRotaAt: null,
    entregueAt: null,
    ...p,
  };
}

function grupoDe(entregas: EntregaLite[]): GrupoEntregas {
  const g = agrupaPorOnda(entregas, ZONAS);
  return g[0];
}

describe('linhaRota / textoRota', () => {
  it('formato rotulo. Nome — endereco — bairro — itens (sem obs)', () => {
    expect(linhaRota('N-01', entrega({ nome: 'Ana', numero: '20', complemento: 'ap 301' }))).toBe(
      'N-01. Ana — Rua A, 20, ap 301 — Icarai — 2x Original'
    );
  });
  it('inclui obs quando preenchida; "sem itens" quando vazio', () => {
    expect(linhaRota('N-02', entrega({ nome: 'Bia', itens: [], observacao: 'portao azul' }))).toBe(
      'N-02. Bia — Rua A, 10 — Icarai — sem itens — portao azul'
    );
  });
  it('textoRota usa o mesmo codigo impresso na etiqueta', () => {
    const txt = textoRota(
      grupoDe([
        entrega({ id: 'a', nome: 'Ana', zona: 'N1', sequencia: 1 }),
        entrega({ id: 'b', nome: 'Bia', zona: 'N3', sequencia: 2 }),
      ])
    );
    expect(txt.split('\n')).toHaveLength(2);
    expect(txt).toContain('N-01. Ana');
    expect(txt).toContain('N-02. Bia');
  });
  it('cai no numero de ordem quando a entrega ainda nao tem sequencia', () => {
    const txt = textoRota(grupoDe([entrega({ id: 'a', nome: 'Ana' })]));
    expect(txt).toContain('1. Ana');
  });
  // Contato do assinante nao circula fora da Cora (decisao do Hugo, 04/08): a
  // rota vai pro celular do entregador, entao telefone nao entra nela. O
  // entregador fala com o Hugo, o Hugo fala com o cliente.
  it('nao vaza o telefone do assinante na rota', () => {
    const fone = '(21) 98888-7777';
    const e = entrega({ nome: 'Ana', whatsapp: fone });
    expect(linhaRota('N-01', e)).not.toContain('8888');
    expect(textoRota(grupoDe([e]))).not.toContain('8888');
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

describe('agrupaPorOnda', () => {
  const lista: EntregaLite[] = [
    entrega({ id: '1', nome: 'Ana', bairro: 'Fonseca', zona: 'N1', sequencia: 2, status: 'entregue' }),
    entrega({ id: '2', nome: 'Bia', bairro: 'Icarai', zona: 'N3', sequencia: 1 }),
    entrega({
      id: '3',
      nome: 'Caio',
      bairro: 'Botafogo',
      regiao: 'rio',
      cidade: 'Rio de Janeiro',
      zona: 'R2',
      sequencia: 1,
    }),
    entrega({ id: '4', nome: 'Hugo', bairro: 'Fonseca', zona: 'H' }),
  ];

  it('Niteroi, Rio e entrega propria, nessa ordem', () => {
    expect(agrupaPorOnda(lista, ZONAS).map((g) => g.grupo)).toEqual(['niteroi', 'rio', 'propria']);
  });

  it('ordena pela sequencia dentro do grupo, nao pelo bairro', () => {
    const [niteroi] = agrupaPorOnda(lista, ZONAS);
    expect(niteroi.entregas.map((e) => e.nome)).toEqual(['Bia', 'Ana']);
  });

  it('contadores total/entregues por grupo', () => {
    const [niteroi, rio] = agrupaPorOnda(lista, ZONAS);
    expect(niteroi).toMatchObject({ total: 2, entregues: 1 });
    expect(rio).toMatchObject({ total: 1, entregues: 0 });
  });

  it('entrega propria nao conta pacote pra bag', () => {
    const propria = agrupaPorOnda(lista, ZONAS)[2];
    expect(propria).toMatchObject({ total: 1, pacotes: 0, onda: null });
  });

  it('grupo sem entrega nao aparece', () => {
    expect(agrupaPorOnda([lista[1]], ZONAS).map((g) => g.grupo)).toEqual(['niteroi']);
  });

  // Pacote sem zona precisa continuar visivel, sequenciavel e carregavel: campo
  // de cadastro vazio nao pode fazer uma entrega real sumir da lista.
  it('entrega sem zona fica na onda da regiao, no fim, e e contada como semZona', () => {
    const [niteroi] = agrupaPorOnda([...lista, entrega({ id: '5', nome: 'Zoe' })], ZONAS);
    expect(niteroi.entregas.map((e) => e.nome)).toEqual(['Bia', 'Ana', 'Zoe']);
    expect(niteroi).toMatchObject({ total: 3, semZona: 1, semSequencia: 1, pacotes: 3 });
  });

  it('zona desativada/desconhecida no snapshot cai no mesmo fallback', () => {
    const [niteroi] = agrupaPorOnda([entrega({ id: '9', zona: 'XX' })], ZONAS);
    expect(niteroi).toMatchObject({ grupo: 'niteroi', semZona: 1 });
  });
});

describe('rotuloSequencia', () => {
  it('monta o codigo com o prefixo da onda e zero-pad de 2 digitos', () => {
    expect(rotuloSequencia({ sequencia: 7 }, 'rio')).toBe('R-07');
    expect(rotuloSequencia({ sequencia: 1 }, 'niteroi')).toBe('N-01');
    expect(rotuloSequencia({ sequencia: 103 }, 'rio')).toBe('R-103');
  });
  it('null sem sequencia ou sem onda (entrega propria)', () => {
    expect(rotuloSequencia({ sequencia: null }, 'rio')).toBeNull();
    expect(rotuloSequencia({ sequencia: 3 }, null)).toBeNull();
  });
});

describe('ordemCarregamento', () => {
  // Ultima parada no fundo da bag, primeira no topo: o motoboy tira o pacote de
  // cima a cada parada em vez de garimpar.
  it('inverte a ordem de entrega e nao muta a lista original', () => {
    const lista = [
      entrega({ id: 'a', sequencia: 1 }),
      entrega({ id: 'b', sequencia: 2 }),
      entrega({ id: 'c', sequencia: 3 }),
    ];
    expect(ordemCarregamento(lista).map((e) => e.id)).toEqual(['c', 'b', 'a']);
    expect(lista.map((e) => e.id)).toEqual(['a', 'b', 'c']);
  });
});

describe('ocupacaoBag', () => {
  it('sem capacidade configurada nao alerta', () => {
    expect(ocupacaoBag(19, null)).toMatchObject({ acima: false, excedente: 0, capacidade: null });
  });
  it('dentro da capacidade (inclusive no limite exato)', () => {
    expect(ocupacaoBag(20, 20)).toMatchObject({ acima: false, excedente: 0 });
  });
  it('acima da capacidade informa o excedente', () => {
    expect(ocupacaoBag(23, 20)).toMatchObject({ acima: true, excedente: 3 });
  });
});
