import { Component, DestroyRef, ElementRef, inject, OnInit } from '@angular/core'
import { takeUntilDestroyed } from '@angular/core/rxjs-interop'
import { FormArray, FormBuilder, FormControl, FormGroup, Validators } from '@angular/forms'
import { ActivatedRoute, Router } from '@angular/router'
import { AlertService } from '@core/services/alert.service'
import { ErrorService } from '../../../../shared/components/services/error.service'
import { ClinicsService } from '../admin/clinics/services/clinics.service'
import { PatientsService } from '../patients/services/patients.service'
import { BillingService, InvoiceDto, InvoiceItemDto, InvoiceResponse } from './billing.service'
import { ClinicOption, PatientOption } from './interfaces/billing-ui.interfaces'

@Component({
  selector: 'app-invoice-form',
  templateUrl: './invoice-form.component.html',
  styleUrls: ['./invoice-form.component.css'],
})
export class InvoiceFormComponent implements OnInit {
  private readonly destroyRef = inject(DestroyRef)

  form!: FormGroup
  isEdit = false
  loading = false
  patients: PatientOption[] = []
  clinics: ClinicOption[] = []

  get items(): FormArray {
    return this.form.get('items') as FormArray
  }

  constructor(
    private fb: FormBuilder,
    private route: ActivatedRoute,
    private router: Router,
    private billing: BillingService,
    private patientsService: PatientsService,
    private clinicsService: ClinicsService,
    private alert: AlertService,
    private errorService: ErrorService,
    private elRef: ElementRef,
  ) {}

  goBack(): void {
    this.router.navigate(['/dashboard/billing'])
  }

  ngOnInit(): void {
    this.buildForm()
    this.loadOptions()

    const id = this.route.snapshot.paramMap.get('id')
    if (id) {
      this.isEdit = true
      this.loadInvoice(id)
    } else {
      // Autogenerar número de factura
      this.generateInvoiceNumber()
    }
  }

  buildForm(): void {
    this.form = this.fb.group({
      invoiceNumber: ['', [Validators.required]],
      patientId: ['', [Validators.required]],
      clinicId: ['', [Validators.required]],
      issueDate: [new Date(), [Validators.required]],
      dueDate: [null, [Validators.required]],
      taxRate: [0, [Validators.min(0)]],
      discountRate: [0, [Validators.min(0)]],
      discountAmount: [0, [Validators.min(0)]],
      notes: [''],
      terms: [''],
      items: this.fb.array([]),
    })

    // Item inicial
    this.addItem()
  }

  addItem(): void {
    this.items.push(
      this.fb.group({
        description: ['', Validators.required],
        quantity: [1, [Validators.required, Validators.min(1)]],
        unitPrice: [0, [Validators.required, Validators.min(0)]],
        serviceCode: [''],
        category: [''],
      }),
    )
  }

  removeItem(index: number): void {
    this.items.removeAt(index)
  }

  loadOptions(): void {
    this.patientsService.findAll().pipe(takeUntilDestroyed(this.destroyRef)).subscribe({
      next: pts => (this.patients = pts.data.map(p => ({ id: p.id, firstName: p.firstName, lastName: p.lastName }))),
      error: err => this.errorService.handleError(err),
    })
    this.clinicsService.findAll(true).pipe(takeUntilDestroyed(this.destroyRef)).subscribe({
      next: cs => (this.clinics = cs.map(c => ({ id: c.id, name: c.name }))),
      error: err => this.errorService.handleError(err),
    })
  }

  loadInvoice(id: string): void {
    this.loading = true
    this.billing.getInvoice(id).pipe(takeUntilDestroyed(this.destroyRef)).subscribe({
      next: inv => {
        this.form.patchValue({
          invoiceNumber: inv.invoiceNumber,
          patientId: inv.patient?.id,
          clinicId: inv.clinic?.id,
          issueDate: new Date(inv.issueDate),
          dueDate: new Date(inv.dueDate),
          taxRate: inv.taxRate,
          discountRate: inv.discountRate,
          discountAmount: inv.discountAmount,
          notes: inv.notes,
          terms: inv.terms,
        })

        this.items.clear()
        ;(inv.items || []).forEach((it: InvoiceItemDto) => {
          this.items.push(
            this.fb.group({
              description: [it.description, Validators.required],
              quantity: [it.quantity, [Validators.required, Validators.min(1)]],
              unitPrice: [Number(it.unitPrice), [Validators.required, Validators.min(0)]],
              serviceCode: [it.serviceCode],
              category: [it.category],
            }),
          )
        })
        this.loading = false
      },
      error: err => {
        this.errorService.handleError(err)
        this.loading = false
      },
    })
  }

  private toDateOnly(d: Date): string {
    const iso = new Date(d).toISOString()
    return iso.split('T')[0]
  }

  submit(): void {
    if (this.form.invalid) {
      this.form.markAllAsTouched()
      this.scrollToFirstError()
      return
    }

    const raw = this.form.getRawValue()
    const payload: InvoiceDto = {
      invoiceNumber: raw.invoiceNumber,
      issueDate: this.toDateOnly(raw.issueDate),
      dueDate: this.toDateOnly(raw.dueDate),
      taxRate: raw.taxRate ?? 0,
      discountRate: raw.discountRate ?? 0,
      discountAmount: raw.discountAmount ?? 0,
      notes: raw.notes,
      terms: raw.terms,
      patientId: raw.patientId,
      clinicId: raw.clinicId,
      items: raw.items.map((it: InvoiceItemDto) => ({
        description: it.description,
        quantity: Number(it.quantity),
        unitPrice: Number(it.unitPrice),
        serviceCode: it.serviceCode,
        category: it.category,
      })),
    }

    this.loading = true
    const id = this.route.snapshot.paramMap.get('id')
    const obs =
      this.isEdit && id
        ? this.billing.updateInvoice(id, payload)
        : this.billing.createInvoice(payload)
    obs.pipe(takeUntilDestroyed(this.destroyRef)).subscribe({
      next: () => {
        this.loading = false
        this.alert.success('Éxito', this.isEdit ? 'Factura actualizada' : 'Factura creada')
        this.router.navigate(['/dashboard/billing'])
      },
      error: err => {
        this.loading = false
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

  async generateInvoiceNumber(): Promise<void> {
    this.billing.generateInvoiceNumber().pipe(takeUntilDestroyed(this.destroyRef)).subscribe({
      next: num => this.form.get('invoiceNumber')?.setValue(num),
      error: () => {},
    })
  }

  // Totales calculados
  get subtotal(): number {
    return this.items.controls.reduce((sum, ctrl) => {
      const q = Number((ctrl.get('quantity') as FormControl).value || 0)
      const p = Number((ctrl.get('unitPrice') as FormControl).value || 0)
      return sum + q * p
    }, 0)
  }

  get discountAmountCalc(): number {
    const rate = Number(this.form.get('discountRate')?.value || 0)
    const manual = Number(this.form.get('discountAmount')?.value || 0)
    const auto = (this.subtotal * rate) / 100
    return manual > 0 ? manual : auto
  }

  get taxAmount(): number {
    const rate = Number(this.form.get('taxRate')?.value || 0)
    const base = Math.max(this.subtotal - this.discountAmountCalc, 0)
    return (base * rate) / 100
  }

  get total(): number {
    return Math.max(this.subtotal - this.discountAmountCalc, 0) + this.taxAmount
  }
}
