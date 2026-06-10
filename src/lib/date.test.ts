import { describe, it, expect } from 'vitest';
import { derivaCiclo, derivaSemana, proximaQuinta } from './date';

// Helper: date local (meia-noite) sem timezone shift.
const local = (y: number, m: number, d: number) => new Date(y, m - 1, d);

describe('derivaCiclo', () => {
  it('entrega numa quarta (10/jun/2026): D2=seg 8, fim=entrega, corte D2 12h', () => {
    const r = derivaCiclo(local(2026, 6, 10));
    expect(r.data_inicio).toBe('2026-06-08'); // entrega - 2 (D2)
    expect(r.data_fim).toBe('2026-06-10'); // = entrega
    expect(r.data_entrega).toBe('2026-06-10');
    // 08/jun 12h BRT (UTC-3) = 15h UTC
    expect(r.data_corte).toBe('2026-06-08T15:00:00.000Z');
    expect(r.numero).toBe(24); // semana ISO da entrega (informativo)
    expect(r.ano).toBe(2026);
  });

  it('entrega num domingo: ciclo de 3 dias termina no domingo', () => {
    const r = derivaCiclo(local(2026, 6, 14)); // domingo
    expect(r.data_inicio).toBe('2026-06-12'); // sexta
    expect(r.data_fim).toBe('2026-06-14');
    expect(r.data_entrega).toBe('2026-06-14');
  });
});

describe('derivaSemana', () => {
  it('semana 22/2026 a partir de quinta 28/mai/2026', () => {
    const r = derivaSemana(local(2026, 5, 28));
    expect(r.numero).toBe(22);
    expect(r.ano).toBe(2026);
    expect(r.data_inicio).toBe('2026-05-25'); // segunda
    expect(r.data_fim).toBe('2026-05-31'); // domingo
    expect(r.data_entrega).toBe('2026-05-28'); // quinta
    // terca 26/mai 12h BRT (UTC-3) = 15h UTC
    expect(r.data_corte).toBe('2026-05-26T15:00:00.000Z');
  });

  it('virada de ano: quinta 01/jan/2026 cai na ISO week 1 de 2026', () => {
    const r = derivaSemana(local(2026, 1, 1));
    expect(r.numero).toBe(1);
    expect(r.ano).toBe(2026);
  });

  it('virada de ano: quinta 31/dez/2026 cai na ISO week 53 de 2026', () => {
    // 31/dez/2026 e quinta; ISO week year = 2026 (nao 2027)
    const r = derivaSemana(local(2026, 12, 31));
    expect(r.numero).toBe(53);
    expect(r.ano).toBe(2026);
  });
});

describe('proximaQuinta', () => {
  it('a partir de uma segunda retorna a quinta da mesma semana', () => {
    const q = proximaQuinta(local(2026, 5, 25)); // segunda 25/mai
    expect(q.getFullYear()).toBe(2026);
    expect(q.getMonth()).toBe(4); // maio (0-indexed)
    expect(q.getDate()).toBe(28);
  });

  it('se hoje for quinta retorna a proxima quinta (nao hoje)', () => {
    const q = proximaQuinta(local(2026, 5, 28)); // quinta 28/mai
    expect(q.getDate()).toBe(4); // 4/jun
    expect(q.getMonth()).toBe(5); // junho
  });
});
