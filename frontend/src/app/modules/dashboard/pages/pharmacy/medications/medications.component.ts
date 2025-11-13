import { Component, computed, OnInit, signal } from '@angular/core'
import { Router } from '@angular/router'
import { AlertService } from '@core/services/alert.service'
import { Medication } from '../interfaces/pharmacy.interfaces'
import { InventoryService } from '../services/inventory.service'

@Component({
  selector: 'app-medications',
  templateUrl: './medications.component.html',
  styleUrls: ['./medications.component.css'],
})
export class MedicationsComponent implements OnInit {
  loading = signal(false)
  medications = signal<Medication[]>([])
  search = signal('')
  filtered = computed(() => {
    const term = this.search().toLowerCase().trim()
    if (!term) return this.medications()
    return this.medications().filter(m =>
      [m.name, m.genericName, m.brandName, m.code, m.manufacturer]
        .filter(Boolean)
        .some(v => v!.toLowerCase().includes(term)),
    )
  })

  constructor(
    private inventoryService: InventoryService,
    private alert: AlertService,
    public router: Router,
  ) {}

  ngOnInit(): void {
    this.loadMedications()
  }

  loadMedications(): void {
    this.loading.set(true)
    this.inventoryService.getAllMedications().subscribe({
      next: medications => {
        this.medications.set(medications)
        this.loading.set(false)
      },
      error: () => {
        this.alert.error('Error', 'No se pudieron cargar los medicamentos')
        this.loading.set(false)
      },
    })
  }

  newMedication(): void {
    this.router.navigate(['/dashboard/pharmacy/medications/new'])
  }

  editMedication(medication: Medication): void {
    this.router.navigate(['/dashboard/pharmacy/medications/edit', medication.id])
  }

  async deleteMedication(medication: Medication): Promise<void> {
    const result = await this.alert.confirm({
      title: 'Eliminar medicamento',
      text: `¿Seguro que desea eliminar ${medication.name}?`,
      confirmButtonText: 'Eliminar',
      cancelButtonText: 'Cancelar',
    })

    if (!result.isConfirmed) return

    this.loading.set(true)
    this.inventoryService.deleteMedication(medication.id).subscribe({
      next: () => {
        this.alert.success('Eliminado', 'Medicamento eliminado correctamente')
        this.medications.set(this.medications().filter(m => m.id !== medication.id))
        this.loading.set(false)
      },
      error: () => {
        this.alert.error('Error', 'No se pudo eliminar el medicamento')
        this.loading.set(false)
      },
    })
  }

  viewStock(medication: Medication): void {
    // Navegar al inventario con filtro por medicamento
    this.router.navigate(['/dashboard/pharmacy/inventory'], {
      queryParams: { medicationId: medication.id },
    })
  }

  getCategoryLabel(category: string): string {
    const labels: Record<string, string> = {
      analgesic: 'Analgésico',
      antibiotic: 'Antibiótico',
      antihypertensive: 'Antihipertensivo',
      antiinflammatory: 'Antiinflamatorio',
      antidiabetic: 'Antidiabético',
      other: 'Otro',
    }
    return labels[category] || category
  }

  trackById(_: number, item: Medication): string {
    return item.id
  }
}
