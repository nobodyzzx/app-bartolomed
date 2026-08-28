import { computed, Injectable, signal } from '@angular/core'
import { MedicationStock } from '../../interfaces/pharmacy.interfaces'
import { matchesSearch } from '../../../../../../shared/utils/text-search.util'

/** Ítem en el carrito de venta (modelo UI, distinto de SaleItem del API) */
export interface CartItem {
  medicationStock: MedicationStock
  quantity: number
  unitPrice: number
  /** Rebaja de esta línea en bolivianos enteros (no un porcentaje). */
  discountAmount: number
  /** Obligatorio si hay descuento: el backend rechaza una rebaja sin motivo. */
  discountReason: string
  subtotal: number
}

/**
 * Servicio de carrito de venta (scope de componente).
 * Proveer en el componente: providers: [SaleCartService]
 * No usar providedIn: 'root' — el estado debe reiniciarse con cada nueva venta.
 */
@Injectable()
export class SaleCartService {
  private readonly _items = signal<CartItem[]>([])
  private readonly _stocks = signal<MedicationStock[]>([])

  readonly items = this._items.asReadonly()
  readonly stocks = this._stocks.asReadonly()
  readonly searchTerm = signal<string>('')

  readonly filteredStocks = computed(() => {
    const term = this.searchTerm().toLowerCase()
    if (!term) return this._stocks()
    return this._stocks().filter(
      s =>
        matchesSearch(term, s.medication?.name, s.batchNumber, s.medication?.activeIngredients),
    )
  })

  readonly subtotal = computed(() => this._items().reduce((sum, it) => sum + it.subtotal, 0))
  readonly totalUnits = computed(() => this._items().reduce((sum, it) => sum + it.quantity, 0))

  setStocks(stocks: MedicationStock[]): void {
    this._stocks.set(stocks)
  }

  /**
   * Agrega o suma cantidad al ítem del carrito.
   * Retorna mensaje de error si el stock es insuficiente, null en caso de éxito.
   */
  addOrUpdate(
    stock: MedicationStock,
    quantity: number,
    unitPrice: number,
    discountAmount: number,
  ): string | null {
    const availableQty = stock.availableQuantity || 0
    const existingIndex = this._items().findIndex(it => it.medicationStock.id === stock.id)

    if (existingIndex >= 0) {
      const existing = this._items()[existingIndex]
      const newQuantity = existing.quantity + quantity

      const cap = Math.min(newQuantity, availableQty)
      // La rebaja es un importe plano en Bs, no un porcentaje: no escala con
      // la cantidad. Solo se tope para que el subtotal no quede negativo si
      // la línea terminó más chica que el descuento ya cargado.
      const cappedDiscount = Math.min(existing.discountAmount, cap * existing.unitPrice)
      const subtotal = cap * existing.unitPrice - cappedDiscount
      this._items.update(items =>
        items.map((it, i) =>
          i === existingIndex ? { ...it, quantity: cap, discountAmount: cappedDiscount, subtotal } : it,
        ),
      )

      if (newQuantity > availableQty) {
        return `Stock insuficiente: se ajustó a ${cap} unidades (máx ${availableQty})`
      }
      return null
    }

    const take = Math.min(quantity, availableQty)
    if (take <= 0) return `Stock insuficiente (${availableQty} disponibles)`

    const cappedDiscount = Math.min(discountAmount, take * unitPrice)
    const subtotal = take * unitPrice - cappedDiscount
    this._items.update(items => [
      ...items,
      { medicationStock: stock, quantity: take, unitPrice, discountAmount: cappedDiscount, discountReason: '', subtotal },
    ])
    return null
  }

  removeItem(index: number): void {
    this._items.update(items => items.filter((_, i) => i !== index))
  }

  /** Retorna mensaje de error o null en caso de éxito */
  updateQuantity(index: number, newQuantity: number): string | null {
    const item = this._items()[index]
    if (!item) return 'Ítem no encontrado'
    const availableQty = item.medicationStock.availableQuantity || 0
    if (newQuantity > availableQty) return `Solo hay ${availableQty} unidades disponibles`

    const cappedDiscount = Math.min(item.discountAmount, newQuantity * item.unitPrice)
    const subtotal = newQuantity * item.unitPrice - cappedDiscount
    this._items.update(items =>
      items.map((it, i) =>
        i === index ? { ...it, quantity: newQuantity, discountAmount: cappedDiscount, subtotal } : it,
      ),
    )
    return null
  }

  /** Retorna mensaje de error o null en caso de éxito */
  updateReason(index: number, discountReason: string): void {
    this._items.update(items =>
      items.map((it, i) => (i === index ? { ...it, discountReason } : it)),
    )
  }

  /** Cuántas líneas tienen descuento sin justificar; bloquea el registro. */
  readonly linesMissingReason = computed(
    () => this._items().filter(it => it.discountAmount > 0 && !it.discountReason.trim()).length,
  )

  /** Tope al importe de la línea: un descuento no puede volverla negativa. */
  updateDiscount(index: number, discountAmount: number): string | null {
    const item = this._items()[index]
    if (!item) return 'Ítem no encontrado'

    const lineTotal = item.quantity * item.unitPrice
    const cappedDiscount = Math.min(Math.max(0, discountAmount), lineTotal)
    const subtotal = lineTotal - cappedDiscount
    this._items.update(items =>
      items.map((it, i) => (i === index ? { ...it, discountAmount: cappedDiscount, subtotal } : it)),
    )
    return null
  }

  clear(): void {
    this._items.set([])
    this._stocks.set([])
    this.searchTerm.set('')
  }
}
