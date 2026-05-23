import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { supabase } from '../../lib/supabase';
import { Shell } from './components/Shell';
import { ModalCriarSemana } from './components/ModalCriarSemana';

interface SemanaLite {
  id: string;
  data_entrega: string;
  data_corte: string;
}

const DIA_MS = 86_400_000;

function ymdLocal(ymd: string): number {
  const [y, m, d] = ymd.split('-').map(Number);
  return new Date(y, m - 1, d).getTime();
}

/** Escolhe a semana "atual" por prioridade (briefing v3 §10). */
function escolherAtual(semanas: SemanaLite[], agora: number): string | null {
  // 1. viva: corte <= agora <= entrega + 3 dias
  const viva = semanas.find((s) => {
    const corte = new Date(s.data_corte).getTime();
    const limite = ymdLocal(s.data_entrega) + 3 * DIA_MS;
    return corte <= agora && agora <= limite;
  });
  if (viva) return viva.id;

  // 2. proxima futura (menor data_entrega >= hoje)
  const futuras = semanas
    .filter((s) => ymdLocal(s.data_entrega) >= agora - DIA_MS)
    .sort((a, b) => a.data_entrega.localeCompare(b.data_entrega));
  if (futuras[0]) return futuras[0].id;

  // 3. mais recente passada
  const passadas = [...semanas].sort((a, b) => b.data_entrega.localeCompare(a.data_entrega));
  return passadas[0]?.id ?? null;
}

export function SemanaAtualRedirect() {
  const navigate = useNavigate();
  const [vazio, setVazio] = useState(false);
  const [erro, setErro] = useState<string | null>(null);
  const [modalAberto, setModalAberto] = useState(false);

  useEffect(() => {
    let cancelado = false;
    async function resolver() {
      const { data, error } = await supabase
        .from('semanas')
        .select('id, data_entrega, data_corte')
        .order('data_entrega', { ascending: true });

      if (cancelado) return;
      if (error) {
        setErro(error.message);
        return;
      }
      const id = escolherAtual((data ?? []) as SemanaLite[], Date.now());
      if (id) navigate(`/semanas/${id}`, { replace: true });
      else setVazio(true);
    }
    resolver();
    return () => {
      cancelado = true;
    };
  }, [navigate]);

  if (erro) {
    return (
      <Shell>
        <div className="p-8 text-danger-text">Erro ao carregar semanas: {erro}</div>
      </Shell>
    );
  }

  if (vazio) {
    return (
      <Shell>
        <div className="grid min-h-[60vh] place-items-center p-8 text-center">
          <div>
            <p className="font-display text-2xl text-ink-700">
              Você ainda não criou nenhuma semana.
            </p>
            <button
              onClick={() => setModalAberto(true)}
              className="mt-4 h-11 rounded-md bg-brand-500 px-5 text-white hover:bg-brand-600"
            >
              Criar semana
            </button>
          </div>
        </div>
        {modalAberto && <ModalCriarSemana onClose={() => setModalAberto(false)} />}
      </Shell>
    );
  }

  return (
    <Shell>
      <div className="p-8 text-warm-500">Carregando…</div>
    </Shell>
  );
}
