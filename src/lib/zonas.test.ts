import { describe, expect, it } from 'vitest';
import {
  atribuiSequenciasFaltantes,
  codigoSequencia,
  comparaCanonico,
  grupoDaEntrega,
  indexaOrdemBairros,
  indexaZonas,
  moveNaSequencia,
  ondaDaEntrega,
  ordemDoBairro,
  recalculaSequencias,
  sugereZonaPorBairro,
  zonaDaEntrega,
  ORDEM_ROTA_PADRAO,
  type BairroZonaDefault,
  type EntregaSequenciavel,
  type OrdemContexto,
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

// Espelha o seed da 0032 + a ordem de rota da 0033. Gavea e 4, nao 3: o 3 fica
// reservado pra Lagoa lado Jardim Botanico, que nao tem linha propria.
const DEFAULTS: BairroZonaDefault[] = [
  { cidade: 'Niterói', bairro: 'Fonseca', zona: 'N1', ordem: 1 },
  { cidade: 'Niterói', bairro: 'Vital Brazil', zona: 'N1', ordem: 2 },
  { cidade: 'Niterói', bairro: 'Charitas', zona: 'N2', ordem: 1 },
  { cidade: 'Niterói', bairro: 'São Francisco', zona: 'N2', ordem: 2 },
  { cidade: 'Niterói', bairro: 'Icaraí', zona: 'N3', ordem: 1 },
  { cidade: 'Niterói', bairro: 'Boa Viagem', zona: 'N3', ordem: 2 },
  { cidade: 'Rio de Janeiro', bairro: 'Cosme Velho', zona: 'R1', ordem: 1 },
  { cidade: 'Rio de Janeiro', bairro: 'Lagoa', zona: 'R1', ordem: 2 },
  { cidade: 'Rio de Janeiro', bairro: 'Humaitá', zona: 'R1', ordem: 3 },
  { cidade: 'Rio de Janeiro', bairro: 'Botafogo', zona: 'R2', ordem: 1 },
  { cidade: 'Rio de Janeiro', bairro: 'Flamengo', zona: 'R2', ordem: 2 },
  { cidade: 'Rio de Janeiro', bairro: 'Glória', zona: 'R2', ordem: 3 },
  { cidade: 'Rio de Janeiro', bairro: 'Urca', zona: 'R3', ordem: 1 },
  { cidade: 'Rio de Janeiro', bairro: 'Copacabana', zona: 'R3', ordem: 2 },
  { cidade: 'Rio de Janeiro', bairro: 'Gávea', zona: 'R3', ordem: 4 },
];

const CTX: OrdemContexto = { zonas: ZONAS, bairros: indexaOrdemBairros(DEFAULTS) };

function e(p: Partial<EntregaSequenciavel> & { id: string }): EntregaSequenciavel {
  return {
    zona: null,
    sequencia: null,
    ordemRota: null,
    regiao: 'niteroi',
    bairro: 'Icarai',
    cidade: 'Niteroi',
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

describe('ordemDoBairro', () => {
  const bairros = indexaOrdemBairros(DEFAULTS);
  it('acha a ordem do bairro na rota', () => {
    expect(ordemDoBairro('Niterói', 'Icaraí', bairros)).toBe(1);
    expect(ordemDoBairro('Niterói', 'Boa Viagem', bairros)).toBe(2);
  });
  it('tolera acento e caixa', () => {
    expect(ordemDoBairro('NITEROI', 'icarai', bairros)).toBe(1);
  });
  it('bairro fora do cadastro nao tem ordem', () => {
    expect(ordemDoBairro('Rio de Janeiro', 'Ipanema', bairros)).toBeNull();
  });
  // A Lagoa tem UMA linha (R1, ordem 2) porque a sugestao de zona tem que ser
  // nao-ambigua. Quem esta na Lagoa mas com zona R3 leva essa ordem 2 pra dentro
  // de R3 — ver o teste de posicionamento da Suzana mais abaixo.
  it('Lagoa tem uma ordem so, a da linha de R1', () => {
    expect(ordemDoBairro('Rio de Janeiro', 'Lagoa', bairros)).toBe(2);
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
    [...lista].sort((a, b) => comparaCanonico(a, b, CTX)).map((x) => x.id);

  it('ordem da zona vem antes de qualquer criterio de endereco', () => {
    expect(
      ordena([
        e({ id: 'n3', zona: 'N3', bairro: 'Aaa' }),
        e({ id: 'n1', zona: 'N1', bairro: 'Zzz' }),
      ])
    ).toEqual(['n1', 'n3']);
  });

  it('dentro do bairro: logradouro', () => {
    expect(
      ordena([
        e({ id: 'b', zona: 'N1', bairro: 'Fonseca', rua: 'Rua B' }),
        e({ id: 'a', zona: 'N1', bairro: 'Fonseca', rua: 'Rua A' }),
      ])
    ).toEqual(['a', 'b']);
  });

  // Ate a 0032 a ordem dentro da zona era alfabetica e o bairro fora do cadastro
  // vinha junto com os outros. Agora ordem de bairro manda, e quem nao tem ordem
  // fecha a zona.
  it('bairro cadastrado vem antes de bairro sem ordem, mesmo alfabeticamente depois', () => {
    expect(
      ordena([
        e({ id: 'aaa', zona: 'N1', bairro: 'Aaa', rua: 'Rua Z' }),
        e({ id: 'fon', zona: 'N1', bairro: 'Fonseca', rua: 'Rua A' }),
      ])
    ).toEqual(['fon', 'aaa']);
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

  // O bairro so decide entre quem tem a MESMA ordem de bairro (ou nenhuma);
  // ai a comparacao ignora acento e caixa.
  it('ignora acento na comparacao de bairro (desempate de bairros sem ordem)', () => {
    expect(
      ordena([
        e({ id: 'z', zona: 'N3', bairro: 'Ácaro' }),
        e({ id: 'a', zona: 'N3', bairro: 'Abadia' }),
      ])
    ).toEqual(['a', 'z']);
  });

  // Icarai (ordem 1) tem que vir antes de Boa Viagem (ordem 2) — o inverso do
  // alfabeto, que e o bug que a 0033 conserta.
  it('acento nao atrapalha o lookup da ordem do bairro', () => {
    expect(
      ordena([
        e({ id: 'b', zona: 'N3', bairro: 'Boa Viagem' }),
        e({ id: 'i', zona: 'N3', bairro: 'Icarai' }),
      ])
    ).toEqual(['i', 'b']);
  });

  it('entrega sem zona vai pro fim', () => {
    expect(ordena([e({ id: 'sem' }), e({ id: 'n3', zona: 'N3' })])).toEqual(['n3', 'sem']);
  });

  // O motivo da 0033: alfabeticamente Boa Viagem vinha antes de Icarai e o
  // motoboy atravessava Icarai duas vezes. Boa Viagem e o ponto mais proximo da
  // ponte e tem que FECHAR a onda de Niteroi.
  it('ordem do bairro manda sobre o alfabeto: Icarai antes de Boa Viagem', () => {
    expect(
      ordena([
        e({ id: 'boa', zona: 'N3', bairro: 'Boa Viagem' }),
        e({ id: 'ica', zona: 'N3', bairro: 'Icarai' }),
      ])
    ).toEqual(['ica', 'boa']);
  });

  it('ordem da zona ainda vem antes da ordem do bairro', () => {
    expect(
      ordena([
        e({ id: 'n3', zona: 'N3', bairro: 'Icarai' }),      // bairro ordem 1
        e({ id: 'n1', zona: 'N1', bairro: 'Vital Brazil' }), // bairro ordem 2
      ])
    ).toEqual(['n1', 'n3']);
  });

  it('bairro sem ordem cadastrada vai pro fim da zona', () => {
    expect(
      ordena([
        e({ id: 'ipanema', zona: 'R2', cidade: 'Rio de Janeiro', bairro: 'Ipanema' }),
        e({ id: 'gloria', zona: 'R2', cidade: 'Rio de Janeiro', bairro: 'Glória' }),
      ])
    ).toEqual(['gloria', 'ipanema']);
  });

  // Quem nao tem ordem_rota fica no MEIO da faixa (ORDEM_ROTA_PADRAO), nao no
  // fim: e o que permite um valor sozinho puxar OU empurrar.
  it('ordem_rota abaixo do padrao puxa pra frente do bairro', () => {
    expect(
      ordena([
        e({ id: 'sem', zona: 'N3', bairro: 'Icarai', rua: 'Rua A' }),
        e({ id: 'puxado', zona: 'N3', bairro: 'Icarai', rua: 'Rua Z', ordemRota: 100 }),
      ])
    ).toEqual(['puxado', 'sem']);
  });

  it('ordem_rota acima do padrao empurra pro fim do bairro', () => {
    expect(
      ordena([
        e({ id: 'empurrado', zona: 'N3', bairro: 'Icarai', rua: 'Rua A', ordemRota: 900 }),
        e({ id: 'sem', zona: 'N3', bairro: 'Icarai', rua: 'Rua Z' }),
      ])
    ).toEqual(['sem', 'empurrado']);
  });

  it('gravar exatamente o padrao e o mesmo que deixar em branco', () => {
    const comValor = e({ id: 'x', zona: 'N3', bairro: 'Icarai', rua: 'Rua A', ordemRota: ORDEM_ROTA_PADRAO });
    const semValor = e({ id: 'x', zona: 'N3', bairro: 'Icarai', rua: 'Rua A' });
    const outro = e({ id: 'y', zona: 'N3', bairro: 'Icarai', rua: 'Rua Z' });
    expect(comparaCanonico(comValor, outro, CTX)).toBe(comparaCanonico(semValor, outro, CTX));
  });

  // Vale pros dois lados: nem 100 tira alguem de Boa Viagem pra antes de Icarai,
  // nem 900 empurra alguem de Icarai pra depois de Boa Viagem.
  it('ordem_rota nao atravessa a ordem do bairro', () => {
    expect(
      ordena([
        e({ id: 'boa', zona: 'N3', bairro: 'Boa Viagem', ordemRota: 100 }),
        e({ id: 'ica', zona: 'N3', bairro: 'Icarai', ordemRota: 900 }),
      ])
    ).toEqual(['ica', 'boa']);
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
    expect(atribuiSequenciasFaltantes(lista, CTX)).toEqual([
      { id: 'n1', sequencia: 1 },
      { id: 'n3', sequencia: 2 },
      { id: 'r1', sequencia: 1 },
      { id: 'r2', sequencia: 2 },
    ]);
  });

  it('zona H nao entra na numeracao das ondas', () => {
    const saida = atribuiSequenciasFaltantes(
      [e({ id: 'h', zona: 'H' }), e({ id: 'n1', zona: 'N1' })],
      CTX
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
    expect(atribuiSequenciasFaltantes(lista, CTX)).toEqual([{ id: 'novo', sequencia: 3 }]);
  });

  it('varios novos entram em ordem canonica, um atras do outro', () => {
    const lista = [
      e({ id: 'ja', zona: 'N1', sequencia: 5 }),
      e({ id: 'n3', zona: 'N3', bairro: 'Icarai' }),
      e({ id: 'n2', zona: 'N2', bairro: 'Charitas' }),
    ];
    expect(atribuiSequenciasFaltantes(lista, CTX)).toEqual([
      { id: 'n2', sequencia: 6 },
      { id: 'n3', sequencia: 7 },
    ]);
  });

  it('nada a fazer quando todo mundo ja tem numero', () => {
    expect(atribuiSequenciasFaltantes([e({ id: 'a', zona: 'N1', sequencia: 1 })], CTX)).toEqual([]);
  });

  it('entrega sem zona tambem e sequenciada, no fim da onda', () => {
    const saida = atribuiSequenciasFaltantes(
      [e({ id: 'sem' }), e({ id: 'n1', zona: 'N1' })],
      CTX
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
    expect(recalculaSequencias(lista, CTX, 'niteroi')).toEqual([
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
    expect(recalculaSequencias(lista, CTX, 'rio')).toEqual([{ id: 'r', sequencia: 1 }]);
  });

  it('nao renumera quem nao viaja na bag', () => {
    expect(recalculaSequencias([e({ id: 'h', zona: 'H' })], CTX, 'niteroi')).toEqual([]);
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


// Os dois casos de borda de bairro do briefing, com os assinantes reais.
describe('casos reais de borda de bairro (briefing 17/08)', () => {
  const ordena = (lista: EntregaSequenciavel[]) =>
    [...lista].sort((a, b) => comparaCanonico(a, b, CTX)).map((x) => x.nome);

  const icarai = (nome: string, rua: string, numero: string, ordemRota: number | null = null) =>
    e({ id: nome, nome, zona: 'N3', cidade: 'Niterói', bairro: 'Icaraí', rua, numero, ordemRota });

  const N3 = (ordens: Record<string, number | null> = {}) => [
    icarai('Maria Tereza', 'Avenida Jornalista Alberto Francisco Torres', '59', ordens['Maria Tereza'] ?? null),
    icarai('Isabel Considera', 'Rua Belisario Augusto', '79', ordens['Isabel Considera'] ?? null),
    icarai('Dani Considera', 'Rua Mariz e Barros', '121', ordens['Dani Considera'] ?? null),
    icarai('Maria Helena Paixão', 'Rua Otávio Carneiro', '129', ordens['Maria Helena Paixão'] ?? null),
    icarai('Marcelo', 'Rua Professor Miguel Couto', '389', ordens['Marcelo'] ?? null),
    e({ id: 'Anouk', nome: 'Anouk', zona: 'N3', cidade: 'Niterói', bairro: 'Boa Viagem', rua: 'Rua Edmundo March', numero: '14' }),
  ];

  it('Boa Viagem fecha a onda mesmo sem nenhum ordem_rota', () => {
    expect(ordena(N3()).at(-1)).toBe('Anouk');
  });

  // O backfill da 0033: UMA linha, so pra ela. Os outros quatro de Icarai ficam
  // em branco e nao mudam de lugar entre si.
  it('ordem_rota 900 so nela ja fecha Icarai, logo antes de Boa Viagem', () => {
    expect(ordena(N3({ 'Maria Tereza': 900 }))).toEqual([
      'Isabel Considera',
      'Dani Considera',
      'Maria Helena Paixão',
      'Marcelo',
      'Maria Tereza',
      'Anouk',
    ]);
  });

  // A ordem relativa dos outros quatro e a mesma com e sem o override dela.
  it('o override dela nao reordena o resto de Icarai', () => {
    const semEla = (lista: string[]) => lista.filter((n) => n !== 'Maria Tereza');
    expect(semEla(ordena(N3({ 'Maria Tereza': 900 })))).toEqual(semEla(ordena(N3())));
  });

  // Se um dia alguem precisar ABRIR a onda em vez de fechar, o mesmo campo faz,
  // tambem com uma linha so.
  it('a faixa de baixo puxa pra primeira parada do bairro', () => {
    expect(ordena(N3({ Marcelo: 100 }))[0]).toBe('Marcelo');
  });

  // Suzana e Lagoa lado Jardim Botanico, zona R3. Nao ha linha de bairro que a
  // posicione em R3 — mas a ordem 2 que a Lagoa carrega de R1 ja a poe entre
  // Copacabana (2) e Gavea (4), com o empate desfeito pelo nome do bairro.
  it('Suzana cai entre Copacabana e Gávea em R3, sem precisar de ordem_rota', () => {
    const rio = (nome: string, bairro: string, rua: string, numero: string) =>
      e({ id: nome, nome, zona: 'R3', regiao: 'rio', cidade: 'Rio de Janeiro', bairro, rua, numero });
    expect(
      ordena([
        rio('Camila Perlingeiro', 'Gávea', 'Rua Marquês de São Vicente', '512'),
        rio('Suzana', 'Lagoa', 'Rua Frei Leandro', '26'),
        rio('Chiara', 'Copacabana', 'Rua Guimarães Natal', '16'),
        rio('Evandro', 'Gávea', 'Rua Vice-Governador Rúbens Berardo', '65'),
      ])
    ).toEqual(['Chiara', 'Suzana', 'Camila Perlingeiro', 'Evandro']);
  });

  // REGRESSAO. A posicao da Suzana em R3 esta certa hoje, mas por ACIDENTE, nao
  // por regra: ninguem declarou onde a Lagoa entra em R3 (a zona dela e override
  // no cadastro e a `bairro_zona_default` so tem a linha de R1). O lugar dela sai
  // de duas coisas decididas com outra intencao — a Lagoa ter ordem 2 DENTRO DE
  // R1, e "Copacabana" preceder "Lagoa" no desempate por nome de bairro.
  //
  // Ou seja: reordenar a Lagoa dentro de R1 move a Suzana no Rio, e nada mais no
  // sistema acusa — o erro so aparece com o motoboy na rua. Este teste e o que
  // transforma a coincidencia em contrato: se a heranca quebrar, quebra aqui.
  //
  // Afirma POSICAO RELATIVA, nao numero de sequencia: assinante novo em R3 muda
  // os numeros e nao pode derrubar o teste.
  it('R3: assinante de Lagoa override cai entre Copacabana e Gávea (posição herdada da ordem da Lagoa em R1)', () => {
    const rio = (nome: string, bairro: string, rua: string, numero: string) =>
      e({ id: nome, nome, zona: 'R3', regiao: 'rio', cidade: 'Rio de Janeiro', bairro, rua, numero });

    const ordenados = ordena([
      rio('Camila Perlingeiro', 'Gávea', 'Rua Marquês de São Vicente', '512'),
      rio('Luiza Rafaella', 'Gávea', 'Rua Marquês de São Vicente', '61'),
      rio('Evandro', 'Gávea', 'Rua Vice-Governador Rúbens Berardo', '65'),
      rio('Suzana', 'Lagoa', 'Rua Frei Leandro', '26'),
      rio('Chiara', 'Copacabana', 'Rua Guimarães Natal', '16'),
      // Urca abre R3 e nao tem assinante hoje; entra pra provar que a Suzana fica
      // DEPOIS de Copacabana em vez de so cair na cabeca da zona.
      rio('Parada da Urca', 'Urca', 'Avenida Portugal', '100'),
    ]);
    const em = (nome: string) => ordenados.indexOf(nome);

    expect(em('Parada da Urca')).toBeLessThan(em('Chiara'));
    expect(em('Chiara')).toBeLessThan(em('Suzana'));
    expect(em('Suzana')).toBeLessThan(em('Camila Perlingeiro'));
    expect(em('Suzana')).toBeLessThan(em('Luiza Rafaella'));
    expect(em('Suzana')).toBeLessThan(em('Evandro'));
  });
});
