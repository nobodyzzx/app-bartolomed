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
      isActive: [data?.price?.isActive ?? true],
    })
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
      isActive: raw.isActive,
    }

    this.dialogRef.close(payload)
  }

  cancel(): void {
    this.dialogRef.close()
  }
}
