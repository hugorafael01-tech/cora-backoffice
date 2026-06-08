import { describe, expect, it } from 'vitest';
import {
  calcLevainBuild,
  derivaEtapaAgora,
  farinhaPorPaoG,
  previewLinha,
  progressoEtapas,
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

describe('slugify', () => {
  it('remove acento, espaco e caixa', () => {
    expect(slugify('Pão Italiano de Azeitonas')).toBe('pao-italiano-de-azeitonas');
  });
  it('trim de hifens nas pontas', () => {
    expect(slugify('  Ciabatta!  ')).toBe('ciabatta');
  });
});
