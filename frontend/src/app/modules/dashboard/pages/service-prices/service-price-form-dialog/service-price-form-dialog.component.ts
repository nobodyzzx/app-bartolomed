import { Component, Inject } from '@angular/core'
import { FormBuilder, FormGroup, Validators } from '@angular/forms'
import { MAT_DIALOG_DATA, MatDialogRef } from '@angular/material/dialog'
import {
  APPOINTMENT_TYPE_LABELS,
  AppointmentType,
  CATEGORY_LABELS,
  ServiceCategory,
  ServicePrice,
  ServicePricePayload,
} from '../service-prices.service'

@Component({
  selector: 'app-service-price-form-dialog',
  templateUrl: './service-price-form-dialog.component.html',
  standalone: false,
})
export class ServicePriceFormDialogComponent {
  readonly ServiceCategory = ServiceCategory
  readonly categories = Object.values(ServiceCategory)
  readonly appointmentTypes = Object.values(AppointmentType)
  readonly categoryLabels = CATEGORY_LABELS
  readonly appointmentTypeLabels = APPOINTMENT_TYPE_LABELS

  form: FormGroup
  readonly isEdit: boolean

  constructor(
    private fb: FormBuilder,
    public dialogRef: MatDialogRef<ServicePriceFormDialogComponent>,
    @Inject(MAT_DIALOG_DATA) public data: { price?: ServicePrice },
  ) {
    this.isEdit = !!data?.price

    this.form = this.fb.group({
      code: [data?.price?.code ?? '', [Validators.required, Validators.maxLength(30)]],
      name: [data?.price?.name ?? '', [Validators.required, Validators.maxLength(120)]],
      description: [data?.price?.description ?? ''],
      category: [data?.price?.category ?? ServiceCategory.CONSULTATION, Validators.required],
      appointmentType: [data?.price?.appointmentType ?? null],
      price: [data?.price?.price ?? null, [Validators.required, Validators.min(0)]],
      costPrice: [data?.price?.costPrice ?? null, [Validators.min(0)]],
      // No viaja al backend: es solo otra forma de escribir el precio.
      marginPct: [null as number | null, [Validators.min(-100)]],
      isActive: [data?.price?.isActive ?? true],
      requiresConsent: [data?.price?.requiresConsent ?? false],
    })

    this.recalcMargin()
  }

  // ── Margen ──────────────────────────────────────────────────────────────
  // Dos maneras de decir lo mismo: se puede fijar el precio y ver qué margen
  // deja, o fijar el margen que se quiere y que salga el precio. Cada clínica
  // razona de una de las dos formas, y con 110 estudios importa poder elegir.

  get hasCost(): boolean {
    return Number(this.form.get('costPrice')?.value ?? 0) > 0
  }

  /**
   * Precio escrito → margen que resulta. Sin costo no hay margen posible, así
   * que el campo se deshabilita desde aquí: `[disabled]` en la plantilla no
   * sirve con `formControlName`, reactive forms gobierna esa propiedad.
   */
  recalcMargin(): void {
    const marginCtrl = this.form.get('marginPct')
    const costo = Number(this.form.get('costPrice')?.value ?? 0)
    const precio = Number(this.form.get('price')?.value ?? 0)

    if (!costo) {
      marginCtrl?.setValue(null, { emitEvent: false })
      marginCtrl?.disable({ emitEvent: false })
      return
    }

    marginCtrl?.enable({ emitEvent: false })
    const margen = ((precio - costo) / costo) * 100
    marginCtrl?.setValue(Math.round(margen * 10) / 10, { emitEvent: false })
  }

  /**
   * Margen escrito → precio que resulta, redondeado a múltiplos de 5 Bs.
   *
   * Deliberadamente **no** reescribe el campo de margen: hacerlo mientras se
   * teclea se realimenta y descontrola el valor. Escribir "100" pasaba por 1,
   * 10 y 100, y cada paso recalculaba el margen sobre el precio redondeado y
   * lo devolvía al campo — acababa en 2000%. El ajuste por redondeo se hace al
   * salir del campo, en `onMarginBlur`.
   */
  recalcPrice(): void {
    const costo = Number(this.form.get('costPrice')?.value ?? 0)
    const margen = this.form.get('marginPct')?.value
    if (!costo || margen === null || margen === '' || margen === undefined) return

    const bruto = costo * (1 + Number(margen) / 100)
    const redondeado = Math.max(0, Math.ceil(bruto / 5) * 5)
    this.form.get('price')?.setValue(redondeado, { emitEvent: false })
  }

  /** Ya sin el usuario escribiendo, el margen se sincera con el precio real. */
  onMarginBlur(): void {
    this.recalcMargin()
  }

  /** `appointmentType` solo aplica a consultas — igual criterio que el backend. */
  get isConsultation(): boolean {
    return this.form.get('category')?.value === ServiceCategory.CONSULTATION
  }

  onCategoryChange(): void {
    if (!this.isConsultation) this.form.patchValue({ appointmentType: null })
  }

  submit(): void {
    if (this.form.invalid) {
      this.form.markAllAsTouched()
      return
    }

    const raw = this.form.getRawValue()
    const payload: ServicePricePayload = {
      code: raw.code.trim().toUpperCase(),
      name: raw.name.trim(),
      description: raw.description?.trim() || undefined,
      category: raw.category,
      appointmentType: raw.category === ServiceCategory.CONSULTATION ? raw.appointmentType : null,
      price: Number(raw.price),
      // `marginPct` se queda en la pantalla: el margen es una consecuencia del
      // par costo/precio, no un dato aparte que pueda contradecirlos.
      costPrice: raw.costPrice === null || raw.costPrice === '' ? undefined : Number(raw.costPrice),
      isActive: raw.isActive,
      requiresConsent: raw.requiresConsent,
    }

    this.dialogRef.close(payload)
  }

  cancel(): void {
    this.dialogRef.close()
  }
}
