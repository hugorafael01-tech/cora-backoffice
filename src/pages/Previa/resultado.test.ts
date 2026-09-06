import { describe, expect, it } from 'vitest';
import {
  cestasDoGrupo,
  exigeResolucaoManual,
  ordenaResultados,
  paraEnviarAMao,
} from './resultado';
import type { ResultadoPagador, StatusGeracao } from './types';

function r(
  pagador: string,
  status: StatusGeracao,
  extra: Partial<ResultadoPagador> = {},
): ResultadoPagador {
  return {
    pagador,
    pagadorId: `id-${pagador}`,
    cestas: [pagador],
    envioManual: false,
    status,
    ...extra,
  };
}

describe('exigeResolucaoManual', () => {
  it('só gravar_retorno exige mão humana', () => {
    expect(exigeResolucaoManual(r('A', 'erro', { etapa: 'gravar_retorno' }))).toBe(true);
    // Nos outros dois o retry resolve: no insert nada foi criado, no asaas a
    // fatura pendente é o que permite o rechamar.
    expect(exigeResolucaoManual(r('A', 'erro', { etapa: 'asaas' }))).toBe(false);
    expect(exigeResolucaoManual(r('A', 'erro', { etapa: 'insert' }))).toBe(false);
    expect(exigeResolucaoManual(r('A', 'bloqueado'))).toBe(false);
  });
});

describe('ordenaResultados', () => {
  it('gravar_retorno fura a fila, inclusive a dos outros erros', () => {
    const lista = [
      r('Zulmira', 'criado'),
      r('Ana', 'erro', { etapa: 'asaas' }),
      r('Bruno', 'erro', { etapa: 'gravar_retorno' }),
      r('Carla', 'bloqueado'),
    ];
    expect(ordenaResultados(lista).map((x) => x.pagador)).toEqual([
      'Bruno', // gravar_retorno
      'Ana', // erro comum
      'Carla', // bloqueado
      'Zulmira', // criado
    ]);
  });

  it('dentro do mesmo peso, ordem alfabética', () => {
    const lista = [r('Zulmira', 'criado'), r('Ana', 'criado'), r('Ândrea', 'criado')];
    // localeCompare pt-BR: Â vem junto de A, não depois de Z.
    expect(ordenaResultados(lista).map((x) => x.pagador)).toEqual(['Ana', 'Ândrea', 'Zulmira']);
  });

  it('não muda a lista original', () => {
    const lista = [r('Zulmira', 'criado'), r('Ana', 'erro')];
    ordenaResultados(lista);
    expect(lista.map((x) => x.pagador)).toEqual(['Zulmira', 'Ana']);
  });

  it('a ordem completa dos cinco desfechos', () => {
    const lista = [
      r('E', 'pulado'),
      r('D', 'criado'),
      r('C', 'rechamado'),
      r('B', 'bloqueado'),
      r('A', 'erro'),
    ];
    expect(ordenaResultados(lista).map((x) => x.status)).toEqual([
      'erro',
      'bloqueado',
      'rechamado',
      'criado',
      'pulado',
    ]);
  });
});

describe('paraEnviarAMao', () => {
  it('entra quem está marcado e tem cobrança', () => {
    const lista = [
      r('Aldina', 'criado', { envioManual: true }),
      r('Bento', 'rechamado', { envioManual: true }),
      r('Célia', 'pulado', { envioManual: true }),
      r('Dora', 'criado'), // não marcada
    ];
    expect(paraEnviarAMao(lista).map((x) => x.pagador)).toEqual(['Aldina', 'Bento', 'Célia']);
  });

  it('bloqueado e erro ficam de fora — não há boleto a enviar', () => {
    const lista = [
      r('Aldina', 'bloqueado', { envioManual: true }),
      r('Bento', 'erro', { envioManual: true, etapa: 'asaas' }),
    ];
    expect(paraEnviarAMao(lista)).toEqual([]);
  });

  it('gravar_retorno NÃO entra, mesmo tendo cobrança no Asaas', () => {
    // A cobrança existe, mas a fatura não guardou o id. Pedir que alguém envie
    // um boleto que o sistema ainda não sabe que existe é pedir confusão: o
    // caminho é resolver o estado primeiro.
    const lista = [r('Aldina', 'erro', { envioManual: true, etapa: 'gravar_retorno' })];
    expect(paraEnviarAMao(lista)).toEqual([]);
  });
});

describe('cestasDoGrupo', () => {
  it('grupo de uma cesta não repete o nome do pagador', () => {
    expect(cestasDoGrupo(r('Abdala Farah', 'criado'))).toBe(null);
  });

  it('grupo de duas nomeia as duas', () => {
    const grupo = r('Aldina', 'criado', { cestas: ['Aldina', 'Fernanda'] });
    expect(cestasDoGrupo(grupo)).toBe('Aldina + Fernanda');
  });
});
