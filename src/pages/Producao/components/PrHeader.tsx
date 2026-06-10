import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { formataDiaMes } from '../../../lib/date';
import { cicloLabel } from '../../../lib/semana';
import { ModalCriarSemana } from '../../Semana/components/ModalCriarSemana';
import { CicloSwitcher } from './CicloSwitcher';
import type { Semana } from '../types';

interface Props {
  semana: Semana;
}

/** Cabecalho da tela de Producao. Identidade = ciclo (data de entrega); a semana
 *  ISO vira detalhe secundario. Switcher de ciclos abertos + criar ciclo (que
 *  cai de volta na Producao) no lugar das setas. */
export function PrHeader({ semana }: Props) {
  const navigate = useNavigate();
  const [criando, setCriando] = useState(false);
  const titulo = cicloLabel(semana.data_entrega); // "Ciclo · entrega qua 10 jun"
  const subtitulo = `Semana ISO ${semana.numero} · ${formataDiaMes(semana.data_inicio)} — ${formataDiaMes(
    semana.data_entrega
  )}`;

  return (
    <header className="flex flex-wrap items-end justify-between gap-3 border-b border-warm-200 px-5 py-5 md:px-8">
      <div>
        <div className="text-[11px] uppercase tracking-[0.04em] text-warm-500">pré-produção</div>
        <h1 className="font-display text-[26px] leading-tight text-ink-700 md:text-[30px]">
          {titulo}
        </h1>
        <div className="mt-1 text-[13px] text-warm-500">{subtitulo}</div>
      </div>
      <div className="flex flex-wrap items-center gap-2">
        <span className="rounded-md border border-warning-border bg-warning-bg px-2.5 py-1 text-[11px] text-warning-text">
          período de testes
        </span>
        <CicloSwitcher />
        <button
          onClick={() => setCriando(true)}
          className="h-11 rounded-md border border-warm-300 bg-white px-3 text-[13px] text-warm-700 hover:bg-warm-100"
        >
          + Novo ciclo
        </button>
      </div>

      {criando && (
        <ModalCriarSemana
          onClose={() => setCriando(false)}
          onCriada={(id) => navigate(`/producao/${id}?aba=volume`)}
        />
      )}
    </header>
  );
}
