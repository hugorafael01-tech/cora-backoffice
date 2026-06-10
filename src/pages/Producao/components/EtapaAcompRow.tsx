import { Fragment, useState } from 'react';
import {
  appendDobra,
  ehEtapaDivisao,
  etapaTipoLabel,
  fmtPecaDivisao,
  fmtTempC,
  lerDobras,
  resumoDobras,
} from '../../../lib/producao';
import type { AcaoEtapa, CapturaEtapa as CapturaEtapaInput } from '../../../lib/producaoActions';
import type { EtapaAcomp, EtapaStatus } from '../types';
import { CapturaEtapa } from './CapturaEtapa';
import { RegistroDobras } from './RegistroDobras';

interface Props {
  etapa: EtapaAcomp;
  pesoMassaG: number | null; // peso da peca, p/ a etapa de divisao
  destaque: boolean; // "etapa agora"
  salvando: boolean;
  onAvancar: (acao: AcaoEtapa) => void;
  onCaptura: (captura: CapturaEtapaInput) => void;
}

function hora(iso: string | null): string | null {
  if (!iso) return null;
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return null;
  return d.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' });
}

function statusLabel(status: EtapaStatus): string {
  if (status === 'em_curso') return 'em curso';
  if (status === 'concluida') return 'concluída';
  if (status === 'pulada') return 'pulada';
  return 'aguardando';
}

// Botao de acao: alvo de toque >= 40px e largura distribuida no mobile; volta ao
// compacto lado a lado no md+.
const BTN =
  'flex-1 md:flex-none min-h-[40px] md:min-h-[32px] rounded-md px-3 md:px-2.5 font-display text-[12px] md:text-[11px] uppercase tracking-[0.04em] disabled:cursor-not-allowed disabled:opacity-50';

export function EtapaAcompRow({
  etapa,
  pesoMassaG,
  destaque,
  salvando,
  onAvancar,
  onCaptura,
}: Props) {
  const [capturaAberta, setCapturaAberta] = useState(false);
  const toggle = () => setCapturaAberta((v) => !v);

  const iniciada = hora(etapa.iniciadaAt);
  const concluida = hora(etapa.concluidaAt);
  const peca = ehEtapaDivisao(etapa.tipo) ? fmtPecaDivisao(pesoMassaG) : null;

  const ehDobra = etapa.tipo === 'dobra';
  const dobras = ehDobra ? lerDobras(etapa.detalhes) : [];
  const resumo = ehDobra ? resumoDobras(dobras) : null;

  // Subtexto fluido: cada item inteiro (nowrap), separados por " · " com espaco
  // real (cria ponto de quebra entre itens, nunca no meio de um). Notas pode quebrar.
  const meta: { node: React.ReactNode; nowrap: boolean }[] = [];
  if (peca) meta.push({ node: <span className="font-medium text-brand-500">{peca}</span>, nowrap: true });
  if (iniciada) meta.push({ node: <>iniciada {iniciada}</>, nowrap: true });
  if (concluida) meta.push({ node: <>concluída {concluida}</>, nowrap: true });
  if (etapa.tempC != null) meta.push({ node: <>{fmtTempC(etapa.tempC)}</>, nowrap: true });
  if (resumo) meta.push({ node: <span className="font-medium text-brand-500">{resumo}</span>, nowrap: true });
  if (etapa.notas) meta.push({ node: <span className="text-warm-600">{etapa.notas}</span>, nowrap: false });

  const temAcoes = etapa.status === 'aguardando' || etapa.status === 'em_curso';

  // Acao de botao que nao deve disparar o toggle da linha
  const acao = (fn: () => void) => (e: React.MouseEvent) => {
    e.stopPropagation();
    fn();
  };

  // UM TOQUE: append { n, at:now, temp_c:null } e persiste (detalhes + dobra_numero).
  function registrarDobra() {
    const novo = appendDobra(dobras, new Date().toISOString());
    onCaptura({ detalhes: { ...etapa.detalhes, dobras: novo }, dobraNumero: novo.length });
  }

  return (
    <li
      className={`rounded border ${
        destaque ? 'border-brand-200 bg-brand-50' : 'border-warm-200 bg-white'
      }`}
    >
      <div
        role="button"
        tabIndex={0}
        aria-expanded={capturaAberta}
        onClick={toggle}
        onKeyDown={(e) => {
          if (e.target === e.currentTarget && (e.key === 'Enter' || e.key === ' ')) {
            e.preventDefault();
            toggle();
          }
        }}
        className="flex cursor-pointer flex-col gap-2.5 px-3 py-2.5 md:flex-row md:items-start md:gap-3"
      >
        {/* Bloco 1 + 2: numero, titulo/status e subtexto */}
        <div className="flex min-w-0 items-start gap-3 md:flex-1">
          <span className="mt-0.5 grid h-5 w-5 flex-shrink-0 place-items-center rounded bg-warm-100 text-[11px] tabular-nums text-warm-500">
            {etapa.ordem}
          </span>
          <div className="min-w-0 flex-1">
            <div className="flex flex-wrap items-center gap-2">
              <span className="font-medium text-warm-800">{etapaTipoLabel(etapa.tipo)}</span>
              <span className="text-[11px] uppercase tracking-[0.04em] text-warm-500">
                {statusLabel(etapa.status)}
              </span>
              {destaque && (
                <span className="rounded bg-brand-500 px-1.5 py-0.5 text-[10px] font-medium uppercase tracking-[0.04em] text-white">
                  agora
                </span>
              )}
            </div>
            {meta.length > 0 && (
              <div className="mt-0.5 text-[12px] leading-snug text-warm-500">
                {meta.map((m, i) => (
                  <Fragment key={i}>
                    {i > 0 && <span className="text-warm-300"> · </span>}
                    <span className={m.nowrap ? 'whitespace-nowrap' : undefined}>{m.node}</span>
                  </Fragment>
                ))}
              </div>
            )}
          </div>
          {/* Chevron sempre visivel (a linha inteira ja e clicavel) */}
          <span
            aria-hidden
            className={`mt-0.5 flex-shrink-0 text-[18px] leading-none text-warm-300 transition-transform ${
              capturaAberta ? 'rotate-90' : ''
            }`}
          >
            ›
          </span>
        </div>

        {/* Bloco 3: acoes — linha cheia no mobile, lado a lado no md+ */}
        {temAcoes && (
          <div className="flex items-stretch gap-2 md:items-center md:gap-1.5 md:flex-shrink-0">
            {ehDobra && etapa.status === 'em_curso' && (
              <button
                onClick={acao(registrarDobra)}
                disabled={salvando}
                className={`${BTN} bg-brand-500 text-white hover:bg-brand-600`}
              >
                registrar dobra
              </button>
            )}
            {etapa.status === 'aguardando' && (
              <button
                onClick={acao(() => onAvancar('iniciar'))}
                disabled={salvando}
                className={`${BTN} bg-brand-500 text-white hover:bg-brand-600`}
              >
                iniciar
              </button>
            )}
            {etapa.status === 'em_curso' && (
              <button
                onClick={acao(() => onAvancar('concluir'))}
                disabled={salvando}
                className={`${BTN} border border-success-border bg-success-bg text-success-text hover:opacity-80`}
              >
                concluir
              </button>
            )}
            <button
              onClick={acao(() => onAvancar('pular'))}
              disabled={salvando}
              className={`${BTN} border border-warm-300 bg-white text-warm-500 hover:bg-warm-50`}
            >
              pular
            </button>
          </div>
        )}
      </div>

      {capturaAberta &&
        (ehDobra ? (
          <RegistroDobras etapa={etapa} salvando={salvando} onCaptura={onCaptura} />
        ) : (
          <CapturaEtapa
            etapa={etapa}
            salvando={salvando}
            onSalvar={(captura) => onCaptura(captura)}
          />
        ))}
    </li>
  );
}
