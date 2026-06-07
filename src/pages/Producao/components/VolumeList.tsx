import type { LinhaVolume } from '../types';
import { VolumeRow } from './VolumeRow';

interface Props {
  linhas: LinhaVolume[];
  onQty: (versaoReceitaId: string, qty: number) => void;
  onRemover: (linha: LinhaVolume) => void;
  onAdicionar: () => void;
  onNovaTeste: () => void;
}

export function VolumeList({ linhas, onQty, onRemover, onAdicionar, onNovaTeste }: Props) {
  const cardapioCount = linhas.filter((l) => l.fonte === 'cardapio').length;

  return (
    <section className="px-5 pt-6 md:px-8">
      <div className="mb-2.5 flex flex-wrap items-center gap-3">
        <h2 className="font-display text-[13px] uppercase tracking-[0.06em] text-warm-600">
          Definir volume
        </h2>
        <span className="text-[12px] text-warm-500">
          cardapio da semana · {cardapioCount} {cardapioCount === 1 ? 'receita' : 'receitas'}
        </span>
        <div className="ml-auto flex gap-2">
          <button
            onClick={onAdicionar}
            className="min-h-[38px] rounded-md border border-dashed border-brand-200 px-3 text-[13px] text-brand-500 hover:bg-brand-50"
          >
            + Adicionar receita
          </button>
          <button
            onClick={onNovaTeste}
            className="min-h-[38px] rounded-md border border-dashed border-brand-200 px-3 text-[13px] text-brand-500 hover:bg-brand-50"
          >
            + Nova receita de teste
          </button>
        </div>
      </div>

      <div className="overflow-hidden rounded-md border border-warm-300 bg-white">
        {linhas.length === 0 ? (
          <div className="px-4 py-9 text-center text-[14px] leading-relaxed text-warm-500">
            <div className="mb-1.5 font-display text-[15px] uppercase tracking-[0.04em]">
              Nenhum volume definido
            </div>
            Adicione uma receita ao cardapio da semana ou crie uma receita de teste.
          </div>
        ) : (
          linhas.map((l) => (
            <VolumeRow key={l.versaoReceitaId} linha={l} onQty={onQty} onRemover={onRemover} />
          ))
        )}
      </div>
    </section>
  );
}
