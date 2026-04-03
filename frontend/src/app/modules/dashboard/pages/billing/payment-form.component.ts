import { Component, DestroyRef, ElementRef, inject, OnInit } from '@angular/core'
import { takeUntilDestroyed } from '@angular/core/rxjs-interop'
import { FormBuilder, FormGroup, Validators } from '@angular/forms'
import { ActivatedRoute, Router } from '@angular/router'
import { AlertService } from '@core/services/alert.service'
import { of } from 'rxjs'
import { switchMap, tap } from 'rxjs/operators'
import { ErrorService } from '../../../../shared/components/services/error.service'
import { Clinic } from '../admin/clinics/interfaces/clinic.interface'
import { ClinicsService } from '../admin/clinics/services/clinics.service'
import { Patient } from '../patients/interfaces/patient.interface'
import { PatientsService } from '../patients/services/patients.service'
import { BillingService, InvoiceResponse, PaymentResponse } from './billing.service'

@Component({
  selector: 'app-payment-form',
  templateUrl: './payment-form.component.html',
  styleUrls: ['./payment-form.component.css'],
})
export class PaymentFormComponent implements OnInit {
  private readonly destroyRef = inject(DestroyRef)

  form!: FormGroup
  loading = false
  submitting = false
  editMode = false // futuro soporte edición

  paymentMethods = [
    { value: 'cash', label: 'Efectivo', icon: 'payments' },
    { value: 'card', label: 'Tarjeta', icon: 'credit_card' },
    { value: 'transfer', label: 'Transferencia', icon: 'account_balance' },
    { value: 'qr', label: 'QR', icon: 'qr_code' },
    { value: 'check', label: 'Cheque', icon: 'receipt_long' },
    { value: 'other', label: 'Otro', icon: 'pending' },
  ]

  patients: Patient[] = []
  clinics: Clinic[] = []
  invoice: InvoiceResponse | null = null

  constructor(
    private fb: FormBuilder,
    private route: ActivatedRoute,
    private router: Router,
    private billingService: BillingService,
    private alert: AlertService,
    private errorService: ErrorService,
    private patientsService: PatientsService,
    private clinicsService: ClinicsService,
    private elRef: ElementRef,
  ) {}

  ngOnInit(): void {
    this.buildForm()
    this.loading = true

    // Cargar catálogos en paralelo y luego evaluar si hay invoiceId param
    of(null)
      .pipe(
        switchMap(() => this.patientsService.findAll()),
        tap(p => (this.patients = p.data)),
        switchMap(() => this.clinicsService.findAll()),
        tap(c => (this.clinics = c)),
        switchMap(() => {
          const invoiceId = this.route.snapshot.paramMap.get('invoiceId')
          if (invoiceId)
            return this.billingService.getInvoice(invoiceId).pipe(
              tap(inv => {
                this.invoice = inv
                this.form.patchValue({ invoiceId: inv?.id })
              }),
            )
          return of(null)
        }),
        switchMap(() => this.billingService.generatePaymentNumber()),
        tap(num => this.form.patchValue({ paymentNumber: num })),
        takeUntilDestroyed(this.destroyRef),
      )
      .subscribe({
        next: () => (this.loading = false),
        error: err => {
          this.loading = false
          this.errorService.handleError(err)
        },
      })
  }

  buildForm() {
    this.form = this.fb.group({
      paymentNumber: ['', [Validators.required]],
      invoiceId: ['', [Validators.required]],
      patientId: ['', [Validators.required]],
      clinicId: ['', [Validators.required]],
      amount: [0, [Validators.required, Validators.min(0.01)]],
      method: ['cash', [Validators.required]],
      paymentDate: [new Date(), [Validators.required]],
      reference: ['', []],
      notes: ['', [Validators.maxLength(500)]],
    })
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
      invoiceId: raw.invoiceId || this.invoice?.id,
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
    requestAnimationFrame(() => {
      const el = this.elRef.nativeElement.querySelector('.mat-form-field-invalid')
      el?.scrollIntoView({ behavior: 'smooth', block: 'center' })
    })
  }

  cancel() {
    this.router.navigate(['/dashboard/billing'])
  }

  methodIcon(method: string) {
    return this.paymentMethods.find(m => m.value === method)?.icon || 'payments'
  }
}
