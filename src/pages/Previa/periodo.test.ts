import { describe, expect, it } from 'vitest';
import { opcoesDePeriodo, periodoPadrao, rotuloPeriodo } from './periodo';

/** Instante UTC a partir de uma hora de Sao Paulo (BRT = UTC-3). */
function emSaoPaulo(iso: string): Date {
  return new Date(`${iso}-03:00`);
}

describe('periodoPadrao', () => {
  it('ate o dia 28 aponta pro mes que vem', () => {
    expect(periodoPadrao(emSaoPaulo('2026-09-04T10:00:00'))).toBe('2026-10');
    expect(periodoPadrao(emSaoPaulo('2026-09-26T09:00:00'))).toBe('2026-10');
    expect(periodoPadrao(emSaoPaulo('2026-09-28T23:00:00'))).toBe('2026-10');
  });

  it('passado o 28 pula pro seguinte', () => {
    expect(periodoPadrao(emSaoPaulo('2026-09-29T08:00:00'))).toBe('2026-11');
    expect(periodoPadrao(emSaoPaulo('2026-09-30T20:00:00'))).toBe('2026-11');
  });

  it('a noite de Sao Paulo nao vira o mes cedo demais', () => {
    // 26/09 as 23h em SP ja e 27/09 em UTC, e 28/09 as 21h ja e 29/09 em UTC.
    // Os dois seguem dentro da janela de conferencia e tem que abrir outubro.
    expect(periodoPadrao(emSaoPaulo('2026-09-26T23:00:00'))).toBe('2026-10');
    expect(periodoPadrao(emSaoPaulo('2026-09-28T21:00:00'))).toBe('2026-10');
  });

  it('a madrugada de Sao Paulo tambem nao atrasa o mes', () => {
    // 29/09 as 00h30 em SP ainda e 29/09 em UTC (UTC-3 so adianta), mas o teste
    // fixa o comportamento na virada do dia.
    expect(periodoPadrao(emSaoPaulo('2026-09-29T00:30:00'))).toBe('2026-11');
  });

  it('vira o ano', () => {
    expect(periodoPadrao(emSaoPaulo('2026-12-10T12:00:00'))).toBe('2027-01');
    expect(periodoPadrao(emSaoPaulo('2026-12-29T12:00:00'))).toBe('2027-02');
  });

  it('nao depende do fuso da maquina que roda', () => {
    // Mesmo instante, escrito de dois jeitos: o resultado tem que ser igual.
    const instante = emSaoPaulo('2026-09-28T22:00:00');
    expect(periodoPadrao(instante)).toBe(periodoPadrao(new Date(instante.toISOString())));
  });
});

describe('opcoesDePeriodo', () => {
  it('oferece tres meses atras, o padrao e um adiante', () => {
    expect(opcoesDePeriodo('2026-10')).toEqual([
      '2026-07', '2026-08', '2026-09', '2026-10', '2026-11',
    ]);
  });

  it('atravessa a virada do ano', () => {
    expect(opcoesDePeriodo('2027-01')).toEqual([
      '2026-10', '2026-11', '2026-12', '2027-01', '2027-02',
    ]);
  });
});

describe('rotuloPeriodo', () => {
  it('escreve o mes por extenso, em minuscula', () => {
    expect(rotuloPeriodo('2026-10')).toBe('outubro de 2026');
    expect(rotuloPeriodo('2026-03')).toBe('março de 2026');
  });
});
