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
}

export interface DadosProducao {
  semana: Semana;
  estado: EstadoSemana;
  linhas: LinhaVolume[];
  semanaAnterior: string | null;
  semanaProxima: string | null;
}
