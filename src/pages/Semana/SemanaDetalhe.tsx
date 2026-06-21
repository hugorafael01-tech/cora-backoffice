import { useState } from 'react';
import { useParams, Navigate, Link } from 'react-router-dom';
import { supabase } from '../../lib/supabase';
import { useSemana } from '../../hooks/useSemana';
import { Shell } from './components/Shell';
import { WkHeader } from './components/WkHeader';
import { EstadoBanner } from './components/EstadoBanner';
import { Cronograma } from './components/Cronograma';
import { CardsVolume } from './components/CardsVolume';
import { TabelaProducao } from './components/TabelaProducao';
import { CardInsumos } from './components/CardInsumos';
import { CardEntregas } from './components/CardEntregas';
import { ModalCriarSemana } from './components/ModalCriarSemana';
import { ModalEditarCiclo } from './components/ModalEditarCiclo';

export function SemanaDetalhe() {
  const { id } = useParams<{ id: string }>();
  const { dados, loading, naoEncontrada, error, refetch } = useSemana(id);
  const [modalAberto, setModalAberto] = useState(false);
  const [editandoData, setEditandoData] = useState(false);
  const [abrindo, setAbrindo] = useState(false);

  if (naoEncontrada) return <Navigate to="/semanas/atual" replace />;

  if (loading || !dados) {
    return (
      <Shell>
        <div className="p-8 text-warm-500">{error ? `Erro: ${error.message}` : 'Carregando…'}</div>
      </Shell>
    );
  }

  const { semana, estado, planejamento, insumos, entregas, etapasAgora, semanaAnterior, semanaProxima } =
    dados;

  async function abrirSemana() {
    if (!id) return;
    setAbrindo(true);
    const { error: errFn } = await supabase.rpc('popular_cardapio_padrao', { p_semana_id: id });
    if (!errFn) {
      await supabase.from('semanas').update({ status: 'aberta' }).eq('id', id);
    }
    setAbrindo(false);
    refetch();
  }

  return (
    <Shell>
      <WkHeader
        semana={semana}
        estado={estado}
        anterior={semanaAnterior}
        proxima={semanaProxima}
        onNova={() => setModalAberto(true)}
        onEditarData={() => setEditandoData(true)}
      />

      <EstadoBanner
        estado={estado}
        onAbrirSemana={abrirSemana}
        abrindo={abrindo}
        proximaSemanaId={semanaProxima}
      />

      <div className="flex items-center justify-end px-5 pt-3 md:px-8">
        <Link
          to={`/semanas/${semana.id}/cardapio`}
          className="text-[14px] text-brand-600 hover:underline"
        >
          Cardápio da semana →
        </Link>
      </div>

      <Cronograma dataEntrega={semana.data_entrega} estado={estado} />

      <CardsVolume estado={estado} planejamento={planejamento} insumos={insumos} />

      <TabelaProducao estado={estado} planejamento={planejamento} etapasAgora={etapasAgora} />

      <div className="grid grid-cols-1 gap-4 px-5 pb-8 md:grid-cols-2 md:px-8">
        <CardInsumos alertas={insumos.alertas} okCount={insumos.okCount} />
        <CardEntregas estado={estado} cidades={entregas.cidades} totalGeral={entregas.totalGeral} />
      </div>

      {modalAberto && <ModalCriarSemana onClose={() => setModalAberto(false)} />}
      {editandoData && (
        <ModalEditarCiclo
          semana={semana}
          onClose={() => setEditandoData(false)}
          onSalva={() => { setEditandoData(false); refetch(); }}
        />
      )}
    </Shell>
  );
}
