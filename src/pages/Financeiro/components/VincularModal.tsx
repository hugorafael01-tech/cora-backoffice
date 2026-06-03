import { useEffect, useMemo, useState } from 'react';
import { supabase } from '../../../lib/supabase';
import { vincularAsaas, type VincularResultado } from '../../../lib/vincularAsaas';
import { formatBRL, formatData, mascararCliente, rotuloEvento } from '../../../lib/financeiro';
import type { OrfaoCliente, SubscriptionFinanceiro } from '../types';

interface Props {
  orfao: OrfaoCliente;
  subscriptions: SubscriptionFinanceiro[];
  onClose: () => void;
  /** Chamado no 200, com o nome da assinatura vinculada (pra mensagem de sucesso + refetch). */
  onSuccess: (nome: string) => void;
}

type ErroTipo = Exclude<VincularResultado['tipo'], 'ok'>;

/** Mensagens novas (404/400/rede), curtas e sem travessão. O 409 tem bloco próprio. */
const MENSAGEM_ERRO: Record<Exclude<ErroTipo, 'customer_already_linked'>, string> = {
  not_found: 'Essa assinatura não está mais disponível. Atualiza a página e tenta de novo.',
  bad_request: 'Os dados do pagamento vieram incompletos. Atualiza a página e tenta de novo.',
  unauthorized: 'Sua sessão expirou. Entra de novo pra continuar.',
  network: 'Não foi possível falar com o servidor. Tenta de novo em instantes.',
};

async function reLogin() {
  await supabase.auth.signOut();
  window.location.href = '/login';
}

/**
 * Modal de vincular (gesto 2). Busca a assinatura por nome na lista que o C1 já carregou
 * (sem nova leitura), chama o endpoint do portal e trata todas as respostas.
 * Assinantes já vinculados aparecem marcados (informativo), mas a seleção não é bloqueada:
 * trocar o cliente de uma assinatura é legítimo, e o endpoint protege o caso perigoso (409).
 */
export function VincularModal({ orfao, subscriptions, onClose, onSuccess }: Props) {
  const [busca, setBusca] = useState('');
  const [selecionadaId, setSelecionadaId] = useState<string | null>(null);
  const [enviando, setEnviando] = useState(false);
  const [erro, setErro] = useState<ErroTipo | null>(null);

  const semCliente = !orfao.asaas_customer_id;

  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if (e.key === 'Escape' && !enviando) onClose();
    }
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, [enviando, onClose]);

  const filtradas = useMemo(() => {
    const termo = busca.trim().toLowerCase();
    return subscriptions.filter((s) => (termo ? s.nome.toLowerCase().includes(termo) : true));
  }, [subscriptions, busca]);

  const selecionada = subscriptions.find((s) => s.id === selecionadaId) ?? null;

  async function confirmar() {
    if (!selecionada || semCliente || enviando) return;
    setEnviando(true);
    setErro(null);
    const r = await vincularAsaas({
      subscriptionId: selecionada.id,
      asaasCustomerId: orfao.asaas_customer_id as string,
    });
    if (r.tipo === 'ok') {
      onSuccess(selecionada.nome);
      return;
    }
    setErro(r.tipo);
    setEnviando(false);
  }

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-6"
      role="dialog"
      aria-modal="true"
      aria-labelledby="vincular-title"
      onClick={(e) => {
        if (e.target === e.currentTarget && !enviando) onClose();
      }}
    >
      <div className="flex max-h-[88vh] w-[520px] max-w-full flex-col overflow-hidden rounded-lg bg-white">
        {/* Cabeçalho + resumo do órfão */}
        <div className="border-b border-warm-200 px-6 py-4">
          <div className="text-[11px] uppercase tracking-wide text-warm-400">cliente do Asaas</div>
          <h3 id="vincular-title" className="font-display text-[22px] uppercase tracking-wide text-brand-500">
            Vincular pagamento
          </h3>
          <div className="mt-3 flex flex-wrap items-center gap-2 rounded-md border border-warm-200 bg-warm-100 px-3 py-2 text-[13px]">
            <span className="text-warm-600">{rotuloEvento(orfao.principal.event_type)}</span>
            <span className="rounded border border-warm-200 bg-white px-1.5 py-0.5 font-mono text-[12px] text-warm-500">
              {orfao.asaas_customer_id ?? 'sem código'}
            </span>
            <span className="font-medium tabular-nums text-ink-700">{formatBRL(orfao.principal.valor)}</span>
            <span className="text-warm-500">{formatData(orfao.principal.received_at)}</span>
          </div>
        </div>

        {/* Corpo: busca + lista de assinantes */}
        <div className="flex-1 overflow-y-auto px-6 py-4">
          <div className="mb-2 text-[13px] font-medium text-warm-600">
            De qual assinante é esse pagamento?
          </div>

          {semCliente ? (
            <div className="rounded-md border border-warning-border bg-warning-bg px-3 py-2 text-[13px] text-warning-text">
              Esse pagamento veio sem código de cliente do Asaas, então não dá pra vincular por aqui.
            </div>
          ) : (
            <>
              <input
                type="search"
                autoFocus
                value={busca}
                onChange={(e) => setBusca(e.target.value)}
                placeholder="Buscar por nome"
                className="mb-3 w-full rounded-md border border-warm-300 bg-white px-3 py-2 text-[14px] text-ink-700 placeholder:text-warm-400 focus:border-brand-500 focus:outline-none"
              />

              {filtradas.length === 0 ? (
                <div className="px-1 py-6 text-center text-[13px] text-warm-500">
                  Nenhum assinante com esse nome.
                </div>
              ) : (
                <ul className="space-y-1">
                  {filtradas.map((s) => {
                    const jaVinculado = !!s.asaas_customer_id;
                    const sel = s.id === selecionadaId;
                    return (
                      <li key={s.id}>
                        <button
                          type="button"
                          onClick={() => {
                            setSelecionadaId(s.id);
                            setErro(null);
                          }}
                          className={`flex w-full items-center gap-3 rounded-md border px-3 py-2 text-left ${
                            sel ? 'border-brand-500 bg-brand-50' : 'border-warm-200 hover:bg-warm-100'
                          }`}
                        >
                          <span
                            className={`grid h-4 w-4 shrink-0 place-items-center rounded-full border ${
                              sel ? 'border-brand-500' : 'border-warm-300'
                            }`}
                          >
                            {sel && <span className="h-2 w-2 rounded-full bg-brand-500" />}
                          </span>
                          <span className="min-w-0 flex-1">
                            <span className="block truncate text-[14px] text-ink-700">{s.nome}</span>
                            <span className="block text-[12px] text-warm-500">
                              {jaVinculado
                                ? `Já vinculado a ${mascararCliente(s.asaas_customer_id)}`
                                : 'Sem cliente do Asaas ainda'}
                            </span>
                          </span>
                          <span
                            className={`shrink-0 rounded-full px-2 py-0.5 text-[11px] ${
                              jaVinculado
                                ? 'bg-warm-100 text-warm-500'
                                : 'bg-success-bg text-success-text'
                            }`}
                          >
                            {jaVinculado ? 'já vinculado' : 'livre'}
                          </span>
                        </button>
                      </li>
                    );
                  })}
                </ul>
              )}
            </>
          )}

          {/* Mensagens de resposta */}
          {erro === 'customer_already_linked' && (
            <div className="mt-3 rounded-md border border-danger-border bg-danger-bg px-3 py-2 text-[13px] text-danger-text">
              <strong>Esse cliente do Asaas já está com outro assinante.</strong> A gente não vincula
              pra não cobrar a pessoa errada. Confere no painel do Asaas de quem é esse código antes
              de seguir.
            </div>
          )}
          {erro && erro !== 'customer_already_linked' && (
            <div className="mt-3 rounded-md border border-warm-200 bg-warm-50 px-3 py-2 text-[13px] text-warm-600">
              {MENSAGEM_ERRO[erro]}
              {erro === 'unauthorized' && (
                <button onClick={reLogin} className="ml-2 text-brand-600 underline">
                  Entrar de novo
                </button>
              )}
            </div>
          )}
        </div>

        {/* Rodapé */}
        <div className="flex justify-end gap-2 border-t border-warm-200 bg-warm-50 px-6 py-3">
          <button
            onClick={onClose}
            disabled={enviando}
            className="rounded-md px-3 py-1.5 text-[14px] text-warm-600 hover:bg-warm-200 disabled:opacity-50"
          >
            Cancelar
          </button>
          <button
            onClick={confirmar}
            disabled={!selecionada || semCliente || enviando}
            className="rounded-md bg-brand-500 px-4 py-1.5 text-[14px] text-white hover:bg-brand-600 disabled:cursor-default disabled:opacity-40"
          >
            {enviando
              ? 'Vinculando…'
              : selecionada
                ? `Vincular a ${selecionada.nome.split(' ')[0]}`
                : 'Vincular'}
          </button>
        </div>
      </div>
    </div>
  );
}
