import { describe, expect, it } from 'vitest';
import {
  appendDobra,
  calcDelta,
  calcLevainBuild,
  derivaEtapaAgora,
  diasContexto,
  distribuiHidratacaoPorEtapa,
  ehEtapaDeMassa,
  somaBakerDaMassa,
  duracaoMin,
  ehEtapaDivisao,
  farinhaPorPaoG,
  fmtDeltaPct,
  fmtDeltaUn,
  fmtDuracaoMin,
  fmtPecaDivisao,
  fmtTempC,
  lerDobras,
  previewLinha,
  progressoEtapas,
  removerUltimaDobra,
  resumoDobras,
  setTempDobra,
  slugify,
} from './producao';
import type { EtapaAcomp, EtapaStatus } from '../pages/Producao/types';

function etapa(id: string, ordem: number, status: EtapaStatus): EtapaAcomp {
  return {
    id,
    ordem,
    tipo: 'dobra',
    nome: null,
    status,
    iniciadaAt: null,
    concluidaAt: null,
    dobraNumero: null,
    tempC: null,
    detalhes: {},
    notas: null,
  };
}

describe('farinhaPorPaoG (formula da ficha = peso_farinha_por_pao do banco)', () => {
  it('peso_massa / soma_baker', () => {
    expect(farinhaPorPaoG(820, 1.92)).toBeCloseTo(427.08, 2);
  });
  it('null quando soma_baker == 0 (sem ingredientes)', () => {
    expect(farinhaPorPaoG(500, 0)).toBeNull();
  });
  it('null quando peso_massa nulo', () => {
    expect(farinhaPorPaoG(null, 1.7)).toBeNull();
  });
});

describe('calcLevainBuild (perfil liquido 1:2:2)', () => {
  it('reparte total = meta + sobra em isca 1 : agua 2 : farinha 2', () => {
    const b = calcLevainBuild(600, 400); // total 1000
    expect(b.total).toBe(1000);
    expect(b.isca).toBe(200);
    expect(b.agua).toBe(400);
    expect(b.farinha).toBe(400);
  });

  it('clampa meta/sobra negativas em zero', () => {
    expect(calcLevainBuild(-100, -50).total).toBe(0);
  });
});

describe('previewLinha (espelho do trigger)', () => {
  it('calcula massa e levain com receita completa', () => {
    // Original: peso_massa 820, soma_baker 1.92, levain 0.20
    const { massaKg, levainKg } = previewLinha(10, 820, 1.92, 0.2);
    expect(massaKg).toBe(8.2); // 10 * 820 / 1000
    // farinha/pao = 820/1.92 = 427.08 ; levain = 10 * 427.08 * 0.20 / 1000
    expect(levainKg).toBeCloseTo(0.854, 3);
  });

  it('levain = null quando soma_baker == 0 (pao novo sem ingredientes)', () => {
    const { massaKg, levainKg } = previewLinha(10, 500, 0, null);
    expect(massaKg).toBe(5); // massa calcula normal
    expect(levainKg).toBeNull();
  });

  it('levain = null quando a versao nao tem linha de levain', () => {
    const { levainKg } = previewLinha(10, 600, 1.7, null);
    expect(levainKg).toBeNull();
  });

  it('massa = null quando peso_massa_g e nulo', () => {
    const { massaKg, levainKg } = previewLinha(10, null, 1.9, 0.2);
    expect(massaKg).toBeNull();
    expect(levainKg).toBeNull();
  });
});

describe('derivaEtapaAgora', () => {
  it('em_curso de menor ordem ganha quando ha mais de uma', () => {
    const etapas = [
      etapa('a', 1, 'concluida'),
      etapa('c', 3, 'em_curso'),
      etapa('b', 2, 'em_curso'),
    ];
    expect(derivaEtapaAgora(etapas)).toBe('b');
  });

  it('sem em_curso, pega a primeira aguardando (menor ordem)', () => {
    const etapas = [
      etapa('a', 1, 'concluida'),
      etapa('b', 2, 'pulada'),
      etapa('d', 4, 'aguardando'),
      etapa('c', 3, 'aguardando'),
    ];
    expect(derivaEtapaAgora(etapas)).toBe('c');
  });

  it('null quando todas resolvidas', () => {
    const etapas = [etapa('a', 1, 'concluida'), etapa('b', 2, 'pulada')];
    expect(derivaEtapaAgora(etapas)).toBeNull();
  });
});

describe('progressoEtapas (N/M, pulada conta como resolvida)', () => {
  it('conta concluida e pulada como feitas', () => {
    const etapas = [
      etapa('a', 1, 'concluida'),
      etapa('b', 2, 'pulada'),
      etapa('c', 3, 'em_curso'),
      etapa('d', 4, 'aguardando'),
    ];
    expect(progressoEtapas(etapas)).toEqual({ feitas: 2, total: 4 });
  });

  it('lista vazia = 0/0', () => {
    expect(progressoEtapas([])).toEqual({ feitas: 0, total: 0 });
  });
});

describe('ehEtapaDivisao (Pao Original: pre_shape e a divisao, nao shape)', () => {
  it('pre_shape e divisao (por tipo)', () => {
    expect(ehEtapaDivisao('pre_shape')).toBe(true);
  });
  it('shape NAO e divisao', () => {
    expect(ehEtapaDivisao('shape')).toBe(false);
  });
  it('casa por nome com "divisao" (ficha tem nome)', () => {
    expect(ehEtapaDivisao('descanso', 'Descanso e divisao')).toBe(true);
  });
  it('outros tipos sem nome de divisao = false', () => {
    expect(ehEtapaDivisao('batimento')).toBe(false);
    expect(ehEtapaDivisao('coccao', 'Coccao')).toBe(false);
  });
});

describe('fmtPecaDivisao', () => {
  it('formata o peso da peca', () => {
    expect(fmtPecaDivisao(283)).toBe('peças de ~283 g');
  });
  it('null quando peso nulo', () => {
    expect(fmtPecaDivisao(null)).toBeNull();
  });
});

describe('fmtTempC', () => {
  it('usa virgula decimal e sufixo °C', () => {
    expect(fmtTempC(25.5)).toBe('25,5 °C');
  });
  it('inteiro sem casa decimal', () => {
    expect(fmtTempC(25)).toBe('25 °C');
  });
});

describe('registro de dobras', () => {
  // 17:32Z = 14:32 em America/Sao_Paulo (UTC-3); 18:01Z = 15:01.
  const at1 = '2026-06-10T17:32:00.000Z';
  const at2 = '2026-06-10T18:01:00.000Z';

  it('lerDobras: vazio quando ausente ou nao-array', () => {
    expect(lerDobras(null)).toEqual([]);
    expect(lerDobras({})).toEqual([]);
    expect(lerDobras({ dobras: 'x' })).toEqual([]);
  });

  it('lerDobras: ignora entradas malformadas e ordena por n', () => {
    const det = {
      dobras: [
        { n: 2, at: at2, temp_c: 25 },
        { n: 1, at: at1, temp_c: null },
        { n: 3 }, // malformada (sem at) -> ignorada
        null, // ignorada
        { at: at1 }, // sem n -> ignorada
      ],
    };
    expect(lerDobras(det)).toEqual([
      { n: 1, at: at1, temp_c: null },
      { n: 2, at: at2, temp_c: 25 },
    ]);
  });

  it('lerDobras: temp_c nao-numerica vira null', () => {
    expect(lerDobras({ dobras: [{ n: 1, at: at1, temp_c: 'quente' }] })).toEqual([
      { n: 1, at: at1, temp_c: null },
    ]);
  });

  it('appendDobra: n sequencial, temp_c null, imutavel', () => {
    const d0: ReturnType<typeof lerDobras> = [];
    const d1 = appendDobra(d0, at1);
    expect(d1).toEqual([{ n: 1, at: at1, temp_c: null }]);
    const d2 = appendDobra(d1, at2);
    expect(d2.map((d) => d.n)).toEqual([1, 2]);
    expect(d0).toEqual([]); // nao mutou o original
  });

  it('setTempDobra: aceita numero e null, so toca o n alvo', () => {
    const d = appendDobra(appendDobra([], at1), at2);
    expect(setTempDobra(d, 1, 26.5)).toEqual([
      { n: 1, at: at1, temp_c: 26.5 },
      { n: 2, at: at2, temp_c: null },
    ]);
    const com = setTempDobra(d, 2, 27);
    expect(setTempDobra(com, 2, null)[1].temp_c).toBeNull();
  });

  it('removerUltimaDobra: tira so a ultima', () => {
    const d = appendDobra(appendDobra([], at1), at2);
    expect(removerUltimaDobra(d).map((x) => x.n)).toEqual([1]);
    expect(removerUltimaDobra([])).toEqual([]);
  });

  it('resumoDobras: contagem + hora SP da ultima', () => {
    expect(resumoDobras([])).toBeNull();
    expect(resumoDobras([{ n: 1, at: at1, temp_c: null }])).toBe('1 dobra · última 14:32');
    expect(
      resumoDobras([
        { n: 1, at: at1, temp_c: null },
        { n: 2, at: at2, temp_c: 25 },
      ])
    ).toBe('2 dobras · última 15:01');
  });
});

describe('calcDelta (Registro: (realizado - previsto) / previsto)', () => {
  it('delta positivo e negativo', () => {
    expect(calcDelta(50, 52)).toBeCloseTo(0.04, 5);
    expect(calcDelta(10, 9)).toBeCloseTo(-0.1, 5);
  });
  it('zero quando bate o previsto', () => {
    expect(calcDelta(40, 40)).toBe(0);
  });
  it('null quando falta um dos lados', () => {
    expect(calcDelta(null, 10)).toBeNull();
    expect(calcDelta(10, null)).toBeNull();
  });
  it('null quando previsto == 0 (sem base de comparacao)', () => {
    expect(calcDelta(0, 5)).toBeNull();
  });
});

describe('fmtDeltaPct (sinal explicito, virgula decimal)', () => {
  it('positivo com "+"', () => {
    expect(fmtDeltaPct(0.04)).toBe('+4%');
  });
  it('negativo com "-" e 1 casa', () => {
    expect(fmtDeltaPct(-0.032)).toBe('-3,2%');
  });
  it('zero vira "+0%"', () => {
    expect(fmtDeltaPct(0)).toBe('+0%');
  });
  it('negativo que arredonda pra zero nao vira "-0%"', () => {
    expect(fmtDeltaPct(-0.0001)).toBe('-0%');
  });
});

describe('fmtDeltaUn (delta absoluto em unidades)', () => {
  it('positivo, negativo e zero com sinal explicito', () => {
    expect(fmtDeltaUn(50, 52)).toBe('+2 un');
    expect(fmtDeltaUn(50, 45)).toBe('-5 un');
    expect(fmtDeltaUn(50, 50)).toBe('+0 un');
  });
});

describe('duracaoMin', () => {
  const ini = '2026-06-10T17:00:00.000Z';
  it('minutos arredondados entre inicio e fim', () => {
    expect(duracaoMin(ini, '2026-06-10T17:45:00.000Z')).toBe(45);
    expect(duracaoMin(ini, '2026-06-10T18:20:30.000Z')).toBe(81); // 80,5 -> 81
  });
  it('null quando falta carimbo', () => {
    expect(duracaoMin(null, ini)).toBeNull();
    expect(duracaoMin(ini, null)).toBeNull();
  });
  it('null quando fim antes do inicio (carimbo inconsistente)', () => {
    expect(duracaoMin(ini, '2026-06-10T16:00:00.000Z')).toBeNull();
  });
  it('null quando ISO invalido', () => {
    expect(duracaoMin('nao-e-data', ini)).toBeNull();
  });
});

describe('fmtDuracaoMin', () => {
  it('abaixo de 1h em minutos', () => {
    expect(fmtDuracaoMin(45)).toBe('45 min');
    expect(fmtDuracaoMin(0)).toBe('0 min');
  });
  it('hora cheia sem minutos', () => {
    expect(fmtDuracaoMin(120)).toBe('2h');
  });
  it('hora + minutos com zero a esquerda', () => {
    expect(fmtDuracaoMin(65)).toBe('1h05');
    expect(fmtDuracaoMin(81)).toBe('1h21');
  });
});

describe('diasContexto (D2/D1/D0 a partir da entrega)', () => {
  it('3 dias em ordem cronologica, dia = D-index, data = entrega - dia', () => {
    const dias = diasContexto('2026-06-11'); // entrega qui 11 jun
    expect(dias.map((d) => d.dia)).toEqual([2, 1, 0]);
    expect(dias.map((d) => d.data)).toEqual(['2026-06-09', '2026-06-10', '2026-06-11']);
  });
  it('label no formato "D{dia} . {dia-semana dia mes}"', () => {
    const [d2] = diasContexto('2026-06-11');
    expect(d2.label).toBe('D2 . ter 9 jun');
  });
});

describe('slugify', () => {
  it('remove acento, espaco e caixa', () => {
    expect(slugify('Pão Italiano de Azeitonas')).toBe('pao-italiano-de-azeitonas');
  });
  it('trim de hifens nas pontas', () => {
    expect(slugify('  Ciabatta!  ')).toBe('ciabatta');
  });
});

describe('ehEtapaDeMassa (criterio de hidratacao)', () => {
  it('inclui as etapas cuja agua termina na massa', () => {
    ['autolise_mistura', 'batimento', 'escaldo', 'tangzhong'].forEach((e) =>
      expect(ehEtapaDeMassa(e)).toBe(true),
    );
  });

  it('exclui preparo e cobertura que ficam fora da massa', () => {
    ['salamoia', 'maceracao', 'infusao', 'finalizacao'].forEach((e) =>
      expect(ehEtapaDeMassa(e)).toBe(false),
    );
  });

  it('etapa desconhecida ou ausente nao conta como massa', () => {
    expect(ehEtapaDeMassa('etapa_que_nao_existe_ainda')).toBe(false);
    expect(ehEtapaDeMassa(null)).toBe(false);
    expect(ehEtapaDeMassa(undefined)).toBe(false);
  });
});

describe('distribuiHidratacaoPorEtapa (agua dividida em etapas, 0036)', () => {
  it('linha unica recebe o alvo inteiro (receita nao dividida)', () => {
    expect(distribuiHidratacaoPorEtapa([{ etapa: 'batimento', percentual: 0.7 }], 0.75)).toEqual([0.75]);
  });

  it('receita sem linha de agua (Brioche) devolve vazio', () => {
    expect(distribuiHidratacaoPorEtapa([], 0.75)).toEqual([]);
  });

  it('preserva a proporcao 85/15 do Original e fecha o alvo', () => {
    const r = distribuiHidratacaoPorEtapa([{ etapa: 'batimento', percentual: 0.595 }, { etapa: 'batimento', percentual: 0.105 }], 0.7);
    expect(r).toEqual([0.595, 0.105]);
    expect(r[0] + r[1]).toBeCloseTo(0.7, 10);
  });

  it('reescala a proporcao 85/15 quando o alvo muda', () => {
    const r = distribuiHidratacaoPorEtapa([{ etapa: 'batimento', percentual: 0.595 }, { etapa: 'batimento', percentual: 0.105 }], 0.8);
    expect(r).toEqual([0.68, 0.12]); // 85% e 15% de 0.80
    expect(r[0] + r[1]).toBeCloseTo(0.8, 10);
  });

  it('NAO multiplica a hidratacao pelo numero de etapas', () => {
    // O bug que a 0036 introduziria: gravar o alvo em cada linha somaria 1.50.
    const r = distribuiHidratacaoPorEtapa([{ etapa: 'batimento', percentual: 0.525 }, { etapa: 'batimento', percentual: 0.225 }], 0.75);
    expect(r.reduce((a, b) => a + b, 0)).toBeCloseTo(0.75, 10);
  });

  it('fecha o alvo mesmo quando a proporcao nao cabe em 4 casas (Multigraos)', () => {
    // 0.58 / 1.12 = 0.5178571..., que nao e exato em NUMERIC(6,4).
    const r = distribuiHidratacaoPorEtapa([{ etapa: 'autolise_mistura', percentual: 0.58 }, { etapa: 'escaldo', percentual: 0.54 }], 1.0);
    expect(r.reduce((a, b) => a + b, 0)).toBeCloseTo(1.0, 10);
    r.forEach((v) => expect(v).toBe(Math.round(v * 10000) / 10000));
  });

  it('divide em partes iguais quando o total atual e zero', () => {
    expect(distribuiHidratacaoPorEtapa([{ etapa: 'batimento', percentual: 0 }, { etapa: 'batimento', percentual: 0 }], 0.8)).toEqual([0.4, 0.4]);
  });

  it('mantem 4 casas decimais em todas as linhas', () => {
    const r = distribuiHidratacaoPorEtapa([{ etapa: 'batimento', percentual: 0.6375 }, { etapa: 'batimento', percentual: 0.1125 }], 0.73);
    r.forEach((v) => expect(v).toBe(Math.round(v * 10000) / 10000));
    expect(r.reduce((a, b) => a + b, 0)).toBeCloseTo(0.73, 10);
  });
});

describe('distribuiHidratacaoPorEtapa: agua que NAO e da massa', () => {
  // Focaccia como esta em producao: autolise 0.5250 + batimento 0.2250 de massa
  // (= 0.75, que bate com hidratacao_alvo 75) + salamoia 0.0150 de superficie.
  const focaccia = [
    { etapa: 'autolise_mistura', percentual: 0.525 },
    { etapa: 'batimento', percentual: 0.225 },
    { etapa: 'salamoia', percentual: 0.015 },
  ];

  it('nao toca na agua da salamoia', () => {
    const r = distribuiHidratacaoPorEtapa(focaccia, 0.8);
    expect(r[2]).toBe(0.015);
  });

  it('o alvo fecha SO entre as etapas de massa', () => {
    const r = distribuiHidratacaoPorEtapa(focaccia, 0.8);
    expect(r[0] + r[1]).toBeCloseTo(0.8, 10);
    expect(r[0]).toBeCloseTo(0.56, 10); // 70% de 0.80
    expect(r[1]).toBeCloseTo(0.24, 10); // 30% de 0.80
  });

  it('a salmoura nao entra na proporcao (senao a massa erraria o alvo)', () => {
    // Distribuindo entre as 3 linhas, a massa fecharia 0.7843 em vez de 0.80.
    const r = distribuiHidratacaoPorEtapa(focaccia, 0.8);
    expect(r[0] + r[1]).not.toBeCloseTo((0.75 / 0.765) * 0.8, 6);
  });

  it('alvo igual ao atual nao muda nada, nem a salamoia', () => {
    expect(distribuiHidratacaoPorEtapa(focaccia, 0.75)).toEqual([0.525, 0.225, 0.015]);
  });

  it('sem nenhuma linha de massa devolve tudo intocado', () => {
    const so = [{ etapa: 'salamoia', percentual: 0.015 }];
    expect(distribuiHidratacaoPorEtapa(so, 0.8)).toEqual([0.015]);
  });

  it('etapa nova desconhecida fica de fora ate ser declarada', () => {
    const comNova = [
      { etapa: 'autolise_mistura', percentual: 0.6 },
      { etapa: 'vaporizacao', percentual: 0.02 },
    ];
    const r = distribuiHidratacaoPorEtapa(comNova, 0.7);
    expect(r).toEqual([0.7, 0.02]);
  });
});

describe('somaBakerDaMassa (denominador da farinha/pao, 0037)', () => {
  // Focaccia como esta em producao apos a remodelagem.
  const focaccia = [
    { etapa: 'autolise_mistura', percentual: 0.525 },
    { etapa: 'batimento', percentual: 0.3 },   // levain
    { etapa: 'batimento', percentual: 1.0 },   // farinha
    { etapa: 'batimento', percentual: 0.225 }, // agua
    { etapa: 'batimento', percentual: 0.03 },  // azeite
    { etapa: 'batimento', percentual: 0.024 }, // sal
    { etapa: 'maceracao', percentual: 0.23 },
    { etapa: 'maceracao', percentual: 0.019 },
    { etapa: 'maceracao', percentual: 0.008 },
    { etapa: 'maceracao', percentual: 0.002 },
    { etapa: 'infusao', percentual: 0.046 },
    { etapa: 'infusao', percentual: 0.003 },
    { etapa: 'salamoia', percentual: 0.015 },
    { etapa: 'salamoia', percentual: 0.002 },
    { etapa: 'finalizacao', percentual: 0.002 },
  ];

  it('bate com a planilha do Hugo: 2.756 g / 1.310 g = 2,104', () => {
    expect(somaBakerDaMassa(focaccia)).toBeCloseTo(2.104, 10);
    expect(2756 / 1310).toBeCloseTo(2.104, 3);
  });

  it('a farinha/pao da Focaccia sai 149,7 g, nao 129,6 g', () => {
    expect(farinhaPorPaoG(315, somaBakerDaMassa(focaccia))).toBeCloseTo(149.71, 1);
    // o que a formula antiga dava, somando cobertura no denominador:
    const somaTudo = focaccia.reduce((a, l) => a + l.percentual, 0);
    expect(farinhaPorPaoG(315, somaTudo)).toBeCloseTo(129.58, 1);
  });

  it('cobertura e crosta ficam fora do denominador', () => {
    const soMassa = focaccia.filter((l) => ehEtapaDeMassa(l.etapa));
    expect(somaBakerDaMassa(focaccia)).toBeCloseTo(
      soMassa.reduce((a, l) => a + l.percentual, 0), 10);
  });

  it('escaldo e tangzhong CONTAM (voltam pra massa)', () => {
    // Multigraos: agua escaldo 0.54 + autolise 0.58 sao hidratacao.
    const multigraos = [
      { etapa: 'batimento', percentual: 0.4 },
      { etapa: 'batimento', percentual: 1.0 },
      { etapa: 'escaldo', percentual: 0.54 },
      { etapa: 'autolise_mistura', percentual: 0.58 },
      { etapa: 'escaldo', percentual: 0.012 },
      { etapa: 'finalizacao', percentual: 0.06 }, // aveia de crosta (0037)
    ];
    expect(somaBakerDaMassa(multigraos)).toBeCloseTo(2.532, 10);
  });

  it('receita sem cobertura nenhuma nao muda de denominador', () => {
    const original = [
      { etapa: 'batimento', percentual: 0.2 },
      { etapa: 'batimento', percentual: 0.8 },
      { etapa: 'autolise_mistura', percentual: 0.595 },
      { etapa: 'batimento', percentual: 0.105 },
      { etapa: 'batimento', percentual: 0.02 },
    ];
    const tudo = original.reduce((a, l) => a + l.percentual, 0);
    expect(somaBakerDaMassa(original)).toBeCloseTo(tudo, 10);
  });

  it('etapa desconhecida nao infla o denominador', () => {
    const r = somaBakerDaMassa([
      { etapa: 'batimento', percentual: 1.0 },
      { etapa: 'etapa_futura', percentual: 0.5 },
    ]);
    expect(r).toBe(1.0);
  });

  it('lista vazia devolve 0 (farinha vira null)', () => {
    expect(somaBakerDaMassa([])).toBe(0);
    expect(farinhaPorPaoG(315, somaBakerDaMassa([]))).toBeNull();
  });
});
