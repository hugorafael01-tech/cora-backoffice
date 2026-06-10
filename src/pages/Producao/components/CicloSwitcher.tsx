import { useEffect, useState } from 'react';
import { useNavigate, useParams, useSearchParams } from 'react-router-dom';
import { supabase } from '../../../lib/supabase';
import { cicloLabel } from '../../../lib/semana';

interface CicloOption {
  id: string;
  data_entrega: string;
  numero: number;
}

/**
 * Switcher de ciclos do modulo Producao: lista os ciclos ABERTOS (nao
 * cancelado/encerrado) por data de entrega; trocar navega pro mesmo path
 * preservando a aba (?aba=). O ciclo atual entra na lista mesmo se ja encerrado
 * (voce esta nele). Substitui a navegacao linear prev/next (ciclos sobrepoem).
 */
export function CicloSwitcher() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const [ciclos, setCiclos] = useState<CicloOption[]>([]);

  useEffect(() => {
    let cancelado = false;
    async function carregar() {
      const { data } = await supabase
        .from('semanas')
        .select('id, data_entrega, numero, status')
        .order('data_entrega', { ascending: true });
      if (cancelado || !data) return;
      const aberto = (s: string) => s !== 'cancelada' && s !== 'concluida';
      const lista = data
        .filter((c) => aberto(c.status) || c.id === id)
        .map((c) => ({ id: c.id as string, data_entrega: c.data_entrega, numero: c.numero }));
      setCiclos(lista);
    }
    carregar();
    return () => {
      cancelado = true;
    };
  }, [id]);

  function trocar(novoId: string) {
    if (novoId === id) return;
    const qs = searchParams.toString();
    navigate(`/producao/${novoId}${qs ? `?${qs}` : ''}`);
  }

  return (
    <select
      value={id ?? ''}
      onChange={(e) => trocar(e.target.value)}
      aria-label="Trocar de ciclo"
      className="h-11 max-w-[220px] rounded-md border border-warm-300 bg-white px-2.5 text-[13px] text-warm-700 focus:border-brand-300 focus:outline-none"
    >
      {ciclos.length === 0 && id && <option value={id}>Ciclo atual</option>}
      {ciclos.map((c) => (
        <option key={c.id} value={c.id}>
          {cicloLabel(c.data_entrega)} · ISO {c.numero}
        </option>
      ))}
    </select>
  );
}
