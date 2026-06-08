import { useState } from 'react';
import type { CapturaEtapa as CapturaEtapaInput } from '../../../lib/producaoActions';
import type { EtapaAcomp } from '../types';

interface Props {
  etapa: EtapaAcomp;
  salvando: boolean;
  onSalvar: (captura: CapturaEtapaInput) => void;
}

/** "" -> null; senao Number (NaN vira null). */
function parseNum(s: string): number | null {
  const t = s.trim();
  if (t === '') return null;
  const n = Number(t.replace(',', '.'));
  return Number.isNaN(n) ? null : n;
}

function asStr(v: unknown): string {
  return v == null ? '' : String(v);
}

const INPUT =
  'min-h-[36px] w-full rounded border border-warm-300 bg-white px-2.5 text-[13px] text-warm-800 placeholder:text-warm-400 focus:border-brand-300 focus:outline-none';
const LABEL = 'mb-1 block text-[11px] uppercase tracking-[0.04em] text-warm-500';

/** Campos numericos do detalhes JSONB de coccao. */
const COCCAO_FIELDS: { key: string; label: string }[] = [
  { key: 'qty_paes', label: 'Qty paes' },
  { key: 'base_c', label: 'Base (C)' },
  { key: 'teto_c', label: 'Teto (C)' },
  { key: 'duracao_min', label: 'Duracao (min)' },
  { key: 'fornada_num', label: 'Fornada num' },
  { key: 'fornada_total', label: 'Fornada total' },
];

const RECIPIENTES = ['banneton', 'couche', 'tabuleiro'];

/**
 * Captura inline da etapa, por tipo. Grava na propria etapa (temp_c /
 * dobra_numero / detalhes JSONB / notas). So envia as chaves do tipo + notas.
 */
export function CapturaEtapa({ etapa, salvando, onSalvar }: Props) {
  const det = etapa.detalhes ?? {};

  const [tempC, setTempC] = useState(asStr(etapa.tempC));
  const [dobraNumero, setDobraNumero] = useState(asStr(etapa.dobraNumero));
  const [notas, setNotas] = useState(etapa.notas ?? '');
  // detalhes editaveis como strings (coccao/shape)
  const [detVals, setDetVals] = useState<Record<string, string>>(() => {
    const init: Record<string, string> = {};
    for (const f of COCCAO_FIELDS) init[f.key] = asStr(det[f.key]);
    init.peso_medio_g = asStr(det.peso_medio_g);
    init.recipiente = asStr(det.recipiente);
    return init;
  });

  const tipo = etapa.tipo;
  const usaTemp = tipo === 'autolise_mistura' || tipo === 'batimento';
  const tempLabel = tipo === 'autolise_mistura' ? 'Temp da agua (C)' : 'Temp da massa (C)';

  function setDet(key: string, value: string) {
    setDetVals((prev) => ({ ...prev, [key]: value }));
  }

  function salvar() {
    const captura: CapturaEtapaInput = { notas: notas.trim() === '' ? null : notas.trim() };

    if (usaTemp) captura.tempC = parseNum(tempC);
    if (tipo === 'dobra') captura.dobraNumero = parseNum(dobraNumero);

    if (tipo === 'coccao') {
      const detalhes: Record<string, unknown> = { ...det };
      for (const f of COCCAO_FIELDS) detalhes[f.key] = parseNum(detVals[f.key]);
      captura.detalhes = detalhes;
    }
    if (tipo === 'shape') {
      const detalhes: Record<string, unknown> = { ...det };
      detalhes.peso_medio_g = parseNum(detVals.peso_medio_g);
      detalhes.recipiente = detVals.recipiente.trim() === '' ? null : detVals.recipiente;
      captura.detalhes = detalhes;
    }

    onSalvar(captura);
  }

  return (
    <div className="border-t border-warm-200 bg-warm-50 px-3 py-3">
      <div className="grid grid-cols-2 gap-2.5 md:grid-cols-3">
        {usaTemp && (
          <div>
            <label className={LABEL}>{tempLabel}</label>
            <input
              className={INPUT}
              inputMode="decimal"
              value={tempC}
              onChange={(e) => setTempC(e.target.value)}
              placeholder="ex: 14,5"
            />
          </div>
        )}

        {tipo === 'dobra' && (
          <div>
            <label className={LABEL}>Numero da dobra</label>
            <input
              className={INPUT}
              inputMode="numeric"
              value={dobraNumero}
              onChange={(e) => setDobraNumero(e.target.value)}
              placeholder="ex: 2"
            />
          </div>
        )}

        {tipo === 'coccao' &&
          COCCAO_FIELDS.map((f) => (
            <div key={f.key}>
              <label className={LABEL}>{f.label}</label>
              <input
                className={INPUT}
                inputMode="decimal"
                value={detVals[f.key]}
                onChange={(e) => setDet(f.key, e.target.value)}
              />
            </div>
          ))}

        {tipo === 'shape' && (
          <>
            <div>
              <label className={LABEL}>Peso medio (g)</label>
              <input
                className={INPUT}
                inputMode="decimal"
                value={detVals.peso_medio_g}
                onChange={(e) => setDet('peso_medio_g', e.target.value)}
              />
            </div>
            <div>
              <label className={LABEL}>Recipiente</label>
              <select
                className={INPUT}
                value={detVals.recipiente}
                onChange={(e) => setDet('recipiente', e.target.value)}
              >
                <option value="">—</option>
                {RECIPIENTES.map((r) => (
                  <option key={r} value={r}>
                    {r}
                  </option>
                ))}
              </select>
            </div>
          </>
        )}
      </div>

      <div className="mt-2.5">
        <label className={LABEL}>Notas</label>
        <textarea
          className={`${INPUT} min-h-[44px] py-1.5`}
          value={notas}
          onChange={(e) => setNotas(e.target.value)}
          placeholder="observacoes da etapa"
        />
      </div>

      <div className="mt-2.5 flex justify-end">
        <button
          onClick={salvar}
          disabled={salvando}
          className="min-h-[36px] rounded-md bg-brand-500 px-4 font-display text-[12px] uppercase tracking-[0.04em] text-white hover:bg-brand-600 disabled:cursor-not-allowed disabled:bg-warm-200 disabled:text-warm-400"
        >
          {salvando ? 'Salvando…' : 'Salvar captura'}
        </button>
      </div>
    </div>
  );
}
