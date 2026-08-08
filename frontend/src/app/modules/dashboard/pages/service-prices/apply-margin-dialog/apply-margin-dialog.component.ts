import { Component, inject, signal } from '@angular/core'
import { FormControl, Validators } from '@angular/forms'
import { MatDialogRef } from '@angular/material/dialog'
import {
  ApplyMarginResult,
  LAB_CATEGORY_LABELS,
  ServicePricesService,
} from '../service-prices.service'

/**
 * Recalcula en bloque el precio de una categoría de estudios a partir del
 * margen que la clínica quiere ganar sobre el costo de convenio.
 *
 * Siempre en dos tiempos: primero la vista previa (`dryRun`) y solo después la
 * confirmación. Cambiar de golpe el precio de decenas de exámenes sin ver el
 * resultado es justo el tipo de acción que no debería poder hacerse a ciegas.
 */
@Component({
  selector: 'app-apply-margin-dialog',
  templateUrl: './apply-margin-dialog.component.html',
  standalone: false,
})
export class ApplyMarginDialogComponent {
  private svc = inject(ServicePricesService)
  dialogRef = inject(MatDialogRef<ApplyMarginDialogComponent>)

  readonly categoryOptions = Object.entries(LAB_CATEGORY_LABELS).map(([value, label]) => ({
    value,
    label,
  }))

  labCategory = new FormControl<string>('', { nonNullable: true })
  marginPct = new FormControl<number | null>(50, [Validators.required, Validators.min(0), Validators.max(1000)])

  preview = signal<ApplyMarginResult | null>(null)
  loading = signal(false)
  applying = signal(false)

  /** Cualquier cambio invalida la vista previa: dejarla sería enseñar otra cosa. */
  onCriteriaChange(): void {
    this.preview.set(null)
  }

  loadPreview(): void {
    if (this.marginPct.invalid) {
      this.marginPct.markAsTouched()
      return
    }
    this.loading.set(true)
    this.svc
      .applyMargin({
        labCategory: this.labCategory.value || undefined,
        marginPct: Number(this.marginPct.value),
        dryRun: true,
      })
      .subscribe({
        next: res => {
          this.preview.set(res)
          this.loading.set(false)
        },
        error: () => this.loading.set(false),
      })
  }

  apply(): void {
    const previa = this.preview()
    if (!previa || previa.affected === 0) return

    this.applying.set(true)
    this.svc
      .applyMargin({
        labCategory: this.labCategory.value || undefined,
        marginPct: Number(this.marginPct.value),
      })
      .subscribe({
        next: res => {
          this.applying.set(false)
          this.dialogRef.close(res)
        },
        error: () => this.applying.set(false),
      })
  }

  cancel(): void {
    this.dialogRef.close()
  }
}
