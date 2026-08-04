import { enderecoCompleto, resumoItens, type EntregaLite } from '../../../lib/expedicao';

/**
 * Vista de impressao das etiquetas: escondida na tela (`hidden`), visivel so no
 * print (`print:block`). A geometria da folha (PIMACO 6183 / Avery 5163) e
 * definida em mm pela regra @media print .etiquetas-print em index.css — as
 * classes aqui cuidam so de tipografia e conteudo. Uma etiqueta por entrega:
 * nome / itens / endereco completo / whatsapp / observacao.
 *
 * A ordem privilegia a montagem dos pacotes: nome + itens sao o par lido de
 * relance na bancada, entao vem primeiro e em corpo maior (22px / 17px).
 * Endereco e whatsapp servem ao entregador, que ja leva a rota impressa.
 */
export function EtiquetasPrint({ entregas }: { entregas: EntregaLite[] }) {
  return (
    <div className="etiquetas-print hidden print:block">
      <div className="etiquetas-grid">
        {entregas.map((e) => {
          const resumo = resumoItens(e.itens);
          return (
            <div key={e.id} className="etiqueta text-[12px] text-black">
              <div className="text-[22px] font-bold leading-tight">{e.nome}</div>
              <div className="mt-1 text-[17px] font-semibold leading-snug">
                {resumo || 'sem itens'}
              </div>
              <div className="mt-1.5 border-t border-black/20 pt-1.5 leading-snug">
                {enderecoCompleto(e)}
              </div>
              {e.whatsapp && <div className="mt-1">WhatsApp: {e.whatsapp}</div>}
              {e.observacao && e.observacao.trim() && (
                <div className="mt-1 text-[11px] italic">Obs.: {e.observacao.trim()}</div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}
