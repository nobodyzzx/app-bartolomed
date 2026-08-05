/**
 * Reparte un descuento aplicado **sobre el total** entre las líneas que lo
 * componen.
 *
 * Hace falta porque el recibo tiene que cuadrar siempre: si el descuento se
 * imprime absorbido en el precio unitario (modo `absorbed`), cada línea debe
 * llevar su parte, y la suma de las partes tiene que dar **exactamente** el
 * descuento otorgado. Un `round()` por línea no lo garantiza — los centavos
 * sobrantes se pierden o se duplican — así que la última línea recibe el
 * remanente en lugar de su cuota redondeada.
 */
export interface ProrationLine {
  /** Importe bruto de la línea (cantidad × precio de lista). */
  gross: number;
}

export function prorateDiscount(lines: ProrationLine[], discount: number): number[] {
  if (lines.length === 0) return [];

  const totalGross = lines.reduce((sum, l) => sum + l.gross, 0);
  const cappedDiscount = Math.min(Math.max(discount, 0), totalGross);

  // Sin base sobre la que repartir, el descuento no puede aplicarse.
  if (totalGross <= 0 || cappedDiscount === 0) return lines.map(() => 0);

  const shares = lines.map(l => round2((cappedDiscount * l.gross) / totalGross));

  // El remanente va a la última línea con importe: así la suma de las partes
  // es exactamente el descuento, sin centavos perdidos por redondeo.
  const lastIndex = findLastIndexWithGross(lines);
  const allocatedExceptLast = shares.reduce((sum, share, i) => (i === lastIndex ? sum : sum + share), 0);
  shares[lastIndex] = round2(cappedDiscount - allocatedExceptLast);

  // El ajuste podría dejar la última línea por encima de su propio bruto
  // (descuentos grandes sobre líneas muy desiguales). En ese caso se derrama
  // el excedente hacia atrás, para que ninguna línea quede en negativo.
  spillOverflowBackwards(lines, shares, lastIndex);

  return shares;
}

function findLastIndexWithGross(lines: ProrationLine[]): number {
  for (let i = lines.length - 1; i >= 0; i--) {
    if (lines[i].gross > 0) return i;
  }
  return lines.length - 1;
}

function spillOverflowBackwards(lines: ProrationLine[], shares: number[], fromIndex: number): void {
  for (let i = fromIndex; i >= 0; i--) {
    const overflow = round2(shares[i] - lines[i].gross);
    if (overflow <= 0) continue;

    shares[i] = lines[i].gross;
    const previous = findPreviousIndexWithRoom(lines, shares, i);
    if (previous === -1) return; // No hay dónde ponerlo: ya está todo al tope.
    shares[previous] = round2(shares[previous] + overflow);
  }
}

function findPreviousIndexWithRoom(lines: ProrationLine[], shares: number[], fromIndex: number): number {
  for (let i = fromIndex - 1; i >= 0; i--) {
    if (shares[i] < lines[i].gross) return i;
  }
  return -1;
}

export function round2(value: number): number {
  return Math.round((value + Number.EPSILON) * 100) / 100;
}
