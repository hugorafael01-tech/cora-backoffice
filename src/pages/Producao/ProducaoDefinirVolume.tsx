import { useMemo, useState } from 'react';
import { Navigate, useParams } from 'react-router-dom';
import { useProducaoVolume } from '../../hooks/useProducaoVolume';
import { criarProducoesSemana, removerProducao } from '../../lib/producaoActions';
import { diasDaSemana, previewLinha } from '../../lib/producao';
import { dataSpStr } from '../../lib/date';
import { Shell } from '../Semana/components/Shell';
import { PrHeader } from './components/PrHeader';
import { BannerProducao } from './components/BannerProducao';
import { DayTabs } from './components/DayTabs';
import { VolumeList } from './components/VolumeList';
import { LevainCard } from './components/LevainCard';
import { ResumoCards } from './components/ResumoCards';
import { ConcludeBar } from './components/ConcludeBar';
import { AdicionarReceitaModal } from './components/AdicionarReceitaModal';
import { NovaReceitaTesteModal } from './components/NovaReceitaTesteModal';
import { ProducaoTabs, type AbaProducao } from './components/ProducaoTabs';
import { Preparacao } from './components/Preparacao';
import type { LinhaVolume } from './types';

type ModalAberto = 'adicionar' | 'novaTeste' | null;

export function ProducaoDefinirVolume() {
  const { id } = useParams<{ id: string }>();
  const { dados, loading, naoEncontrada, error, refetch } = useProducaoVolume(id);

  const [linhas, setLinhas] = useState<LinhaVolume[]>([]);
  const [aba, setAba] = useState<AbaProducao>('volume');
  const [sobra, setSobra] = useState(400);
  const [modal, setModal] = useState<ModalAberto>(null);
  const [salvando, setSalvando] = useState(false);
  const [sucesso, setSucesso] = useState<string | null>(null);
  const [erroAcao, setErroAcao] = useState<string | null>(null);

  // Sincroniza a lista local com o carregamento/refetch do banco no render
  // (padrao "ajustar estado durante render"; evita setState em effect).
  const [origem, setOrigem] = useState(dados);
  if (dados !== origem) {
    setOrigem(dados);
    setLinhas(dados?.linhas ?? []);
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

  const { semana, semanaAnterior, semanaProxima } = dados;

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
        await removerProducao(id, linha.versaoReceitaId);
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
      setSucesso(`${criadas} ${criadas === 1 ? 'producao criada.' : 'producoes criadas.'}`);
      refetch();
    } catch (e) {
      setErroAcao(e instanceof Error ? e.message : String(e));
    } finally {
      setSalvando(false);
    }
  }

  const dias = diasDaSemana(semana.data_entrega, dataSpStr(new Date()));

  return (
    <Shell>
      <PrHeader semana={semana} anterior={semanaAnterior} proxima={semanaProxima} />
      <ProducaoTabs ativa={aba} onChange={setAba} />

      {aba === 'volume' && (
        <>
          <BannerProducao sucesso={sucesso} />
          <DayTabs dias={dias} />

          <VolumeList
            linhas={linhas}
            onQty={setQty}
            onRemover={removerLinha}
            onAdicionar={() => setModal('adicionar')}
            onNovaTeste={() => setModal('novaTeste')}
          />

          <LevainCard metaG={totais.levainKg * 1000} sobraG={sobra} onSobra={setSobra} />

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
    </Shell>
  );
}
