import { Component, DestroyRef, inject } from '@angular/core'
import { takeUntilDestroyed } from '@angular/core/rxjs-interop'
import { Router } from '@angular/router'
import { AlertService } from '@core/services/alert.service'
import { debounceTime, distinctUntilChanged, Subject, switchMap } from 'rxjs'
import { Patient } from '../patients/interfaces/patient.interface'
import { PatientsService } from '../patients/services/patients.service'
import { openPdfInNewTab } from '../../../../shared/utils/pdf-viewer.util'
import {
  Charge,
  ChargeOrigin,
  CheckoutPayload,
  CheckoutService,
  DiscountDisplay,
  ORIGIN_LABELS,
  PAYMENT_METHODS,
} from './checkout.service'
import {
  ServiceCategory,
  ServicePriceCatalogItem,
  ServicePricesService,
} from '../service-prices/service-prices.service'

/** Fila de la tabla de cobro: el cargo más lo que el cajero decida sobre él. */
interface CheckoutLine {
  charge: Charge
  selected: boolean
  discount: number
  reason: string
}

@Component({
  selector: 'app-checkout',
  templateUrl: './checkout.component.html',
  standalone: false,
})
export class CheckoutComponent {
  private readonly destroyRef = inject(DestroyRef)
  private readonly searchTerm$ = new Subject<string>()

  readonly DiscountDisplay = DiscountDisplay
  readonly originLabels = ORIGIN_LABELS
  readonly paymentMethods = PAYMENT_METHODS

  search = ''
  results: Patient[] = []
  searching = false

  patient: Patient | null = null
  lines: CheckoutLine[] = []
  loadingAccount = false

  globalDiscount = 0
  globalDiscountReason = ''
  discountDisplay: DiscountDisplay = DiscountDisplay.ITEMIZED

  paymentMethod = 'cash'
  paymentAmount: number | null = null
  paymentReference = ''

  processing = false

  // --- Cargo suelto: lo que no viene de una consulta ni de una orden ---
  catalog: ServicePriceCatalogItem[] = []
  newChargeId = ''
  newChargeQty = 1
  addingCharge = false

  constructor(
    private checkoutService: CheckoutService,
    private patientsService: PatientsService,
    private alert: AlertService,
    private router: Router,
    private servicePrices: ServicePricesService,
  ) {
    this.searchTerm$
      .pipe(
        debounceTime(300),
        distinctUntilChanged(),
        switchMap(term => {
          this.searching = true
          return this.patientsService.searchPatients(term)
        }),
        takeUntilDestroyed(this.destroyRef),
      )
      .subscribe({
        next: patients => {
          this.results = patients
          this.searching = false
        },
        error: () => {
          this.searching = false
        },
      })

    // El tarifario completo: son decenas de filas, se carga una vez al abrir.
    this.servicePrices
      .catalog()
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: catalog => (this.catalog = catalog),
        error: () => (this.catalog = []),
      })
  }

  onSearchChange(term: string): void {
    if (term.trim().length < 2) {
      this.results = []
      return
    }
    this.searchTerm$.next(term.trim())
  }

  /** Categoría del tarifario → origen del cargo, para que la cuenta lo etiquete igual. */
  private originForCategory(category: ServiceCategory): ChargeOrigin {
    if (category === ServiceCategory.CONSULTATION) return ChargeOrigin.CONSULTATION
    if (category === ServiceCategory.LABORATORY) return ChargeOrigin.LABORATORY
    return ChargeOrigin.OTHER
  }

  get newChargeSelected(): ServicePriceCatalogItem | undefined {
    return this.catalog.find(item => item.id === this.newChargeId)
  }

  get canAddCharge(): boolean {
    return !!this.patient && !!this.newChargeSelected && this.newChargeQty > 0 && !this.addingCharge
  }

  addCharge(): void {
    const chosen = this.newChargeSelected
    if (!this.patient || !chosen || !this.canAddCharge) return

    this.addingCharge = true
    this.checkoutService
      .addCharge({
        patientId: this.patient.id!,
        patientName: `${this.patient.firstName ?? ''} ${this.patient.lastName ?? ''}`.trim(),
        origin: this.originForCategory(chosen.category),
        servicePriceId: chosen.id,
        description: chosen.name,
        quantity: this.newChargeQty,
        listPrice: chosen.price,
      })
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: () => {
          this.addingCharge = false
          this.newChargeId = ''
          this.newChargeQty = 1
          this.loadAccount()
        },
        error: () => (this.addingCharge = false),
      })
  }

  selectPatient(patient: Patient): void {
    this.patient = patient
    this.results = []
    this.search = ''
    this.loadAccount()
  }

  clearPatient(): void {
    this.patient = null
    this.lines = []
    this.resetDiscounts()
  }

  loadAccount(): void {
    if (!this.patient) return
    this.loadingAccount = true

    this.checkoutService
      .getAccount(this.patient.id!)
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: account => {
          this.lines = account.items.map(charge => ({
            charge,
            selected: true,
            discount: 0,
            reason: '',
          }))
          this.resetDiscounts()
          this.paymentAmount = this.totalToCharge
          this.loadingAccount = false
        },
        error: () => {
          this.loadingAccount = false
        },
      })
  }

  // ─── totales ──────────────────────────────────────────────────────────────

  get selectedLines(): CheckoutLine[] {
    return this.lines.filter(l => l.selected)
  }

  get subtotal(): number {
    return this.round(this.selectedLines.reduce((sum, l) => sum + l.charge.quantity * l.charge.listPrice, 0))
  }

  get lineDiscountTotal(): number {
    return this.round(this.selectedLines.reduce((sum, l) => sum + (Number(l.discount) || 0), 0))
  }

  get discountTotal(): number {
    return this.round(this.lineDiscountTotal + (Number(this.globalDiscount) || 0))
  }

  get totalToCharge(): number {
    return this.round(Math.max(0, this.subtotal - this.discountTotal))
  }

  /** El descuento no puede superar lo que se está cobrando. */
  get discountExceedsTotal(): boolean {
    return this.discountTotal > this.subtotal
  }

  get missingLineReason(): boolean {
    return this.selectedLines.some(l => Number(l.discount) > 0 && !l.reason.trim())
  }

  get missingGlobalReason(): boolean {
    return Number(this.globalDiscount) > 0 && !this.globalDiscountReason.trim()
  }

  get canSubmit(): boolean {
    return (
      this.selectedLines.length > 0 &&
      !this.discountExceedsTotal &&
      !this.missingLineReason &&
      !this.missingGlobalReason &&
      !this.processing
    )
  }

  /**
   * Por qué no se puede cobrar todavía, en texto; `null` si se puede.
   *
   * El botón se deshabilitaba en silencio: al poner un descuento sin motivo
   * quedaba gris y no había nada que lo explicara. El `<mat-error>` del motivo
   * global tampoco servía —`mat-error` solo se pinta cuando el campo está en
   * estado de error, y con `ngModel` sin validadores eso no ocurre nunca—, y el
   * descuento por línea solo teñía el borde de rojo, en una tabla que puede
   * quedar lejos del botón.
   */
  get blockingReason(): string | null {
    if (this.processing) return null
    if (this.selectedLines.length === 0) return 'Marca al menos un cargo para cobrar.'
    if (this.discountExceedsTotal) {
      return 'El descuento supera el importe de los cargos seleccionados.'
    }
    if (this.missingLineReason) {
      return 'Falta el motivo de un descuento de la tabla. Un descuento sin motivo no se puede registrar.'
    }
    if (this.missingGlobalReason) {
      return 'Falta el motivo del descuento sobre el total.'
    }
    return null
  }

  toggleAll(selected: boolean): void {
    this.lines.forEach(l => (l.selected = selected))
    this.paymentAmount = this.totalToCharge
  }

  onAmountsChanged(): void {
    this.paymentAmount = this.totalToCharge
  }

  // ─── cobro ────────────────────────────────────────────────────────────────

  async submit(): Promise<void> {
    if (!this.canSubmit) return

    const paying = Number(this.paymentAmount) || 0
    const partial = paying > 0 && paying < this.totalToCharge

    const result = await this.alert.fire({
      icon: 'question',
      title: '¿Confirmar el cobro?',
      html: this.confirmationHtml(paying, partial),
      showCancelButton: true,
      confirmButtonText: 'Cobrar',
      cancelButtonText: 'Cancelar',
    })
    if (!result.isConfirmed) return

    this.processing = true
    this.checkoutService
      .checkout(this.buildPayload(paying))
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: invoice => {
          this.processing = false
          this.offerReceipt(invoice.id, invoice.invoiceNumber)
          this.loadAccount()
        },
        error: () => {
          this.processing = false
        },
      })
  }

  private buildPayload(paying: number): CheckoutPayload {
    const lineDiscounts = this.selectedLines
      .filter(l => Number(l.discount) > 0)
      .map(l => ({ chargeId: l.charge.id, amount: Number(l.discount), reason: l.reason.trim() }))

    return {
      chargeIds: this.selectedLines.map(l => l.charge.id),
      ...(lineDiscounts.length ? { lineDiscounts } : {}),
      ...(Number(this.globalDiscount) > 0
        ? {
            globalDiscount: {
              amount: Number(this.globalDiscount),
              reason: this.globalDiscountReason.trim(),
            },
          }
        : {}),
      discountDisplay: this.discountDisplay,
      ...(paying > 0
        ? {
            payment: {
              method: this.paymentMethod,
              amount: paying,
              ...(this.paymentReference.trim() ? { reference: this.paymentReference.trim() } : {}),
            },
          }
        : {}),
    }
  }

  /** Formato es-BO, igual que el resto de la pantalla (coma decimal). */
  private bs(value: number): string {
    return `Bs ${value.toLocaleString('es-BO', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`
  }

  private confirmationHtml(paying: number, partial: boolean): string {
    const rows = [
      `<p><strong>Total a cobrar:</strong> ${this.bs(this.totalToCharge)}</p>`,
      this.discountTotal > 0
        ? `<p><strong>Descuento:</strong> ${this.bs(this.discountTotal)} — se imprimirá ${
            this.discountDisplay === DiscountDisplay.ITEMIZED
              ? 'desglosado en el recibo'
              : 'absorbido en el precio, sin aparecer en el recibo'
          }</p>`
        : '',
      `<p><strong>Paga ahora:</strong> ${this.bs(paying)}</p>`,
      partial ? `<p>Queda un saldo de ${this.bs(this.totalToCharge - paying)}</p>` : '',
    ]
    return rows.filter(Boolean).join('')
  }

  private async offerReceipt(invoiceId: string, invoiceNumber: string): Promise<void> {
    const result = await this.alert.fire({
      icon: 'success',
      title: `Cobro registrado (${invoiceNumber})`,
      text: '¿Deseas descargar el recibo?',
      showCancelButton: true,
      confirmButtonText: 'Descargar recibo',
      cancelButtonText: 'Ahora no',
    })
    if (result.isConfirmed) this.downloadReceipt(invoiceId, invoiceNumber)
  }

  private downloadReceipt(invoiceId: string, invoiceNumber: string): void {
    this.checkoutService
      .downloadReceipt(invoiceId, this.discountDisplay)
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: blob => openPdfInNewTab(blob, `${invoiceNumber}.pdf`),
      })
  }

  private resetDiscounts(): void {
    this.globalDiscount = 0
    this.globalDiscountReason = ''
    this.lines.forEach(l => {
      l.discount = 0
      l.reason = ''
    })
  }

  private round(value: number): number {
    return Math.round((value + Number.EPSILON) * 100) / 100
  }

  patientLabel(patient: Patient): string {
    return `${patient.firstName} ${patient.lastName}`
  }

  goBack(): void {
    this.router.navigate(['/dashboard'])
  }
}
