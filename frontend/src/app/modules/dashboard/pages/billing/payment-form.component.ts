import { Component, DestroyRef, ElementRef, inject, OnInit } from '@angular/core'
import { takeUntilDestroyed } from '@angular/core/rxjs-interop'
import { FormBuilder, FormGroup, Validators } from '@angular/forms'
import { ActivatedRoute, Router } from '@angular/router'
import { AlertService } from '@core/services/alert.service'
import { forkJoin } from 'rxjs'
import { ErrorService } from '../../../../shared/components/services/error.service'
import { scrollToFirstInvalidField } from '../../../../shared/utils/form-errors.util'
import { PAYMENT_METHODS } from '../checkout/checkout.service'
import { BillingService, InvoiceResponse, PaymentResponse } from './billing.service'

/**
 * Cobra el saldo pendiente de UNA factura (llega siempre con :invoiceId en
 * la ruta — la ruta "en blanco", sin id, existía en el módulo pero nada la
 * usaba: pedía elegir paciente y clínica a mano y tipear un UUID de factura
 * en un input de texto plano, con paciente/clínica descartados al guardar
 * (CreatePaymentDto ni los declara). Sin poder llegar nunca con un saldo
 * real que cobrar, quedaba una factura con `remainingAmount > 0` para
 * siempre: no había forma de terminarla de cobrar.
 */
@Component({
    selector: 'app-payment-form',
    templateUrl: './payment-form.component.html',
    styleUrls: ['./payment-form.component.css'],
    standalone: false
})
export class PaymentFormComponent implements OnInit {
  private readonly destroyRef = inject(DestroyRef)

  form!: FormGroup
  loading = false
  submitting = false

  /** La clínica solo cobra en efectivo y por QR (lista compartida con farmacia y el punto de cobro). */
  paymentMethods = PAYMENT_METHODS

  invoice: InvoiceResponse | null = null
  readonly today = new Date()

  constructor(
    private fb: FormBuilder,
    private route: ActivatedRoute,
    private router: Router,
    private billingService: BillingService,
    private alert: AlertService,
    private errorService: ErrorService,
    private elRef: ElementRef,
  ) {}

  ngOnInit(): void {
    this.buildForm()

    const invoiceId = this.route.snapshot.paramMap.get('invoiceId')
    if (!invoiceId) {
      this.alert.error('Factura no especificada', 'Abre esta pantalla desde "Cobrar saldo" en la lista de facturas')
      this.router.navigate(['/dashboard/billing'])
      return
    }

    this.loading = true
    forkJoin({
      invoice: this.billingService.getInvoice(invoiceId),
      paymentNumber: this.billingService.generatePaymentNumber(),
    })
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: ({ invoice, paymentNumber }) => {
          this.invoice = invoice
          const remaining = Number(invoice.remainingAmount ?? invoice.totalAmount)

          if (remaining <= 0) {
            this.alert.warning('Sin saldo pendiente', `La factura ${invoice.invoiceNumber} ya está totalmente pagada`)
            this.router.navigate(['/dashboard/billing'])
            return
          }

          this.form.patchValue({ invoiceId: invoice.id, paymentNumber, amount: remaining })
          // El backend rechaza un pago que supere el saldo (BadRequestException);
          // se valida acá también para no hacer ir y volver a alguien que
          // escribió de más solo para que se lo rebote un 400.
          this.form.get('amount')?.addValidators(Validators.max(remaining))
          this.form.get('amount')?.updateValueAndValidity()
          this.loading = false
        },
        error: () => {
          this.loading = false
          this.router.navigate(['/dashboard/billing'])
        },
      })
  }

  buildForm() {
    this.form = this.fb.group({
      paymentNumber: ['', [Validators.required]],
      invoiceId: ['', [Validators.required]],
      amount: [0, [Validators.required, Validators.min(0.01)]],
      method: ['cash', [Validators.required]],
      paymentDate: [new Date(), [Validators.required]],
      reference: ['', []],
      notes: ['', [Validators.maxLength(500)]],
    })
  }

  get remainingAmount(): number {
    return Number(this.invoice?.remainingAmount ?? this.invoice?.totalAmount ?? 0)
  }

  submit() {
    if (this.form.invalid) {
      this.form.markAllAsTouched()
      this.scrollToFirstError()
      return
    }
    this.submitting = true
    const raw = this.form.getRawValue()

    const payload = {
      paymentNumber: raw.paymentNumber,
      invoiceId: raw.invoiceId,
      amount: raw.amount,
      method: raw.method,
      paymentDate: raw.paymentDate,
      reference: raw.reference || undefined,
      notes: raw.notes || undefined,
    }

    this.billingService.addPayment(payload).pipe(takeUntilDestroyed(this.destroyRef)).subscribe({
      next: (created: PaymentResponse) => {
        this.submitting = false
        this.alert.success('Pago registrado', `Se creó el pago #${created.paymentNumber}`)
        this.router.navigate(['/dashboard/billing'])
      },
      error: (err: unknown) => {
        this.submitting = false
        this.errorService.handleError(err)
      },
    })
  }

  private scrollToFirstError(): void {
    scrollToFirstInvalidField(this.elRef.nativeElement as HTMLElement)
  }

  paymentDetailErrorCount(): number {
    return ['amount', 'method', 'reference', 'notes'].filter(name => {
      const c = this.form.get(name)
      return !!c && c.invalid && c.touched
    }).length
  }

  cancel() {
    this.router.navigate(['/dashboard/billing'])
  }

  methodIcon(method: string) {
    return this.paymentMethods.find(m => m.value === method)?.icon || 'payments'
  }

  methodLabel(method: string) {
    return this.paymentMethods.find(m => m.value === method)?.label ?? ''
  }
}
