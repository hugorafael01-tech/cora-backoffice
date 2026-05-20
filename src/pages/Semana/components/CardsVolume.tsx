import type { EstadoSemana } from '../../../lib/semana';
import type { LinhaProducao, InsumoAlerta } from '../types';

interface Props {
  estado: EstadoSemana;
  planejamento: LinhaProducao[];
  insumos: { alertas: InsumoAlerta[]; okCount: number };
}

function kg(g: number): string {
  return (g / 1000).toLocaleString('pt-BR', { maximumFractionDigits: 1 });
}

export function CardsVolume({ estado, planejamento, insumos }: Props) {
  const totalPaes = planejamento.reduce((s, l) => s + l.qty, 0);
  const totalMassaG = planejamento.reduce((s, l) => s + l.massaTotalG, 0);
  const totalLevainG = planejamento.reduce((s, l) => s + l.levainG, 0);
  const aprox = estado === 'A';
  const til = aprox ? '~' : '';

  const numClass = aprox ? 'text-warm-500 opacity-[0.78]' : 'text-ink-700';

  const cards = [
    { label: 'Pães', valor: `${til}${totalPaes}` },
    { label: 'Massa', valor: `${til}${kg(totalMassaG)} kg` },
    { label: 'Levain', valor: `${til}${kg(totalLevainG)} kg` },
  ];

  const temAlerta = insumos.alertas.length > 0;

  return (
    <div className="grid grid-cols-2 gap-3 px-5 py-2 md:grid-cols-4 md:px-8">
      {cards.map((c) => (
        <div key={c.label} className="rounded-lg border border-warm-200 bg-white px-4 py-3">
          <div className="text-[12px] text-warm-500">{c.label}</div>
          <div className={`font-display text-[26px] leading-tight ${numClass}`}>{c.valor}</div>
        </div>
      ))}
      <div
        className={`rounded-lg border px-4 py-3 ${
          temAlerta ? 'border-warning-border bg-warning-bg' : 'border-warm-200 bg-white'
        }`}
      >
        <div className="text-[12px] text-warm-500">Insumos</div>
        <div
          className={`font-display text-[26px] leading-tight ${
            temAlerta ? 'text-warning-text' : 'text-ink-700'
          }`}
        >
          {temAlerta ? `${insumos.alertas.length} alerta${insumos.alertas.length > 1 ? 's' : ''}` : 'OK'}
        </div>
      </div>
    </div>
  );
}
