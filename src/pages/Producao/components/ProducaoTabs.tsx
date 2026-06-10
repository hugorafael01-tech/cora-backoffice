export type AbaProducao = 'volume' | 'preparacao' | 'acompanhamento';

interface Props {
  ativa: AbaProducao;
  onChange: (aba: AbaProducao) => void;
}

const ABAS: { id: AbaProducao; label: string }[] = [
  { id: 'volume', label: 'Definir volume' },
  { id: 'preparacao', label: 'Preparação' },
  { id: 'acompanhamento', label: 'Acompanhamento' },
];

/** Segmented control entre as views do modulo Producao (Estado A + B). */
export function ProducaoTabs({ ativa, onChange }: Props) {
  return (
    <div className="px-5 pt-4 md:px-8">
      <div className="inline-flex gap-1 rounded-lg border border-warm-200 bg-warm-100 p-[3px]">
        {ABAS.map((a) => (
          <button
            key={a.id}
            onClick={() => onChange(a.id)}
            aria-pressed={ativa === a.id}
            className={`min-h-[36px] rounded-md px-3 font-display text-[12px] uppercase tracking-[0.04em] ${
              ativa === a.id ? 'bg-white text-brand-500' : 'text-warm-500 hover:text-warm-700'
            }`}
          >
            {a.label}
          </button>
        ))}
      </div>
    </div>
  );
}
