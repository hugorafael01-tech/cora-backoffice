/**
 * PROVISORIO - Fase 1
 *
 * Esta sub-tela de cardapio vive aqui porque o modulo Planejamento completo
 * so entra na Fase 3/4. Quando Planejamento existir como modulo separado
 * (rota /planejamento), esta secao e removida e substituida por link
 * "Editar cardapio ->" pra /planejamento/:semana_id.
 *
 * Briefing original: Docs/CORA_Briefing_Backoffice_Fase1_Schema_v3.md (Decisao #1)
 * Briefing tecnico: Docs/CORA_Briefing_Backoffice_Fase1_Etapa1_Semana_v3.md (par.13)
 * Wireframe definitivo do Planejamento: Planejamento_wireframes_v2.html (Fase 3/4)
 */
import { useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { supabase } from '../../lib/supabase';
import { useSemanaCardapio } from '../../hooks/useSemanaCardapio';
import type { ProdutoCardapio } from '../../hooks/useSemanaCardapio';
import { Shell } from './components/Shell';

function brl(v: number): string {
  return v.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
}

export function SemanaCardapio() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { baseFixos, rotativos, jaNoBanco, loading, error } = useSemanaCardapio(id);
  const [overrides, setOverrides] = useState<Map<string, boolean>>(new Map());
  const [publicando, setPublicando] = useState(false);
  const [erroPub, setErroPub] = useState<string | null>(null);

  const marcado = (pid: string) => (overrides.has(pid) ? overrides.get(pid)! : jaNoBanco.has(pid));

  function toggle(pid: string) {
    setOverrides((prev) => {
      const next = new Map(prev);
      next.set(pid, !marcado(pid));
      return next;
    });
  }

  function voltar() {
    navigate(`/semanas/${id}`);
  }

  async function publicar() {
    if (!id) return;
    setPublicando(true);
    setErroPub(null);

    const paraInserir = rotativos.filter((p) => marcado(p.id) && !jaNoBanco.has(p.id));
    const paraDeletar = rotativos.filter((p) => !marcado(p.id) && jaNoBanco.has(p.id));

    try {
      if (paraInserir.length > 0) {
        const rows = paraInserir.map((p: ProdutoCardapio) => ({
          semana_id: id,
          produto_id: p.id,
          tipo: 'rotativo' as const,
          preco_avulso: p.preco_avulso,
        }));
        const { error: errIns } = await supabase.from('cardapios').insert(rows);
        if (errIns) throw errIns;
      }
      for (const p of paraDeletar) {
        const { error: errDel } = await supabase
          .from('cardapios')
          .delete()
          .eq('semana_id', id)
          .eq('produto_id', p.id);
        if (errDel) throw errDel;
      }
      // Congela a semana se estiver aberta (no-op se ja congelada/rascunho)
      await supabase.from('semanas').update({ status: 'congelada' }).eq('id', id).eq('status', 'aberta');
      navigate(`/semanas/${id}`);
    } catch (e) {
      setErroPub(e instanceof Error ? e.message : String(e));
      setPublicando(false);
    }
  }

  return (
    <Shell>
      <div className="mx-auto max-w-2xl px-5 py-6 md:px-8">
        <button onClick={voltar} className="text-[14px] text-brand-600 hover:underline">
          ← Voltar pra semana
        </button>

        <h1 className="mt-3 font-display text-[26px] text-ink-700">Cardápio da semana</h1>

        {error && <p className="mt-4 text-danger-text">Erro: {error.message}</p>}
        {loading ? (
          <p className="mt-6 text-warm-500">Carregando…</p>
        ) : (
          <>
            <section className="mt-6 rounded-lg border border-warm-200 bg-white p-4">
              <h2 className="text-[12px] uppercase tracking-wide text-warm-500">
                Base e fixos (sempre presentes)
              </h2>
              <ul className="mt-3 space-y-2">
                {baseFixos.map((p) => (
                  <li key={p.id} className="flex items-center justify-between text-warm-700">
                    <span>● {p.nome}</span>
                    <span className="tabular-nums text-warm-600">{brl(p.preco_avulso)}</span>
                  </li>
                ))}
              </ul>
              <p className="mt-3 text-[11px] text-warm-400">
                trancado nesta tela. edite via Receitas →
              </p>
            </section>

            <section className="mt-4 rounded-lg border border-warm-200 bg-white p-4">
              <h2 className="text-[12px] uppercase tracking-wide text-warm-500">
                Rotativos (selecione 1 ou mais)
              </h2>
              <ul className="mt-3 space-y-1">
                {rotativos.map((p) => (
                  <li key={p.id}>
                    <label
                      className="flex cursor-pointer items-center justify-between rounded-md px-2 py-2 hover:bg-warm-100"
                      style={{ minHeight: 44 }}
                    >
                      <span className="flex items-center gap-3 text-warm-700">
                        <input
                          type="checkbox"
                          checked={marcado(p.id)}
                          onChange={() => toggle(p.id)}
                          className="h-5 w-5 accent-brand-500"
                        />
                        {p.nome}
                      </span>
                      <span className="tabular-nums text-warm-600">{brl(p.preco_avulso)}</span>
                    </label>
                  </li>
                ))}
              </ul>
            </section>

            {erroPub && <p className="mt-4 text-[13px] text-danger-text">{erroPub}</p>}

            <div className="mt-6 flex justify-end gap-2">
              <button
                onClick={voltar}
                className="h-11 rounded-md border border-warm-200 px-4 text-warm-600 hover:bg-warm-100"
              >
                Cancelar
              </button>
              <button
                onClick={publicar}
                disabled={publicando}
                className="h-11 rounded-md bg-brand-500 px-4 text-white hover:bg-brand-600 disabled:opacity-50"
              >
                {publicando ? 'Publicando…' : 'Publicar →'}
              </button>
            </div>
          </>
        )}
      </div>
    </Shell>
  );
}
