import type { EntregaLite } from '../../lib/expedicao';
import type { BairroZonaDefault, OrdemContexto, Zona } from '../../lib/zonas';

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
  /** Cadastro das zonas ativas (cor, forma, ordem, onda). */
  zonas: Zona[];
  /** Sugestao de zona + ordem dos bairros dentro da zona. */
  bairros: BairroZonaDefault[];
  /** Zonas + ordem dos bairros, prontos pra chave de ordenacao canonica. */
  ordem: OrdemContexto;
  /** `app_settings.capacidade_bag`; null = nao configurada, sem comparacao. */
  capacidadeBag: number | null;
}
