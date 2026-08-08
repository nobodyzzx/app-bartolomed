import { MedicationStock } from './pharmacy.entity';

/**
 * Los helpers de vencimiento se prueban aquí y no desde el servicio porque
 * viven en la entidad, y los specs de servicio la mockean entera: nunca
 * ejecutan estos métodos ni los hooks. El mismo agujero que dejó pasar en
 * facturación un `@BeforeUpdate` que deshacía lo que el servicio escribía.
 */
const makeStock = (overrides: Partial<MedicationStock> = {}): MedicationStock =>
  Object.assign(new MedicationStock(), {
    quantity: 10,
    reservedQuantity: 0,
    availableQuantity: 10,
    minimumStock: 5,
    expiryDate: null,
    ...overrides,
  });

const enDias = (dias: number) => new Date(Date.now() + dias * 24 * 60 * 60 * 1000);

describe('MedicationStock — vencimiento sin registrar', () => {
  // `new Date(null)` es la época Unix (1-1-1970), así que sin la guarda todo
  // lote sin fecha saldría vencido y la farmacia vería 475 alertas falsas.
  it('un lote sin fecha no está vencido', () => {
    expect(makeStock({ expiryDate: null }).isExpired()).toBe(false);
  });

  it('un lote sin fecha no está por vencer', () => {
    expect(makeStock({ expiryDate: null }).isExpiringSoon(30)).toBe(false);
  });

  it('sin fecha, los días hasta el vencimiento son null, no 0', () => {
    // Devolver 0 sería indistinguible de "vence hoy".
    expect(makeStock({ expiryDate: null }).getDaysUntilExpiry()).toBeNull();
  });

  it('con fecha sigue detectando el vencido', () => {
    expect(makeStock({ expiryDate: enDias(-1) }).isExpired()).toBe(true);
  });

  it('con fecha sigue detectando el próximo a vencer', () => {
    const stock = makeStock({ expiryDate: enDias(10) });
    expect(stock.isExpiringSoon(30)).toBe(true);
    expect(stock.isExpired()).toBe(false);
  });

  it('lo que vence más allá del plazo no cuenta como próximo', () => {
    expect(makeStock({ expiryDate: enDias(90) }).isExpiringSoon(30)).toBe(false);
  });
});

describe('MedicationStock — stock bajo', () => {
  it('avisa cuando lo disponible llega al mínimo', () => {
    expect(makeStock({ availableQuantity: 5, minimumStock: 5 }).isLowStock()).toBe(true);
  });

  it('no avisa por encima del mínimo', () => {
    expect(makeStock({ availableQuantity: 6, minimumStock: 5 }).isLowStock()).toBe(false);
  });
});

describe('MedicationStock — cantidad disponible', () => {
  it('el hook descuenta lo reservado', () => {
    const stock = makeStock({ quantity: 40, reservedQuantity: 15, availableQuantity: 0 });
    stock.calculateAvailableQuantity();
    expect(stock.availableQuantity).toBe(25);
  });
});
