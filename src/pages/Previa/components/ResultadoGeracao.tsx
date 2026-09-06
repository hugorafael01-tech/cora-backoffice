import { reais } from '../../../lib/previa';
import {
  ROTULO_STATUS,
  cestasDoGrupo,
  exigeResolucaoManual,
  ordenaResultados,
  paraEnviarAMao,
} from '../resultado';
import type { RespostaGeracao, ResultadoPagador, StatusGeracao } from '../types';

interface Props {
  resposta: RespostaGeracao;
}

/**
 * O que aconteceu na geração.
 *
 * Substitui a prévia depois de gerar, e não aparece ao lado dela: são duas
 * leituras do mesmo período e vê-las juntas convidaria a comparar linha a linha
 * quando o que importa agora é só o que deu errado.
 *
 * A ordem das seções segue o que exige alguém: resolução à mão, envio à mão,
 * depois o resto. O resumo fica no topo por ser a resposta à pergunta que traz
 * o Hugo aqui — "deu certo?".
 */
export function ResultadoGeracao({ resposta }: Props) {
  const { resumo, resultados, complemento, complemento_erro: complementoErro } = resposta;
  const emOrdem = ordenaResultados(resultados);
  const aResolver = emOrdem.filter(exigeResolucaoManual);
  const aEnviar = paraEnviarAMao(resultados);

  const total = resultados
    .filter((r) => r.status === 'criado' || r.status === 'rechamado')
    .reduce((s, r) => s + (r.valor ?? 0), 0);

  return (
    <div className="space-y-4 px-5 py-4 md:px-8">
      {/* ── O resumo ─────────────────────────────────────────────── */}
      <section className="rounded-lg border border-warm-200 bg-white px-4 py-3">
        <div className="flex flex-wrap items-baseline justify-between gap-3">
          <div>
            <div className="text-[12px] text-warm-500">
              {resumo.criados === 1 ? '1 cobrança criada' : `${resumo.criados} cobranças criadas`}
              {resumo.rechamados > 0 && ` · ${resumo.rechamados} refeitas`}
              {resumo.pulados > 0 && ` · ${resumo.pulados} já existiam`}
            </div>
            <div className="font-display text-[26px] leading-none tabular-nums text-ink-700">
              {reais(total)}
            </div>
          </div>
          <ul className="flex flex-wrap gap-2 text-[12px]">
            {resumo.erros > 0 && <Selo tom="danger">{resumo.erros} com erro</Selo>}
            {resumo.bloqueados > 0 && <Selo tom="warning">{resumo.bloqueados} bloqueados</Selo>}
            {resumo.erros === 0 && resumo.bloqueados === 0 && (
              <Selo tom="success">Sem erro nem bloqueio</Selo>
            )}
          </ul>
        </div>
      </section>

      {/* ── Resolução à mão: cobrança criada e não registrada ─────── */}
      {aResolver.length > 0 && (
        <section className="rounded-lg border border-danger-border bg-danger-bg px-4 py-3">
          <h2 className="text-[14px] font-semibold text-danger-text">
            Resolver à mão antes de gerar de novo
          </h2>
          <p className="mt-1 text-[13px] text-danger-text">
            A cobrança existe no Asaas e a fatura não guardou o id. Gerar de novo criaria uma
            segunda cobrança para a mesma pessoa.
          </p>
          <ul className="mt-2 space-y-2">
            {aResolver.map((r) => (
              <li key={r.pagadorId} className="text-[13px] text-danger-text">
                <span className="font-semibold">{r.pagador}</span>
                {r.asaasPaymentId && (
                  <>
                    {' · '}
                    <code className="rounded bg-white/60 px-1 py-0.5 font-mono text-[12px]">
                      {r.asaasPaymentId}
                    </code>
                  </>
                )}
                {r.erro && <div className="mt-0.5 opacity-90">{r.erro}</div>}
              </li>
            ))}
          </ul>
        </section>
      )}

      {/* ── Envio à mão ──────────────────────────────────────────── */}
      {aEnviar.length > 0 && (
        <section className="rounded-lg border border-info-border bg-info-bg px-4 py-3">
          <h2 className="text-[14px] font-semibold text-info-text">Enviar à mão</h2>
          <p className="mt-1 text-[13px] text-info-text">
            {aEnviar.length === 1 ? 'Esta pessoa não recebe' : 'Estas pessoas não recebem'} a
            cobrança por e-mail. A cobrança foi criada normalmente; só o envio é que não existe.
          </p>
          <ul className="mt-2 space-y-1">
            {aEnviar.map((r) => (
              <li key={r.pagadorId} className="text-[13px] text-info-text">
                <span className="font-semibold">{r.pagador}</span>
                {cestasDoGrupo(r) && ` · ${cestasDoGrupo(r)}`}
                {r.valor != null && ` · ${reais(r.valor)}`}
              </li>
            ))}
          </ul>
        </section>
      )}

      {/* ── Uma linha por pagador ────────────────────────────────── */}
      <section>
        <h2 className="text-[13px] font-semibold text-ink-700">Por pagador</h2>
        <ul className="mt-2 space-y-1">
          {emOrdem.map((r) => (
            <LinhaPagador key={r.pagadorId} r={r} />
          ))}
        </ul>
      </section>

      {/* ── Complemento ──────────────────────────────────────────── */}
      <section className="rounded-lg border border-warm-200 bg-warm-100 px-4 py-3">
        <h2 className="text-[13px] font-semibold text-ink-700">Linha digitável e Pix</h2>
        {complementoErro ? (
          <p className="mt-1 text-[13px] text-warm-600">
            A busca falhou: {complementoErro}. As cobranças foram criadas do mesmo jeito — só falta
            o dado de pagamento, e a próxima geração busca de novo.
          </p>
        ) : complemento ? (
          <p className="mt-1 text-[13px] text-warm-600">
            {complemento.resolvidos} de {complemento.pagamentos}{' '}
            {complemento.pagamentos === 1 ? 'cobrança preenchida' : 'cobranças preenchidas'} (
            {complemento.faturas} {complemento.faturas === 1 ? 'fatura' : 'faturas'}).
            {complemento.semDadoAinda > 0 &&
              ` ${complemento.semDadoAinda} ainda sem dado no Asaas — a próxima geração busca de novo.`}
            {complemento.erros > 0 && ` ${complemento.erros} não gravaram.`}
          </p>
        ) : (
          <p className="mt-1 text-[13px] text-warm-600">Nada a preencher.</p>
        )}
      </section>
    </div>
  );
}

/* ── peças ─────────────────────────────────────────────────────── */

const TOM_DO_STATUS: Record<StatusGeracao, 'success' | 'warning' | 'danger' | 'neutro'> = {
  criado: 'success',
  rechamado: 'success',
  pulado: 'neutro',
  bloqueado: 'warning',
  erro: 'danger',
};

function LinhaPagador({ r }: { r: ResultadoPagador }) {
  const cestas = cestasDoGrupo(r);
  return (
    <li className="flex flex-wrap items-baseline justify-between gap-2 rounded-md border border-warm-200 bg-white px-3 py-2">
      <div className="min-w-0">
        <div className="truncate text-[14px] text-ink-700">
          {r.pagador}
          {r.envioManual && <span className="ml-2 text-[12px] text-warm-500">enviar à mão</span>}
        </div>
        {cestas && <div className="text-[12px] text-warm-500">{cestas}</div>}
        {(r.motivo || r.erro) && (
          <div className="mt-0.5 text-[12px] text-warm-600">{r.erro ?? r.motivo}</div>
        )}
      </div>
      <div className="flex shrink-0 items-baseline gap-3">
        {r.valor != null && (
          <span className="text-[14px] tabular-nums text-ink-700">{reais(r.valor)}</span>
        )}
        <Selo tom={TOM_DO_STATUS[r.status]}>{ROTULO_STATUS[r.status]}</Selo>
      </div>
    </li>
  );
}

const CLASSE_DO_TOM = {
  success: 'border-success-border bg-success-bg text-success-text',
  warning: 'border-warning-border bg-warning-bg text-warning-text',
  danger: 'border-danger-border bg-danger-bg text-danger-text',
  info: 'border-info-border bg-info-bg text-info-text',
  neutro: 'border-warm-200 bg-warm-100 text-warm-600',
} as const;

function Selo({ tom, children }: { tom: keyof typeof CLASSE_DO_TOM; children: React.ReactNode }) {
  return (
    <span
      className={`inline-block rounded-full border px-2 py-0.5 text-[12px] ${CLASSE_DO_TOM[tom]}`}
    >
      {children}
    </span>
  );
}
