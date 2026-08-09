import { Location } from '@angular/common'
import { Component, DestroyRef, ElementRef, inject, OnInit } from '@angular/core'
import { takeUntilDestroyed } from '@angular/core/rxjs-interop'
import { FormBuilder, FormGroup, Validators } from '@angular/forms'
import { ActivatedRoute, Router } from '@angular/router'
import { AlertService } from '@core/services/alert.service'
import { scrollToFirstInvalidField } from '@shared/utils/form-errors.util'
import { AssetCondition, AssetStatus, CreateAssetDto } from '../interfaces/assets.interfaces'
import { AssetRegistrationService } from '../services/asset-registration.service'

/**
 * Estado del ítem, tal como lo piensa quien hace el inventario: si está y sirve,
 * si está pero no sirve, si falta confirmarlo o si ya no está.
 *
 * La ficha guarda dos campos separados —`status` (7 valores) y `condition` (5)—
 * que dan 35 combinaciones de las que el inventario real usa tres. Aquí se
 * ofrecen cinco opciones y el componente las traduce a ese par.
 */
interface EstadoOpcion {
  value: string
  label: string
  hint: string
  status: AssetStatus
  condition: AssetCondition
}

@Component({
  selector: 'app-assets-form',
  templateUrl: './assets-form.component.html',
  styleUrls: ['./assets-form.component.css'],
  standalone: false,
})
export class AssetsFormComponent implements OnInit {
  private readonly destroyRef = inject(DestroyRef)

  assetForm!: FormGroup
  isEditMode = false
  isViewMode = false
  assetId: string | null = null
  isLoading = false
  isSubmitting = false
  locations: string[] = []

  assetTypes = [
    { value: 'medical_equipment', label: 'Equipo Médico', icon: 'medical_services' },
    { value: 'furniture', label: 'Mobiliario', icon: 'chair' },
    { value: 'computer', label: 'Equipo de Cómputo', icon: 'computer' },
    { value: 'vehicle', label: 'Vehículo', icon: 'directions_car' },
    { value: 'building', label: 'Edificio', icon: 'business' },
    { value: 'other', label: 'Otro', icon: 'inventory_2' },
  ]

  readonly estados: EstadoOpcion[] = [
    {
      value: 'en_uso',
      label: 'En uso',
      hint: 'Está y funciona',
      status: AssetStatus.ACTIVE,
      condition: AssetCondition.GOOD,
    },
    {
      value: 'por_confirmar',
      label: 'Por confirmar',
      hint: 'Figura en la planilla, falta verificarlo',
      status: AssetStatus.INACTIVE,
      condition: AssetCondition.GOOD,
    },
    {
      value: 'mantenimiento',
      label: 'En mantenimiento',
      hint: 'Fuera de servicio, en reparación',
      status: AssetStatus.MAINTENANCE,
      condition: AssetCondition.FAIR,
    },
    {
      value: 'en_desuso',
      label: 'En desuso',
      hint: 'Está pero no sirve',
      status: AssetStatus.DAMAGED,
      condition: AssetCondition.POOR,
    },
    {
      value: 'de_baja',
      label: 'Dado de baja',
      hint: 'Ya no está en la clínica',
      status: AssetStatus.RETIRED,
      condition: AssetCondition.POOR,
    },
  ]

  /** Los estados que la ficha puede traer y no están entre las cinco opciones. */
  private readonly estadoPorStatus: Record<string, string> = {
    [AssetStatus.ACTIVE]: 'en_uso',
    [AssetStatus.INACTIVE]: 'por_confirmar',
    [AssetStatus.MAINTENANCE]: 'mantenimiento',
    [AssetStatus.DAMAGED]: 'en_desuso',
    [AssetStatus.RETIRED]: 'de_baja',
    [AssetStatus.SOLD]: 'de_baja',
    [AssetStatus.LOST]: 'de_baja',
  }

  typeLabel(value: string): string {
    return this.assetTypes.find(t => t.value === value)?.label ?? ''
  }

  estadoLabel(value: string): string {
    return this.estados.find(e => e.value === value)?.label ?? ''
  }

  constructor(
    private fb: FormBuilder,
    private assetService: AssetRegistrationService,
    private router: Router,
    private route: ActivatedRoute,
    private location: Location,
    private alert: AlertService,
    private elRef: ElementRef,
  ) {}

  ngOnInit(): void {
    this.initForm()
    this.checkRouteParams()
    this.assetService
      .getLocations()
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: locations => (this.locations = [...locations].sort((a, b) => a.localeCompare(b, 'es'))),
        error: () => (this.locations = []),
      })
  }

  /**
   * Seis campos y ninguno más.
   *
   * El formulario pedía 24, con número de serie, fabricante, precio y fecha de
   * compra **obligatorios**: ninguno de los 235 ítems del inventario real los
   * tiene, así que dar de alta un ítem de la planilla era imposible. El resto de
   * campos sigue existiendo en la ficha y conserva su valor; simplemente no se
   * piden aquí.
   */
  initForm(): void {
    this.assetForm = this.fb.group({
      name: ['', [Validators.required, Validators.maxLength(200)]],
      quantity: [1, [Validators.required, Validators.min(1)]],
      type: ['other', Validators.required],
      estado: ['en_uso', Validators.required],
      location: ['', Validators.required],
      notes: [''],
    })
  }

  checkRouteParams(): void {
    this.assetId = this.route.snapshot.paramMap.get('id')
    this.isViewMode = this.route.snapshot.data['viewMode'] === true

    if (this.assetId) {
      this.isEditMode = true
      this.loadAsset(this.assetId)

      if (this.isViewMode) {
        this.assetForm.disable()
      }
    }
  }

  loadAsset(id: string): void {
    this.isLoading = true
    this.assetService
      .getAssetById(id)
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: asset => {
          this.assetForm.patchValue({
            name: asset.name,
            quantity: asset.quantity ?? 1,
            type: asset.type,
            estado: this.estadoPorStatus[asset.status] ?? 'en_uso',
            location: asset.location ?? '',
            notes: (asset as unknown as Record<string, unknown>)['notes'] ?? '',
          })
          this.isLoading = false
        },
        error: () => {
          this.isLoading = false
          this.goBack()
        },
      })
  }

  onSubmit(): void {
    if (this.assetForm.invalid) {
      this.assetForm.markAllAsTouched()
      this.scrollToFirstError()
      return
    }

    this.isSubmitting = true
    const { estado, ...resto } = this.assetForm.value
    const opcion = this.estados.find(e => e.value === estado) ?? this.estados[0]
    // El estado se desdobla acá y no en el backend: la ficha sigue guardando
    // `status` y `condition` por separado, y los informes y traslados leen esos.
    const formData = { ...resto, status: opcion.status, condition: opcion.condition } as CreateAssetDto

    const request$ = this.isEditMode
      ? this.assetService.updateAsset(this.assetId!, formData)
      : this.assetService.createAsset(formData)

    request$.pipe(takeUntilDestroyed(this.destroyRef)).subscribe({
      next: () => {
        this.isSubmitting = false
        this.router.navigate(['/dashboard/assets-control/inventory'])
      },
      error: () => {
        this.isSubmitting = false
      },
    })
  }

  private scrollToFirstError(): void {
    scrollToFirstInvalidField(this.elRef.nativeElement as HTMLElement)
  }

  goBack(): void {
    this.location.back()
  }

  enableEdit(): void {
    this.isViewMode = false
    this.assetForm.enable()
  }
}
