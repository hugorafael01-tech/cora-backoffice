interface Props {
  numProducoes: number;
  salvando: boolean;
  onCriar: () => void;
}

export function ConcludeBar({ numProducoes, salvando, onCriar }: Props) {
  const disabled = salvando || numProducoes === 0;

  return (
    <section className="px-5 pb-10 pt-6 md:px-8">
      <div className="mb-4 rounded border-l-[3px] border-brand-200 bg-warm-100 px-3.5 py-2.5 text-[12.5px] leading-relaxed text-warm-500">
        <strong className="font-semibold text-warm-700">Levain e refinavel</strong> na calculadora
        acima a qualquer momento.{' '}
        <strong className="font-semibold text-warm-700">Producoes de teste</strong> podem ser
        limpas antes do Alpha — nao contam pro historico.
      </div>
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="text-[12.5px] text-warm-500">
          {numProducoes === 0
            ? 'Defina o volume (qty maior que 0) pra criar producoes.'
            : `${numProducoes} ${numProducoes === 1 ? 'producao planejada' : 'producoes planejadas'} · etapas a gerar`}
        </div>
        <button
          onClick={onCriar}
          disabled={disabled}
          className="min-h-[48px] rounded-md bg-brand-500 px-6 font-display text-[13px] uppercase tracking-[0.06em] text-white hover:bg-brand-600 disabled:cursor-not-allowed disabled:bg-warm-200 disabled:text-warm-400"
        >
          {salvando ? 'Criando…' : 'Criar producoes da semana'}
        </button>
      </div>
    </section>
  );
}
