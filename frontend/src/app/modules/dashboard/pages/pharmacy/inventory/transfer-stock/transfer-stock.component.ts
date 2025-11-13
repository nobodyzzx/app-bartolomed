import { Location } from '@angular/common'
import { Component, OnInit, signal } from '@angular/core'
import { FormBuilder, FormGroup, Validators } from '@angular/forms'
import { Router } from '@angular/router'
import { AlertService } from '@core/services/alert.service'
import { ClinicContextService } from '../../../../../../modules/clinics/services/clinic-context.service'
import { Clinic } from '../../../clinics/interfaces'
import { ClinicsService } from '../../../clinics/services/clinics.service'
import { MedicationStock } from '../../interfaces/pharmacy.interfaces'
import { InventoryService } from '../../services/inventory.service'

@Component({
  selector: 'app-transfer-stock',
  templateUrl: './transfer-stock.component.html',
})
export class TransferStockComponent implements OnInit {
  form: FormGroup
  loading = signal(false)
  loadingClinics = signal(false)
  loadingStocks = signal(false)

  clinics = signal<Clinic[]>([])
  stocks = signal<MedicationStock[]>([])
  selectedStock = signal<MedicationStock | null>(null)
  currentClinicId = signal<string | null>(null)

  constructor(
    private fb: FormBuilder,
    private inventory: InventoryService,
    private clinicsService: ClinicsService,
    private clinicContext: ClinicContextService,
    private alert: AlertService,
    private router: Router,
    private location: Location,
  ) {
    this.form = this.fb.group({
      sourceStockId: ['', Validators.required],
      toClinicId: ['', Validators.required],
      quantity: [1, [Validators.required, Validators.min(1)]],
      location: [''],
      note: [''],
    })
  }

  ngOnInit(): void {
    const currentClinic = this.clinicContext.clinicId
    this.currentClinicId.set(currentClinic)

    if (currentClinic) {
      this.loadStocks(currentClinic)
    }
    this.loadClinics()

    // Watch stock selection
    this.form.get('sourceStockId')?.valueChanges.subscribe(stockId => {
      const stock = this.stocks().find(s => s.id === stockId)
      this.selectedStock.set(stock || null)
      if (stock && (stock.availableQuantity || 0) > 0) {
        this.form.patchValue({ quantity: Math.min(1, stock.availableQuantity || 1) })
        this.form
          .get('quantity')
          ?.setValidators([
            Validators.required,
            Validators.min(1),
            Validators.max(stock.availableQuantity || 1),
          ])
        this.form.get('quantity')?.updateValueAndValidity()
      }
    })
  }

  loadClinics(): void {
    this.loadingClinics.set(true)
    this.clinicsService.findAll(true).subscribe({
      next: (clinics: Clinic[]) => {
        this.clinics.set(clinics.filter((c: Clinic) => c.id !== this.currentClinicId()))
        this.loadingClinics.set(false)
      },
      error: () => {
        this.loadingClinics.set(false)
        this.alert.error('Error', 'No se pudieron cargar las clínicas')
      },
    })
  }

  loadStocks(clinicId: string): void {
    this.loadingStocks.set(true)
    this.inventory.getProducts(clinicId).subscribe({
      next: stocks => {
        this.stocks.set(stocks.filter(s => (s.availableQuantity || 0) > 0))
        this.loadingStocks.set(false)
      },
      error: () => {
        this.loadingStocks.set(false)
        this.alert.error('Error', 'No se pudo cargar el inventario')
      },
    })
  }

  async submit() {
    if (this.form.invalid) {
      this.form.markAllAsTouched()
      this.alert.warning('Formulario inválido', 'Revise los campos requeridos')
      return
    }

    const stock = this.selectedStock()
    if (!stock) {
      this.alert.warning('Stock no seleccionado', 'Por favor seleccione un lote válido')
      return
    }

    const toClinic = this.clinics().find(c => c.id === this.form.value.toClinicId)
    const result = await this.alert.confirm({
      title: 'Confirmar transferencia',
      html: `<div class="text-left">
        <p><strong>Producto:</strong> ${stock.medication?.name || 'N/A'}</p>
        <p><strong>Lote:</strong> ${stock.batchNumber}</p>
        <p><strong>Cantidad:</strong> ${this.form.value.quantity} de ${stock.availableQuantity || 0} disponibles</p>
        <p><strong>Destino:</strong> ${toClinic?.name || 'N/A'}</p>
      </div>`,
      confirmButtonText: 'Transferir',
      cancelButtonText: 'Cancelar',
    })
    if (!result.isConfirmed) return

    this.loading.set(true)
    this.inventory.transferStock(this.form.value).subscribe({
      next: () => {
        this.alert.success('Transferencia completada', 'El stock fue transferido correctamente')
        this.router.navigate(['/dashboard/pharmacy/inventory'])
      },
      error: () => {
        this.loading.set(false)
        this.alert.error('Error', 'No se pudo completar la transferencia')
      },
    })
  }

  getStockDisplay(stock: MedicationStock): string {
    return `${stock.medication?.name || 'Sin nombre'} - Lote: ${stock.batchNumber} (${stock.availableQuantity || 0} disp.)`
  }

  goBack(): void {
    this.location.back()
  }
}
