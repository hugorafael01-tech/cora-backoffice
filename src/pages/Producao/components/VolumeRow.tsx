import { fmtKg, previewLinha } from '../../../lib/producao';
import { grupoLabel } from '../../../lib/semana';
import type { LinhaVolume } from '../types';

interface Props {
  linha: LinhaVolume;
  onQty: (versaoReceitaId: string, qty: number) => void;
  onRemover: (linha: LinhaVolume) => void;
}

export function VolumeRow({ linha, onQty, onRemover }: Props) {
  const { massaKg, levainKg } = previewLinha(
    linha.qty,
    linha.pesoMassaG,
    linha.somaBaker,
    linha.levainPct
  );
  const zero = linha.qty === 0;
  // Producao ja iniciada/concluida: linha nao e editavel nem removivel por aqui
  // (a FK e ON DELETE CASCADE; remover apagaria etapas/carimbos/capturas).
  const congelada =
    linha.producaoStatus === 'em_curso' || linha.producaoStatus === 'concluida';

  return (
    <div className="grid grid-cols-[1fr_auto] items-center gap-4 border-b border-warm-200 px-4 py-4 last:border-b-0 md:px-5">
      <div>
        <div className="flex flex-wrap items-center gap-2 text-[16px] font-semibold text-warm-800">
          {linha.nome}
          {linha.rascunho ? (
            <span className="rounded border border-warm-300 bg-white px-1.5 py-0.5 text-[11px] font-medium text-warm-500">
              rascunho
            </span>
          ) : (
            <span className="rounded border border-warm-300 bg-warm-100 px-1.5 py-0.5 text-[11px] font-medium text-warm-600">
              {grupoLabel(linha.grupo)}
            </span>
          )}
          {linha.fonte === 'teste' && (
            <span className="rounded border border-warning-border bg-warning-bg px-1.5 py-0.5 text-[11px] font-medium text-warning-text">
              teste
            </span>
          )}
        </div>
        <div className="mt-1.5 text-[12.5px] tabular-nums text-warm-500">
          massa {fmtKg(massaKg)}
          <span className="mx-1.5 text-warm-300">·</span>
          levain {fmtKg(levainKg)}
        </div>
      </div>

      <div className="flex items-center">
        <div className="inline-flex items-center overflow-hidden rounded-md border-[1.5px] border-warm-300 bg-white">
          <button
            aria-label="Diminuir"
            disabled={zero || congelada}
            onClick={() => onQty(linha.versaoReceitaId, Math.max(0, linha.qty - 1))}
            className="h-11 w-11 text-[22px] leading-none text-brand-500 enabled:hover:bg-brand-50 disabled:cursor-not-allowed disabled:text-warm-300"
          >
            −
          </button>
          <span
            className={`min-w-[3rem] text-center font-display text-[22px] tabular-nums ${
              zero || congelada ? 'text-warm-400' : 'text-warm-800'
            }`}
          >
            {linha.qty}
          </span>
          <button
            aria-label="Aumentar"
            disabled={congelada}
            onClick={() => onQty(linha.versaoReceitaId, linha.qty + 1)}
            className="h-11 w-11 text-[22px] leading-none text-brand-500 enabled:hover:bg-brand-50 disabled:cursor-not-allowed disabled:text-warm-300"
          >
            +
          </button>
        </div>
        <button
          aria-label="Remover receita"
          disabled={congelada}
          title={congelada ? 'Produção já iniciada' : undefined}
          onClick={() => onRemover(linha)}
          className="ml-3 grid h-9 w-9 place-items-center rounded-md border border-warm-300 bg-white text-[13px] text-warm-400 enabled:hover:border-danger-border enabled:hover:text-danger-text disabled:cursor-not-allowed disabled:text-warm-300"
        >
          ✕
        </button>
      </div>
    </div>
  );
}
