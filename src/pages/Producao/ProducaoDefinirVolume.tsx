import { useMemo, useState } from 'react';
import { Navigate, useParams, useSearchParams } from 'react-router-dom';
import { useProducaoVolume } from '../../hooks/useProducaoVolume';
import { criarProducoesSemana, removerProducao, salvarSobraLevain } from '../../lib/producaoActions';
import { previewLinha } from '../../lib/producao';
import { Shell } from '../Semana/components/Shell';
import { PrHeader } from './components/PrHeader';
import { BannerProducao } from './components/BannerProducao';
import { VolumeList } from './components/VolumeList';
import { LevainCard } from './components/LevainCard';
import { ResumoCards } from './components/ResumoCards';
import { ConcludeBar } from './components/ConcludeBar';
import { AdicionarReceitaModal } from './components/AdicionarReceitaModal';
import { NovaReceitaTesteModal } from './components/NovaReceitaTesteModal';
import { ProducaoTabs, type AbaProducao } from './components/ProducaoTabs';
import { Preparacao } from './components/Preparacao';
import { Acompanhamento } from './components/Acompanhamento';
import type { LinhaVolume } from './types';

type ModalAberto = 'adicionar' | 'novaTeste' | null;

export function ProducaoDefinirVolume() {
  const { id } = useParams<{ id: string }>();
  const { dados, loading, naoEncontrada, error, refetch } = useProducaoVolume(id);

  const [linhas, setLinhas] = useState<LinhaVolume[]>([]);
  const [sobra, setSobra] = useState(400);
  const [modal, setModal] = useState<ModalAberto>(null);
  const [salvando, setSalvando] = useState(false);
  const [sucesso, setSucesso] = useState<string | null>(null);
  const [erroAcao, setErroAcao] = useState<string | null>(null);

  // Aba na URL (?aba=...): deep-link + sobrevive a reload e a remount. Default
  // 'volume'. Trocar de aba usa replace (nao polui o historico de navegacao).
  const [searchParams, setSearchParams] = useSearchParams();
  const abaParam = searchParams.get('aba');
  const aba: AbaProducao =
    abaParam === 'preparacao' || abaParam === 'acompanhamento' ? abaParam : 'volume';
  function setAba(nova: AbaProducao) {
    setSearchParams(
      (prev) => {
        const next = new URLSearchParams(prev);
        next.set('aba', nova);
        return next;
      },
      { replace: true }
    );
  }

  // Sincroniza a lista local + sobra de levain do ciclo com o load/refetch do
  // banco no render (padrao "ajustar estado durante render"; evita setState em
  // effect). sobra vem de semanas.sobra_levain_g (0025), default 400.
  const [origem, setOrigem] = useState(dados);
  if (dados !== origem) {
    setOrigem(dados);
    setLinhas(dados?.linhas ?? []);
    setSobra(dados?.semana.sobra_levain_g ?? 400);
  }

  const totais = useMemo(() => {
    let paes = 0;
    let massaKg = 0;
    let levainKg = 0;
    for (const l of linhas) {
      const { massaKg: m, levainKg: lev } = previewLinha(
        l.qty,
        l.pesoMassaG,
        l.somaBaker,
        l.levainPct
      );
      paes += l.qty;
      massaKg += m ?? 0;
      levainKg += lev ?? 0;
    }
    return { paes, massaKg, levainKg };
  }, [linhas]);

  const numProducoes = linhas.filter((l) => l.qty > 0).length;

  const excluirVersaoIds = useMemo(
    () => new Set(linhas.map((l) => l.versaoReceitaId)),
    [linhas]
  );

  if (naoEncontrada) return <Navigate to="/producao/atual" replace />;

  if (loading || !dados) {
    return (
      <Shell>
        <div className="p-8 text-warm-500">{error ? `Erro: ${error.message}` : 'Carregando…'}</div>
      </Shell>
    );
  }

  const { semana } = dados;

  // Persiste a sobra de levain do ciclo (no blur do input). Erro vai pro banner;
  // sem refetch (o estado local ja reflete a edicao ao vivo).
  async function salvarSobra(g: number) {
    if (!id) return;
    setErroAcao(null);
    try {
      await salvarSobraLevain(id, g);
    } catch (e) {
      setErroAcao(e instanceof Error ? e.message : String(e));
    }
  }

  function setQty(versaoReceitaId: string, qty: number) {
    setSucesso(null);
    setLinhas((prev) =>
      prev.map((l) => (l.versaoReceitaId === versaoReceitaId ? { ...l, qty } : l))
    );
  }

  function adicionarLinha(linha: LinhaVolume) {
    setLinhas((prev) =>
      prev.some((l) => l.versaoReceitaId === linha.versaoReceitaId) ? prev : [...prev, linha]
    );
    setModal(null);
  }

  async function removerLinha(linha: LinhaVolume) {
    setErroAcao(null);
    try {
      if (linha.temProducao && id) {
        const apagadas = await removerProducao(id, linha.versaoReceitaId);
        if (apagadas === 0) {
          // Backstop: producao ja congelada no banco (em_curso/concluida) — mantem
          // a linha na UI pra nao desincronizar com o banco.
          setErroAcao('Produção já iniciada. Não dá pra remover por aqui.');
          return;
        }
      }
      setLinhas((prev) => prev.filter((l) => l.versaoReceitaId !== linha.versaoReceitaId));
    } catch (e) {
      setErroAcao(e instanceof Error ? e.message : String(e));
    }
  }

  async function criar() {
    if (!id) return;
    setSalvando(true);
    setErroAcao(null);
    setSucesso(null);
    try {
      const { criadas } = await criarProducoesSemana(id, linhas);
      setSucesso(`${criadas} ${criadas === 1 ? 'produção criada.' : 'produções criadas.'}`);
      refetch();
    } catch (e) {
      setErroAcao(e instanceof Error ? e.message : String(e));
    } finally {
      setSalvando(false);
    }
  }

  return (
    <Shell>
      <PrHeader semana={semana} />
      <ProducaoTabs ativa={aba} onChange={setAba} />

      {aba === 'volume' && (
        <>
          <BannerProducao sucesso={sucesso} />

          <VolumeList
            linhas={linhas}
            onQty={setQty}
            onRemover={removerLinha}
            onAdicionar={() => setModal('adicionar')}
            onNovaTeste={() => setModal('novaTeste')}
          />

          <LevainCard
            metaG={totais.levainKg * 1000}
            sobraG={sobra}
            onSobra={setSobra}
            onSobraCommit={salvarSobra}
          />

          <ResumoCards paes={totais.paes} massaKg={totais.massaKg} levainKg={totais.levainKg} />

          {erroAcao && (
            <p className="px-5 text-[13px] text-danger-text md:px-8">Erro: {erroAcao}</p>
          )}

          <ConcludeBar numProducoes={numProducoes} salvando={salvando} onCriar={criar} />

          {modal === 'adicionar' && (
            <AdicionarReceitaModal
              excluirVersaoIds={excluirVersaoIds}
              onAdd={adicionarLinha}
              onClose={() => setModal(null)}
            />
          )}
          {modal === 'novaTeste' && (
            <NovaReceitaTesteModal onAdd={adicionarLinha} onClose={() => setModal(null)} />
          )}
        </>
      )}

      {aba === 'preparacao' && (
        <Preparacao semanaId={semana.id} onIrParaVolume={() => setAba('volume')} />
      )}

      {aba === 'acompanhamento' && (
        <Acompanhamento
          semanaId={semana.id}
          dataEntrega={semana.data_entrega}
          onIrParaVolume={() => setAba('volume')}
        />
      )}
    </Shell>
  );
}
