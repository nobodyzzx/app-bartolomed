import { Location } from '@angular/common'
import { Component, DestroyRef, computed, inject, OnInit, signal } from '@angular/core'
import { takeUntilDestroyed } from '@angular/core/rxjs-interop'
import { Sort } from '@angular/material/sort'
import { ActivatedRoute, Router } from '@angular/router'
import { AlertService } from '@core/services/alert.service'
import { Medication, ProductType } from '../interfaces/pharmacy.interfaces'
import { matchesSearch } from '../../../../../shared/utils/text-search.util'
import { EstadoOrden, leerOrden, ordenar } from '../../../../../shared/utils/table-sort.util'
import { ListStateService } from '../../../../../shared/services/list-state.service'
import { InventoryService } from '../services/inventory.service'

@Component({
    selector: 'app-medications',
    templateUrl: './medications.component.html',
    styleUrls: ['./medications.component.css'],
    standalone: false
})
export class MedicationsComponent implements OnInit {
  private readonly destroyRef = inject(DestroyRef)
  private readonly listState = inject(ListStateService)
  private readonly route = inject(ActivatedRoute)

  /** Clave con la que se recuerda la vista de este listado. */
  private static readonly RUTA = '/dashboard/pharmacy/medications'

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
    // arriba, no la página 7 del orden anterior. Antes de recordar la vista, o
    // se guardaría la página vieja.
    this.page.set(0)
    this.recordarVista()
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
    this.recordarVista()
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
    this.recordarVista()
  }

  onPageChange(e: { pageIndex: number; pageSize: number }): void {
    this.page.set(e.pageIndex)
    this.pageSize.set(e.pageSize)
    this.recordarVista()
  }

  constructor(
    private inventoryService: InventoryService,
    private alert: AlertService,
    public router: Router,
    private location: Location,
  ) {}

  ngOnInit(): void {
    // Volviendo de una ficha manda lo recordado: sin esto, corregir un producto
    // devolvía el catálogo entero desde la página 1.
    const guardado = this.listState.recuperarSiVuelve(MedicationsComponent.RUTA)
    const params = this.route.snapshot.queryParamMap
    this.search.set(String(guardado?.['q'] ?? params.get('q') ?? ''))
    this.categoryFilter.set(String(guardado?.['tipo'] ?? params.get('tipo') ?? 'all'))
    this.page.set(Math.max(0, Number(guardado?.['page'] ?? params.get('page') ?? 1) - 1))
    const sort = String(guardado?.['sort'] ?? params.get('sort') ?? '')
    const dir = String(guardado?.['dir'] ?? params.get('dir') ?? '')
    if (sort && (dir === 'asc' || dir === 'desc')) this.orden.set({ key: sort, dir })

    this.loadMedications()
  }

  /** Deja la vista en la URL y la recuerda para cuando se vuelva de una ficha. */
  private recordarVista(): void {
    const estado = {
      q: this.search().trim() || undefined,
      tipo: this.categoryFilter() === 'all' ? undefined : this.categoryFilter(),
      sort: this.orden().dir ? this.orden().key : undefined,
      dir: this.orden().dir || undefined,
      page: this.page() + 1,
    }
    this.listState.guardar(MedicationsComponent.RUTA, estado)
    this.listState.reflejarEnUrl(this.route, estado)
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
