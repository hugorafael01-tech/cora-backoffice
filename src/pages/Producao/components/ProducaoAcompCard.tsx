import { grupoLabel } from '../../../lib/semana';
import { producaoStatusLabel } from '../../../lib/producao';
import type { AcaoEtapa, CapturaEtapa } from '../../../lib/producaoActions';
import type { ProducaoAcomp, ProducaoStatus } from '../types';
import { EtapaAcompRow } from './EtapaAcompRow';

interface Props {
  producao: ProducaoAcomp;
  aberta: boolean;
  onToggle: () => void;
  salvando: string | null; // id (etapa ou producao) em escrita; desabilita os botoes
  onAvancar: (etapaId: string, acao: AcaoEtapa) => void;
  onCaptura: (etapaId: string, captura: CapturaEtapa) => void;
  onIniciarProd: (producaoId: string) => void;
  onConcluirProd: (producaoId: string) => void;
}

function chipClasse(status: ProducaoStatus): string {
  if (status === 'em_curso') return 'border-brand-200 bg-brand-50 text-brand-600';
  if (status === 'concluida') return 'border-success-border bg-success-bg text-success-text';
  if (status === 'cancelada') return 'border-warm-300 bg-warm-100 text-warm-500';
  return 'border-warm-300 bg-warm-100 text-warm-600'; // planejada
}

export function ProducaoAcompCard({
  producao,
  aberta,
  onToggle,
  salvando,
  onAvancar,
  onCaptura,
  onIniciarProd,
  onConcluirProd,
}: Props) {
  const prodBusy = salvando === producao.id;

  return (
    <div className="overflow-hidden rounded-md border border-warm-300 bg-white">
      <button
        onClick={onToggle}
        aria-expanded={aberta}
        className="flex w-full items-center justify-between gap-3 px-4 py-3.5 text-left hover:bg-warm-50 md:px-5"
      >
        <span className="flex flex-wrap items-center gap-2">
          <span className="text-[16px] font-semibold text-warm-800">{producao.nome}</span>
          {producao.rascunho ? (
            <span className="rounded border border-warm-300 bg-white px-1.5 py-0.5 text-[11px] font-medium text-warm-500">
              rascunho
            </span>
          ) : (
            <span className="rounded border border-warm-300 bg-warm-100 px-1.5 py-0.5 text-[11px] font-medium text-warm-600">
              {grupoLabel(producao.grupo)}
            </span>
          )}
          <span
            className={`rounded border px-1.5 py-0.5 text-[11px] font-medium ${chipClasse(
              producao.status
            )}`}
          >
            {producaoStatusLabel(producao.status)}
          </span>
        </span>
        <span className="flex items-center gap-3 text-[12.5px] tabular-nums text-warm-500">
          <span>
            {producao.feitas}/{producao.total} etapas
          </span>
          {producao.qtyPrevista != null && <span>{producao.qtyPrevista} un</span>}
          <span className="text-warm-300">{aberta ? '▾' : '▸'}</span>
        </span>
      </button>

      {aberta && (
        <div className="border-t border-warm-200 px-4 pb-4 pt-3 md:px-5">
          {/* Status da producao (manual) */}
          <div className="mb-3 flex flex-wrap items-center gap-2">
            {producao.status === 'planejada' && (
              <button
                onClick={() => onIniciarProd(producao.id)}
                disabled={prodBusy}
                className="min-h-[36px] rounded-md bg-brand-500 px-3.5 font-display text-[12px] uppercase tracking-[0.04em] text-white hover:bg-brand-600 disabled:cursor-not-allowed disabled:bg-warm-200 disabled:text-warm-400"
              >
                {prodBusy ? 'Salvando…' : 'Iniciar producao'}
              </button>
            )}
            {producao.status === 'em_curso' && (
              <button
                onClick={() => onConcluirProd(producao.id)}
                disabled={prodBusy}
                className="min-h-[36px] rounded-md border border-success-border bg-success-bg px-3.5 font-display text-[12px] uppercase tracking-[0.04em] text-success-text hover:opacity-80 disabled:cursor-not-allowed disabled:opacity-50"
              >
                {prodBusy ? 'Salvando…' : 'Concluir producao'}
              </button>
            )}
            {producao.status === 'concluida' && (
              <span className="text-[12.5px] text-success-text">Producao concluida.</span>
            )}
          </div>

          {/* Etapas */}
          {producao.etapas.length === 0 ? (
            <p className="text-[13px] text-warm-500">
              Sem etapas geradas (a producao nasce com as etapas da receita + coccao).
            </p>
          ) : (
            <ol className="space-y-1.5">
              {producao.etapas.map((e) => (
                <EtapaAcompRow
                  key={e.id}
                  etapa={e}
                  pesoMassaG={producao.pesoMassaG}
                  destaque={e.id === producao.etapaAgoraId}
                  salvando={salvando === e.id}
                  onAvancar={(acao) => onAvancar(e.id, acao)}
                  onCaptura={(captura) => onCaptura(e.id, captura)}
                />
              ))}
            </ol>
          )}
        </div>
      )}
    </div>
  );
}
