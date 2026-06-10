interface Props {
  sucesso: string | null;
}

/**
 * Banner do topo: info "sem assinante" (default) ou sucesso pos-criacao.
 * O acompanhamento (fatia 2) ainda nao existe, entao o sucesso nao linka pra la.
 */
export function BannerProducao({ sucesso }: Props) {
  if (sucesso) {
    return (
      <div className="mx-5 mt-4 rounded-md border border-success-border bg-success-bg px-4 py-3 text-[13px] text-success-text md:mx-8">
        <strong className="font-semibold">{sucesso}</strong> Etapas geradas (autólise até cocção).
      </div>
    );
  }

  return (
    <div className="mx-5 mt-4 rounded-md border border-brand-200 bg-brand-50 px-4 py-3 text-[13px] text-brand-700 md:mx-8">
      <span className="mr-2 text-[11px] uppercase tracking-[0.06em] text-brand-500">
        sem assinante
      </span>
      Você define o volume da semana na mão. Quando entrar cliente, os{' '}
      <strong className="font-semibold text-brand-800">pedidos</strong> populam aqui e a forma não muda.
    </div>
  );
}
