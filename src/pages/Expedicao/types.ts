import type { EntregaLite } from '../../lib/expedicao';

/** Campos do ciclo usados no header da Expedicao. */
export interface ExpedicaoSemana {
  id: string;
  numero: number;
  data_inicio: string;
  data_entrega: string;
}

export interface DadosExpedicao {
  semana: ExpedicaoSemana;
  entregas: EntregaLite[];
}
