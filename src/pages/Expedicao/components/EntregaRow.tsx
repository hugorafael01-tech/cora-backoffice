import { useState } from 'react';
import {
  enderecoCompleto,
  enderecoCurto,
  resumoItens,
  rotuloSequencia,
  statusLabel,
  type EntregaLite,
  type StatusEntrega,
} from '../../../lib/expedicao';
import { zonaDaEntrega, type Onda, type Zona } from '../../../lib/zonas';
import { MarcaZona } from './MarcaZona';

interface Props {
  entrega: EntregaLite;
  /** Onda do grupo; null em "entrega própria" (sem sequência). */
  onda: Onda | null;
  zonas: Map<string, Zona>;
  busy: boolean;
  podeSubir: boolean;
  podeDescer: boolean;
  onAvancar: (id: string) => void;
  onVoltar: (id: string) => void;
  onSalvarObs: (id: string, texto: string) => void;
  onRemover: (id: string) => void;
  onMover: (id: string, direcao: 'cima' | 'baixo') => void;
}

const TINT: Record<StatusEntrega, string> = {
  pendente: 'border-warm-200 bg-white',
  em_rota: 'border-brand-200 bg-brand-50',
  entregue: 'border-success-border bg-success-bg',
};

const CHIP: Record<StatusEntrega, string> = {
  pendente: 'border-warm-300 bg-warm-100 text-warm-600',
  em_rota: 'border-brand-200 bg-white text-brand-600',
  entregue: 'border-success-border bg-white text-success-text',
};

export function EntregaRow({
  entrega: e,
  onda,
  zonas,
  busy,
  podeSubir,
  podeDescer,
  onAvancar,
  onVoltar,
  onSalvarObs,
  onRemover,
  onMover,
}: Props) {
  const [aberta, setAberta] = useState(false);
  const [obs, setObs] = useState(e.observacao ?? '');
  const [confirmandoRemover, setConfirmandoRemover] = useState(false);

  // Sincroniza o texto local quando a observacao do banco muda (refetch).
  const [obsOrigem, setObsOrigem] = useState(e.observacao);
  if (e.observacao !== obsOrigem) {
    setObsOrigem(e.observacao);
    setObs(e.observacao ?? '');
  }

  const resumo = resumoItens(e.itens);
  const zona = zonaDaEntrega(e, zonas);
  const codigo = rotuloSequencia(e, onda);
  const semZona = zona === null;

  return (
    <li className={`rounded-lg border ${TINT[e.status]}`}>
      {/* Area principal: toque avanca o status (padrao bancada). */}
      <div
        role="button"
        tabIndex={0}
        aria-label={`Avançar status de ${e.nome}`}
        onClick={() => !busy && onAvancar(e.id)}
        onKeyDown={(ev) => {
          if (ev.target === ev.currentTarget && (ev.key === 'Enter' || ev.key === ' ')) {
            ev.preventDefault();
            if (!busy) onAvancar(e.id);
          }
        }}
        className="flex cursor-pointer items-start gap-3 px-3.5 py-3"
      >
        {/* Mesmo par que sai impresso na etiqueta: codigo de sequencia em cima,
            marca de zona embaixo. Conferir tela x pacote e so casar os dois. */}
        <div className="flex w-14 flex-shrink-0 flex-col items-start gap-1">
          <span className="text-[15px] font-bold leading-none tabular-nums text-ink-700">
            {codigo ?? '—'}
          </span>
          <MarcaZona
            zona={zona}
            tamanho={16}
            className={`text-[11px] ${semZona ? 'text-danger-text' : 'text-warm-500'}`}
          />
        </div>
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-2">
            <span className="truncate font-medium text-warm-800">{e.nome}</span>
            <span
              className={`flex-shrink-0 rounded border px-1.5 py-0.5 text-[10px] uppercase tracking-[0.03em] ${CHIP[e.status]}`}
            >
              {statusLabel(e.status)}
            </span>
          </div>
          <div className="mt-0.5 truncate text-[13px] text-warm-600">{resumo || 'sem itens'}</div>
          <div className="mt-0.5 truncate text-[12px] text-warm-500">{enderecoCurto(e)}</div>
          {semZona && (
            <div className="mt-1 text-[11px] text-danger-text">
              Sem zona no cadastro — a etiqueta sai sem marca de bag.
            </div>
          )}
        </div>
        <button
          aria-label={aberta ? 'Recolher' : 'Expandir'}
          aria-expanded={aberta}
          onClick={(ev) => {
            ev.stopPropagation();
            setAberta((v) => !v);
          }}
          className={`-mr-1 grid h-9 w-9 flex-shrink-0 place-items-center rounded-md text-[18px] leading-none text-warm-300 transition-transform hover:text-warm-500 ${
            aberta ? 'rotate-90' : ''
          }`}
        >
          ›
        </button>
      </div>

      {aberta && (
        <div className="space-y-3 border-t border-warm-200/70 px-3.5 py-3 text-[13px]">
          <div className="text-warm-600">{enderecoCompleto(e)}</div>
          <div className="text-warm-600">
            Zona:{' '}
            <span className="text-warm-700">
              {zona ? `${zona.codigo} — ${zona.nome}` : 'não definida'}
            </span>
            {semZona && (
              <span className="text-warm-500"> · define no cadastro do assinante</span>
            )}
          </div>
          {e.whatsapp && (
            <div className="text-warm-600">
              WhatsApp: <span className="text-warm-700">{e.whatsapp}</span>
            </div>
          )}

          {/* Ajuste manual da ordem: troca de numero com a vizinha, entao so duas
              paradas mudam e o resto da bag fica parado. */}
          {onda && e.sequencia != null && (
            <div>
              <label className="mb-1 block text-[11px] uppercase tracking-[0.04em] text-warm-500">
                Ordem na onda
              </label>
              <div className="flex items-center gap-2">
                <button
                  onClick={() => !busy && onMover(e.id, 'cima')}
                  disabled={busy || !podeSubir}
                  className="h-9 rounded-md border border-warm-300 bg-white px-3 text-[12px] text-warm-700 hover:bg-warm-100 disabled:cursor-not-allowed disabled:text-warm-300"
                >
                  ↑ Antes
                </button>
                <button
                  onClick={() => !busy && onMover(e.id, 'baixo')}
                  disabled={busy || !podeDescer}
                  className="h-9 rounded-md border border-warm-300 bg-white px-3 text-[12px] text-warm-700 hover:bg-warm-100 disabled:cursor-not-allowed disabled:text-warm-300"
                >
                  ↓ Depois
                </button>
                <span className="text-[12px] text-warm-500">troca de posição com a vizinha</span>
              </div>
            </div>
          )}

          <div>
            <label className="mb-1 block text-[11px] uppercase tracking-[0.04em] text-warm-500">
              Observação
            </label>
            <textarea
              value={obs}
              onChange={(ev) => setObs(ev.target.value)}
              onBlur={() => obs !== (e.observacao ?? '') && onSalvarObs(e.id, obs)}
              rows={2}
              placeholder="Ex.: portão azul, deixar na portaria…"
              className="w-full rounded border border-warm-300 bg-white px-2.5 py-1.5 text-[13px] text-warm-800 placeholder:text-warm-400 focus:border-brand-300 focus:outline-none"
            />
          </div>

          <div className="flex flex-wrap items-center gap-2">
            <button
              onClick={() => !busy && onVoltar(e.id)}
              disabled={busy || e.status === 'pendente'}
              className="h-9 rounded-md border border-warm-300 bg-white px-3 text-[12px] text-warm-700 hover:bg-warm-100 disabled:cursor-not-allowed disabled:text-warm-300"
            >
              ← Voltar um passo
            </button>
            {confirmandoRemover ? (
              <>
                <button
                  onClick={() => onRemover(e.id)}
                  disabled={busy}
                  className="h-9 rounded-md border border-danger-border bg-danger-bg px-3 text-[12px] text-danger-text hover:opacity-80 disabled:opacity-50"
                >
                  Confirmar remoção
                </button>
                <button
                  onClick={() => setConfirmandoRemover(false)}
                  className="h-9 rounded-md px-2 text-[12px] text-warm-500 hover:text-warm-700"
                >
                  Cancelar
                </button>
              </>
            ) : (
              <button
                onClick={() => setConfirmandoRemover(true)}
                disabled={busy}
                className="h-9 rounded-md border border-warm-300 bg-white px-3 text-[12px] text-warm-500 hover:border-danger-border hover:text-danger-text disabled:cursor-not-allowed"
              >
                Remover
              </button>
            )}
          </div>
        </div>
      )}
    </li>
  );
}
