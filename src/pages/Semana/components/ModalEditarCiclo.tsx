import { useState } from 'react';
import { supabase } from '../../../lib/supabase';
import { derivaCiclo, formataDiaSemanaDiaMes } from '../../../lib/date';
import type { Semana } from '../types';

interface Props {
  semana: Semana;
  onClose: () => void;
  onSalva: () => void;
}

function ymdToLocalDate(ymd: string): Date {
  const [y, m, d] = ymd.split('-').map(Number);
  return new Date(y, m - 1, d);
}

export function ModalEditarCiclo({ semana, onClose, onSalva }: Props) {
  const [ymd, setYmd] = useState(semana.data_entrega);
  const [salvando, setSalvando] = useState(false);
  const [erro, setErro] = useState<string | null>(null);

  const derivada = derivaCiclo(ymdToLocalDate(ymd));

  async function submit() {
    if (ymd === semana.data_entrega) { onClose(); return; }
    setSalvando(true);
    setErro(null);

    // 1. UPDATE semanas primeiro — o trigger da janela valida contra o range
    //    da semana, entao a semana precisa estar atualizada antes da janela.
    const { error: errSemana } = await supabase
      .from('semanas')
      .update({
        data_entrega: derivada.data_entrega,
        data_corte: derivada.data_corte,
        data_inicio: derivada.data_inicio,
        data_fim: derivada.data_fim,
        numero: derivada.numero,
        ano: derivada.ano,
      })
      .eq('id', semana.id);

    if (errSemana) {
      setSalvando(false);
      setErro(errSemana.message);
      return;
    }

    // 2. UPDATE janela "Padrao" — trigger lê o range já atualizado de semanas.
    const { error: errJanela } = await supabase
      .from('janelas_entrega')
      .update({
        data_entrega: derivada.data_entrega,
        cutoff_at: derivada.data_corte,
      })
      .eq('semana_id', semana.id)
      .eq('label', 'Padrão');

    if (errJanela) {
      setSalvando(false);
      setErro(errJanela.message);
      return;
    }

    setSalvando(false);
    onSalva();
  }

  return (
    <div className="fixed inset-0 z-40 grid place-items-center p-4" role="dialog" aria-modal="true">
      <div className="absolute inset-0 bg-black/40" onClick={onClose} />
      <div className="relative w-full max-w-md rounded-lg border border-warm-200 bg-warm-50 p-6 shadow-xl">
        <h2 className="font-display text-2xl text-ink-700">Editar data de entrega</h2>
        <p className="mt-1 text-[14px] text-warm-500">
          Corte e intervalo do ciclo são derivados automaticamente.
        </p>

        <label className="mt-5 block text-[12px] uppercase tracking-wide text-warm-500">
          Data de entrega (D-0)
        </label>
        <input
          type="date"
          value={ymd}
          onChange={(e) => setYmd(e.target.value)}
          className="mt-1 w-full rounded-md border border-warm-200 bg-white px-3 py-2 text-warm-700"
        />

        <div className="mt-4 rounded-md bg-warm-100 px-4 py-3 text-[13px] text-warm-600">
          D-2 {formataDiaSemanaDiaMes(derivada.data_inicio)} · D-0/entrega {formataDiaSemanaDiaMes(derivada.data_entrega)}
        </div>

        {erro && <p className="mt-3 text-[13px] text-danger-text">{erro}</p>}

        <div className="mt-6 flex justify-end gap-2">
          <button
            onClick={onClose}
            className="h-11 rounded-md border border-warm-200 px-4 text-warm-600 hover:bg-warm-100"
          >
            Cancelar
          </button>
          <button
            onClick={submit}
            disabled={salvando}
            className="h-11 rounded-md bg-brand-500 px-4 text-white hover:bg-brand-600 disabled:opacity-50"
          >
            {salvando ? 'Salvando…' : 'Salvar'}
          </button>
        </div>
      </div>
    </div>
  );
}
