import type { ResultadoPagador, StatusGeracao } from './types';

/**
 * Ordenação e leitura da tela de resultado. Puro, sem JSX: a regra de "o que o
 * Hugo precisa ver primeiro" é decisão, não desenho, e decisão se testa.
 */

/**
 * Um resultado exige resolução à mão AGORA?
 *
 * Só um estado se qualifica: `gravar_retorno`. Nele a cobrança EXISTE no Asaas
 * e a fatura não guardou o id — o assinante já pode receber o boleto, e o banco
 * não sabe disso. É também o único estado em que rodar de novo piora: o retry
 * veria "pendente sem pagamento" e criaria uma SEGUNDA cobrança.
 *
 * Erro no `insert` e erro no `asaas` são recuperáveis rodando de novo: no
 * primeiro nada foi criado, no segundo a fatura pendente é exatamente o que
 * permite o `rechamar`.
 */
export function exigeResolucaoManual(r: ResultadoPagador): boolean {
  return r.status === 'erro' && r.etapa === 'gravar_retorno';
}

/**
 * Ordem de leitura: o que pede ação humana em cima, o que deu certo embaixo.
 *
 * Não é ordem alfabética nem a ordem em que o servidor gerou. Numa lista de 26
 * linhas, as 2 que precisam de alguém não podem estar no meio.
 */
const PESO_STATUS: Record<StatusGeracao, number> = {
  erro: 1,
  bloqueado: 2,
  rechamado: 3,
  criado: 4,
  pulado: 5,
};

export function ordenaResultados(resultados: ResultadoPagador[]): ResultadoPagador[] {
  return [...resultados].sort((a, b) => {
    // `gravar_retorno` fura a fila inteira, inclusive a dos outros erros.
    const ma = exigeResolucaoManual(a) ? 0 : PESO_STATUS[a.status];
    const mb = exigeResolucaoManual(b) ? 0 : PESO_STATUS[b.status];
    return ma - mb || a.pagador.localeCompare(b.pagador, 'pt-BR');
  });
}

/**
 * Quem vai precisar receber o boleto à mão.
 *
 * Só entra quem TEM cobrança: `criado`, `rechamado` e `pulado`. Bloqueado não
 * gerou nada, então não há o que enviar; e erro fica de fora até o estado dele
 * ser resolvido — inclusive `gravar_retorno`, que tem cobrança no Asaas mas
 * ainda não tem fatura que a referencie. Listá-lo aqui pediria que alguém
 * enviasse um boleto que o sistema ainda não sabe que existe.
 */
const TEM_COBRANCA: StatusGeracao[] = ['criado', 'rechamado', 'pulado'];

export function paraEnviarAMao(resultados: ResultadoPagador[]): ResultadoPagador[] {
  return resultados
    .filter((r) => r.envioManual && TEM_COBRANCA.includes(r.status))
    .sort((a, b) => a.pagador.localeCompare(b.pagador, 'pt-BR'));
}

/** Rótulo de cada desfecho. Sentence case, vocabulário da casa. */
export const ROTULO_STATUS: Record<StatusGeracao, string> = {
  criado: 'Cobrança criada',
  rechamado: 'Cobrança refeita',
  pulado: 'Já tinha cobrança',
  bloqueado: 'Bloqueado',
  erro: 'Erro',
};

/**
 * As cestas de um grupo, para a linha do pagador.
 *
 * Quando o grupo é de uma cesta só, o nome dela é o nome do pagador e repetir
 * seria ruído. Devolve null nesse caso.
 */
export function cestasDoGrupo(r: ResultadoPagador): string | null {
  if (r.cestas.length <= 1) return null;
  return r.cestas.join(' + ');
}
