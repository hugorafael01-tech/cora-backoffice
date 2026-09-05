import type { CodigoAlerta } from '../../lib/previa';

/**
 * Peso do alerta na tela. Classificacao do Hugo (04/09):
 *   BLOQUEIA = impede criar a cobranca, ou torna o valor nao confiavel
 *   CONFIRA  = decisao dele, caso a caso
 *
 * Fica aqui e nao em lib/previa.ts de proposito: e regra de TELA. O modulo
 * puro tem um gemeo no portal (Fase 3) que nao desenha nada, e carregar peso
 * visual pra la seria peso a manter em dois lugares sem ninguem usar.
 */
export type PesoAlerta = 'bloqueia' | 'confira';

export const PESO_POR_CODIGO: Record<CodigoAlerta, PesoAlerta> = {
  // Bloqueia: sem cliente no Asaas nao ha como criar a cobranca; sem forma de
  // pagamento nao se sabe como cobrar; total divergente quer dizer que os dois
  // numeros do banco discordam e nenhum deles e confiavel.
  sem_cliente_asaas: 'bloqueia',
  forma_pagamento_ausente: 'bloqueia',
  total_extras_divergente: 'bloqueia',

  // Confira: o valor da pra calcular, mas alguem precisa olhar antes.
  preco_zero: 'confira',
  preco_divergente: 'confira',
  entrega_nao_confirmada: 'confira',
  ajuste_nao_reconstruivel: 'confira',
  grupo_forma_mista: 'confira',
  pagador_nao_encontrado: 'confira',
};

/** Título curto de cada grupo de alerta. Sentence case, nunca caixa alta. */
export const TITULO_POR_CODIGO: Record<CodigoAlerta, string> = {
  sem_cliente_asaas: 'Sem cliente no Asaas',
  forma_pagamento_ausente: 'Sem forma de pagamento',
  total_extras_divergente: 'Total dos produtos não fecha',
  preco_zero: 'Produto com preço zero',
  preco_divergente: 'Preço diferente do cardápio da semana',
  entrega_nao_confirmada: 'Cesta confirmada sem entrega marcada',
  ajuste_nao_reconstruivel: 'Ajuste de mudança de plano',
  grupo_forma_mista: 'Formas de pagamento diferentes em quem paga junto',
  pagador_nao_encontrado: 'Quem paga não está entre as ativas',
};
