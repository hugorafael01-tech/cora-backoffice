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
 *
 * Desde a migration 0035 esta tela nao monta so o plano de producao: o portal
 * le `cardapios` direto (task 86e2fqk33), entao o que se marca aqui e o que o
 * assinante ve e o preco que ele paga. Dai o destaque e os precos explicitos.
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
  const {
    baseFixos,
    rotativos,
    jaNoBanco,
    precoCongelado,
    destaqueNoBanco,
    statusSemana,
    loading,
    error,
  } = useSemanaCardapio(id);
  const [overrides, setOverrides] = useState<Map<string, boolean>>(new Map());
  // `undefined` = ninguem mexeu ainda, vale o que esta no banco. `null` = o
  // Hugo tirou o destaque de proposito — semana sem estreia e permitida.
  const [destaqueOverride, setDestaqueOverride] = useState<string | null | undefined>(undefined);
  const [confirmandoSemDestaque, setConfirmandoSemDestaque] = useState(false);
  const [publicando, setPublicando] = useState(false);
  const [erroPub, setErroPub] = useState<string | null>(null);

  const marcado = (pid: string) => (overrides.has(pid) ? overrides.get(pid)! : jaNoBanco.has(pid));

  // Destaque so vale em rotativo marcado. Desmarcar o item que era o destaque
  // limpa o destaque sozinho, sem um segundo estado pra sincronizar.
  const destaqueBruto = destaqueOverride !== undefined ? destaqueOverride : destaqueNoBanco;
  const destaqueId =
    destaqueBruto && rotativos.some((p) => p.id === destaqueBruto && marcado(p.id))
      ? destaqueBruto
      : null;

  // O aviso e sobre o que vai AO AR. Semana em rascunho ainda esta sendo
  // montada e pode legitimamente nao ter destaque escolhido.
  const semanaVaiAoAr = statusSemana === 'aberta' || statusSemana === 'congelada';

  function toggle(pid: string) {
    setOverrides((prev) => {
      const next = new Map(prev);
      next.set(pid, !marcado(pid));
      return next;
    });
  }

  // Um destaque so: clicar em outro item move, clicar no mesmo desliga. A UI
  // impede o segundo destaque em vez de deixar o indice unico da 0035 rejeitar.
  function toggleDestaque(pid: string) {
    setDestaqueOverride(destaqueId === pid ? null : pid);
    setConfirmandoSemDestaque(false);
  }

  function voltar() {
    navigate(`/semanas/${id}`);
  }

  function aoClicarPublicar() {
    if (!destaqueId && semanaVaiAoAr) {
      setConfirmandoSemDestaque(true);
      return;
    }
    publicar();
  }

  async function publicar() {
    if (!id) return;
    setPublicando(true);
    setErroPub(null);
    setConfirmandoSemDestaque(false);

    const paraInserir = rotativos.filter((p) => marcado(p.id) && !jaNoBanco.has(p.id));
    const paraDeletar = rotativos.filter((p) => !marcado(p.id) && jaNoBanco.has(p.id));

    try {
      for (const p of paraDeletar) {
        const { error: errDel } = await supabase
          .from('cardapios')
          .delete()
          .eq('semana_id', id)
          .eq('produto_id', p.id);
        if (errDel) throw errDel;
      }

      // Limpar o destaque antigo ANTES de marcar o novo: `ux_cardapios_destaque
      // _por_semana` (0035) e unico parcial e rejeitaria os dois convivendo,
      // mesmo que por um instante. No-op se a linha ja saiu no delete acima.
      if (destaqueNoBanco && destaqueNoBanco !== destaqueId) {
        const { error: errLimpa } = await supabase
          .from('cardapios')
          .update({ destaque: false })
          .eq('semana_id', id)
          .eq('produto_id', destaqueNoBanco);
        if (errLimpa) throw errLimpa;
      }

      if (paraInserir.length > 0) {
        // `preco_avulso` copiado de `produtos` aqui e so aqui: e o snapshot que
        // congela. Sem `destaque` no insert — entra false pelo default e a
        // marcacao vem depois, com o destaque antigo ja limpo.
        const rows = paraInserir.map((p: ProdutoCardapio) => ({
          semana_id: id,
          produto_id: p.id,
          tipo: 'rotativo' as const,
          preco_avulso: p.preco_avulso,
        }));
        const { error: errIns } = await supabase.from('cardapios').insert(rows);
        if (errIns) throw errIns;
      }

      if (destaqueId && destaqueId !== destaqueNoBanco) {
        const { error: errDest } = await supabase
          .from('cardapios')
          .update({ destaque: true })
          .eq('semana_id', id)
          .eq('produto_id', destaqueId);
        if (errDest) throw errDest;
      }

      // Congela a semana se estiver aberta (no-op se ja congelada/rascunho)
      await supabase.from('semanas').update({ status: 'congelada' }).eq('id', id).eq('status', 'aberta');
      navigate(`/semanas/${id}`);
    } catch (e) {
      setErroPub(e instanceof Error ? e.message : String(e));
      setPublicando(false);
    }
  }

  /**
   * O preco que vale pro item, e de onde ele vem.
   *
   * Item ja em `cardapios` mostra o preco CONGELADO, nao o de `produtos`: sao
   * numeros diferentes quando o produto mudou de preco depois da semana ser
   * montada, e o congelado e o que o assinante paga.
   */
  function Preco({ p, entraNoCardapio }: { p: ProdutoCardapio; entraNoCardapio: boolean }) {
    const congelado = precoCongelado.get(p.id);

    if (congelado === undefined) {
      return (
        <span className="text-right">
          <span className={`tabular-nums ${entraNoCardapio ? 'text-warm-600' : 'text-warm-400'}`}>
            {brl(p.preco_avulso)}
          </span>
          {entraNoCardapio && (
            <span className="block text-[11px] text-warm-400">congela ao publicar</span>
          )}
        </span>
      );
    }

    const mudou = congelado !== p.preco_avulso;
    return (
      <span className="text-right">
        <span className={`tabular-nums ${entraNoCardapio ? 'text-warm-600' : 'text-warm-400'}`}>
          {brl(congelado)}
        </span>
        <span className="block text-[11px] text-warm-400">
          {!entraNoCardapio
            ? 'sai ao publicar'
            : mudou
              ? `congelado · produto hoje ${brl(p.preco_avulso)}`
              : 'congelado'}
        </span>
      </span>
    );
  }

  return (
    <Shell>
      <div className="mx-auto max-w-2xl px-5 py-6 md:px-8">
        <button onClick={voltar} className="text-[14px] text-brand-600 hover:underline">
          ← Voltar pra semana
        </button>

        <h1 className="mt-3 font-display text-[26px] text-ink-700">Cardápio da semana</h1>
        <p className="mt-1 text-[13px] text-warm-500">
          É isto que o portal mostra e cobra. O preço de cada item congela aqui e não muda depois,
          mesmo que o preço do produto mude.
        </p>

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
                  <li key={p.id} className="flex items-start justify-between text-warm-700">
                    <span>● {p.nome}</span>
                    <Preco p={p} entraNoCardapio={jaNoBanco.has(p.id)} />
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
                  <li
                    key={p.id}
                    className="flex items-center justify-between gap-3 rounded-md px-2 py-2 hover:bg-warm-100"
                  >
                    {/* O <label> cobre só o checkbox e o nome: se envolvesse a
                        linha inteira, clicar em "destaque" também alternaria a
                        marcação do item. */}
                    <label
                      className="flex flex-1 cursor-pointer items-center gap-3 text-warm-700"
                      style={{ minHeight: 44 }}
                    >
                      <input
                        type="checkbox"
                        checked={marcado(p.id)}
                        onChange={() => toggle(p.id)}
                        className="h-5 w-5 accent-brand-500"
                      />
                      {p.nome}
                    </label>
                    {marcado(p.id) && (
                      <button
                        type="button"
                        onClick={() => toggleDestaque(p.id)}
                        aria-pressed={destaqueId === p.id}
                        title={
                          destaqueId === p.id
                            ? 'É o destaque da semana. Clique pra tirar.'
                            : 'Usar como destaque da semana'
                        }
                        className={
                          destaqueId === p.id
                            ? 'h-8 shrink-0 rounded-md border border-brand-500 bg-brand-50 px-2 text-[12px] text-brand-600'
                            : 'h-8 shrink-0 rounded-md border border-warm-200 px-2 text-[12px] text-warm-400 hover:text-warm-700'
                        }
                      >
                        {destaqueId === p.id ? '★ destaque' : '☆ destacar'}
                      </button>
                    )}
                    <Preco p={p} entraNoCardapio={marcado(p.id)} />
                  </li>
                ))}
              </ul>
              <p className="mt-3 text-[11px] text-warm-400">
                O destaque é a estreia da semana — vira o hero da Home e do Cardápio no portal. Um
                por semana, e dá pra não ter nenhum.
              </p>
            </section>

            {erroPub && <p className="mt-4 text-[13px] text-danger-text">{erroPub}</p>}

            {confirmandoSemDestaque ? (
              <div className="mt-6 rounded-md border border-warm-300 bg-warm-100 p-4">
                <p className="text-[13px] text-warm-700">
                  Esta semana vai ao ar <strong>sem destaque</strong>: o portal mostra os itens sem
                  hero de novidade. É isso mesmo?
                </p>
                <div className="mt-3 flex justify-end gap-2">
                  <button
                    onClick={() => setConfirmandoSemDestaque(false)}
                    className="h-11 rounded-md px-3 text-warm-500 hover:text-warm-700"
                  >
                    Escolher um destaque
                  </button>
                  <button
                    onClick={publicar}
                    disabled={publicando}
                    className="h-11 rounded-md bg-brand-500 px-4 text-white hover:bg-brand-600 disabled:opacity-50"
                  >
                    Publicar sem destaque →
                  </button>
                </div>
              </div>
            ) : (
              <div className="mt-6 flex justify-end gap-2">
                <button
                  onClick={voltar}
                  className="h-11 rounded-md border border-warm-200 px-4 text-warm-600 hover:bg-warm-100"
                >
                  Cancelar
                </button>
                <button
                  onClick={aoClicarPublicar}
                  disabled={publicando}
                  className="h-11 rounded-md bg-brand-500 px-4 text-white hover:bg-brand-600 disabled:opacity-50"
                >
                  {publicando ? 'Publicando…' : 'Publicar →'}
                </button>
              </div>
            )}
          </>
        )}
      </div>
    </Shell>
  );
}
