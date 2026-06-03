import { useMemo, useState } from 'react';
import { formatData, mascararCliente } from '../../../lib/financeiro';
import type { FiltroPanorama, PaymentStatus, SubscriptionFinanceiro } from '../types';

interface Props {
  subscriptions: SubscriptionFinanceiro[];
}

const ABAS: { id: FiltroPanorama; label: string }[] = [
  { id: 'todas', label: 'Todas' },
  { id: 'vencidas', label: 'Vencidas' },
  { id: 'sem_status', label: 'Sem status' },
  { id: 'em_dia', label: 'Em dia' },
];

const LIMITE = 12;

function StatusBadge({ status }: { status: PaymentStatus | null }) {
  const mapa: Record<string, { texto: string; classe: string; title?: string }> = {
    em_dia: { texto: 'em dia', classe: 'border-success-border bg-success-bg text-success-text' },
    vencido: { texto: 'vencido', classe: 'border-danger-border bg-danger-bg text-danger-text' },
    pendente: { texto: 'pendente', classe: 'border-warning-border bg-warning-bg text-warning-text' },
  };
  const cfg = status
    ? mapa[status]
    : {
        texto: 'sem status',
        classe: 'border-warm-200 bg-warm-100 text-warm-500',
        title: 'ainda sem pagamento registrado',
      };
  return (
    <span
      className={`inline-block rounded-full border px-2 py-0.5 text-[12px] ${cfg.classe}`}
      title={cfg.title}
    >
      {cfg.texto}
    </span>
  );
}

function passaFiltro(s: SubscriptionFinanceiro, filtro: FiltroPanorama): boolean {
  switch (filtro) {
    case 'vencidas':
      return s.payment_status === 'vencido';
    case 'sem_status':
      return s.payment_status == null;
    case 'em_dia':
      return s.payment_status === 'em_dia';
    default:
      return true;
  }
}

/** Gesto 1 — panorama das assinaturas, já ordenado por atenção pelo hook. */
export function PanoramaTabela({ subscriptions }: Props) {
  const [filtro, setFiltro] = useState<FiltroPanorama>('todas');
  const [busca, setBusca] = useState('');
  const [verTodas, setVerTodas] = useState(false);

  const filtradas = useMemo(() => {
    const termo = busca.trim().toLowerCase();
    return subscriptions
      .filter((s) => passaFiltro(s, filtro))
      .filter((s) => (termo ? s.nome.toLowerCase().includes(termo) : true));
  }, [subscriptions, filtro, busca]);

  const visiveis = verTodas ? filtradas : filtradas.slice(0, LIMITE);

  return (
    <section className="px-5 py-4 md:px-8">
      <div className="mb-3 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex flex-wrap gap-1">
          {ABAS.map((aba) => (
            <button
              key={aba.id}
              onClick={() => {
                setFiltro(aba.id);
                setVerTodas(false);
              }}
              className={`rounded-full px-3 py-1 text-[13px] ${
                filtro === aba.id
                  ? 'bg-brand-500 text-white'
                  : 'text-warm-600 hover:bg-warm-200'
              }`}
            >
              {aba.label}
            </button>
          ))}
        </div>
        <input
          type="search"
          value={busca}
          onChange={(e) => setBusca(e.target.value)}
          placeholder="Buscar por nome"
          className="w-full rounded-md border border-warm-200 bg-white px-3 py-1.5 text-[14px] text-ink-700 placeholder:text-warm-400 sm:w-56"
        />
      </div>

      <div className="overflow-x-auto rounded-lg border border-warm-200 bg-white">
        <table className="w-full text-left text-[14px]">
          <thead className="border-b border-warm-200 text-[12px] uppercase tracking-wide text-warm-500">
            <tr>
              <th className="px-4 py-2 font-medium">Assinante</th>
              <th className="px-4 py-2 font-medium">Pagamento</th>
              <th className="px-4 py-2 font-medium">Último pagamento</th>
              <th className="px-4 py-2 font-medium">Vínculo Asaas</th>
            </tr>
          </thead>
          <tbody>
            {visiveis.length === 0 ? (
              <tr>
                <td colSpan={4} className="px-4 py-8 text-center text-warm-500">
                  {subscriptions.length === 0
                    ? 'Nenhuma assinatura ainda.'
                    : 'Nenhuma assinatura nesse filtro.'}
                </td>
              </tr>
            ) : (
              visiveis.map((s) => (
                <tr key={s.id} className="border-b border-warm-100 last:border-0">
                  <td className="px-4 py-2.5 text-ink-700">{s.nome}</td>
                  <td className="px-4 py-2.5">
                    <StatusBadge status={s.payment_status} />
                  </td>
                  <td className="px-4 py-2.5 text-warm-600">{formatData(s.last_payment_at)}</td>
                  <td className="px-4 py-2.5">
                    {s.asaas_customer_id ? (
                      <span className="text-warm-600">
                        vinculado{' '}
                        <span className="text-[12px] text-warm-400">
                          · {mascararCliente(s.asaas_customer_id)}
                        </span>
                      </span>
                    ) : (
                      <span className="text-warm-400">não vinculado</span>
                    )}
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

      {filtradas.length > LIMITE && (
        <div className="mt-2 text-center">
          <button
            onClick={() => setVerTodas((v) => !v)}
            className="text-[13px] text-brand-600 hover:underline"
          >
            {verTodas
              ? 'ver menos'
              : `ver todas (${visiveis.length} de ${filtradas.length})`}
          </button>
        </div>
      )}
    </section>
  );
}
