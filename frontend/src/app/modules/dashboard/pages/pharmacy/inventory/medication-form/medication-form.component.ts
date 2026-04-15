import { Location } from '@angular/common'
import { Component, DestroyRef, ElementRef, inject, OnInit } from '@angular/core'
import { takeUntilDestroyed } from '@angular/core/rxjs-interop'
import { FormBuilder, FormGroup, Validators } from '@angular/forms'
import { ActivatedRoute, Router } from '@angular/router'
import { AlertService } from '@core/services/alert.service'
import {
  CreateMedicationDto,
  MedicationCategory,
  StorageCondition,
} from '../../interfaces/pharmacy.interfaces'
import { InventoryService } from '../../services/inventory.service'

@Component({
    selector: 'app-medication-form',
    templateUrl: './medication-form.component.html',
    styleUrls: ['./medication-form.component.css'],
    standalone: false
})
export class MedicationFormComponent implements OnInit {
  private readonly destroyRef = inject(DestroyRef)

  medicationForm!: FormGroup
  loading = false
  isEditMode = false
  medicationId: string | null = null

  readonly concentrationUnits: string[] = ['mg', 'g', 'ml', 'mg/ml', 'UI', '%']
  readonly dosageForms: string[] = [
    'Comprimido',
    'Cápsula',
    'Jarabe',
    'Suspensión',
    'Inyectable',
    'Crema',
    'Pomada',
    'Gel',
    'Tópico',
    'Gotas',
    'Spray',
  ]
  readonly administrationRoutes: string[] = [
    'Oral',
    'Tópica',
    'Intravenosa',
    'Intramuscular',
    'Subcutánea',
    'Sublingual',
    'Rectal',
    'Oftálmica',
    'Ótica',
    'Nasal',
  ]

  constructor(
    private fb: FormBuilder,
    private route: ActivatedRoute,
    private router: Router,
    private location: Location,
    private inventoryService: InventoryService,
    private alertService: AlertService,
    private elRef: ElementRef,
  ) {}

  ngOnInit(): void {
    this.initForm()
    this.medicationId = this.route.snapshot.paramMap.get('id')
    if (this.medicationId) {
      this.isEditMode = true
      this.loadMedication()
    } else {
      this.generateCode()
    }
  }

  initForm(): void {
    this.medicationForm = this.fb.group({
      code: [{ value: '', disabled: true }, Validators.required],
      nombreComercial: ['', [Validators.required, Validators.minLength(2)]],
      principioActivo: ['', Validators.required],
      concentracionValor: [null, [Validators.required, Validators.min(0.0001)]],
      concentracionUnidad: [this.concentrationUnits[0], Validators.required],
      formaFarmaceutica: [this.dosageForms[0], Validators.required],
      viaAdministracion: [this.administrationRoutes[0], Validators.required],
      laboratorio: [''],
    })
  }

  generateCode(): void {
    const now = new Date()
    const y = String(now.getFullYear()).slice(-2)
    const m = String(now.getMonth() + 1).padStart(2, '0')
    const d = String(now.getDate()).padStart(2, '0')
    const rand = Math.random().toString(36).substring(2, 6).toUpperCase()
    const code = `MED-${y}${m}${d}-${rand}`
    this.medicationForm.patchValue({ code })
  }

  loadMedication(): void {
    if (!this.medicationId) return
    this.loading = true
    this.inventoryService.getMedicationById(this.medicationId).pipe(takeUntilDestroyed(this.destroyRef)).subscribe({
      next: medication => {
        // Extraer valor y unidad de strength (ej: "500 mg" -> 500, "mg")
        const strengthMatch = medication.strength?.match(/^([\d.]+)\s*(.+)$/)
        const concentracionValor = strengthMatch ? parseFloat(strengthMatch[1]) : null
        const concentracionUnidad = strengthMatch ? strengthMatch[2] : this.concentrationUnits[0]

        this.medicationForm.patchValue({
          code: medication.code,
          nombreComercial: medication.name || medication.brandName || '',
          principioActivo: medication.activeIngredients || '',
          concentracionValor,
          concentracionUnidad,
          formaFarmaceutica: medication.dosageForm || this.dosageForms[0],
          viaAdministracion: medication.dosageInstructions || this.administrationRoutes[0],
          laboratorio: medication.manufacturer || '',
        })
        this.loading = false
      },
      error: () => {
        this.alertService.error('Error', 'No se pudo cargar el medicamento')
        this.loading = false
        this.goBack()
      },
    })
  }

  async onSubmit(): Promise<void> {
    if (this.medicationForm.invalid) {
      this.medicationForm.markAllAsTouched()
      this.scrollToFirstError()
      return
    }

    const formValue = this.medicationForm.getRawValue()
    const strength = `${formValue.concentracionValor} ${formValue.concentracionUnidad}`

    const dto: CreateMedicationDto = {
      code: formValue.code,
      name: formValue.nombreComercial,
      strength,
      dosageForm: formValue.formaFarmaceutica,
      activeIngredients: formValue.principioActivo,
      category: MedicationCategory.OTHER,
      storageCondition: StorageCondition.ROOM_TEMPERATURE,
      manufacturer: formValue.laboratorio || undefined,
      dosageInstructions: formValue.viaAdministracion || undefined,
    }

    this.loading = true
    this.inventoryService.createMedication(dto).pipe(takeUntilDestroyed(this.destroyRef)).subscribe({
      next: () => {
        this.alertService.success('Éxito', 'Medicamento creado correctamente')
        this.router.navigate(['/dashboard/pharmacy/inventory'])
      },
      error: () => {
        this.alertService.error('Error', 'No se pudo crear el medicamento')
        this.loading = false
      },
    })
  }

  private scrollToFirstError(): void {
    requestAnimationFrame(() => {
      const el = this.elRef.nativeElement.querySelector('.mat-form-field-invalid')
      el?.scrollIntoView({ behavior: 'smooth', block: 'center' })
    })
  }

  goBack(): void {
    this.location.back()
  }

  cancel(): void {
    this.router.navigate(['/dashboard/pharmacy/inventory'])
  }
}
