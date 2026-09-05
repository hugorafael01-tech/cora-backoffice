import type { AlertaPrevia, CodigoAlerta } from '../../../lib/previa';
import { PESO_POR_CODIGO, TITULO_POR_CODIGO, type PesoAlerta } from '../types';

interface Props {
  alertas: AlertaPrevia[];
}

/**
 * Alertas agrupados por codigo, em dois pesos.
 *
 * Nao e lista corrida de propósito: nove codigos possiveis, e trinta linhas de
 * aviso soltas viram parede que ninguem le. Agrupado, cada tipo aparece uma vez
 * com a contagem, e o que bloqueia fica em cima.
 *
 * Zero alerta nao vira card vazio: a ausencia ja e a mensagem, e a tela mostra
 * uma linha discreta em vez de um bloco verde comemorando.
 */
export function AlertasPainel({ alertas }: Props) {
  if (alertas.length === 0) {
    return (
      <p className="px-5 pb-2 text-[13px] text-warm-500 md:px-8">
        Nenhum alerta nesta prévia.
      </p>
    );
  }

  const porCodigo = new Map<CodigoAlerta, AlertaPrevia[]>();
  for (const a of alertas) {
    porCodigo.set(a.codigo, [...(porCodigo.get(a.codigo) ?? []), a]);
  }

  const grupos = [...porCodigo.entries()].map(([codigo, itens]) => ({
    codigo,
    itens,
    peso: PESO_POR_CODIGO[codigo],
  }));

  // Bloqueia primeiro, e dentro de cada peso o mais numeroso em cima: o que
  // afeta mais gente merece ser lido antes.
  const ordem: Record<PesoAlerta, number> = { bloqueia: 0, confira: 1 };
  grupos.sort((a, b) => ordem[a.peso] - ordem[b.peso] || b.itens.length - a.itens.length);

  const bloqueios = grupos.filter((g) => g.peso === 'bloqueia').length;

  return (
    <section className="px-5 py-2 md:px-8">
      {bloqueios > 0 && (
        <p className="mb-2 text-[13px] text-danger-text">
          {bloqueios === 1
            ? 'Um problema impede gerar as cobranças.'
            : `${bloqueios} problemas impedem gerar as cobranças.`}
        </p>
      )}

      <ul className="space-y-2">
        {grupos.map((g) => (
          <GrupoDeAlerta key={g.codigo} codigo={g.codigo} peso={g.peso} itens={g.itens} />
        ))}
      </ul>
    </section>
  );
}

function GrupoDeAlerta({
  codigo,
  peso,
  itens,
}: {
  codigo: CodigoAlerta;
  peso: PesoAlerta;
  itens: AlertaPrevia[];
}) {
  const cor =
    peso === 'bloqueia'
      ? 'border-danger-border bg-danger-bg'
      : 'border-warning-border bg-warning-bg';
  const corTexto = peso === 'bloqueia' ? 'text-danger-text' : 'text-warning-text';

  return (
    <li className={`rounded-lg border px-4 py-3 ${cor}`}>
      <div className="flex items-baseline justify-between gap-3">
        <span className={`text-[14px] font-semibold ${corTexto}`}>
          {TITULO_POR_CODIGO[codigo]}
        </span>
        <span className={`shrink-0 text-[12px] ${corTexto}`}>
          {peso === 'bloqueia' ? 'Bloqueia' : 'Confira'}
          {itens.length > 1 ? ` · ${itens.length}` : ''}
        </span>
      </div>
      <ul className={`mt-1 space-y-1 text-[13px] ${corTexto}`}>
        {itens.map((a, i) => (
          <li key={`${a.subscriptionId ?? 'geral'}-${i}`}>{a.mensagem}</li>
        ))}
      </ul>
    </li>
  );
}
