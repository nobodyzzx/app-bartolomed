import { Component, DestroyRef, inject } from '@angular/core'
import { takeUntilDestroyed } from '@angular/core/rxjs-interop'
import { Router } from '@angular/router'
import { AlertService } from '@core/services/alert.service'
import { debounceTime, distinctUntilChanged, Subject, switchMap } from 'rxjs'
import { Patient } from '../patients/interfaces/patient.interface'
import { PatientsService } from '../patients/services/patients.service'
import {
  Charge,
  CheckoutPayload,
  CheckoutService,
  DiscountDisplay,
  ORIGIN_LABELS,
  PAYMENT_METHODS,
} from './checkout.service'

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

  constructor(
    private checkoutService: CheckoutService,
    private patientsService: PatientsService,
    private alert: AlertService,
    private router: Router,
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
  }

  onSearchChange(term: string): void {
    if (term.trim().length < 2) {
      this.results = []
      return
    }
    this.searchTerm$.next(term.trim())
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

  private confirmationHtml(paying: number, partial: boolean): string {
    const rows = [
      `<p><strong>Total a cobrar:</strong> Bs ${this.totalToCharge.toFixed(2)}</p>`,
      this.discountTotal > 0
        ? `<p><strong>Descuento:</strong> Bs ${this.discountTotal.toFixed(2)} — se imprimirá
           ${this.discountDisplay === DiscountDisplay.ITEMIZED ? 'desglosado en el recibo' : '<em>absorbido en el precio</em>, sin aparecer en el recibo'}</p>`
        : '',
      `<p><strong>Paga ahora:</strong> Bs ${paying.toFixed(2)}</p>`,
      partial
        ? `<p class="text-amber-600">Queda un saldo de Bs ${(this.totalToCharge - paying).toFixed(2)}</p>`
        : '',
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
        next: blob => {
          const url = window.URL.createObjectURL(blob)
          const a = document.createElement('a')
          a.href = url
          a.download = `${invoiceNumber}.pdf`
          document.body.appendChild(a)
          a.click()
          document.body.removeChild(a)
          window.URL.revokeObjectURL(url)
        },
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
