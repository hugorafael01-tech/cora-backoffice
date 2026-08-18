// Helpers puros da Expedicao (E2). Sem Supabase: normalizacao de regiao, flatten
// de itens (espelha a view planejamento_semana / 0013), resumo/rota/etiqueta,
// transicoes de status e agrupamento por onda. Tudo testavel isoladamente.
//
// Zona e sequencia (0032) vivem em ./zonas.ts; aqui elas so entram no shape da
// entrega e no agrupamento da tela.
import { normalize } from './normalize';
import {
  codigoSequencia,
  comparaCanonico,
  grupoDaEntrega,
  zonaDaEntrega,
  GRUPO_LABEL,
  type GrupoOnda,
  type Onda,
  type Zona,
} from './zonas';

export type Regiao = 'niteroi' | 'rio';
export type StatusEntrega = 'pendente' | 'em_rota' | 'entregue';

export interface ItemEntrega {
  slug: string;
  nome: string;
  qty: number;
}

/** Item da entrega ja resolvido pra UI/rota/etiqueta. */
export interface EntregaLite {
  id: string;
  nome: string;
  whatsapp: string | null;
  cep: string | null;
  rua: string;
  numero: string | null;
  complemento: string | null;
  bairro: string;
  cidade: string;
  regiao: string;
  /** Codigo da zona congelado na geracao (snapshot). null = cadastro sem zona. */
  zona: string | null;
  /** Ordem da parada dentro da onda (1..n). null = ainda nao sequenciada. */
  sequencia: number | null;
  itens: ItemEntrega[];
  observacao: string | null;
  status: StatusEntrega;
  emRotaAt: string | null;
  entregueAt: string | null;
}

/**
 * Regiao a partir da cidade: normaliza (lower/sem acento); cidade que contem
 * 'niter' (Niteroi, Niterói) -> 'niteroi'; qualquer outra -> 'rio'. Binario de
 * proposito no v1 (so atendemos Niteroi e Rio).
 */
export function normalizaRegiao(cidade: string | null | undefined): Regiao {
  return normalize(cidade).includes('niter') ? 'niteroi' : 'rio';
}

export function regiaoLabel(r: Regiao): string {
  return r === 'niteroi' ? 'Niterói' : 'Rio';
}

const STATUS_LABEL: Record<StatusEntrega, string> = {
  pendente: 'Pendente',
  em_rota: 'Em rota',
  entregue: 'Entregue',
};

export function statusLabel(s: StatusEntrega): string {
  return STATUS_LABEL[s];
}

/**
 * Junta composicao { slug: qty } (qty 0 = removido) com extras [{ id, qty, nome }]
 * num formato unico [{ slug, nome, qty }]. Mesma logica da view 0013: ignora qty
 * <= 0; nome via tabela produtos (mapa slug->nome), com fallback no proprio slug
 * (ou no nome do extra, quando vier). Agrega por slug somando as quantidades.
 */
export function flattenComposition(
  composition: unknown,
  extras: unknown,
  nomePorSlug: Map<string, string>
): ItemEntrega[] {
  const porSlug = new Map<string, ItemEntrega>();

  const soma = (slug: string, qty: number, nome: string) => {
    if (!slug || qty <= 0) return;
    const ja = porSlug.get(slug);
    if (ja) ja.qty += qty;
    else porSlug.set(slug, { slug, nome, qty });
  };

  if (composition && typeof composition === 'object' && !Array.isArray(composition)) {
    for (const [slug, raw] of Object.entries(composition as Record<string, unknown>)) {
      soma(slug, Number(raw) || 0, nomePorSlug.get(slug) ?? slug);
    }
  }

  if (Array.isArray(extras)) {
    for (const e of extras as Array<Record<string, unknown>>) {
      const slug = String(e?.id ?? '');
      const nome =
        (typeof e?.nome === 'string' && e.nome) || nomePorSlug.get(slug) || slug;
      soma(slug, Number(e?.qty) || 0, nome);
    }
  }

  return [...porSlug.values()];
}

/** Composicao do pedido pontual: objeto { slug: qty } (sem extras). */
export function flattenComposicaoPontual(
  composicao: unknown,
  nomePorSlug: Map<string, string>
): ItemEntrega[] {
  return flattenComposition(composicao, null, nomePorSlug);
}

/** Baseline da assinatura: qty de Original/Integral cadastrada no plano. */
export interface BaselineAssinatura {
  original: number;
  integral: number;
}

/** weekly_order do ciclo (se existir) considerado como possivel override. */
export interface OrdemAssinatura {
  status: 'rascunho' | 'confirmado';
  composition: unknown;
  extras: unknown;
}

/**
 * Itens da entrega de uma assinatura (decisao de produto 20/07/2026): todo
 * assinante recebe o baseline (Original + Integral do plano) toda semana, sem
 * precisar de acao. O weekly_order CONFIRMADO e o UNICO override valido —
 * composicao custom (se null, cai no baseline) E extras. Rascunho ou ausencia
 * de order nao valem nada (nem composicao nem extras): baseline puro, sem
 * extras.
 */
export function itensAssinatura(
  ordem: OrdemAssinatura | null,
  baseline: BaselineAssinatura,
  nomePorSlug: Map<string, string>
): ItemEntrega[] {
  const composicaoBase = { original: baseline.original, integral: baseline.integral };
  if (ordem && ordem.status === 'confirmado') {
    return flattenComposition(ordem.composition ?? composicaoBase, ordem.extras, nomePorSlug);
  }
  return flattenComposition(composicaoBase, null, nomePorSlug);
}

/** "3x Original · 1x Focaccia" (ordem dos itens). '' quando vazio. */
export function resumoItens(itens: ItemEntrega[]): string {
  return itens.map((i) => `${i.qty}x ${i.nome}`).join(' · ');
}

/** "rua, numero · bairro" (endereco curto da linha). */
export function enderecoCurto(e: Pick<EntregaLite, 'rua' | 'numero' | 'bairro'>): string {
  const ruaNum = [e.rua, e.numero].filter((x) => x && String(x).trim()).join(', ');
  return [ruaNum, e.bairro].filter(Boolean).join(' · ');
}

/** Endereco completo (etiqueta / linha expandida). */
export function enderecoCompleto(
  e: Pick<EntregaLite, 'rua' | 'numero' | 'complemento' | 'bairro' | 'cidade' | 'cep'>
): string {
  const linha1 = [e.rua, e.numero, e.complemento]
    .filter((x) => x && String(x).trim())
    .join(', ');
  const linha2 = [e.bairro, e.cidade].filter(Boolean).join(' - ');
  const cep = e.cep ? `CEP ${e.cep}` : '';
  return [linha1, linha2, cep].filter(Boolean).join(' · ');
}

/**
 * Linha de rota pro WhatsApp do motoboy:
 * "R-07. Nome — rua, numero, complemento — bairro — itens — obs"
 * (obs so entra quando preenchida; itens cai em "sem itens" quando vazio).
 *
 * O prefixo e o MESMO codigo impresso na etiqueta: o motoboy casa a linha da
 * lista com o pacote sem ter que ler nome nem endereco. `rotulo` cai no numero
 * de ordem quando a entrega ainda nao tem sequencia.
 *
 * Telefone continua fora daqui (decisao do Hugo, 04/08) — ver EtiquetasPrint.
 */
export function linhaRota(rotulo: string, e: EntregaLite): string {
  const endereco = [e.rua, e.numero, e.complemento]
    .filter((x) => x && String(x).trim())
    .join(', ');
  const partes = [`${rotulo}. ${e.nome}`, endereco, e.bairro, resumoItens(e.itens) || 'sem itens'];
  if (e.observacao && e.observacao.trim()) partes.push(e.observacao.trim());
  return partes.join(' — ');
}

/**
 * Texto completo da rota de um grupo, uma linha por entrega na ordem da lista
 * (ordem de ENTREGA, nao de carregamento).
 */
export function textoRota(grupo: GrupoEntregas): string {
  return grupo.entregas
    .map((e, i) => linhaRota(rotuloSequencia(e, grupo.onda) ?? String(i + 1), e))
    .join('\n');
}

/**
 * Codigo de sequencia da entrega ('N-01'), ou null quando ela ainda nao foi
 * sequenciada / nao viaja na bag.
 */
export function rotuloSequencia(
  e: Pick<EntregaLite, 'sequencia'>,
  onda: Onda | null
): string | null {
  return onda && e.sequencia != null ? codigoSequencia(onda, e.sequencia) : null;
}

const ORDEM: StatusEntrega[] = ['pendente', 'em_rota', 'entregue'];

/** Proximo status (entregue e terminal — fica em entregue). */
export function proximoStatus(s: StatusEntrega): StatusEntrega {
  const i = ORDEM.indexOf(s);
  return ORDEM[Math.min(i + 1, ORDEM.length - 1)];
}

/** Status anterior (pendente e inicial — fica em pendente). */
export function statusAnterior(s: StatusEntrega): StatusEntrega {
  const i = ORDEM.indexOf(s);
  return ORDEM[Math.max(i - 1, 0)];
}

/** Um grupo da tela de expedicao: uma onda de rota, ou a entrega propria. */
export interface GrupoEntregas {
  grupo: GrupoOnda;
  label: string;
  /** Onda de rota do grupo; null em 'propria' (nao viaja na bag). */
  onda: Onda | null;
  /** Ordem de ENTREGA: sequencia crescente (as sem sequencia vao pro fim). */
  entregas: EntregaLite[];
  total: number;
  entregues: number;
  /** Entregas sem zona resolvida — precisam de correcao no cadastro. */
  semZona: number;
  /** Entregas ainda sem sequencia atribuida. */
  semSequencia: number;
  /** Pacotes que contam pra capacidade da bag ('propria' nao conta). */
  pacotes: number;
}

const ORDEM_GRUPOS: GrupoOnda[] = ['niteroi', 'rio', 'propria'];

/**
 * Agrupa por onda (Niteroi, Rio, entrega propria), ordenando pela SEQUENCIA
 * dentro do grupo — e a ordem em que o motoboy entrega. Entrega ainda sem
 * sequencia vai pro fim do grupo, em ordem canonica (zona, bairro, logradouro),
 * pra lista nao dancar entre um refetch e outro.
 *
 * Substituiu `agrupaPorRegiao`: a onda vem da ZONA do cadastro, nao da cidade.
 * A `regiao` do snapshot segue sendo o fallback de quem esta sem zona.
 */
export function agrupaPorOnda(entregas: EntregaLite[], zonas: Map<string, Zona>): GrupoEntregas[] {
  const grupos: GrupoEntregas[] = [];

  for (const grupo of ORDEM_GRUPOS) {
    const doGrupo = entregas
      .filter((e) => grupoDaEntrega(e, zonas) === grupo)
      .sort((a, b) => {
        if (a.sequencia != null && b.sequencia != null) return a.sequencia - b.sequencia;
        if (a.sequencia != null) return -1;
        if (b.sequencia != null) return 1;
        return comparaCanonico(a, b, zonas);
      });
    if (doGrupo.length === 0) continue;

    grupos.push({
      grupo,
      label: GRUPO_LABEL[grupo],
      onda: grupo === 'propria' ? null : grupo,
      entregas: doGrupo,
      total: doGrupo.length,
      entregues: doGrupo.filter((e) => e.status === 'entregue').length,
      semZona: doGrupo.filter((e) => zonaDaEntrega(e, zonas) === null).length,
      semSequencia: doGrupo.filter((e) => e.sequencia == null).length,
      // Entrega propria nao viaja na bag, entao nao ocupa capacidade.
      pacotes: grupo === 'propria' ? 0 : doGrupo.length,
    });
  }

  return grupos;
}

/**
 * Ordem de CARREGAMENTO da bag: sequencia decrescente. A ultima parada entra
 * primeiro (vai pro fundo) e a primeira fica no topo, entao o motoboy tira o
 * pacote de cima a cada parada em vez de garimpar dentro da bag.
 */
export function ordemCarregamento(entregas: EntregaLite[]): EntregaLite[] {
  return [...entregas].reverse();
}

/** Resultado da comparacao entre pacotes de uma onda e a capacidade da bag. */
export interface OcupacaoBag {
  pacotes: number;
  capacidade: number | null;
  excedente: number;
  acima: boolean;
}

/**
 * Compara os pacotes da onda com a capacidade de transporte configurada
 * (`app_settings.capacidade_bag`). Capacidade nao configurada = sem comparacao,
 * nunca alerta falso.
 */
export function ocupacaoBag(pacotes: number, capacidade: number | null): OcupacaoBag {
  const acima = capacidade != null && pacotes > capacidade;
  return {
    pacotes,
    capacidade,
    excedente: acima ? pacotes - (capacidade as number) : 0,
    acima,
  };
}
