import { useEffect, useMemo, useState } from 'react';
import { Navigate, useParams } from 'react-router-dom';
import { useExpedicao } from '../../hooks/useExpedicao';
import {
  agrupaPorOnda,
  ocupacaoBag,
  ordemCarregamento,
  textoRota,
  type EntregaLite,
  type GrupoEntregas,
} from '../../lib/expedicao';
import {
  avancarStatusEntrega,
  gerarExpedicao,
  moverEntregaNaSequencia,
  recalcularSequenciaOnda,
  removerEntrega,
  salvarObservacaoEntrega,
  sequenciarExpedicao,
  voltarStatusEntrega,
} from '../../lib/expedicaoActions';
import type { OrdemContexto, Zona } from '../../lib/zonas';
import { Shell } from '../Semana/components/Shell';
import { EdHeader } from './components/EdHeader';
import { EntregaRow } from './components/EntregaRow';
import { EtiquetasPrint } from './components/EtiquetasPrint';

/** Como a lista de um grupo esta sendo lida. */
type Vista = 'carregamento' | 'entrega';

export function ExpedicaoDetalhe() {
  const { id } = useParams<{ id: string }>();
  const { dados, loading, naoEncontrada, error, refetch } = useExpedicao(id);

  const [gerando, setGerando] = useState(false);
  const [busyId, setBusyId] = useState<string | null>(null);
  const [toast, setToast] = useState<string | null>(null);
  const [erroAcao, setErroAcao] = useState<string | null>(null);
  // A tela abre na ordem de CARREGAMENTO: montar a bag e a primeira coisa que
  // acontece depois de imprimir. A ordem de entrega fica a um clique.
  const [vista, setVista] = useState<Record<string, Vista>>({});

  useEffect(() => {
    if (!toast) return;
    const t = setTimeout(() => setToast(null), 3000);
    return () => clearTimeout(t);
  }, [toast]);

  const ordem: OrdemContexto = useMemo(
    () => dados?.ordem ?? { zonas: new Map<string, Zona>(), bairros: new Map<string, number>() },
    [dados]
  );
  const zonas = ordem.zonas;
  const grupos = useMemo(() => agrupaPorOnda(dados?.entregas ?? [], ordem), [dados, ordem]);
  const entregas = dados?.entregas ?? [];
  const totalCiclo = entregas.length;
  const entreguesCiclo = entregas.filter((e) => e.status === 'entregue').length;
  const semSequencia = entregas.filter((e) => e.sequencia == null).length;
  // A impressao segue a ordem de ENTREGA: as etiquetas saem na ordem das
  // paradas, entao a pilha que sai da impressora ja e a pilha de montagem.
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
      const { criadas, atualizadas, sequenciadas } = await gerarExpedicao(id);
      const partes = [
        `${criadas} ${criadas === 1 ? 'nova' : 'novas'}`,
        `${atualizadas} atualizada${atualizadas === 1 ? '' : 's'}`,
      ];
      if (sequenciadas > 0) partes.push(`${sequenciadas} sequenciada${sequenciadas === 1 ? '' : 's'}`);
      setToast(`${partes.join(' · ')}.`);
      refetch();
    } catch (e) {
      setErroAcao(e instanceof Error ? e.message : String(e));
    } finally {
      setGerando(false);
    }
  }

  async function rodar(chave: string, fn: () => Promise<void>) {
    setErroAcao(null);
    setBusyId(chave);
    try {
      await fn();
      refetch();
    } catch (e) {
      setErroAcao(e instanceof Error ? e.message : String(e));
    } finally {
      setBusyId(null);
    }
  }

  async function copiarRota(grupo: GrupoEntregas) {
    try {
      await navigator.clipboard.writeText(textoRota(grupo));
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
              <div className="flex flex-wrap items-center gap-2">
                {semSequencia > 0 && id && (
                  <button
                    onClick={() =>
                      rodar('sequenciar', async () => {
                        const n = await sequenciarExpedicao(id);
                        setToast(`${n} entrega${n === 1 ? '' : 's'} sequenciada${n === 1 ? '' : 's'}.`);
                      })
                    }
                    disabled={busyId !== null}
                    className="h-10 rounded-md border border-brand-200 bg-brand-50 px-3.5 text-[13px] text-brand-600 hover:bg-brand-100 disabled:cursor-not-allowed disabled:opacity-60"
                  >
                    Atribuir sequência ({semSequencia})
                  </button>
                )}
                <button
                  onClick={() => window.print()}
                  className="h-10 rounded-md border border-warm-300 bg-white px-3.5 text-[13px] text-warm-700 hover:bg-warm-100"
                >
                  Imprimir etiquetas
                </button>
              </div>
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
            <div className="mt-5 space-y-8">
              {grupos.map((g) => (
                <GrupoOndaSecao
                  key={g.grupo}
                  grupo={g}
                  zonas={zonas}
                  capacidadeBag={dados.capacidadeBag}
                  vista={vista[g.grupo] ?? 'carregamento'}
                  onVista={(v) => setVista((atual) => ({ ...atual, [g.grupo]: v }))}
                  busyId={busyId}
                  onCopiarRota={() => copiarRota(g)}
                  onRecalcular={() =>
                    g.onda && id
                      ? rodar(`recalc-${g.grupo}`, async () => {
                          const n = await recalcularSequenciaOnda(id, g.onda!);
                          setToast(`${g.label}: ${n} parada${n === 1 ? '' : 's'} renumerada${n === 1 ? '' : 's'}.`);
                        })
                      : undefined
                  }
                  onAvancar={(eid) => rodar(eid, () => avancarStatusEntrega(eid))}
                  onVoltar={(eid) => rodar(eid, () => voltarStatusEntrega(eid))}
                  onSalvarObs={(eid, txt) => rodar(eid, () => salvarObservacaoEntrega(eid, txt))}
                  onRemover={(eid) => rodar(eid, () => removerEntrega(eid))}
                  onMover={(eid, dir) =>
                    id ? rodar(eid, () => moverEntregaNaSequencia(id, eid, dir)) : undefined
                  }
                />
              ))}
            </div>
          )}
        </div>
      </div>

      <EtiquetasPrint entregas={todas} zonas={zonas} />

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

interface SecaoProps {
  grupo: GrupoEntregas;
  zonas: Map<string, Zona>;
  capacidadeBag: number | null;
  vista: Vista;
  onVista: (v: Vista) => void;
  busyId: string | null;
  onCopiarRota: () => void;
  onRecalcular: () => void;
  onAvancar: (id: string) => void;
  onVoltar: (id: string) => void;
  onSalvarObs: (id: string, texto: string) => void;
  onRemover: (id: string) => void;
  onMover: (id: string, direcao: 'cima' | 'baixo') => void;
}

/**
 * Uma onda (ou a entrega propria): cabecalho com contadores e ocupacao da bag,
 * alternador carregamento/entrega, e a lista.
 */
function GrupoOndaSecao({
  grupo: g,
  zonas,
  capacidadeBag,
  vista,
  onVista,
  busyId,
  onCopiarRota,
  onRecalcular,
  onAvancar,
  onVoltar,
  onSalvarObs,
  onRemover,
  onMover,
}: SecaoProps) {
  const [confirmandoRecalculo, setConfirmandoRecalculo] = useState(false);
  const naBag = g.onda !== null;
  const carregando = naBag && vista === 'carregamento';
  const lista = carregando ? ordemCarregamento(g.entregas) : g.entregas;
  const ocupacao = ocupacaoBag(g.pacotes, capacidadeBag);

  return (
    <section>
      <div className="mb-2 flex flex-wrap items-center justify-between gap-2">
        <h2 className="font-display text-[20px] uppercase tracking-[0.03em] text-ink-700">
          {g.label}
        </h2>
        <div className="flex flex-wrap items-center gap-3">
          <span className="text-[12px] text-warm-500">
            {g.entregues} de {g.total} entregue{g.total === 1 ? '' : 's'}
          </span>
          {naBag && (
            <button
              onClick={onCopiarRota}
              className="h-9 rounded-md border border-warm-300 bg-white px-3 text-[12px] text-warm-700 hover:bg-warm-100"
            >
              Copiar rota
            </button>
          )}
        </div>
      </div>

      {naBag ? (
        <>
          {/* Ocupacao da bag: total de pacotes e comparacao com a capacidade
              configurada. Sem capacidade em app_settings nao ha comparacao —
              alerta inventado seria pior que alerta nenhum. */}
          <div
            className={`mb-2 rounded-md border px-3 py-2 text-[12px] ${
              ocupacao.acima
                ? 'border-danger-border bg-danger-bg text-danger-text'
                : 'border-warm-200 bg-warm-100 text-warm-600'
            }`}
          >
            <span className="font-medium">
              {ocupacao.pacotes} pacote{ocupacao.pacotes === 1 ? '' : 's'}
            </span>
            {ocupacao.capacidade == null ? (
              <span> · capacidade de transporte não configurada</span>
            ) : ocupacao.acima ? (
              <span>
                {' '}
                · {ocupacao.excedente} acima da capacidade de {ocupacao.capacidade} — não cabe numa
                viagem só
              </span>
            ) : (
              <span> · capacidade de {ocupacao.capacidade}</span>
            )}
            {g.semZona > 0 && (
              <span className="text-danger-text">
                {' '}
                · {g.semZona} sem zona no cadastro
              </span>
            )}
          </div>

          <div className="mb-2 flex flex-wrap items-center justify-between gap-2">
            <div className="text-[12px] text-warm-600">
              {carregando ? (
                <>
                  <span className="font-medium text-warm-800">Ordem de carregar a bag</span> —
                  última parada no fundo, primeira no topo.
                </>
              ) : (
                <>
                  <span className="font-medium text-warm-800">Ordem de entrega</span> — a mesma da
                  rota e das etiquetas.
                </>
              )}
            </div>
            <div className="flex items-center gap-2">
              <button
                onClick={() => onVista(carregando ? 'entrega' : 'carregamento')}
                className="h-9 rounded-md border border-warm-300 bg-white px-3 text-[12px] text-warm-700 hover:bg-warm-100"
              >
                {carregando ? 'Ver ordem de entrega' : 'Ver ordem de carregamento'}
              </button>
              {confirmandoRecalculo ? (
                <>
                  <button
                    onClick={() => {
                      setConfirmandoRecalculo(false);
                      onRecalcular();
                    }}
                    disabled={busyId !== null}
                    className="h-9 rounded-md border border-danger-border bg-danger-bg px-3 text-[12px] text-danger-text hover:opacity-80 disabled:opacity-50"
                  >
                    Descartar ordem manual
                  </button>
                  <button
                    onClick={() => setConfirmandoRecalculo(false)}
                    className="h-9 rounded-md px-2 text-[12px] text-warm-500 hover:text-warm-700"
                  >
                    Cancelar
                  </button>
                </>
              ) : (
                <button
                  onClick={() => setConfirmandoRecalculo(true)}
                  disabled={busyId !== null}
                  className="h-9 rounded-md border border-warm-300 bg-white px-3 text-[12px] text-warm-500 hover:text-warm-700 disabled:cursor-not-allowed"
                >
                  Recalcular sequência
                </button>
              )}
            </div>
          </div>
        </>
      ) : (
        <p className="mb-2 rounded-md border border-warm-300 bg-warm-100 px-3 py-2 text-[12px] text-warm-600">
          Não vai na bag e não entra na numeração das ondas — a etiqueta sai marcada como entrega
          própria.
        </p>
      )}

      <ul className="space-y-2">
        {lista.map((e) => {
          const i = g.entregas.indexOf(e);
          return (
            <EntregaRow
              key={e.id}
              entrega={e}
              onda={g.onda}
              zonas={zonas}
              busy={busyId === e.id}
              podeSubir={i > 0}
              podeDescer={i < g.entregas.length - 1}
              onAvancar={onAvancar}
              onVoltar={onVoltar}
              onSalvarObs={onSalvarObs}
              onRemover={onRemover}
              onMover={onMover}
            />
          );
        })}
      </ul>
    </section>
  );
}
