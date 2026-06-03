import type { ResumoFinanceiro } from '../types';

interface Props {
  resumo: ResumoFinanceiro;
}

/**
 * Quatro contadores do topo. Tons honestos: vencidas chamam atenção (danger),
 * em dia é boa notícia (success), sem status e a identificar são neutros/informativos.
 * Zero não é erro — "0 vencidas" é uma boa notícia, então o card com zero não vira vazio triste.
 */
export function ResumoCards({ resumo }: Props) {
  const cards = [
    { label: 'Em dia', valor: resumo.emDia, classe: 'border-success-border bg-success-bg', num: 'text-success-text' },
    { label: 'Vencidas', valor: resumo.vencidas, classe: 'border-danger-border bg-danger-bg', num: 'text-danger-text' },
    { label: 'Sem status ainda', valor: resumo.semStatus, classe: 'border-warm-200 bg-white', num: 'text-ink-700' },
    { label: 'Pra identificar', valor: resumo.praIdentificar, classe: 'border-info-border bg-info-bg', num: 'text-info-text' },
  ];

  return (
    <div className="grid grid-cols-2 gap-3 px-5 py-2 md:grid-cols-4 md:px-8">
      {cards.map((c) => (
        <div key={c.label} className={`rounded-lg border px-4 py-3 ${c.classe}`}>
          <div className="text-[12px] text-warm-500">{c.label}</div>
          <div className={`font-display text-[26px] leading-tight tabular-nums ${c.num}`}>{c.valor}</div>
        </div>
      ))}
    </div>
  );
}
