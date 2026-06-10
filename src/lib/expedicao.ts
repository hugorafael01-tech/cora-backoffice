// Helpers puros da Expedicao (E2). Sem Supabase: normalizacao de regiao, flatten
// de itens (espelha a view planejamento_semana / 0013), resumo/rota/etiqueta,
// transicoes de status e agrupamento por regiao. Tudo testavel isoladamente.
import { normalize } from './normalize';

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
 * "N. Nome — rua, numero, complemento — bairro — itens — obs"
 * (obs so entra quando preenchida; itens cai em "sem itens" quando vazio).
 */
export function linhaRota(n: number, e: EntregaLite): string {
  const endereco = [e.rua, e.numero, e.complemento]
    .filter((x) => x && String(x).trim())
    .join(', ');
  const partes = [`${n}. ${e.nome}`, endereco, e.bairro, resumoItens(e.itens) || 'sem itens'];
  if (e.observacao && e.observacao.trim()) partes.push(e.observacao.trim());
  return partes.join(' — ');
}

/** Texto completo da rota de uma regiao (uma linha por entrega, na ordem da lista). */
export function textoRota(entregas: EntregaLite[]): string {
  return entregas.map((e, i) => linhaRota(i + 1, e)).join('\n');
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

export interface GrupoRegiao {
  regiao: Regiao;
  label: string;
  entregas: EntregaLite[]; // ordenadas por bairro (alfabetico) e nome
  total: number;
  entregues: number;
}

/**
 * Agrupa por regiao (Niteroi primeiro, depois Rio), ordenando as entregas por
 * bairro alfabetico e nome. Define a ORDEM unica usada pela lista e pela rota.
 * So entra grupo com entrega.
 */
export function agrupaPorRegiao(entregas: EntregaLite[]): GrupoRegiao[] {
  const ordemRegiao: Regiao[] = ['niteroi', 'rio'];
  const grupos: GrupoRegiao[] = [];

  for (const regiao of ordemRegiao) {
    const doGrupo = entregas
      .filter((e) => e.regiao === regiao)
      .sort(
        (a, b) =>
          a.bairro.localeCompare(b.bairro, 'pt-BR') || a.nome.localeCompare(b.nome, 'pt-BR')
      );
    if (doGrupo.length === 0) continue;
    grupos.push({
      regiao,
      label: regiaoLabel(regiao),
      entregas: doGrupo,
      total: doGrupo.length,
      entregues: doGrupo.filter((e) => e.status === 'entregue').length,
    });
  }

  return grupos;
}
