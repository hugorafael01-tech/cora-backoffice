import type { Database } from '../../lib/database.types';
import type { EstadoSemana } from '../../lib/semana';

export type Semana = Database['public']['Tables']['semanas']['Row'];
export type ProdutoFormato = Database['public']['Enums']['produto_formato'];

/** Origem de uma linha da lista de volume (de onde a receita veio). */
export type FonteLinha = 'cardapio' | 'adicionada' | 'teste';

/**
 * Uma linha da lista "Definir volume". Carrega a versao a produzir
 * (versao_receita_id) + tudo que o preview precisa espelhar do trigger.
 */
export interface LinhaVolume {
  versaoReceitaId: string;
  produtoId: string;
  nome: string;
  formato: ProdutoFormato | null;
  grupo: number | null;
  fonte: FonteLinha;
  rascunho: boolean; // versao em status rascunho (receita de teste)
  pesoMassaG: number | null;
  somaBaker: number; // soma dos percentual_baker da versao
  levainPct: number | null; // baker% da linha de levain (null = sem levain)
  qty: number;
  temProducao: boolean; // ja existe producao desta versao na semana
  producaoStatus: ProducaoStatus | null; // status da producao existente (null se temProducao=false)
}

export interface DadosProducao {
  semana: Semana;
  estado: EstadoSemana;
  linhas: LinhaVolume[];
  semanaAnterior: string | null;
  semanaProxima: string | null;
}

// ---- Preparacao (read-only: mise en place + fichas) ----

/** Linha de breakdown por produto dentro de um ingrediente (saida nativa da funcao). */
export interface MiseProduto {
  produtoId: string;
  produtoNome: string;
  qtyG: number;
}

/** Ingrediente agregado pro mise en place. totalG = soma dos qtyG dos produtos. */
export interface MiseIngrediente {
  ingredienteId: string;
  nome: string;
  unidade: string;
  totalG: number;
  porProduto: MiseProduto[];
}

/** Uma linha de ingrediente na formulacao da ficha. */
export interface FichaIngrediente {
  nome: string;
  slug: string;
  baker: number; // percentual_baker decimal (0.85 = 85%)
  gramasPorPao: number | null; // farinha_por_pao x baker; null se sem farinha (Sigma 0)
}

/** Uma etapa do processo da ficha (template etapas_receita). */
export interface FichaEtapa {
  ordem: number;
  nome: string;
  tipo: string | null;
  duracaoMin: number | null;
  notas: string | null;
}

/** Ficha tecnica read-only de uma receita produzida na semana. */
export interface Ficha {
  versaoReceitaId: string;
  nome: string;
  grupo: number | null;
  rascunho: boolean;
  hidratacaoAlvo: number | null;
  pesoMassaG: number | null;
  qty: number;
  ingredientes: FichaIngrediente[];
  etapas: FichaEtapa[];
}

export interface DadosPreparacao {
  miseEnPlace: MiseIngrediente[];
  fichas: Ficha[];
  totalPaes: number;
}

// ---- Acompanhamento (Estado B / fatia B1: percorrer as etapas) ----

export type EtapaStatus = Database['public']['Enums']['etapa_status_enum'];
export type EtapaTipo = Database['public']['Enums']['etapa_tipo_enum'];
export type ProducaoStatus = Database['public']['Enums']['producao_status_enum'];

/** Uma etapa de producao com seu estado + captura ja gravada. */
export interface EtapaAcomp {
  id: string;
  ordem: number;
  tipo: EtapaTipo;
  status: EtapaStatus;
  iniciadaAt: string | null;
  concluidaAt: string | null;
  dobraNumero: number | null;
  tempC: number | null;
  detalhes: Record<string, unknown>;
  notas: string | null;
}

/** Uma producao da semana com suas etapas ordenadas + progresso derivado. */
export interface ProducaoAcomp {
  id: string;
  versaoReceitaId: string;
  nome: string;
  grupo: number | null;
  rascunho: boolean;
  status: ProducaoStatus;
  iniciadaAt: string | null;
  concluidaAt: string | null;
  qtyPrevista: number | null;
  pesoMassaG: number | null; // peso da peca (massa crua) p/ a etapa de divisao
  etapas: EtapaAcomp[];
  etapaAgoraId: string | null; // etapa em destaque (em_curso de menor ordem; senao 1a aguardando)
  feitas: number; // etapas resolvidas (concluida + pulada)
  total: number;
}

export interface DadosAcompanhamento {
  producoes: ProducaoAcomp[];
}
