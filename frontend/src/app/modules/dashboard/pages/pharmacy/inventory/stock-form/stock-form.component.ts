import { Location } from '@angular/common'
import { Component, DestroyRef, ElementRef, inject, OnInit, signal } from '@angular/core'
import { takeUntilDestroyed } from '@angular/core/rxjs-interop'
import { FormBuilder, FormGroup, Validators } from '@angular/forms'
import { ActivatedRoute, Router } from '@angular/router'
import { AlertService } from '@core/services/alert.service'
import { ClinicContextService } from '../../../../../clinics/services/clinic-context.service'
import { CreateMedicationStockDto, Medication } from '../../interfaces/pharmacy.interfaces'
import { InventoryService } from '../../services/inventory.service'

@Component({
    selector: 'app-stock-form',
    templateUrl: './stock-form.component.html',
    styleUrls: ['./stock-form.component.css'],
    standalone: false
})
export class StockFormComponent implements OnInit {
  private readonly destroyRef = inject(DestroyRef)

  stockForm!: FormGroup
  loading = signal(false)
  isEditMode = false
  stockId: string | null = null
  medications = signal<Medication[]>([])
  clinicId: string | null = null

  constructor(
    private fb: FormBuilder,
    private route: ActivatedRoute,
    private router: Router,
    private location: Location,
    private inventoryService: InventoryService,
    private clinicContext: ClinicContextService,
    private alertService: AlertService,
    private elRef: ElementRef,
  ) {}

  ngOnInit(): void {
    this.clinicId = this.clinicContext.clinicId
    if (!this.clinicId) {
      this.alertService.error('Error', 'Seleccione una clínica')
      this.router.navigate(['/dashboard/pharmacy/inventory'])
      return
    }

    this.initForm()
    this.loadMedications()

    this.stockId = this.route.snapshot.paramMap.get('id')
    if (this.stockId) {
      this.isEditMode = true
      this.loadStock()
    }
  }

  initForm(): void {
    this.stockForm = this.fb.group({
      medicationId: ['', Validators.required],
      batchNumber: ['', [Validators.required, Validators.minLength(3)]],
      quantity: [null, [Validators.required, Validators.min(1)]],
      unitCost: [null, [Validators.required, Validators.min(0.01)]],
      sellingPrice: [null, [Validators.required, Validators.min(0.01)]],
      expiryDate: [null, Validators.required],
      location: [''],
      minimumStock: [null, Validators.min(0)],
    })
  }

  loadMedications(): void {
    this.loading.set(true)
    this.inventoryService.getAllMedications().pipe(takeUntilDestroyed(this.destroyRef)).subscribe({
      next: result => {
        this.medications.set(result.data)
        this.loading.set(false)
      },
      error: () => {
        this.alertService.error('Error', 'No se pudieron cargar los medicamentos')
        this.loading.set(false)
      },
    })
  }

  loadStock(): void {
    if (!this.stockId) return
    this.loading.set(true)
    this.inventoryService.getProductById(this.stockId).pipe(takeUntilDestroyed(this.destroyRef)).subscribe({
      next: stock => {
        this.stockForm.patchValue({
          medicationId: stock.medicationId,
          batchNumber: stock.batchNumber,
          quantity: stock.quantity,
          unitCost: stock.unitCost,
          sellingPrice: stock.sellingPrice,
          expiryDate: new Date(stock.expiryDate),
          location: stock.location || '',
          minimumStock: stock.minimumStock || null,
        })
        this.loading.set(false)
      },
      error: () => {
        this.alertService.error('Error', 'No se pudo cargar el stock')
        this.loading.set(false)
        this.goBack()
      },
    })
  }

  async onSubmit(): Promise<void> {
    if (this.stockForm.invalid) {
      this.stockForm.markAllAsTouched()
      this.scrollToFirstError()
      return
    }

    // Validar que exista clinicId
    if (!this.clinicId) {
      this.alertService.error(
        'Error de Configuración',
        'No se ha seleccionado una clínica. Por favor, selecciona una clínica en el menú superior.',
      )
      return
    }

    const formValue = this.stockForm.value
    const expDate = new Date(formValue.expiryDate)
    const today = new Date()

    if (expDate <= today) {
      this.alertService.error('Validación', 'La fecha de vencimiento debe ser futura')
      return
    }

    if (formValue.sellingPrice < formValue.unitCost) {
      this.alertService.error(
        'Validación',
        'El precio de venta no puede ser menor al costo unitario',
      )
      return
    }

    const dto: CreateMedicationStockDto = {
      medicationId: formValue.medicationId,
      clinicId: this.clinicId!,
      batchNumber: formValue.batchNumber,
      quantity: Number(formValue.quantity) || 0,
      unitCost: Number(formValue.unitCost) || 0,
      sellingPrice: Number(formValue.sellingPrice) || 0,
      expiryDate: expDate.toISOString().split('T')[0], // Solo fecha YYYY-MM-DD
      receivedDate: new Date().toISOString().split('T')[0], // Solo fecha YYYY-MM-DD
      location: formValue.location || undefined,
      minimumStock:
        formValue.minimumStock != null && formValue.minimumStock !== ''
          ? Number(formValue.minimumStock)
          : undefined,
    }

    this.loading.set(true)

    if (this.isEditMode && this.stockId) {
      // Modo edición
      this.inventoryService.updateProduct(this.stockId, dto).pipe(takeUntilDestroyed(this.destroyRef)).subscribe({
        next: () => {
          this.alertService.success('Éxito', 'Stock actualizado correctamente')
          this.router.navigate(['/dashboard/pharmacy/inventory'])
        },
        error: () => {
          this.alertService.error('Error', 'No se pudo actualizar el stock')
          this.loading.set(false)
        },
      })
    } else {
      // Modo creación
      // Enviar DTO al backend
      this.inventoryService.addProduct(dto).pipe(takeUntilDestroyed(this.destroyRef)).subscribe({
        next: () => {
          this.alertService.success('Éxito', 'Stock registrado correctamente')
          this.router.navigate(['/dashboard/pharmacy/inventory'])
        },
        error: err => {
          const errorMsg = err?.error?.message || err?.message || 'No se pudo registrar el stock'
          this.alertService.error('Error', errorMsg)
          this.loading.set(false)
        },
      })
    }
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

  goToMedicationsCatalog(): void {
    this.router.navigate(['/dashboard/pharmacy/medications'])
  }

  createNewMedication(): void {
    this.router.navigate(['/dashboard/pharmacy/inventory/medication/new'])
  }
}
