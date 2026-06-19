import { useEffect, useState } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { supabase } from '../../lib/supabase';
import { escolherCicloAtual, type CicloLite } from '../../lib/semana';
import { dataSpStr } from '../../lib/date';
import { Shell } from '../Semana/components/Shell';

/** Resolve o ciclo "atual" e redireciona pra /expedicao/:id. Espelha ProducaoAtualRedirect. */
export function ExpedicaoAtualRedirect() {
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
      const id = escolherCicloAtual((data ?? []) as CicloLite[], dataSpStr(new Date()));
      if (id) navigate(`/expedicao/${id}${search}`, { replace: true });
      else setVazio(true);
    }
    resolver();
    return () => {
      cancelado = true;
    };
  }, [navigate, search]);

  if (erro) {
    return (
      <Shell>
        <div className="p-8 text-danger-text">Erro ao carregar ciclos: {erro}</div>
      </Shell>
    );
  }

  if (vazio) {
    return (
      <Shell>
        <div className="grid min-h-[60vh] place-items-center p-8 text-center">
          <p className="font-display text-2xl text-ink-700">
            Crie um ciclo primeiro (no módulo Produção) pra montar a expedição.
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
