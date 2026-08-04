import { resumoItens, type EntregaLite } from '../../../lib/expedicao';

/**
 * Vista de impressao das etiquetas: escondida na tela (`hidden`), visivel so no
 * print (`print:block`). A geometria da folha (PIMACO 6183 / Avery 5163) e
 * definida em mm pela regra @media print .etiquetas-print em index.css — as
 * classes aqui cuidam so de tipografia e conteudo. Uma etiqueta por entrega:
 * nome / itens / endereco / observacao.
 *
 * A ordem privilegia a montagem dos pacotes: nome + itens sao o par lido de
 * relance na bancada, entao vem primeiro e em corpo maior (22px / 17px). O
 * endereco vem em dois corpos porque quem entrega procura rua, numero e
 * complemento (15px); bairro, cidade e CEP sao so contexto (11px).
 *
 * O telefone do assinante NAO entra na etiqueta, que viaja colada no pacote e
 * fica exposta na portaria e no elevador (decisao do Hugo, 04/08). Contato de
 * assinante nao circula fora da Cora: nao adicionar aqui, nem na rota
 * (linhaRota / textoRota), nem em nenhum texto exportado.
 *
 * O endereco e composto campo a campo aqui em vez de usar enderecoCompleto(),
 * que devolve uma string unica e segue servindo a linha expandida na tela.
 */
export function EtiquetasPrint({ entregas }: { entregas: EntregaLite[] }) {
  return (
    <div className="etiquetas-print hidden print:block">
      <div className="etiquetas-grid">
        {entregas.map((e) => {
          const resumo = resumoItens(e.itens);
          const logradouro = [e.rua, e.numero, e.complemento]
            .filter((x) => x && String(x).trim())
            .join(', ');
          const contexto = [
            [e.bairro, e.cidade].filter(Boolean).join(' - '),
            e.cep ? `CEP ${e.cep}` : '',
          ]
            .filter(Boolean)
            .join(' · ');
          return (
            <div key={e.id} className="etiqueta text-[12px] text-black">
              <div className="text-[22px] font-bold leading-tight">{e.nome}</div>
              <div className="mt-1 text-[17px] font-semibold leading-snug">
                {resumo || 'sem itens'}
              </div>
              <div className="mt-1.5 border-t border-black/20 pt-1.5">
                <div className="text-[15px] leading-snug">{logradouro}</div>
                {contexto && <div className="mt-0.5 text-[11px] leading-snug">{contexto}</div>}
              </div>
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
