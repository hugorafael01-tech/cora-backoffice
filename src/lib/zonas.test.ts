import { describe, expect, it } from 'vitest';
import {
  atribuiSequenciasFaltantes,
  codigoSequencia,
  comparaCanonico,
  grupoDaEntrega,
  indexaZonas,
  moveNaSequencia,
  ondaDaEntrega,
  recalculaSequencias,
  sugereZonaPorBairro,
  zonaDaEntrega,
  type EntregaSequenciavel,
  type Zona,
} from './zonas';

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

// Espelha o seed da 0032.
const ZONAS = indexaZonas([
  zona({ codigo: 'H', onda: 'niteroi', ordem: 0, entraNaOnda: false }),
  zona({ codigo: 'N1', onda: 'niteroi', ordem: 1 }),
  zona({ codigo: 'N2', onda: 'niteroi', ordem: 2 }),
  zona({ codigo: 'N3', onda: 'niteroi', ordem: 3 }),
  zona({ codigo: 'R1', cidade: 'Rio de Janeiro', onda: 'rio', ordem: 1 }),
  zona({ codigo: 'R2', cidade: 'Rio de Janeiro', onda: 'rio', ordem: 2 }),
  zona({ codigo: 'R3', cidade: 'Rio de Janeiro', onda: 'rio', ordem: 3 }),
]);

const DEFAULTS = [
  { cidade: 'Niterói', bairro: 'Icaraí', zona: 'N3' },
  { cidade: 'Rio de Janeiro', bairro: 'Lagoa', zona: 'R1' },
  { cidade: 'Rio de Janeiro', bairro: 'Botafogo', zona: 'R2' },
];

function e(p: Partial<EntregaSequenciavel> & { id: string }): EntregaSequenciavel {
  return {
    zona: null,
    sequencia: null,
    regiao: 'niteroi',
    bairro: 'Icarai',
    rua: 'Rua A',
    numero: '10',
    nome: 'Fulano',
    ...p,
  };
}

describe('codigoSequencia', () => {
  it('prefixo da onda + zero-pad de 2 digitos', () => {
    expect(codigoSequencia('niteroi', 1)).toBe('N-01');
    expect(codigoSequencia('rio', 7)).toBe('R-07');
    expect(codigoSequencia('rio', 19)).toBe('R-19');
  });
  it('passa de 99 sem truncar', () => {
    expect(codigoSequencia('rio', 100)).toBe('R-100');
  });
});

describe('sugereZonaPorBairro', () => {
  it('acha o default do bairro', () => {
    expect(sugereZonaPorBairro('Niterói', 'Icaraí', DEFAULTS)).toBe('N3');
  });
  // O cadastro e digitado a mao e ja tem "Icarai" e "Niteroi" sem acento.
  it('tolera acento e caixa dos dois lados', () => {
    expect(sugereZonaPorBairro('NITEROI', 'icarai', DEFAULTS)).toBe('N3');
  });
  it('bairro sem default nao ganha zona por chute', () => {
    expect(sugereZonaPorBairro('Rio de Janeiro', 'Ipanema', DEFAULTS)).toBeNull();
    expect(sugereZonaPorBairro('Niterói', 'Ingá', DEFAULTS)).toBeNull();
  });
  it('cidade ou bairro vazio devolve null', () => {
    expect(sugereZonaPorBairro('', 'Icaraí', DEFAULTS)).toBeNull();
    expect(sugereZonaPorBairro('Niterói', null, DEFAULTS)).toBeNull();
  });
  // O caso que prova por que a zona NAO pode ser derivada do bairro em runtime:
  // a sugestao devolve R1 pra Lagoa, mas um dos enderecos e R3 no cadastro.
  it('Lagoa sugere R1 — a excecao lado Jardim Botanico e override no cadastro', () => {
    expect(sugereZonaPorBairro('Rio de Janeiro', 'Lagoa', DEFAULTS)).toBe('R1');
  });
});

describe('zonaDaEntrega / grupoDaEntrega / ondaDaEntrega', () => {
  it('zona conhecida define grupo e onda', () => {
    const x = e({ id: '1', zona: 'R2', regiao: 'rio' });
    expect(zonaDaEntrega(x, ZONAS)?.codigo).toBe('R2');
    expect(grupoDaEntrega(x, ZONAS)).toBe('rio');
    expect(ondaDaEntrega(x, ZONAS)).toBe('rio');
  });
  it('zona que nao viaja na bag vira grupo propria, sem onda', () => {
    const x = e({ id: '1', zona: 'H' });
    expect(grupoDaEntrega(x, ZONAS)).toBe('propria');
    expect(ondaDaEntrega(x, ZONAS)).toBeNull();
  });
  it('sem zona (ou zona desconhecida) cai na onda pela regiao do snapshot', () => {
    expect(grupoDaEntrega(e({ id: '1', regiao: 'rio' }), ZONAS)).toBe('rio');
    expect(grupoDaEntrega(e({ id: '2', zona: 'XX', regiao: 'niteroi' }), ZONAS)).toBe('niteroi');
    expect(zonaDaEntrega(e({ id: '2', zona: 'XX' }), ZONAS)).toBeNull();
  });
});

describe('comparaCanonico', () => {
  const ordena = (lista: EntregaSequenciavel[]) =>
    [...lista].sort((a, b) => comparaCanonico(a, b, ZONAS)).map((x) => x.id);

  it('ordem da zona vem antes de qualquer criterio de endereco', () => {
    expect(
      ordena([
        e({ id: 'n3', zona: 'N3', bairro: 'Aaa' }),
        e({ id: 'n1', zona: 'N1', bairro: 'Zzz' }),
      ])
    ).toEqual(['n1', 'n3']);
  });

  it('dentro da zona: bairro, depois logradouro', () => {
    expect(
      ordena([
        e({ id: 'b', zona: 'N1', bairro: 'Fonseca', rua: 'Rua B' }),
        e({ id: 'a', zona: 'N1', bairro: 'Fonseca', rua: 'Rua A' }),
        e({ id: 'c', zona: 'N1', bairro: 'Aaa', rua: 'Rua Z' }),
      ])
    ).toEqual(['c', 'a', 'b']);
  });

  it('numero compara como numero, nao como texto', () => {
    expect(
      ordena([
        e({ id: '499', zona: 'R1', bairro: 'Lagoa', rua: 'Rua Sacopã', numero: '499' }),
        e({ id: '250', zona: 'R1', bairro: 'Lagoa', rua: 'Rua Sacopã', numero: '250' }),
        e({ id: '1000', zona: 'R1', bairro: 'Lagoa', rua: 'Rua Sacopã', numero: '1000' }),
      ])
    ).toEqual(['250', '499', '1000']);
  });

  it('ignora acento na comparacao de bairro', () => {
    expect(
      ordena([
        e({ id: 'i', zona: 'N3', bairro: 'Icaraí' }),
        e({ id: 'b', zona: 'N3', bairro: 'Boa Viagem' }),
      ])
    ).toEqual(['b', 'i']);
  });

  it('entrega sem zona vai pro fim', () => {
    expect(ordena([e({ id: 'sem' }), e({ id: 'n3', zona: 'N3' })])).toEqual(['n3', 'sem']);
  });

  // Previsibilidade e o requisito: mesmo conjunto -> mesma ordem, sempre.
  it('e estavel: rodar de novo com a entrada embaralhada da o mesmo resultado', () => {
    const lista = [
      e({ id: 'a', zona: 'N1', bairro: 'Fonseca', rua: 'Rua A' }),
      e({ id: 'b', zona: 'N3', bairro: 'Icarai', rua: 'Rua B' }),
      e({ id: 'c', zona: 'N3', bairro: 'Boa Viagem', rua: 'Rua C' }),
    ];
    expect(ordena(lista)).toEqual(ordena([...lista].reverse()));
  });
});

describe('atribuiSequenciasFaltantes', () => {
  it('numera 1..n por onda, em ordem canonica, ondas independentes', () => {
    const lista = [
      e({ id: 'n3', zona: 'N3', bairro: 'Icarai' }),
      e({ id: 'n1', zona: 'N1', bairro: 'Fonseca' }),
      e({ id: 'r2', zona: 'R2', regiao: 'rio', bairro: 'Botafogo' }),
      e({ id: 'r1', zona: 'R1', regiao: 'rio', bairro: 'Lagoa' }),
    ];
    expect(atribuiSequenciasFaltantes(lista, ZONAS)).toEqual([
      { id: 'n1', sequencia: 1 },
      { id: 'n3', sequencia: 2 },
      { id: 'r1', sequencia: 1 },
      { id: 'r2', sequencia: 2 },
    ]);
  });

  it('zona H nao entra na numeracao das ondas', () => {
    const saida = atribuiSequenciasFaltantes(
      [e({ id: 'h', zona: 'H' }), e({ id: 'n1', zona: 'N1' })],
      ZONAS
    );
    expect(saida).toEqual([{ id: 'n1', sequencia: 1 }]);
  });

  // O ponto do briefing: o sistema nao pode desfazer o ajuste manual do Hugo.
  it('nao toca em quem ja tem sequencia; novo entra no fim da onda', () => {
    const lista = [
      e({ id: 'ja1', zona: 'N3', sequencia: 1, bairro: 'Icarai' }),
      e({ id: 'ja2', zona: 'N1', sequencia: 2, bairro: 'Fonseca' }),
      e({ id: 'novo', zona: 'N1', bairro: 'Aaa' }),
    ];
    expect(atribuiSequenciasFaltantes(lista, ZONAS)).toEqual([{ id: 'novo', sequencia: 3 }]);
  });

  it('varios novos entram em ordem canonica, um atras do outro', () => {
    const lista = [
      e({ id: 'ja', zona: 'N1', sequencia: 5 }),
      e({ id: 'n3', zona: 'N3', bairro: 'Icarai' }),
      e({ id: 'n2', zona: 'N2', bairro: 'Charitas' }),
    ];
    expect(atribuiSequenciasFaltantes(lista, ZONAS)).toEqual([
      { id: 'n2', sequencia: 6 },
      { id: 'n3', sequencia: 7 },
    ]);
  });

  it('nada a fazer quando todo mundo ja tem numero', () => {
    expect(atribuiSequenciasFaltantes([e({ id: 'a', zona: 'N1', sequencia: 1 })], ZONAS)).toEqual([]);
  });

  it('entrega sem zona tambem e sequenciada, no fim da onda', () => {
    const saida = atribuiSequenciasFaltantes(
      [e({ id: 'sem' }), e({ id: 'n1', zona: 'N1' })],
      ZONAS
    );
    expect(saida).toEqual([
      { id: 'n1', sequencia: 1 },
      { id: 'sem', sequencia: 2 },
    ]);
  });
});

describe('recalculaSequencias', () => {
  it('renumera a onda 1..n em ordem canonica, descartando o arranjo manual', () => {
    const lista = [
      e({ id: 'a', zona: 'N3', sequencia: 1, bairro: 'Icarai' }),
      e({ id: 'b', zona: 'N1', sequencia: 2, bairro: 'Fonseca' }),
      e({ id: 'c', zona: 'N2', sequencia: 9, bairro: 'Charitas' }),
    ];
    expect(recalculaSequencias(lista, ZONAS, 'niteroi')).toEqual([
      { id: 'b', sequencia: 1 },
      { id: 'c', sequencia: 2 },
      { id: 'a', sequencia: 3 },
    ]);
  });

  it('mexe so na onda pedida', () => {
    const lista = [
      e({ id: 'n', zona: 'N1', sequencia: 3 }),
      e({ id: 'r', zona: 'R2', regiao: 'rio', sequencia: 3 }),
    ];
    expect(recalculaSequencias(lista, ZONAS, 'rio')).toEqual([{ id: 'r', sequencia: 1 }]);
  });

  it('nao renumera quem nao viaja na bag', () => {
    expect(recalculaSequencias([e({ id: 'h', zona: 'H' })], ZONAS, 'niteroi')).toEqual([]);
  });
});

describe('moveNaSequencia', () => {
  const lista = [
    e({ id: 'a', zona: 'N1', sequencia: 1 }),
    e({ id: 'b', zona: 'N2', sequencia: 2 }),
    e({ id: 'c', zona: 'N3', sequencia: 3 }),
  ];

  it('troca de numero com a vizinha de cima — so duas linhas mudam', () => {
    expect(moveNaSequencia(lista, ZONAS, 'c', 'cima')).toEqual([
      { id: 'c', sequencia: 2 },
      { id: 'b', sequencia: 3 },
    ]);
  });

  it('troca com a vizinha de baixo', () => {
    expect(moveNaSequencia(lista, ZONAS, 'a', 'baixo')).toEqual([
      { id: 'a', sequencia: 2 },
      { id: 'b', sequencia: 1 },
    ]);
  });

  it('na ponta nao faz nada', () => {
    expect(moveNaSequencia(lista, ZONAS, 'a', 'cima')).toEqual([]);
    expect(moveNaSequencia(lista, ZONAS, 'c', 'baixo')).toEqual([]);
  });

  it('nao atravessa ondas: vizinha e da mesma onda', () => {
    const misto = [
      e({ id: 'n', zona: 'N1', sequencia: 1 }),
      e({ id: 'r', zona: 'R1', regiao: 'rio', sequencia: 1 }),
      e({ id: 'r2', zona: 'R2', regiao: 'rio', sequencia: 2 }),
    ];
    expect(moveNaSequencia(misto, ZONAS, 'n', 'baixo')).toEqual([]);
    expect(moveNaSequencia(misto, ZONAS, 'r2', 'cima')).toEqual([
      { id: 'r2', sequencia: 1 },
      { id: 'r', sequencia: 2 },
    ]);
  });

  it('entrega sem sequencia ou que nao viaja na bag nao move', () => {
    expect(moveNaSequencia([...lista, e({ id: 'x', zona: 'N1' })], ZONAS, 'x', 'cima')).toEqual([]);
    expect(moveNaSequencia([e({ id: 'h', zona: 'H', sequencia: 1 })], ZONAS, 'h', 'cima')).toEqual([]);
  });

  it('id inexistente nao explode', () => {
    expect(moveNaSequencia(lista, ZONAS, 'zzz', 'cima')).toEqual([]);
  });

  // Trocar preserva o conjunto de numeros: a bag continua contigua 1..n.
  it('o conjunto de numeros da onda nao muda depois da troca', () => {
    const troca = moveNaSequencia(lista, ZONAS, 'b', 'cima');
    const depois = lista.map((x) => troca.find((t) => t.id === x.id)?.sequencia ?? x.sequencia);
    expect([...depois].sort()).toEqual([1, 2, 3]);
  });
});
