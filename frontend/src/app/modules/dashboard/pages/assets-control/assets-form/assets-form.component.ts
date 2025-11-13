import { Location } from '@angular/common'
import { Component, OnInit } from '@angular/core'
import { FormBuilder, FormGroup, Validators } from '@angular/forms'
import { ActivatedRoute, Router } from '@angular/router'
import { AlertService } from '@core/services/alert.service'
import { CreateAssetDto } from '../interfaces/assets.interfaces'
import { AssetRegistrationService } from '../services/asset-registration.service'

@Component({
  selector: 'app-assets-form',
  templateUrl: './assets-form.component.html',
  styleUrls: ['./assets-form.component.css'],
})
export class AssetsFormComponent implements OnInit {
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

  constructor(
    private fb: FormBuilder,
    private assetService: AssetRegistrationService,
    private router: Router,
    private route: ActivatedRoute,
    private location: Location,
    private alert: AlertService,
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
      purchaseDate: ['', Validators.required],
      vendor: [''],
      invoiceNumber: [''],

      // Garantía
      warrantyExpiry: [''],

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
      lastMaintenanceDate: [''],

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
    this.assetService.getAssetById(id).subscribe({
      next: asset => {
        this.assetForm.patchValue(asset)
        this.isLoading = false
      },
      error: error => {
        console.error('Error loading asset:', error)
        this.isLoading = false
        this.goBack()
      },
    })
  }

  onSubmit(): void {
    if (this.assetForm.invalid) {
      this.assetForm.markAllAsTouched()
      this.alert.warning('Formulario incompleto', 'Por favor complete todos los campos requeridos')
      return
    }

    this.isSubmitting = true
    const formData: CreateAssetDto = this.assetForm.value

    const request$ = this.isEditMode
      ? this.assetService.updateAsset(this.assetId!, formData)
      : this.assetService.createAsset(formData)

    request$.subscribe({
      next: () => {
        this.isSubmitting = false
        this.router.navigate(['/dashboard/assets-control/list'])
      },
      error: error => {
        console.error('Error saving asset:', error)
        this.isSubmitting = false
      },
    })
  }

  goBack(): void {
    this.location.back()
  }

  enableEdit(): void {
    this.isViewMode = false
    this.assetForm.enable()
  }
}
