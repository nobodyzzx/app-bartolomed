import { Component, Inject, OnInit, inject } from '@angular/core'
import { FormBuilder, FormGroup, Validators } from '@angular/forms'
import { MAT_DIALOG_DATA, MatDialogRef } from '@angular/material/dialog'
import { BaseAsset } from '../interfaces/assets.interfaces'
import { AssetRegistrationService } from '../services/asset-registration.service'
import { InventoryCountsService } from '../services/inventory-counts.service'

export interface MoveAssetDialogData {
  asset: BaseAsset
}

/**
 * Traspaso a otro ambiente. Un paso, sin aprobaciones: la cosa ya se movió y lo
 * que falta es anotarlo.
 */
@Component({
  selector: 'app-move-asset-dialog',
  templateUrl: './move-asset-dialog.component.html',
  standalone: false,
})
export class MoveAssetDialogComponent implements OnInit {
  private readonly fb = inject(FormBuilder)
  private readonly assetService = inject(AssetRegistrationService)
  private readonly movements = inject(InventoryCountsService)

  form!: FormGroup
  locations: string[] = []
  isSubmitting = false

  constructor(
    private readonly dialogRef: MatDialogRef<MoveAssetDialogComponent>,
    @Inject(MAT_DIALOG_DATA) public data: MoveAssetDialogData,
  ) {}

  get disponibles(): number {
    return this.data.asset.quantity ?? 1
  }

  ngOnInit(): void {
    this.form = this.fb.group({
      toLocation: ['', [Validators.required]],
      quantity: [this.disponibles, [Validators.required, Validators.min(1), Validators.max(this.disponibles)]],
      notes: [''],
    })

    this.assetService.getLocations().subscribe({
      next: locs =>
        (this.locations = locs
          .filter(l => l !== this.data.asset.location)
          .sort((a, b) => a.localeCompare(b, 'es'))),
      error: () => (this.locations = []),
    })
  }

  submit(): void {
    if (this.form.invalid) {
      this.form.markAllAsTouched()
      return
    }
    this.isSubmitting = true
    const { toLocation, quantity, notes } = this.form.value
    this.movements.move(this.data.asset.id, { toLocation: toLocation.trim(), quantity, notes }).subscribe({
      next: () => this.dialogRef.close(true),
      error: () => (this.isSubmitting = false),
    })
  }

  cancel(): void {
    this.dialogRef.close(false)
  }
}
