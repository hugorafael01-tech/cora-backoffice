import { reais, type GrupoPagador, type LinhaAssinatura } from '../../../lib/previa';
import { ExtrasDetalhe } from './ExtrasDetalhe';

const ROTULO_FORMA: Record<string, string> = {
  boleto: 'Boleto',
  pix: 'Pix',
  boleto_pix: 'Boleto ou Pix',
  cartao: 'Cartão',
};

interface Props {
  grupo: GrupoPagador;
}

/**
 * Um card por pagador. Dentro, uma linha por assinatura.
 *
 * A hierarquia só aparece quando existe: 25 dos 27 pagam só a própria cesta, e
 * nesses o card mostra uma assinatura só, sem nome repetido nem moldura extra.
 * Nos dois pares (Aldina e Sabina) as duas cestas aparecem sob um total só, que
 * é justamente o que o Hugo confere contra o valor único do Asaas.
 */
export function GrupoCard({ grupo }: Props) {
  const sozinha = grupo.assinaturas.length === 1;

  return (
    <li className="rounded-lg border border-warm-200 bg-white px-4 py-3">
      <div className="flex items-baseline justify-between gap-3">
        <div className="min-w-0">
          <div className="truncate text-[15px] font-semibold text-ink-700">
            {grupo.pagadorNome}
          </div>
          <div className="text-[12px] text-warm-500">
            {grupo.formaPagamento
              ? ROTULO_FORMA[grupo.formaPagamento] ?? grupo.formaPagamento
              : 'Sem forma de pagamento'}
            {!sozinha && ` · paga ${grupo.assinaturas.length} cestas`}
          </div>
        </div>
        <div className="shrink-0 font-display text-[22px] leading-none tabular-nums text-ink-700">
          {reais(grupo.total)}
        </div>
      </div>

      <div className={sozinha ? 'mt-2' : 'mt-3 space-y-3'}>
        {grupo.assinaturas.map((a) => (
          <LinhaCesta key={a.subscriptionId} linha={a} mostrarNome={!sozinha} />
        ))}
      </div>
    </li>
  );
}

function LinhaCesta({ linha, mostrarNome }: { linha: LinhaAssinatura; mostrarNome: boolean }) {
  return (
    <div className={mostrarNome ? 'border-l-2 border-warm-200 pl-3' : ''}>
      {mostrarNome && (
        <div className="flex items-baseline justify-between gap-3">
          <span className="truncate text-[14px] text-ink-700">{linha.nome}</span>
          <span className="shrink-0 text-[14px] tabular-nums text-ink-700">
            {reais(linha.total)}
          </span>
        </div>
      )}

      <dl className="mt-1 space-y-0.5 text-[13px]">
        <Verba
          rotulo={linha.proporcional ? 'Assinatura (proporcional)' : 'Assinatura'}
          valor={linha.mensalidade}
        />
        {linha.ajuste > 0 && <Verba rotulo="Ajuste de mudança de plano" valor={linha.ajuste} />}
        <Verba rotulo="Extras" valor={linha.totalExtras} />
      </dl>

      <div className="mt-1.5">
        <ExtrasDetalhe extras={linha.extras} />
      </div>
    </div>
  );
}

function Verba({ rotulo, valor }: { rotulo: string; valor: number }) {
  return (
    <div className="flex items-baseline justify-between gap-3">
      <dt className="text-warm-500">{rotulo}</dt>
      <dd className="shrink-0 tabular-nums text-warm-600">{reais(valor)}</dd>
    </div>
  );
}
