import { describe, expect, it } from 'vitest';
import {
  appendDobra,
  calcDelta,
  calcLevainBuild,
  derivaEtapaAgora,
  diasContexto,
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
