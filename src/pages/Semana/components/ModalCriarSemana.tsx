import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { format } from 'date-fns';
import { supabase } from '../../../lib/supabase';
import { derivaCiclo, proximaQuinta, formataDiaSemanaDiaMes } from '../../../lib/date';
import { diasContexto } from '../../../lib/producao';

interface Props {
  onClose: () => void;
  /** Destino pos-criacao. Default: navega pra /semanas/:id (modulo Semana nao muda). */
  onCriada?: (id: string) => void;
}

function ymdToLocalDate(ymd: string): Date {
  const [y, m, d] = ymd.split('-').map(Number);
  return new Date(y, m - 1, d);
}

export function ModalCriarSemana({ onClose, onCriada }: Props) {
  const navigate = useNavigate();
  const [ymd, setYmd] = useState(() => format(proximaQuinta(), 'yyyy-MM-dd'));
  const [salvando, setSalvando] = useState(false);
  const [erro, setErro] = useState<string | null>(null);

  const derivada = derivaCiclo(ymdToLocalDate(ymd));
  const dias = diasContexto(ymd); // [D2, D1, D0]

  async function submit() {
    setSalvando(true);
    setErro(null);
    const { data, error } = await supabase
      .from('semanas')
      .insert({
        numero: derivada.numero,
        ano: derivada.ano,
        data_inicio: derivada.data_inicio,
        data_fim: derivada.data_fim,
        data_entrega: derivada.data_entrega,
        data_corte: derivada.data_corte,
        status: 'rascunho',
      })
      .select('id')
      .single();

    if (error) {
      setSalvando(false);
      setErro(error.message);
      return;
    }
    onClose();
    if (onCriada) onCriada(data!.id);
    else navigate(`/semanas/${data!.id}`);
  }

  return (
    <div className="fixed inset-0 z-40 grid place-items-center p-4" role="dialog" aria-modal="true">
      <div className="absolute inset-0 bg-black/40" onClick={onClose} />
      <div className="relative w-full max-w-md rounded-lg border border-warm-200 bg-warm-50 p-6 shadow-xl">
        <h2 className="font-display text-2xl text-ink-700">Novo ciclo</h2>
        <p className="mt-1 text-[14px] text-warm-500">
          Informe a data de entrega — qualquer dia. O ciclo (3 dias) é derivado dela.
        </p>

        <label className="mt-5 block text-[12px] uppercase tracking-wide text-warm-500">
          Data de entrega
        </label>
        <input
          type="date"
          value={ymd}
          onChange={(e) => setYmd(e.target.value)}
          className="mt-1 w-full rounded-md border border-warm-200 bg-white px-3 py-2 text-warm-700"
        />

        <div className="mt-4 rounded-md bg-warm-100 px-4 py-3 text-[13px] text-warm-600">
          {dias
            .map((d) =>
              d.dia === 0
                ? `D0/entrega ${formataDiaSemanaDiaMes(d.data)}`
                : `D${d.dia} ${formataDiaSemanaDiaMes(d.data)}`
            )
            .join(' · ')}
          <span className="mt-1 block text-[12px] text-warm-400">
            Semana ISO {derivada.numero} (informativo)
          </span>
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
            {salvando ? 'Criando…' : 'Criar ciclo'}
          </button>
        </div>
      </div>
    </div>
  );
}
