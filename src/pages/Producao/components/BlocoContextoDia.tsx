import { useState } from 'react';
import { agoraSpInput, isoParaSpInput, spInputParaIso } from '../../../lib/date';
import type { DiaContexto } from '../../../lib/producao';
import type { ContextoDiaInput } from '../../../lib/producaoActions';
import type { ContextoDia } from '../types';

interface Props {
  info: DiaContexto;
  ctx: ContextoDia | null;
  salvando: boolean;
  onSalvar: (dia: number, campos: ContextoDiaInput) => void;
}

/** "" -> null; senao Number (NaN vira null). */
function parseNum(s: string): number | null {
  const t = s.trim();
  if (t === '') return null;
  const n = Number(t.replace(',', '.'));
  return Number.isNaN(n) ? null : n;
}

const INPUT =
  'min-h-[36px] w-full rounded border border-warm-300 bg-white px-2.5 text-[13px] text-warm-800 placeholder:text-warm-400 focus:border-brand-300 focus:outline-none';
const LABEL = 'mb-1 block text-[11px] uppercase tracking-[0.04em] text-warm-500';

/**
 * Bloco de contexto de um dia do ciclo. Campos seedados do ctx no mount; apos
 * salvar o estado local ja reflete o salvo (sem reseed). "Refrescar agora"
 * carimba o now (SP) E persiste num clique; o campo segue editavel pra ajuste
 * manual, que persiste no "Salvar".
 */
export function BlocoContextoDia({ info, ctx, salvando, onSalvar }: Props) {
  const [refresh, setRefresh] = useState(() => isoParaSpInput(ctx?.ultimoRefreshLevainAt));
  const [temp, setTemp] = useState(() =>
    ctx?.tempAmbienteMaxC != null ? String(ctx.tempAmbienteMaxC) : ''
  );
  const [notas, setNotas] = useState(ctx?.notas ?? '');

  function campos(refreshVal: string): ContextoDiaInput {
    return {
      ultimoRefreshLevainAt: spInputParaIso(refreshVal),
      tempAmbienteMaxC: parseNum(temp),
      notas: notas.trim() === '' ? null : notas.trim(),
    };
  }

  function refrescarAgora() {
    const novo = agoraSpInput();
    setRefresh(novo);
    onSalvar(info.dia, campos(novo)); // persiste num clique
  }

  function salvar() {
    onSalvar(info.dia, campos(refresh));
  }

  return (
    <div className="rounded-md border border-warm-300 bg-white px-4 py-3.5 md:px-5">
      <div className="mb-2.5 font-display text-[13px] uppercase tracking-[0.04em] text-warm-700">
        {info.label}
      </div>

      <div className="grid gap-2.5 md:grid-cols-2">
        <div>
          <label className={LABEL}>Ultimo refresh do levain</label>
          <div className="flex flex-wrap gap-2">
            <input
              type="datetime-local"
              className={`${INPUT} flex-1`}
              value={refresh}
              onChange={(e) => setRefresh(e.target.value)}
            />
            <button
              onClick={refrescarAgora}
              disabled={salvando}
              className="min-h-[36px] shrink-0 whitespace-nowrap rounded-md border border-warm-300 bg-white px-3 text-[12px] text-brand-600 hover:bg-warm-50 disabled:cursor-not-allowed disabled:opacity-50"
            >
              Refrescar agora
            </button>
          </div>
        </div>

        <div>
          <label className={LABEL}>Temp ambiente max (C)</label>
          <input
            className={INPUT}
            inputMode="decimal"
            value={temp}
            onChange={(e) => setTemp(e.target.value)}
            placeholder="ex: 27,5"
          />
        </div>
      </div>

      <div className="mt-2.5">
        <label className={LABEL}>Notas</label>
        <textarea
          className={`${INPUT} min-h-[44px] py-1.5`}
          value={notas}
          onChange={(e) => setNotas(e.target.value)}
          placeholder="observacoes do dia"
        />
      </div>

      <div className="mt-2.5 flex justify-end">
        <button
          onClick={salvar}
          disabled={salvando}
          className="min-h-[36px] rounded-md bg-brand-500 px-4 font-display text-[12px] uppercase tracking-[0.04em] text-white hover:bg-brand-600 disabled:cursor-not-allowed disabled:bg-warm-200 disabled:text-warm-400"
        >
          {salvando ? 'Salvando…' : 'Salvar'}
        </button>
      </div>
    </div>
  );
}
