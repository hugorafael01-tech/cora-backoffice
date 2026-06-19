import { useEffect, useState } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { supabase } from '../../lib/supabase';
import { escolherCicloAtual, derivaEstado, type CicloLite } from '../../lib/semana';
import { dataSpStr } from '../../lib/date';
import { Shell } from '../Semana/components/Shell';

/** Resolve a semana "atual" e redireciona pra /producao/:id. Espelha SemanaAtualRedirect. */
export function ProducaoAtualRedirect() {
  const navigate = useNavigate();
  const { search } = useLocation();
  const [vazio, setVazio] = useState(false);
  const [erro, setErro] = useState<string | null>(null);

  useEffect(() => {
    let cancelado = false;
    async function resolver() {
      const { data, error } = await supabase
        .from('semanas')
        .select('id, data_entrega, data_corte, status')
        .order('data_entrega', { ascending: true });

      if (cancelado) return;
      if (error) {
        setErro(error.message);
        return;
      }
      const ciclos = (data ?? []) as CicloLite[];
      const id = escolherCicloAtual(ciclos, dataSpStr(new Date()));
      if (id) {
        const params = new URLSearchParams(search);
        if (!params.has('aba')) {
          const ciclo = ciclos.find((c) => c.id === id)!;
          const estado = derivaEstado(ciclo);
          const aba =
            estado === 'B' ? 'acompanhamento' : estado === 'C' ? 'registro' : 'volume';
          params.set('aba', aba);
        }
        const qs = params.toString();
        navigate(`/producao/${id}${qs ? `?${qs}` : ''}`, { replace: true });
      } else {
        setVazio(true);
      }
    }
    resolver();
    return () => {
      cancelado = true;
    };
  }, [navigate, search]);

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
          <p className="font-display text-2xl text-ink-700">
            Crie uma semana primeiro (no módulo Semana) pra definir o volume de produção.
          </p>
        </div>
      </Shell>
    );
  }

  return (
    <Shell>
      <div className="p-8 text-warm-500">Carregando…</div>
    </Shell>
  );
}
