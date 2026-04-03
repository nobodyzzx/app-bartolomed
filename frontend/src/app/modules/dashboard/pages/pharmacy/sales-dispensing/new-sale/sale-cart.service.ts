import { computed, Injectable, signal } from '@angular/core'
import { MedicationStock } from '../../interfaces/pharmacy.interfaces'

/** Ítem en el carrito de venta (modelo UI, distinto de SaleItem del API) */
export interface CartItem {
  medicationStock: MedicationStock
  quantity: number
  unitPrice: number
  discountPercent: number
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
        s.medication?.name?.toLowerCase().includes(term) ||
        s.batchNumber?.toLowerCase().includes(term) ||
        s.medication?.activeIngredients?.toLowerCase().includes(term),
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
    discountPercent: number,
  ): string | null {
    const availableQty = stock.availableQuantity || 0
    const existingIndex = this._items().findIndex(it => it.medicationStock.id === stock.id)

    if (existingIndex >= 0) {
      const existing = this._items()[existingIndex]
      const newQuantity = existing.quantity + quantity

      const cap = Math.min(newQuantity, availableQty)
      const discountAmount = (cap * existing.unitPrice * existing.discountPercent) / 100
      const subtotal = cap * existing.unitPrice - discountAmount
      this._items.update(items =>
        items.map((it, i) => (i === existingIndex ? { ...it, quantity: cap, subtotal } : it)),
      )

      if (newQuantity > availableQty) {
        return `Stock insuficiente: se ajustó a ${cap} unidades (máx ${availableQty})`
      }
      return null
    }

    const take = Math.min(quantity, availableQty)
    if (take <= 0) return `Stock insuficiente (${availableQty} disponibles)`

    const discountAmount = (take * unitPrice * discountPercent) / 100
    const subtotal = take * unitPrice - discountAmount
    this._items.update(items => [
      ...items,
      { medicationStock: stock, quantity: take, unitPrice, discountPercent, subtotal },
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

    const discountAmount = (newQuantity * item.unitPrice * item.discountPercent) / 100
    const subtotal = newQuantity * item.unitPrice - discountAmount
    this._items.update(items =>
      items.map((it, i) => (i === index ? { ...it, quantity: newQuantity, subtotal } : it)),
    )
    return null
  }

  /** Retorna mensaje de error o null en caso de éxito */
  updateDiscount(index: number, discountPercent: number): string | null {
    const item = this._items()[index]
    if (!item) return 'Ítem no encontrado'

    const discountAmount = (item.quantity * item.unitPrice * discountPercent) / 100
    const subtotal = item.quantity * item.unitPrice - discountAmount
    this._items.update(items =>
      items.map((it, i) => (i === index ? { ...it, discountPercent, subtotal } : it)),
    )
    return null
  }

  clear(): void {
    this._items.set([])
    this._stocks.set([])
    this.searchTerm.set('')
  }
}
