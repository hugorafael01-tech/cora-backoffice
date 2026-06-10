interface Props {
  paes: number;
  massaKg: number;
  levainKg: number;
}

export function ResumoCards({ paes, massaKg, levainKg }: Props) {
  return (
    <section className="px-5 pt-7 md:px-8">
      <div className="mb-2.5 flex flex-wrap items-center gap-3">
        <h2 className="font-display text-[13px] uppercase tracking-[0.06em] text-warm-600">
          Resumo da semana
        </h2>
        <span className="text-[12px] text-warm-500">pré-produção · planejada</span>
      </div>
      <div className="grid grid-cols-3 gap-2.5">
        <Card k="Pães" v={paes.toLocaleString('pt-BR')} u="un" d="defina o volume" />
        <Card
          k="Massa total"
          v={massaKg.toLocaleString('pt-BR', { maximumFractionDigits: 2 })}
          u="kg"
          d="un x peso da massa"
        />
        <Card
          k="Levain total"
          v={levainKg.toLocaleString('pt-BR', { maximumFractionDigits: 2 })}
          u="kg"
          d="farinha x prefermento"
        />
      </div>
    </section>
  );
}

function Card({ k, v, u, d }: { k: string; v: string; u: string; d: string }) {
  return (
    <div className="rounded-md border border-warm-300 bg-warm-100 p-4">
      <div className="mb-2 font-display text-[11px] uppercase tracking-[0.06em] text-warm-500">{k}</div>
      <div className="font-display text-[26px] leading-none tabular-nums text-brand-500 md:text-[34px]">
        {v}
        <span className="ml-1 text-[12px] font-normal normal-case tracking-normal text-warm-500">
          {u}
        </span>
      </div>
      <div className="mt-1.5 text-[11.5px] leading-snug text-warm-500">{d}</div>
    </div>
  );
}
