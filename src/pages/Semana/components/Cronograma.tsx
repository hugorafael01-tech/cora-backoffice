import type { EstadoSemana } from '../../../lib/semana';
import { dataSpStr, formataDiaMes } from '../../../lib/date';

interface Props {
  dataEntrega: string; // YYYY-MM-DD (quinta)
  estado: EstadoSemana;
}

const DIAS = [
  { label: 'TER', offset: -2, sub: 'levain + prep + mise en place' },
  { label: 'QUA', offset: -1, sub: 'autólise → shape' },
  { label: 'QUI', offset: 0, sub: 'cocção + entrega' },
];

function addDiasYmd(ymd: string, dias: number): string {
  const [y, m, d] = ymd.split('-').map(Number);
  const dt = new Date(y, m - 1, d + dias);
  const mm = String(dt.getMonth() + 1).padStart(2, '0');
  const dd = String(dt.getDate()).padStart(2, '0');
  return `${dt.getFullYear()}-${mm}-${dd}`;
}

export function Cronograma({ dataEntrega, estado }: Props) {
  const hoje = dataSpStr(new Date());

  return (
    <div className="grid grid-cols-3 gap-3 px-5 py-4 md:px-8">
      {DIAS.map((dia) => {
        const data = addDiasYmd(dataEntrega, dia.offset);
        const isHoje = data === hoje && estado !== 'C';
        const concluido = estado === 'C' || data < hoje;
        return (
          <div
            key={dia.label}
            className={`rounded-lg border px-3 py-3 ${
              isHoje
                ? 'border-brand-500 bg-brand-50'
                : 'border-warm-200 bg-warm-100'
            }`}
          >
            <div className="flex items-center justify-between">
              <span
                className={`font-display text-lg ${isHoje ? 'text-brand-600' : 'text-warm-700'}`}
              >
                {dia.label}
              </span>
              <span className="text-[11px] text-warm-500">
                {concluido && estado === 'C' ? '✓ ' : ''}
                {formataDiaMes(data)}
              </span>
            </div>
            <p className="mt-1 text-[12px] leading-snug text-warm-500">{dia.sub}</p>
          </div>
        );
      })}
    </div>
  );
}
