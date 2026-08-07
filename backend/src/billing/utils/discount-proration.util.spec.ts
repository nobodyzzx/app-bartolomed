import { prorateDiscount } from './discount-proration.util';

const sum = (values: number[]) => Math.round(values.reduce((a, b) => a + b, 0) * 100) / 100;

describe('prorateDiscount', () => {
  it('reparte proporcionalmente al importe de cada línea', () => {
    const shares = prorateDiscount([{ gross: 100 }, { gross: 300 }], 40);

    expect(shares).toEqual([10, 30]);
  });

  it('la suma de las partes es EXACTAMENTE el descuento, aunque no divida entero', () => {
    // 10 / 3 líneas iguales: 3,33 + 3,33 + 3,33 = 9,99 si se redondea cada una.
    const shares = prorateDiscount([{ gross: 50 }, { gross: 50 }, { gross: 50 }], 10);

    expect(sum(shares)).toBe(10);
    expect(shares[2]).toBe(3.34); // la última absorbe el centavo sobrante
  });

  it.each([
    [[{ gross: 33.33 }, { gross: 66.67 }], 7.77],
    [[{ gross: 19.99 }, { gross: 0.01 }, { gross: 80 }], 13.13],
    [[{ gross: 45 }, { gross: 25 }, { gross: 80 }, { gross: 15 }], 33.33],
    [[{ gross: 7 }, { gross: 7 }, { gross: 7 }, { gross: 7 }, { gross: 7 }, { gross: 7 }], 5],
  ])('nunca pierde ni inventa centavos (caso %#)', (lines, discount) => {
    expect(sum(prorateDiscount(lines, discount))).toBe(discount);
  });

  it('ninguna línea queda descontada por encima de su propio importe', () => {
    // Descuento grande y líneas muy desiguales: el ajuste de la última podría
    // dejarla en negativo si no se derrama el excedente hacia atrás.
    const lines = [{ gross: 100 }, { gross: 1 }];
    const shares = prorateDiscount(lines, 100);

    shares.forEach((share, i) => expect(share).toBeLessThanOrEqual(lines[i].gross));
    expect(sum(shares)).toBe(100);
  });

  it('no descuenta más que el total, aunque se pida de más', () => {
    const shares = prorateDiscount([{ gross: 50 }, { gross: 50 }], 500);

    expect(sum(shares)).toBe(100);
  });

  it('ignora un descuento negativo', () => {
    expect(prorateDiscount([{ gross: 50 }], -20)).toEqual([0]);
  });

  it('devuelve ceros si no hay descuento', () => {
    expect(prorateDiscount([{ gross: 80 }, { gross: 45 }], 0)).toEqual([0, 0]);
  });

  it('no revienta con una lista vacía', () => {
    expect(prorateDiscount([], 50)).toEqual([]);
  });

  it('no revienta si todas las líneas son de importe cero', () => {
    expect(sum(prorateDiscount([{ gross: 0 }, { gross: 0 }], 10))).toBe(0);
  });

  it('el neto de cada línea nunca es negativo', () => {
    const lines = [{ gross: 80 }, { gross: 45 }, { gross: 25 }];
    const shares = prorateDiscount(lines, 149.99);

    lines.forEach((line, i) => expect(line.gross - shares[i]).toBeGreaterThanOrEqual(0));
  });
});
