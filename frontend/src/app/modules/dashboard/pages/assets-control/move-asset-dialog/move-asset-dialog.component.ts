import { Component, Inject, OnInit, inject } from '@angular/core'
import { FormBuilder, FormGroup, Validators } from '@angular/forms'
import { MAT_DIALOG_DATA, MatDialogRef } from '@angular/material/dialog'
import { matchesSearch } from '../../../../../shared/utils/text-search.util'
import { BaseAsset, TargetClinic } from '../interfaces/assets.interfaces'
import { AssetRegistrationService } from '../services/asset-registration.service'
import { InventoryCountsService } from '../services/inventory-counts.service'

export interface MoveAssetDialogData {
  asset: BaseAsset
}

/** Marcador de "se queda donde está" en el selector de clínica. */
const AQUI = ''

/**
 * Traspaso a otro ambiente, sea de esta clínica o de la de al lado. Un paso, sin
 * aprobaciones: la cosa ya se movió y lo que falta es anotarlo.
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
  /** Ambientes de esta clínica, sin el que el ítem ya ocupa. */
  private propias: string[] = []
  otrasClinicas: TargetClinic[] = []

  isSubmitting = false

  constructor(
    private readonly dialogRef: MatDialogRef<MoveAssetDialogComponent>,
    @Inject(MAT_DIALOG_DATA) public data: MoveAssetDialogData,
  ) {}

  get disponibles(): number {
    return this.data.asset.quantity ?? 1
  }

  /** Clínica elegida, o null si el ítem se queda en la suya. */
  get destinoClinica(): TargetClinic | null {
    const id = this.form?.value?.toClinicId
    return id ? (this.otrasClinicas.find(c => c.id === id) ?? null) : null
  }

  /**
   * Los ambientes que se sugieren son los de la clínica elegida. Sin esto, al
   * mandar algo a la de al lado saldrían los cuartos de esta, que es justo lo
   * que hace que alguien teclee un nombre que allá no existe.
   */
  get locations(): string[] {
    return this.destinoClinica ? this.destinoClinica.locations : this.propias
  }

  /**
   * La lista se recorta con lo que se va tecleando. Sin esto mostraba los treinta
   * y pico ambientes enteros escribiera uno lo que escribiera, así que teclear no
   * servía de nada y sólo quedaba buscar a ojo desplazando la lista.
   *
   * Sin tildes ni mayúsculas a los dos lados: los ambientes de la planilla vienen
   * en mayúscula y sin acentos ("ADMINISTRACION") mientras que los cargados a
   * mano llevan ambas cosas ("Administración"), y nadie va a teclear la variante
   * exacta que le tocó a cada uno.
   */
  get filteredLocations(): string[] {
    const escrito = this.form?.value?.toLocation ?? ''
    if (!escrito.trim()) return this.locations
    return this.locations.filter(l => matchesSearch(escrito, l))
  }

  ngOnInit(): void {
    this.form = this.fb.group({
      toClinicId: [AQUI],
      toLocation: ['', [Validators.required]],
      quantity: [
        this.disponibles,
        [Validators.required, Validators.min(1), Validators.max(this.disponibles)],
      ],
      notes: [''],
    })

    // Cambiar de clínica invalida el ambiente ya tecleado: pertenece al otro
    // edificio y casi nunca se llama igual.
    this.form.get('toClinicId')!.valueChanges.subscribe(() => {
      this.form.get('toLocation')!.setValue('')
    })

    this.assetService.getLocations().subscribe({
      next: locs =>
        (this.propias = locs
          .filter(l => l !== this.data.asset.location)
          .sort((a, b) => a.localeCompare(b, 'es'))),
      error: () => (this.propias = []),
    })

    this.movements.getTargetClinics().subscribe({
      next: clinicas => (this.otrasClinicas = clinicas),
      error: () => (this.otrasClinicas = []),
    })
  }

  submit(): void {
    if (this.form.invalid) {
      this.form.markAllAsTouched()
      return
    }
    this.isSubmitting = true
    const { toClinicId, toLocation, quantity, notes } = this.form.value
    this.movements
      .move(this.data.asset.id, {
        toLocation: toLocation.trim(),
        toClinicId: toClinicId || undefined,
        quantity,
        notes,
      })
      .subscribe({
        next: () => this.dialogRef.close(true),
        error: () => (this.isSubmitting = false),
      })
  }

  cancel(): void {
    this.dialogRef.close(false)
  }
}
