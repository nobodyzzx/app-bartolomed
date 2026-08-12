import { Location } from '@angular/common'
import { Component, DestroyRef, computed, inject, OnInit, signal } from '@angular/core'
import { takeUntilDestroyed } from '@angular/core/rxjs-interop'
import { Sort } from '@angular/material/sort'
import { Router } from '@angular/router'
import { AlertService } from '@core/services/alert.service'
import { Medication, ProductType } from '../interfaces/pharmacy.interfaces'
import { matchesSearch } from '../../../../../shared/utils/text-search.util'
import { EstadoOrden, leerOrden, ordenar } from '../../../../../shared/utils/table-sort.util'
import { InventoryService } from '../services/inventory.service'

@Component({
    selector: 'app-medications',
    templateUrl: './medications.component.html',
    styleUrls: ['./medications.component.css'],
    standalone: false
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
      // Se filtra por **tipo de producto**, no por categoría farmacológica: los
      // 468 productos del catálogo real estaban todos en `category = other`, así
      // que las tarjetas de analgésicos y antibióticos no separaban nada.
      if (cat !== 'all' && (m.productType ?? ProductType.MEDICATION) !== cat) return false
      if (!term) return true
      return matchesSearch(term, m.name, m.genericName, m.brandName, m.code, m.manufacturer)
    })
  })

  countByCategory = computed(() => (cat: string) =>
    this.medications().filter(m => (m.productType ?? ProductType.MEDICATION) === cat).length
  )

  /** Columna por la que se ordena. Vacío = el orden en que llegó del catálogo. */
  orden = signal<EstadoOrden>({ key: '', dir: '' })

  onSort(sort: Sort): void {
    this.orden.set(leerOrden(sort))
    // De vuelta a la primera página: quien reordena quiere ver lo que quedó
    // arriba, no la página 7 del orden anterior.
    this.page.set(0)
  }

  ordenadas = computed(() =>
    ordenar(this.filtered(), this.orden(), (m, key) => {
      switch (key) {
        case 'code': return m.code
        case 'strength': return m.strength
        case 'dosageForm': return m.dosageForm
        case 'category': return this.getCategoryLabel(m.category)
        case 'manufacturer': return m.manufacturer
        default: return m.name
      }
    }),
  )

  setCategoryFilter(cat: string): void {
    this.categoryFilter.set(cat)
    this.page.set(0)
  }

  // Se trae el catálogo entero —el buscador filtra en cliente— pero se dibuja
  // de a poco: 468 filas de tabla de golpe es lo que colgó el inventario.
  page = signal(0)
  pageSize = signal(50)

  paged = computed(() => {
    const inicio = this.page() * this.pageSize()
    return this.ordenadas().slice(inicio, inicio + this.pageSize())
  })

  setSearch(term: string): void {
    this.search.set(term)
    this.page.set(0)
  }

  onPageChange(e: { pageIndex: number; pageSize: number }): void {
    this.page.set(e.pageIndex)
    this.pageSize.set(e.pageSize)
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
