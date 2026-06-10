import {
  lerDobras,
  removerUltimaDobra,
  setTempDobra,
  type DobraRegistro,
} from '../../../lib/producao';
import { formataHoraSp } from '../../../lib/date';
import type { CapturaEtapa as CapturaEtapaInput } from '../../../lib/producaoActions';
import type { EtapaAcomp } from '../types';

interface Props {
  etapa: EtapaAcomp;
  salvando: boolean;
  onCaptura: (captura: CapturaEtapaInput) => void;
}

/** "" -> null; senao Number (NaN vira null). Aceita virgula. */
function parseNum(s: string): number | null {
  const t = s.trim();
  if (t === '') return null;
  const n = Number(t.replace(',', '.'));
  return Number.isNaN(n) ? null : n;
}

/**
 * Registro de dobras (etapa tipo='dobra') — UM TOQUE. O botao primario
 * "registrar dobra" vive na propria linha (EtapaAcompRow); aqui fica a lista das
 * dobras ja registradas: hora (SP), temp opcional por dobra (preenchivel DEPOIS,
 * salva no blur) e "desfazer" na ultima entrada (toque errado). Persiste em
 * detalhes.dobras + dobra_numero via onCaptura (salvarCapturaEtapa) e refetch.
 */
export function RegistroDobras({ etapa, salvando, onCaptura }: Props) {
  const dobras = lerDobras(etapa.detalhes);
  const emCurso = etapa.status === 'em_curso';

  function persistir(novo: DobraRegistro[]) {
    onCaptura({
      detalhes: { ...etapa.detalhes, dobras: novo },
      dobraNumero: novo.length,
    });
  }

  function salvarTemp(n: number, raw: string) {
    const novoTemp = parseNum(raw);
    const atual = dobras.find((d) => d.n === n)?.temp_c ?? null;
    if (novoTemp === atual) return; // sem mudanca, nao grava
    persistir(setTempDobra(dobras, n, novoTemp));
  }

  return (
    <div className="border-t border-warm-200 bg-warm-50 px-3 py-3">
      {dobras.length === 0 ? (
        <p className="text-[12.5px] text-warm-500">
          Nenhuma dobra registrada ainda. Use “registrar dobra” a cada dobra executada — a temp
          pode entrar depois.
        </p>
      ) : (
        <ul className="space-y-1.5">
          {dobras.map((d, i) => {
            const ultima = i === dobras.length - 1;
            return (
              <li
                key={d.n}
                className="flex flex-wrap items-center gap-x-3 gap-y-1 rounded border border-warm-200 bg-white px-2.5 py-1.5 text-[13px]"
              >
                <span className="font-medium text-warm-800">Dobra {d.n}</span>
                <span className="tabular-nums text-warm-500">{formataHoraSp(d.at)}</span>
                <span className="ml-auto flex items-center gap-1">
                  <input
                    key={`${d.n}-${d.temp_c ?? ''}`}
                    defaultValue={d.temp_c ?? ''}
                    inputMode="decimal"
                    disabled={salvando}
                    onBlur={(e) => salvarTemp(d.n, e.target.value)}
                    placeholder="temp"
                    className="min-h-[30px] w-16 rounded border border-warm-300 bg-white px-2 text-[13px] tabular-nums text-warm-800 placeholder:text-warm-400 focus:border-brand-300 focus:outline-none disabled:opacity-50"
                  />
                  <span className="text-[12px] text-warm-500">°C</span>
                </span>
                {ultima && emCurso && (
                  <button
                    onClick={() => persistir(removerUltimaDobra(dobras))}
                    disabled={salvando}
                    className="text-[11px] uppercase tracking-[0.04em] text-warm-400 hover:text-danger-text disabled:opacity-50"
                  >
                    desfazer
                  </button>
                )}
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}
