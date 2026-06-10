import { Fragment, useEffect, useMemo, useState } from 'react';
import { Navigate, useParams } from 'react-router-dom';
import { useExpedicao } from '../../hooks/useExpedicao';
import {
  agrupaPorRegiao,
  textoRota,
  type EntregaLite,
  type GrupoRegiao,
} from '../../lib/expedicao';
import {
  avancarStatusEntrega,
  gerarExpedicao,
  removerEntrega,
  salvarObservacaoEntrega,
  voltarStatusEntrega,
} from '../../lib/expedicaoActions';
import { Shell } from '../Semana/components/Shell';
import { EdHeader } from './components/EdHeader';
import { EntregaRow } from './components/EntregaRow';
import { EtiquetasPrint } from './components/EtiquetasPrint';

export function ExpedicaoDetalhe() {
  const { id } = useParams<{ id: string }>();
  const { dados, loading, naoEncontrada, error, refetch } = useExpedicao(id);

  const [gerando, setGerando] = useState(false);
  const [busyId, setBusyId] = useState<string | null>(null);
  const [toast, setToast] = useState<string | null>(null);
  const [erroAcao, setErroAcao] = useState<string | null>(null);

  useEffect(() => {
    if (!toast) return;
    const t = setTimeout(() => setToast(null), 3000);
    return () => clearTimeout(t);
  }, [toast]);

  const entregas = dados?.entregas ?? [];
  const grupos = useMemo(() => agrupaPorRegiao(dados?.entregas ?? []), [dados]);
  const totalCiclo = entregas.length;
  const entreguesCiclo = entregas.filter((e) => e.status === 'entregue').length;
  const todas: EntregaLite[] = useMemo(() => grupos.flatMap((g) => g.entregas), [grupos]);

  if (naoEncontrada) return <Navigate to="/expedicao/atual" replace />;

  if (loading || !dados) {
    return (
      <Shell>
        <div className="p-8 text-warm-500">{error ? `Erro: ${error.message}` : 'Carregando…'}</div>
      </Shell>
    );
  }

  async function gerar() {
    if (!id) return;
    setGerando(true);
    setErroAcao(null);
    try {
      const { criadas, atualizadas } = await gerarExpedicao(id);
      setToast(`${criadas} ${criadas === 1 ? 'nova' : 'novas'} · ${atualizadas} atualizada${
        atualizadas === 1 ? '' : 's'
      }.`);
      refetch();
    } catch (e) {
      setErroAcao(e instanceof Error ? e.message : String(e));
    } finally {
      setGerando(false);
    }
  }

  async function rodar(entregaId: string, fn: () => Promise<void>) {
    setErroAcao(null);
    setBusyId(entregaId);
    try {
      await fn();
      refetch();
    } catch (e) {
      setErroAcao(e instanceof Error ? e.message : String(e));
    } finally {
      setBusyId(null);
    }
  }

  async function copiarRota(grupo: GrupoRegiao) {
    try {
      await navigator.clipboard.writeText(textoRota(grupo.entregas));
      setToast(`Rota de ${grupo.label} copiada.`);
    } catch {
      setErroAcao('Não foi possível copiar (clipboard indisponível).');
    }
  }

  return (
    <Shell>
      <div className="print:hidden">
        <EdHeader
          semana={dados.semana}
          temEntregas={totalCiclo > 0}
          gerando={gerando}
          onGerar={gerar}
        />

        <div className="px-5 py-5 md:px-8">
          {/* Resumo do ciclo + acoes globais */}
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div className="text-[14px] text-warm-600">
              {totalCiclo === 0 ? (
                'Nenhuma entrega ainda.'
              ) : (
                <>
                  <span className="font-medium text-warm-800">{totalCiclo}</span> entrega
                  {totalCiclo === 1 ? '' : 's'} ·{' '}
                  <span className="font-medium text-success-text">{entreguesCiclo}</span> entregue
                  {entreguesCiclo === 1 ? '' : 's'}
                </>
              )}
            </div>
            {totalCiclo > 0 && (
              <button
                onClick={() => window.print()}
                className="h-10 rounded-md border border-warm-300 bg-white px-3.5 text-[13px] text-warm-700 hover:bg-warm-100"
              >
                Imprimir etiquetas
              </button>
            )}
          </div>

          {erroAcao && <p className="mt-3 text-[13px] text-danger-text">Erro: {erroAcao}</p>}

          {totalCiclo === 0 ? (
            <div className="mt-8 rounded-lg border border-dashed border-warm-300 bg-warm-100 px-5 py-10 text-center">
              <p className="font-display text-[18px] uppercase tracking-[0.04em] text-warm-500">
                Expedição vazia
              </p>
              <p className="mx-auto mt-1.5 max-w-md text-[14px] leading-relaxed text-warm-500">
                Gere a expedição pra trazer as assinaturas e avulsos confirmados deste ciclo.
              </p>
            </div>
          ) : (
            <div className="mt-5 space-y-6">
              {grupos.map((g) => (
                <section key={g.regiao}>
                  <div className="mb-2 flex flex-wrap items-center justify-between gap-2">
                    <h2 className="font-display text-[20px] uppercase tracking-[0.03em] text-ink-700">
                      {g.label}
                    </h2>
                    <div className="flex items-center gap-3">
                      <span className="text-[12px] text-warm-500">
                        {g.entregues} de {g.total} entregue{g.total === 1 ? '' : 's'}
                      </span>
                      <button
                        onClick={() => copiarRota(g)}
                        className="h-9 rounded-md border border-warm-300 bg-white px-3 text-[12px] text-warm-700 hover:bg-warm-100"
                      >
                        Copiar rota
                      </button>
                    </div>
                  </div>
                  <GrupoLista
                    grupo={g}
                    busyId={busyId}
                    onAvancar={(eid) => rodar(eid, () => avancarStatusEntrega(eid))}
                    onVoltar={(eid) => rodar(eid, () => voltarStatusEntrega(eid))}
                    onSalvarObs={(eid, txt) => rodar(eid, () => salvarObservacaoEntrega(eid, txt))}
                    onRemover={(eid) => rodar(eid, () => removerEntrega(eid))}
                  />
                </section>
              ))}
            </div>
          )}
        </div>
      </div>

      <EtiquetasPrint entregas={todas} />

      {toast && (
        <div
          role="status"
          className="fixed bottom-6 left-1/2 z-50 -translate-x-1/2 rounded-md border border-success-border bg-success-bg px-4 py-2 text-[14px] text-success-text shadow print:hidden"
        >
          {toast}
        </div>
      )}
    </Shell>
  );
}

interface GrupoListaProps {
  grupo: GrupoRegiao;
  busyId: string | null;
  onAvancar: (id: string) => void;
  onVoltar: (id: string) => void;
  onSalvarObs: (id: string, texto: string) => void;
  onRemover: (id: string) => void;
}

/** Lista da regiao com subcabecalhos por bairro; numeracao = ordem da rota. */
function GrupoLista({ grupo, busyId, onAvancar, onVoltar, onSalvarObs, onRemover }: GrupoListaProps) {
  return (
    <ul className="space-y-2">
      {grupo.entregas.map((e, i) => {
        const novoBairro = i === 0 || grupo.entregas[i - 1].bairro !== e.bairro;
        return (
          <Fragment key={e.id}>
            {novoBairro && (
              <li className="mt-3 list-none text-[11px] uppercase tracking-[0.06em] text-warm-400 first:mt-0">
                {e.bairro}
              </li>
            )}
            <EntregaRow
              entrega={e}
              numero={i + 1}
              busy={busyId === e.id}
              onAvancar={onAvancar}
              onVoltar={onVoltar}
              onSalvarObs={onSalvarObs}
              onRemover={onRemover}
            />
          </Fragment>
        );
      })}
    </ul>
  );
}
