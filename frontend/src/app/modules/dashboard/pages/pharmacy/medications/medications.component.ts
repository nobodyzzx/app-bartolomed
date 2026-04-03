import { Location } from '@angular/common'
import { Component, DestroyRef, computed, inject, OnInit, signal } from '@angular/core'
import { takeUntilDestroyed } from '@angular/core/rxjs-interop'
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
  private readonly destroyRef = inject(DestroyRef)

  loading = signal(false)
  medications = signal<Medication[]>([])
  search = signal('')
  categoryFilter = signal<string>('all')

  filtered = computed(() => {
    const term = this.search().toLowerCase().trim()
    const cat = this.categoryFilter()
    return this.medications().filter(m => {
      if (cat !== 'all' && m.category !== cat) return false
      if (!term) return true
      return [m.name, m.genericName, m.brandName, m.code, m.manufacturer]
        .filter(Boolean)
        .some(v => v!.toLowerCase().includes(term))
    })
  })

  countByCategory = computed(() => (cat: string) =>
    this.medications().filter(m => m.category === cat).length
  )

  setCategoryFilter(cat: string): void {
    this.categoryFilter.set(cat)
  }

  constructor(
    private inventoryService: InventoryService,
    private alert: AlertService,
    public router: Router,
    private location: Location,
  ) {}

  ngOnInit(): void {
    this.loadMedications()
  }

  loadMedications(): void {
    this.loading.set(true)
    this.inventoryService.getAllMedications().pipe(takeUntilDestroyed(this.destroyRef)).subscribe({
      next: result => {
        this.medications.set(result.data)
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
    this.inventoryService.deleteMedication(medication.id).pipe(takeUntilDestroyed(this.destroyRef)).subscribe({
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

  goBack(): void {
    this.location.back()
  }

  trackById(_: number, item: Medication): string {
    return item.id
  }
}
