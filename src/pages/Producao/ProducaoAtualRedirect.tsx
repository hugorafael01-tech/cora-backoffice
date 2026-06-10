import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { supabase } from '../../lib/supabase';
import { escolherAtual, type SemanaLite } from '../../lib/semana';
import { Shell } from '../Semana/components/Shell';

/** Resolve a semana "atual" e redireciona pra /producao/:id. Espelha SemanaAtualRedirect. */
export function ProducaoAtualRedirect() {
  const navigate = useNavigate();
  const [vazio, setVazio] = useState(false);
  const [erro, setErro] = useState<string | null>(null);

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
      if (id) navigate(`/producao/${id}`, { replace: true });
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
