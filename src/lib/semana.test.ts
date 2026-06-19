import { describe, it, expect } from 'vitest';
import { cicloLabel, escolherCicloAtual, type CicloLite } from './semana';

describe('cicloLabel', () => {
  it('identidade do ciclo pela data de entrega', () => {
    expect(cicloLabel('2026-06-10')).toBe('Ciclo · entrega qua 10 jun');
  });
});

describe('escolherCicloAtual', () => {
  const c = (id: string, data_entrega: string, status = 'rascunho'): CicloLite => ({
    id,
    data_entrega,
    data_corte: data_entrega + 'T12:00:00Z',
    status,
  });

  it('proximo aberto com entrega >= hoje (mais proxima no futuro)', () => {
    const r = escolherCicloAtual(
      [c('a', '2026-06-05'), c('b', '2026-06-12'), c('d', '2026-06-20')],
      '2026-06-10'
    );
    expect(r).toBe('b');
  });

  it('entrega exatamente hoje conta como atual', () => {
    expect(escolherCicloAtual([c('a', '2026-06-10'), c('b', '2026-06-20')], '2026-06-10')).toBe('a');
  });

  it('nenhum no futuro -> entrega mais recente', () => {
    expect(escolherCicloAtual([c('a', '2026-06-01'), c('b', '2026-06-05')], '2026-06-10')).toBe('b');
  });

  it('ignora cancelado/encerrado quando ha aberto', () => {
    const r = escolherCicloAtual(
      [c('a', '2026-06-12', 'concluida'), c('b', '2026-06-15', 'cancelada'), c('d', '2026-06-20')],
      '2026-06-10'
    );
    expect(r).toBe('d');
  });

  it('sem ciclos -> null', () => {
    expect(escolherCicloAtual([], '2026-06-10')).toBeNull();
  });
});
