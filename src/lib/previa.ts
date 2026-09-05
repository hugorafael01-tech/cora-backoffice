/**
 * Montagem da previa de cobranca (Fase 2, bloco 2a).
 *
 * ============================================================================
 * ESTE ARQUIVO TEM UM GEMEO. LEIA ANTES DE MUDAR QUALQUER CONTA.
 * ============================================================================
 * Na Fase 3 a geracao roda nas functions do `cora-portal`, e o servidor NAO
 * pode confiar em total que veio do browser — e a razao de a fase existir.
 * Entao esta logica vai ser COPIADA pra la e passa a existir em dois lugares:
 *
 *     cora-backoffice/src/lib/previa.ts   (aqui, TypeScript, monta a tela)
 *     cora-portal/api/_lib/previa.js      (la, JavaScript, recalcula do zero)
 *
 * O portal e um repo .jsx sem TypeScript: a transposicao de tipos e problema
 * de la, e o gemeo nasce sem as anotacoes. O que NAO pode mudar na travessia e
 * a conta — mesmas entradas devem dar exatamente as mesmas saidas, ate o
 * centavo e ate a ordem dos alertas.
 *
 * Mudou uma regra aqui? Espelhe la, no mesmo PR ou no seguinte, e diga no
 * BACKOFFICE_STATUS.md. **A conciliacao da Fase 4 detecta divergencia entre os
 * gemeos**: ela compara o conjunto e a soma da previa (deste lado) com o que o
 * portal recalculou antes de criar as cobrancas. Gemeo fora de sincronia
 * aparece la como divergencia e BLOQUEIA a geracao — de proposito. Nao e um
 * detalhe de organizacao: e o mecanismo que impede uma das duas pontas de
 * cobrar um numero que a outra nunca viu.
 *
 * Por isso este modulo e PURO: sem React, sem client Supabase, sem Date.now().
 * Recebe linhas ja lidas e devolve a previa. O I/O mora em usePrevia.ts.
 * Qualquer dependencia nova aqui vira uma dependencia a portar pro portal.
 *
 * ============================================================================
 * O QUE A PREVIA COBRA
 * ============================================================================
 * Uma cobranca por PAGADOR por mes (decisao do Hugo, 04/09), com:
 *   mensalidade do mes de referencia (adiantada)
 *   + extras do ciclo encerrado (pos-consumo: so o que foi ENTREGUE)
 *   + ajuste proporcional de aumento no meio do mes anterior
 *
 * Agrupamento por pagador: dois pares reais em que uma pessoa paga duas
 * assinaturas (Sabina paga a da Maria Helena; Aldina paga a da Fernanda). A
 * tela mostra o total do pagador com as cestas detalhadas embaixo. A `faturas`
 * continua UMA POR ASSINATURA nesta fase — se a cobranca vai ao Asaas agrupada
 * ou separada e decisao da Fase 3, olhando a previa pronta.
 */

// ---------------------------------------------------------------------------
// Entradas (o hook le, este modulo so recebe)
// ---------------------------------------------------------------------------

export type FormaPagamento = 'cartao' | 'boleto' | 'pix' | 'boleto_pix';

export interface SubscriptionPrevia {
  id: string;
  nome: string;
  forma_pagamento: FormaPagamento | null;
  valor_mensal: number;
  valor_frete: number;
  activated_at: string | null;
  next_billing_change_date: string | null;
  next_billing_value: number | null;
  pagador_subscription_id: string | null;
  asaas_customer_id: string | null;
}

export interface ExtraItem {
  id: string;
  nome: string;
  qty: number;
  preco_unit: number;
}

export interface WeeklyOrderPrevia {
  id: string;
  subscription_id: string;
  delivery_date: string; // YYYY-MM-DD, sempre quinta
  status: 'rascunho' | 'confirmado';
  total_extras: number;
  extras: ExtraItem[] | null;
}

export interface EntregaPrevia {
  weekly_order_id: string | null;
  status: string; // 'em_rota' | 'entregue'
}

/** quinta (YYYY-MM-DD) -> slug do produto -> preco_avulso do cardapio daquela semana. */
export type PrecosPorQuinta = Map<string, Map<string, number>>;

export interface EntradaPrevia {
  /** Ativas sem 'dev'. NAO filtrar cartao na query: o filtro e aqui, pra que
   *  linha com forma_pagamento null consiga aparecer com alerta. */
  subscriptions: SubscriptionPrevia[];
  weeklyOrders: WeeklyOrderPrevia[];
  entregas: EntregaPrevia[];
  precos: PrecosPorQuinta;
}

// ---------------------------------------------------------------------------
// Saidas
// ---------------------------------------------------------------------------

export type CodigoAlerta =
  | 'forma_pagamento_ausente'
  | 'entrega_nao_confirmada'
  | 'preco_zero'
  | 'preco_divergente'
  | 'total_extras_divergente'
  | 'sem_cliente_asaas'
  | 'grupo_forma_mista'
  | 'pagador_nao_encontrado'
  | 'ajuste_nao_reconstruivel';

export interface AlertaPrevia {
  codigo: CodigoAlerta;
  mensagem: string;
  subscriptionId: string | null;
}

export interface ExtraCobravel extends ExtraItem {
  quinta: string;
  subtotal: number;
}

export interface LinhaAssinatura {
  subscriptionId: string;
  nome: string;
  formaPagamento: FormaPagamento | null;
  mensalidade: number;
  ajuste: number;
  extras: ExtraCobravel[];
  totalExtras: number;
  total: number;
  /** true quando a mensalidade foi proporcional (entrada no meio do mes). */
  proporcional: boolean;
}

export interface GrupoPagador {
  pagadorId: string;
  pagadorNome: string;
  formaPagamento: FormaPagamento | null;
  assinaturas: LinhaAssinatura[];
  total: number;
}

export interface Previa {
  periodoReferencia: string;
  janela: JanelaCiclo;
  grupos: GrupoPagador[];
  totalGeral: number;
  alertas: AlertaPrevia[];
}

export interface JanelaCiclo {
  /** Primeira quinta APOS o corte anterior (inclusiva). */
  primeiraQuinta: string;
  /** Ultima quinta <= dia 25 do mes anterior ao de referencia (inclusiva). */
  ultimaQuinta: string;
  quintas: string[];
}

// ---------------------------------------------------------------------------
// Datas: aritmetica em UTC sobre YYYY-MM-DD, sem dependencia externa
// ---------------------------------------------------------------------------
// Nao usa date-fns nem Date local de proposito. As datas do banco sao `date`
// (sem hora) e chegam como 'YYYY-MM-DD'; qualquer conversao pra Date local
// desloca um dia dependendo do fuso da maquina — e o gemeo do portal roda em
// serverless UTC, onde o bug apareceria so em producao. Date.UTC e deterministico
// nos dois lados, e uma dependencia a menos pra portar.

const QUINTA = 4; // getUTCDay: 0=domingo

function paraUTC(ymd: string): Date {
  const [a, m, d] = ymd.split('-').map(Number);
  return new Date(Date.UTC(a, m - 1, d));
}

function paraYmd(d: Date): string {
  return d.toISOString().slice(0, 10);
}

function somaDias(ymd: string, dias: number): string {
  const d = paraUTC(ymd);
  d.setUTCDate(d.getUTCDate() + dias);
  return paraYmd(d);
}

/** Mes anterior a 'AAAA-MM', como 'AAAA-MM'. */
export function mesAnterior(periodo: string): string {
  const [a, m] = periodo.split('-').map(Number);
  return m === 1
    ? `${a - 1}-12`
    : `${a}-${String(m - 1).padStart(2, '0')}`;
}

/**
 * Ultima quinta com dia <= 25 no mes dado ('AAAA-MM'). E o corte do ciclo:
 * entrega de quinta depois do 25 fica pro ciclo seguinte.
 */
export function corteDoMes(periodo: string): string {
  const dia25 = `${periodo}-25`;
  // recua de 25 ate achar quinta (no maximo 6 passos)
  let cursor = dia25;
  for (let i = 0; i < 7; i++) {
    if (paraUTC(cursor).getUTCDay() === QUINTA) return cursor;
    cursor = somaDias(cursor, -1);
  }
  /* c8 ignore next */
  throw new Error(`sem quinta ate o dia 25 de ${periodo}`);
}

/** Todas as quintas em (depoisDe, ate], as duas pontas em YYYY-MM-DD. */
export function quintasEntre(depoisDe: string, ate: string): string[] {
  const out: string[] = [];
  let cursor = somaDias(depoisDe, 7); // proxima quinta apos o corte anterior
  while (cursor <= ate) {
    out.push(cursor);
    cursor = somaDias(cursor, 7);
  }
  return out;
}

/** Quintas do mes 'AAAA-MM' inteiro. Usado no rateio de entrada nova. */
export function quintasDoMes(periodo: string): string[] {
  const [a, m] = periodo.split('-').map(Number);
  const out: string[] = [];
  const d = new Date(Date.UTC(a, m - 1, 1));
  while (d.getUTCDay() !== QUINTA) d.setUTCDate(d.getUTCDate() + 1);
  while (d.getUTCMonth() === m - 1) {
    out.push(paraYmd(d));
    d.setUTCDate(d.getUTCDate() + 7);
  }
  return out;
}

/**
 * Janela de extras do periodo de referencia.
 *
 * Regra do briefing: "da primeira quinta APOS o corte anterior ate a ultima
 * quinta <= dia 25" do mes anterior ao de referencia. Os dois cortes juntos
 * fazem a janela ser SEM BURACO e SEM SOBREPOSICAO: o que passou do corte de um
 * mes e exatamente o que abre o mes seguinte.
 *
 * Referencia 2026-11: corte 22/10, corte anterior 24/09 -> 01, 08, 15, 22/10.
 * A quinta 29/10 NAO entra: cai no ciclo de dezembro. Esse e o caso do briefing.
 */
export function janelaDoCiclo(periodoReferencia: string): JanelaCiclo {
  const mesDosExtras = mesAnterior(periodoReferencia);
  const ultimaQuinta = corteDoMes(mesDosExtras);
  const corteAnterior = corteDoMes(mesAnterior(mesDosExtras));
  const quintas = quintasEntre(corteAnterior, ultimaQuinta);
  return {
    primeiraQuinta: quintas[0] ?? somaDias(corteAnterior, 7),
    ultimaQuinta,
    quintas,
  };
}

// ---------------------------------------------------------------------------
// Dinheiro
// ---------------------------------------------------------------------------

/** Arredonda a 2 casas. Mesma conta do computeTotalExtras do portal. */
export function dinheiro(n: number): number {
  return Math.round(n * 100) / 100;
}

// As duas funcoes abaixo formatam texto que vai PRA TELA, dentro das mensagens
// de alerta. Ficam aqui e nao no formatador do app porque o gemeo do portal
// (Fase 3) monta as mesmas mensagens e precisa das mesmas strings.

/** 'R$ 28,00' a partir de 28. */
function reais(n: number): string {
  return `R$ ${n.toFixed(2).replace('.', ',')}`;
}

/** 'quinta 03/09' a partir de '2026-09-03'. Data crua em ISO seria ruido. */
function quintaLegivel(ymd: string): string {
  const [, m, d] = ymd.split('-');
  return `quinta ${d}/${m}`;
}

// ---------------------------------------------------------------------------
// Montagem
// ---------------------------------------------------------------------------

/**
 * Mensalidade do mes de referencia, com a regra de vigencia de 29/08:
 * aumento vale proporcional no mes corrente e cheio na renovacao; reducao SO
 * vale na renovacao. Na pratica, se ha uma mudanca agendada
 * (next_billing_change_date) que ja entrou em vigor ate o primeiro dia do mes
 * de referencia, e o valor novo que vale.
 *
 * Hoje NENHUMA das 40 ativas tem next_billing_* preenchido (conferido em
 * 04/09), entao este ramo nao tem dado vivo — existe pela regra e esta coberto
 * por teste sintetico.
 */
function mensalidadeVigente(sub: SubscriptionPrevia, periodoReferencia: string): number {
  const primeiroDia = `${periodoReferencia}-01`;
  if (
    sub.next_billing_change_date !== null &&
    sub.next_billing_value !== null &&
    sub.next_billing_change_date <= primeiroDia
  ) {
    return sub.next_billing_value;
  }
  return sub.valor_mensal;
}

/**
 * Entrada no meio do mes: primeira cobranca proporcional por quintas restantes
 * dividido por quintas do mes.
 *
 * `valor_mensal` JA INCLUI o frete (conferido em 04/09: vale
 * valor_mensal = valor_paes + valor_frete nas 40 ativas), entao ratear
 * valor_mensal e ratear "mensalidade e frete" como o briefing pede — sem somar
 * o frete de novo por fora.
 */
function rateioDeEntrada(
  sub: SubscriptionPrevia,
  periodoReferencia: string,
  mensalidadeCheia: number,
): { valor: number; proporcional: boolean } {
  if (!sub.activated_at) return { valor: mensalidadeCheia, proporcional: false };
  const ativacao = sub.activated_at.slice(0, 10);
  if (ativacao.slice(0, 7) !== periodoReferencia) {
    return { valor: mensalidadeCheia, proporcional: false };
  }
  const todas = quintasDoMes(periodoReferencia);
  const restantes = todas.filter((q) => q >= ativacao);
  if (todas.length === 0 || restantes.length === todas.length) {
    return { valor: mensalidadeCheia, proporcional: false };
  }
  return {
    valor: dinheiro((mensalidadeCheia * restantes.length) / todas.length),
    proporcional: true,
  };
}

/**
 * Ajuste proporcional de aumento no meio do mes ANTERIOR.
 *
 * Contexto (Hugo, 04/09): aumento no meio do mes so acontece em MUDANCA DE
 * PLANO (1 -> 2 -> 3 paes), proporcional as semanas restantes. Aumento por
 * outro motivo so vale na virada, e ai nao ha ajuste a fazer.
 *
 * ==========================================================================
 * ACHADO DE 04/09: HOJE O AJUSTE E IRRECONSTRUIVEL PELO BANCO.
 * ==========================================================================
 * O PATCH de mudanca de plano do portal (cora-portal,
 * api/subscriptions/index.js) SOBRESCREVE `valor_mensal` na hora e diz, em
 * comentario proprio, que NAO toca `next_billing_*` — "regra de quando a
 * mudanca vale fica pra fase 2". E ninguem mais escreve nessas duas colunas em
 * repo nenhum: a 0014 so as criou, o portal so as LE pra mostrar "mudanca
 * pendente", e as 40 ativas estao com as duas nulas.
 *
 * Consequencia: quando um plano muda no dia 10, o valor velho desaparece no
 * mesmo instante e, no dia 26, a previa nao tem como saber que houve mudanca —
 * a assinatura parece ter sempre valido o valor novo. O unico registro do valor
 * anterior e o e-mail que o portal manda pro Hugo, que nao esta no banco.
 *
 * Por isso a funcao abaixo, na pratica, so vai calcular alguma coisa se algum
 * dia `next_billing_*` passar a ser populado. Enquanto nao for, ela devolve 0 —
 * mas NAO em silencio: `montaPrevia` levanta `ajuste_nao_reconstruivel` sempre
 * que houver assinatura sem esse dado, justamente pra que "nao houve ajuste" e
 * "nao da pra saber se houve" nao se pareçam na tela.
 *
 * A saida (tabela de historico de valor vs lancamento manual em outubro) e
 * decisao do Hugo, e nao esta implementada aqui.
 */
function ajusteProporcional(sub: SubscriptionPrevia, periodoReferencia: string): number {
  const { next_billing_change_date: quando, next_billing_value: novo } = sub;
  if (quando === null || novo === null) return 0;
  const mesDoAjuste = mesAnterior(periodoReferencia);
  if (quando.slice(0, 7) !== mesDoAjuste) return 0;
  if (novo <= sub.valor_mensal) return 0; // reducao nao gera ajuste

  const todas = quintasDoMes(mesDoAjuste);
  const afetadas = todas.filter((q) => q >= quando);
  if (todas.length === 0 || afetadas.length === 0) return 0;
  const diferenca = novo - sub.valor_mensal;
  return dinheiro((diferenca * afetadas.length) / todas.length);
}

/**
 * Monta a previa de um periodo de referencia ('AAAA-MM').
 *
 * O filtro de quem entra e `forma_pagamento <> 'cartao'` do PAGADOR — nunca
 * `IN ('boleto','pix')`, que hoje deixaria 25 dos 27 de fora em silencio
 * (migration 0044). Quem esta com forma nula ENTRA na lista, com alerta: a
 * previa jamais filtra calada.
 */
export function montaPrevia(entrada: EntradaPrevia, periodoReferencia: string): Previa {
  const janela = janelaDoCiclo(periodoReferencia);
  const alertas: AlertaPrevia[] = [];
  const naJanela = new Set(janela.quintas);

  // Entrega e o portao do pos-consumo: so entra extra de pedido que virou
  // entrega ENTREGUE. `weekly_orders.status = 'confirmado'` sozinho nao serve
  // — ha rascunho com total_extras > 0 no banco, carrinho montado que nunca
  // foi entregue (2 casos reais em agosto/2026).
  const entreguesPorOrder = new Set(
    entrada.entregas
      .filter((e) => e.status === 'entregue' && e.weekly_order_id !== null)
      .map((e) => e.weekly_order_id as string),
  );

  const extrasPorSub = new Map<string, ExtraCobravel[]>();
  for (const wo of entrada.weeklyOrders) {
    if (!naJanela.has(wo.delivery_date)) continue;
    if (wo.status !== 'confirmado') continue;

    if (!entreguesPorOrder.has(wo.id)) {
      // Confirmado na janela mas sem entrega entregue. NAO descarta calado:
      // pode ser atraso operacional de marcar a entrega, e nesse caso o extra
      // existe e some da fatura sem ninguem ver.
      alertas.push({
        codigo: 'entrega_nao_confirmada',
        mensagem:
          `Cesta confirmada na ${quintaLegivel(wo.delivery_date)} sem entrega marcada como ` +
          `entregue. Não entrou na cobrança, confira antes de gerar.`,
        subscriptionId: wo.subscription_id,
      });
      continue;
    }

    const itens = wo.extras ?? [];
    const precosDaQuinta = entrada.precos.get(wo.delivery_date);
    let soma = 0;
    const cobravel: ExtraCobravel[] = [];

    for (const item of itens) {
      const subtotal = dinheiro(item.qty * item.preco_unit);
      soma += subtotal;
      cobravel.push({ ...item, quinta: wo.delivery_date, subtotal });

      // O preco gravado e um SNAPSHOT do cardapio no momento do pedido, e e ele
      // que vale: cobrar outro valor seria cobrar um numero que o assinante
      // nunca viu na tela. Mas nunca corrigir calado — os dois alertas abaixo
      // sao o "em voz alta".
      if (item.preco_unit === 0) {
        // Alerta proprio, independente de divergencia: preco zero pode ser
        // cortesia OU erro de cadastro, e hoje os dois tem exatamente o mesmo
        // simbolo no banco. Ninguem consegue distinguir sem perguntar.
        alertas.push({
          codigo: 'preco_zero',
          mensagem:
            `${item.nome} na ${quintaLegivel(wo.delivery_date)} está com preço zero e ` +
            `foi cobrado como zero. Cortesia ou preço que faltou cadastrar? O banco não distingue.`,
          subscriptionId: wo.subscription_id,
        });
      }

      const precoHoje = precosDaQuinta?.get(item.id);
      if (precoHoje !== undefined && precoHoje !== item.preco_unit) {
        alertas.push({
          codigo: 'preco_divergente',
          mensagem:
            `${item.nome} na ${quintaLegivel(wo.delivery_date)} foi gravado a ` +
            `${reais(item.preco_unit)} e o cardápio da semana diz ${reais(precoHoje)}. ` +
            `Cobrado o valor gravado, que foi o que apareceu para a pessoa.`,
          subscriptionId: wo.subscription_id,
        });
      }
    }

    // Invariante provado em 04/09 contra 44 linhas de agosto: total_extras e
    // exatamente a soma de qty*preco_unit. Se quebrar, a tela grita em vez de
    // escolher um dos dois numeros por conta propria.
    if (dinheiro(soma) !== dinheiro(wo.total_extras)) {
      alertas.push({
        codigo: 'total_extras_divergente',
        mensagem:
          `Na ${quintaLegivel(wo.delivery_date)} o total gravado é ${reais(wo.total_extras)} ` +
          `e a soma dos produtos dá ${reais(dinheiro(soma))}. Os dois números do banco ` +
          `discordam, então nenhum deles é confiável.`,
        subscriptionId: wo.subscription_id,
      });
    }

    const acumulado = extrasPorSub.get(wo.subscription_id) ?? [];
    extrasPorSub.set(wo.subscription_id, acumulado.concat(cobravel));
  }

  // ---- linhas por assinatura -------------------------------------------
  const porId = new Map(entrada.subscriptions.map((s) => [s.id, s]));
  const linhas = new Map<string, LinhaAssinatura>();

  for (const sub of entrada.subscriptions) {
    if (sub.forma_pagamento === null) {
      alertas.push({
        codigo: 'forma_pagamento_ausente',
        mensagem:
          `${sub.nome} está ativa sem forma de pagamento. Aparece na prévia, mas ` +
          `confira no painel do Asaas antes de gerar.`,
        subscriptionId: sub.id,
      });
    }

    const cheia = mensalidadeVigente(sub, periodoReferencia);
    const { valor: mensalidade, proporcional } = rateioDeEntrada(sub, periodoReferencia, cheia);
    const ajuste = ajusteProporcional(sub, periodoReferencia);
    const extras = extrasPorSub.get(sub.id) ?? [];
    const totalExtras = dinheiro(extras.reduce((s, e) => s + e.subtotal, 0));

    linhas.set(sub.id, {
      subscriptionId: sub.id,
      nome: sub.nome,
      formaPagamento: sub.forma_pagamento,
      mensalidade,
      ajuste,
      extras,
      totalExtras,
      total: dinheiro(mensalidade + ajuste + totalExtras),
      proporcional,
    });
  }

  // ---- agrupamento por pagador -----------------------------------------
  // Um nivel so: `pagador_subscription_id ?? id`. Null = paga a propria (o caso
  // de 38 das 40). Nao ha trava de ciclo no banco; se um dia A pagar B e B
  // pagar A, cada um vira raiz do proprio grupo em vez de a montagem entrar em
  // loop.
  const grupos = new Map<string, GrupoPagador>();

  for (const sub of entrada.subscriptions) {
    const apontado = sub.pagador_subscription_id;
    let pagadorId = apontado ?? sub.id;
    let pagador = porId.get(pagadorId);

    if (apontado !== null && pagador === undefined) {
      // A coluna aponta pra uma assinatura que nao veio na leitura: ou nao
      // existe mais, ou nao esta ativa, ou e uma linha 'dev'. Antes isto caia
      // num `?? sub` que remontava o grupo em silencio com o nome e a forma de
      // pagamento do DEPENDENTE — a tela mostraria um pagador que nao e o
      // pagador, e o filtro de cartao passaria a olhar a forma errada.
      //
      // Agora: alerta, e o dependente volta a ser pagador de si mesmo. Ele
      // continua aparecendo (nunca some da previa), so nao finge estar
      // agrupado sob alguem que nao esta la.
      alertas.push({
        codigo: 'pagador_nao_encontrado',
        mensagem:
          `${sub.nome} aponta para quem paga por ela, mas essa assinatura não está ativa ` +
          `(pode ter sido cancelada ou pausada). Cobrada separadamente, por si mesma.`,
        subscriptionId: sub.id,
      });
      pagadorId = sub.id;
      pagador = sub;
    }

    const linha = linhas.get(sub.id);
    /* c8 ignore next */
    if (!linha) continue;

    let grupo = grupos.get(pagadorId);
    if (!grupo) {
      // `pagador` so e undefined no caminho ja tratado acima (que reatribui
      // pagadorId e pagador). O `?? sub` fecha o tipo sem inventar caso novo.
      const raiz = pagador ?? sub;
      grupo = {
        pagadorId,
        pagadorNome: raiz.nome,
        formaPagamento: raiz.forma_pagamento,
        assinaturas: [],
        total: 0,
      };
      grupos.set(pagadorId, grupo);
    }
    grupo.assinaturas.push(linha);
  }

  // ---- filtro, totais e alertas de grupo -------------------------------
  const saida: GrupoPagador[] = [];

  for (const grupo of grupos.values()) {
    // Filtro pela forma do PAGADOR: quem paga e quem recebe a cobranca. Um
    // grupo de cartao inteiro fica fora (segue na recorrencia do Asaas na
    // transicao); um pagador de boleto que banca uma assinatura de cartao
    // entra, porque quem paga paga por boleto.
    if (grupo.formaPagamento === 'cartao') continue;

    const formas = new Set(grupo.assinaturas.map((a) => a.formaPagamento));
    if (formas.size > 1) {
      alertas.push({
        codigo: 'grupo_forma_mista',
        mensagem:
          `As assinaturas que ${grupo.pagadorNome} paga têm formas de pagamento ` +
          `diferentes. Cobrado pela forma de quem paga (${grupo.formaPagamento ?? 'sem forma'}).`,
        subscriptionId: grupo.pagadorId,
      });
    }

    const pagador = porId.get(grupo.pagadorId);
    if (pagador && pagador.asaas_customer_id === null) {
      alertas.push({
        codigo: 'sem_cliente_asaas',
        mensagem:
          `${grupo.pagadorNome} não tem cliente no Asaas. A prévia monta, mas a cobrança ` +
          `não pode ser criada sem vincular antes.`,
        subscriptionId: grupo.pagadorId,
      });
    }

    grupo.assinaturas.sort((a, b) => a.nome.localeCompare(b.nome, 'pt-BR'));
    grupo.total = dinheiro(grupo.assinaturas.reduce((s, a) => s + a.total, 0));
    saida.push(grupo);
  }

  saida.sort((a, b) => a.pagadorNome.localeCompare(b.pagadorNome, 'pt-BR'));

  // ---- escopo dos alertas ----------------------------------------------
  // So sobrevive alerta de quem esta NA TELA. Os pedidos dos 13 de cartao
  // passam por esta funcao (a leitura nao os filtra, pra que forma nula
  // apareca), e sem este corte eles gerariam alerta de preco e de entrega numa
  // tela que lista so os 27 — o Hugo veria um aviso sobre alguem que nao esta
  // ali. Alerta irrelevante treina a ignorar alerta, e ai o relevante passa
  // batido junto.
  //
  // subscriptionId null = alerta da previa inteira, nao de uma linha; esse
  // sempre fica.
  const idsNaPrevia = new Set(
    saida.flatMap((g) => g.assinaturas.map((a) => a.subscriptionId)),
  );
  const alertasNoEscopo = alertas.filter(
    (a) => a.subscriptionId === null || idsNaPrevia.has(a.subscriptionId),
  );

  // Enquanto ninguem popular next_billing_*, "nao houve ajuste" e "nao da pra
  // saber se houve" sao o mesmo 0. Este alerta separa os dois. Ele se aposenta
  // sozinho no dia em que todas as linhas da previa tiverem o dado: a condicao
  // e a ausencia do dado, nao a ausencia do mecanismo.
  const semDadoDeAjuste = saida
    .flatMap((g) => g.assinaturas)
    .some((a) => {
      const sub = porId.get(a.subscriptionId);
      return sub !== undefined && sub.next_billing_change_date === null;
    });
  if (semDadoDeAjuste) {
    alertasNoEscopo.push({
      codigo: 'ajuste_nao_reconstruivel',
      mensagem:
        'Mudança de plano no meio do mês não deixa rastro no banco: o valor antigo é ' +
        'substituído na hora. Se alguém mudou de plano no mês passado, o ajuste proporcional ' +
        'não está nesta prévia e precisa de lançamento manual.',
      subscriptionId: null,
    });
  }

  return {
    periodoReferencia,
    janela,
    grupos: saida,
    totalGeral: dinheiro(saida.reduce((s, g) => s + g.total, 0)),
    alertas: alertasNoEscopo,
  };
}
