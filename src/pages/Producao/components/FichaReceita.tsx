import { fmtG } from '../../../lib/producao';
import { grupoLabel } from '../../../lib/semana';
import type { Ficha } from '../types';

interface Props {
  ficha: Ficha;
  aberta: boolean;
  onToggle: () => void;
}

function fmtBaker(baker: number): string {
  return `${(baker * 100).toLocaleString('pt-BR', { maximumFractionDigits: 2 })}%`;
}

function fmtDuracao(min: number | null): string | null {
  if (min == null) return null;
  if (min < 60) return `${min} min`;
  const h = Math.floor(min / 60);
  const m = min % 60;
  return m === 0 ? `${h}h` : `${h}h${String(m).padStart(2, '0')}`;
}

export function FichaReceita({ ficha, aberta, onToggle }: Props) {
  return (
    <div className="overflow-hidden rounded-md border border-warm-300 bg-white">
      <button
        onClick={onToggle}
        aria-expanded={aberta}
        className="flex w-full items-center justify-between gap-3 px-4 py-3.5 text-left hover:bg-warm-50 md:px-5"
      >
        <span className="flex flex-wrap items-center gap-2">
          <span className="text-[16px] font-semibold text-warm-800">{ficha.nome}</span>
          {ficha.rascunho ? (
            <span className="rounded border border-warm-300 bg-white px-1.5 py-0.5 text-[11px] font-medium text-warm-500">
              rascunho
            </span>
          ) : (
            <span className="rounded border border-warm-300 bg-warm-100 px-1.5 py-0.5 text-[11px] font-medium text-warm-600">
              {grupoLabel(ficha.grupo)}
            </span>
          )}
        </span>
        <span className="flex items-center gap-3 text-[12.5px] tabular-nums text-warm-500">
          <span>{ficha.qty} un</span>
          <span className="text-warm-300">{aberta ? '▾' : '▸'}</span>
        </span>
      </button>

      {aberta && (
        <div className="border-t border-warm-200 px-4 pb-4 pt-3 md:px-5">
          <div className="mb-3 flex flex-wrap gap-x-5 gap-y-1 text-[12.5px] text-warm-600">
            <span>
              hidratacao{' '}
              <strong className="font-semibold text-warm-800">
                {ficha.hidratacaoAlvo != null ? `${ficha.hidratacaoAlvo}%` : '—'}
              </strong>
            </span>
            <span>
              massa / pao{' '}
              <strong className="font-semibold text-warm-800">
                {ficha.pesoMassaG != null ? fmtG(ficha.pesoMassaG) : '—'}
              </strong>
            </span>
          </div>

          {/* Formulacao */}
          <div className="mb-1.5 font-display text-[11px] uppercase tracking-[0.06em] text-warm-500">
            Formulacao
          </div>
          {ficha.ingredientes.length === 0 ? (
            <p className="text-[13px] text-warm-500">
              Sem ingredientes cadastrados (definir no modulo Receitas).
            </p>
          ) : (
            <div className="overflow-hidden rounded border border-warm-200">
              <div className="grid grid-cols-[1fr_auto_auto] gap-x-4 bg-warm-50 px-3 py-1.5 text-[10.5px] uppercase tracking-[0.04em] text-warm-500">
                <span>ingrediente</span>
                <span className="text-right">baker%</span>
                <span className="text-right">g / pao</span>
              </div>
              {ficha.ingredientes.map((ing) => (
                <div
                  key={ing.slug || ing.nome}
                  className="grid grid-cols-[1fr_auto_auto] gap-x-4 border-t border-warm-200 px-3 py-1.5 text-[13px] tabular-nums text-warm-700"
                >
                  <span className="truncate">{ing.nome}</span>
                  <span className="text-right text-warm-600">{fmtBaker(ing.baker)}</span>
                  <span className="text-right font-medium text-warm-800">
                    {ing.gramasPorPao != null ? fmtG(ing.gramasPorPao) : '—'}
                  </span>
                </div>
              ))}
            </div>
          )}

          {/* Processo */}
          <div className="mb-1.5 mt-4 font-display text-[11px] uppercase tracking-[0.06em] text-warm-500">
            Processo
          </div>
          {ficha.etapas.length === 0 ? (
            <p className="text-[13px] text-warm-500">
              Etapas ainda nao autoradas (geradas no modulo Receitas; so a cocção e criada na produção).
            </p>
          ) : (
            <ol className="space-y-1.5">
              {ficha.etapas.map((e) => {
                const dur = fmtDuracao(e.duracaoMin);
                return (
                  <li key={e.ordem} className="flex gap-3 text-[13px] text-warm-700">
                    <span className="mt-0.5 grid h-5 w-5 flex-shrink-0 place-items-center rounded bg-warm-100 text-[11px] tabular-nums text-warm-500">
                      {e.ordem}
                    </span>
                    <span className="flex-1">
                      <span className="font-medium text-warm-800">{e.nome}</span>
                      {dur && <span className="ml-2 text-warm-500">{dur}</span>}
                      {e.notas && (
                        <span className="block text-[12px] leading-snug text-warm-500">{e.notas}</span>
                      )}
                    </span>
                  </li>
                );
              })}
            </ol>
          )}
        </div>
      )}
    </div>
  );
}
