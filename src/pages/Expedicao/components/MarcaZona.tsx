import type { FormaZona, Zona } from '../../../lib/zonas';

/**
 * Marca de zona: forma preenchida com a cor da zona + o codigo ao lado.
 *
 * A FORMA carrega a informacao e a COR e complementar — a impressora de hoje e
 * colorida, a proxima sera termica monocromatica. Por isso toda forma leva
 * contorno preto: em preto e branco o preenchimento vira cinza mas a silhueta e
 * o codigo continuam legiveis, e o layout nao precisa ser redesenhado na troca.
 *
 * O codigo fica AO LADO (nao dentro): dentro ele dependeria do contraste contra
 * a cor de cada zona, que e editavel no banco — texto preto sobre o papel nao
 * depende de nada.
 *
 * `zona` null = entrega sem zona no cadastro: forma tracejada e '—', pra faltar
 * de forma visivel em vez de silenciosa.
 */
export function MarcaZona({
  zona,
  tamanho = 20,
  className = '',
}: {
  zona: Zona | null;
  tamanho?: number;
  className?: string;
}) {
  return (
    <span className={`marca-zona inline-flex items-center gap-1 ${className}`}>
      <svg
        width={tamanho}
        height={tamanho}
        viewBox="0 0 24 24"
        aria-hidden="true"
        className="flex-shrink-0"
      >
        {zona ? (
          <FormaSvg forma={zona.forma} fill={zona.corHex} />
        ) : (
          <rect
            x="2.5"
            y="2.5"
            width="19"
            height="19"
            fill="none"
            stroke="currentColor"
            strokeWidth="1.5"
            strokeDasharray="3 2.5"
          />
        )}
      </svg>
      <span className="font-bold leading-none tabular-nums">{zona ? zona.codigo : '—'}</span>
    </span>
  );
}

/** Contorno preto sempre: e o que sobrevive a impressao monocromatica. */
function FormaSvg({ forma, fill }: { forma: FormaZona; fill: string }) {
  const traco = { fill, stroke: 'currentColor', strokeWidth: 1.5, strokeLinejoin: 'round' as const };
  switch (forma) {
    case 'triangulo':
      return <polygon points="12,2.5 22,20 2,20" {...traco} />;
    case 'quadrado':
      return <rect x="2.5" y="2.5" width="19" height="19" {...traco} />;
    case 'losango':
      return <polygon points="12,1.5 22.5,12 12,22.5 1.5,12" {...traco} />;
    case 'hexagono':
      return <polygon points="12,1.5 21,6.75 21,17.25 12,22.5 3,17.25 3,6.75" {...traco} />;
    case 'circulo':
    default:
      return <circle cx="12" cy="12" r="9.75" {...traco} />;
  }
}
