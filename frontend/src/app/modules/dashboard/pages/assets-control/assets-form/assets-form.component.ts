import { Location } from '@angular/common'
import { Component, DestroyRef, ElementRef, inject, OnInit } from '@angular/core'
import { takeUntilDestroyed } from '@angular/core/rxjs-interop'
import { FormBuilder, FormGroup, Validators } from '@angular/forms'
import { ActivatedRoute, Router } from '@angular/router'
import { AlertService } from '@core/services/alert.service'
import { scrollToFirstInvalidField } from '@shared/utils/form-errors.util'
import { CreateAssetDto } from '../interfaces/assets.interfaces'
import { AssetRegistrationService } from '../services/asset-registration.service'

@Component({
    selector: 'app-assets-form',
    templateUrl: './assets-form.component.html',
    styleUrls: ['./assets-form.component.css'],
    standalone: false
})
export class AssetsFormComponent implements OnInit {
  private readonly destroyRef = inject(DestroyRef)

  assetForm!: FormGroup
  isEditMode = false
  isViewMode = false
  assetId: string | null = null
  isLoading = false
  isSubmitting = false

  assetTypes = [
    { value: 'medical_equipment', label: 'Equipo Médico', icon: 'medical_services' },
    { value: 'furniture', label: 'Mobiliario', icon: 'chair' },
    { value: 'computer', label: 'Equipo de Cómputo', icon: 'computer' },
    { value: 'vehicle', label: 'Vehículo', icon: 'directions_car' },
    { value: 'building', label: 'Edificio', icon: 'business' },
    { value: 'other', label: 'Otro', icon: 'inventory_2' },
  ]

  assetStatuses = [
    { value: 'active', label: 'Activo' },
    { value: 'inactive', label: 'Inactivo' },
    { value: 'maintenance', label: 'En Mantenimiento' },
    { value: 'retired', label: 'Retirado' },
  ]

  assetConditions = [
    { value: 'excellent', label: 'Excelente' },
    { value: 'good', label: 'Bueno' },
    { value: 'fair', label: 'Regular' },
    { value: 'poor', label: 'Malo' },
    { value: 'critical', label: 'Crítico' },
  ]

  depreciationMethods = [
    { value: 'straight_line', label: 'Línea Recta' },
    { value: 'declining_balance', label: 'Saldo Decreciente' },
    { value: 'units_of_production', label: 'Unidades de Producción' },
    { value: 'no_depreciation', label: 'Sin Depreciación' },
  ]

  // Fase 2 rediseño: reduce densidad visual ocultando campos secundarios/opcionales
  // detrás de un botón "Mostrar más campos" — se auto-expanden en loadAsset() si el
  // activo ya tiene datos cargados en ellos, para no esconder información real.
  showMorePurchaseFields = false
  showMoreDepreciationFields = false
  showMoreLocationFields = false

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
  }

  initForm(): void {
    this.assetForm = this.fb.group({
      // Información básica
      name: ['', [Validators.required, Validators.maxLength(200)]],
      description: [''],
      type: ['', Validators.required],
      category: [''],

      // Fabricante y modelo
      manufacturer: ['', Validators.required],
      model: [''],
      serialNumber: ['', Validators.required],

      // Estado y condición
      status: ['active', Validators.required],
      condition: ['good', Validators.required],

      // Compra
      purchasePrice: ['', [Validators.required, Validators.min(0)]],
      purchaseDate: [null, Validators.required],
      vendor: [''],
      invoiceNumber: [''],

      // Garantía
      warrantyExpiry: [null],

      // Depreciación
      depreciationMethod: ['straight_line'],
      usefulLifeYears: [10, [Validators.min(1)]],
      salvageValue: [0, [Validators.min(0)]],

      // Ubicación
      location: [''],
      room: [''],
      building: [''],
      floor: [''],

      // Mantenimiento
      maintenanceIntervalMonths: [6, [Validators.min(1)]],
      lastMaintenanceDate: [null],

      // Notas
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
    this.assetService.getAssetById(id).pipe(takeUntilDestroyed(this.destroyRef)).subscribe({
      next: asset => {
        // El backend devuelve las fechas como string ISO (el tipo Date de BaseAsset es solo
        // declarativo); el datepicker necesita instancias reales de Date para poder mostrarlas.
        const raw = asset as unknown as Record<string, unknown>
        this.assetForm.patchValue({
          ...raw,
          purchaseDate: raw['purchaseDate'] ? new Date(raw['purchaseDate'] as string) : null,
          warrantyExpiry: raw['warrantyExpiry'] ? new Date(raw['warrantyExpiry'] as string) : null,
          lastMaintenanceDate: raw['lastMaintenanceDate'] ? new Date(raw['lastMaintenanceDate'] as string) : null,
        })

        // Si el activo ya tiene datos cargados en los campos ocultos, mostrarlos de
        // entrada en vez de esconderlos detrás de "Mostrar más campos".
        this.showMorePurchaseFields = !!(raw['vendor'] || raw['invoiceNumber'] || raw['warrantyExpiry'])
        this.showMoreLocationFields = !!(raw['building'] || raw['floor'])
        this.showMoreDepreciationFields = !!(
          (raw['depreciationMethod'] && raw['depreciationMethod'] !== 'straight_line') ||
          (typeof raw['usefulLifeYears'] === 'number' && raw['usefulLifeYears'] !== 10) ||
          (typeof raw['salvageValue'] === 'number' && raw['salvageValue'] !== 0)
        )

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
    const formData: CreateAssetDto = this.assetForm.value

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

  // Badges de error por sección — cuentan controles inválidos+touched de los campos
  // de cada tarjeta visual (un único FormGroup, sin subgrupos por sección).
  basicInfoErrorCount(): number {
    return this.countSectionErrors(['name', 'description', 'type', 'category'])
  }

  manufacturerErrorCount(): number {
    return this.countSectionErrors(['manufacturer', 'model', 'serialNumber'])
  }

  statusErrorCount(): number {
    return this.countSectionErrors(['status', 'condition'])
  }

  purchaseInfoErrorCount(): number {
    return this.countSectionErrors(['purchasePrice', 'purchaseDate', 'vendor', 'invoiceNumber', 'warrantyExpiry'])
  }

  depreciationErrorCount(): number {
    return this.countSectionErrors(['depreciationMethod', 'usefulLifeYears', 'salvageValue'])
  }

  locationErrorCount(): number {
    return this.countSectionErrors(['location', 'room', 'building', 'floor'])
  }

  maintenanceErrorCount(): number {
    return this.countSectionErrors(['maintenanceIntervalMonths', 'lastMaintenanceDate'])
  }

  notesErrorCount(): number {
    return this.countSectionErrors(['notes'])
  }

  private countSectionErrors(fieldNames: string[]): number {
    return fieldNames.filter(name => {
      const c = this.assetForm.get(name)
      return !!c && c.invalid && c.touched
    }).length
  }

  goBack(): void {
    this.location.back()
  }

  enableEdit(): void {
    this.isViewMode = false
    this.assetForm.enable()
  }
}
