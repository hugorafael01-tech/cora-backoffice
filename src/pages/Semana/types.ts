import type { Database } from '../../lib/database.types';
import type { EstadoSemana, EtapaAgora } from '../../lib/semana';

export type Semana = Database['public']['Tables']['semanas']['Row'];

export interface LinhaProducao {
  slug: string;
  nome: string;
  formato: string | null;
  grupo: number | null;
  qty: number;
  qtyBase: number; // recorrente_base + recorrente_extra
  qtyPontual: number;
  massaTotalG: number;
  levainG: number;
}

export interface InsumoAlerta {
  slug: string;
  nome: string;
  unidade: string;
  atual: number;
  minimo: number;
  crit: boolean; // true = zero (vermelho); false = abaixo do minimo (amarelo)
}

export interface BairroAgregado {
  nome: string;
  count: number;
  foraDaLista: boolean;
}

export interface CidadeEntregas {
  nome: string;
  bairros: BairroAgregado[];
}

export interface DadosSemana {
  semana: Semana;
  estado: EstadoSemana;
  planejamento: LinhaProducao[];
  insumos: { alertas: InsumoAlerta[]; okCount: number };
  entregas: { cidades: CidadeEntregas[]; totalGeral: number };
  etapasAgora: Map<string, EtapaAgora>; // chave: produto.slug
  semanaAnterior: string | null;
  semanaProxima: string | null;
}
