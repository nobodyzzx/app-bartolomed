import { Location } from '@angular/common'
import { Component, computed, DestroyRef, inject, OnInit, signal } from '@angular/core'
import { Sort } from '@angular/material/sort'
import { EstadoOrden, leerOrden, ordenar } from '../../../../../shared/utils/table-sort.util'
import { ListStateService } from '../../../../../shared/services/list-state.service'
import { takeUntilDestroyed } from '@angular/core/rxjs-interop'
import { ActivatedRoute, Router } from '@angular/router'
import { AlertService } from '@core/services/alert.service'
import { Supplier, SupplierType } from '../interfaces/pharmacy.interfaces'
import { SuppliersService } from '../services/suppliers.service'
import { matchesSearch } from '../../../../../shared/utils/text-search.util'

@Component({
    selector: 'app-suppliers',
    templateUrl: './suppliers.component.html',
    styleUrls: ['./suppliers.component.css'],
    standalone: false
})
export class SuppliersComponent implements OnInit {
  private readonly destroyRef = inject(DestroyRef)
  private readonly listState = inject(ListStateService)
  private readonly route = inject(ActivatedRoute)

  /** Clave con la que se recuerda la vista de este listado. */
  private static readonly RUTA = '/dashboard/pharmacy/suppliers'

  loading = signal(false)
  suppliers = signal<Supplier[]>([])
  search = signal('')
  statusFilter = signal<'all' | 'active' | 'inactive'>('all')

  filtered = computed(() => {
    const term = this.search().toLowerCase().trim()
    const status = this.statusFilter()
    return this.suppliers().filter(s => {
      if (status === 'active' && !s.isActive) return false
      if (status === 'inactive' && s.isActive) return false
      if (!term) return true
      return [s.nombreComercial || s.name, s.razonSocial, s.contactPerson, s.email, s.city, s.country]
        .filter(Boolean)
        .some(v => matchesSearch(term, v))
    })
  })

  /** Columna por la que se ordena. Vacío = como vino del servidor. */
  orden = signal<EstadoOrden>({ key: '', dir: '' })

  onSort(sort: Sort): void {
    this.orden.set(leerOrden(sort))
    this.recordarVista()
  }

  /** Deja la vista en la URL y la recuerda para cuando se vuelva de una ficha. */
  private recordarVista(): void {
    const estado = {
      q: this.search().trim() || undefined,
      estado: this.statusFilter() === 'all' ? undefined : this.statusFilter(),
      sort: this.orden().dir ? this.orden().key : undefined,
      dir: this.orden().dir || undefined,
    }
    this.listState.guardar(SuppliersComponent.RUTA, estado)
    this.listState.reflejarEnUrl(this.route, estado)
  }

  ordenadas = computed(() =>
    ordenar(this.filtered(), this.orden(), (s, key) => {
      switch (key) {
        case 'nombre': return s.nombreComercial || s.name
        case 'razonSocial': return s.razonSocial
        // La etiqueta y no el valor del enum: la columna dice "Medicamentos".
        case 'tipo': return this.getSupplierTypeLabel(s.tipoProveedor)
        case 'contacto': return s.contactPerson
        case 'email': return s.email
        // Ciudad y luego departamento, como se lee la celda.
        case 'ubicacion': return [s.city, s.state].filter(Boolean).join(', ')
        case 'estado': return s.isActive ? 'Activo' : 'Inactivo'
        default: return null
      }
    }),
  )

  activeCount       = computed(() => this.suppliers().filter(s => s.isActive).length)
  inactiveCount     = computed(() => this.suppliers().filter(s => !s.isActive).length)
  medicamentosCount = computed(() => this.suppliers().filter(s => s.tipoProveedor === SupplierType.MEDICAMENTOS).length)

  setSearch(term: string): void {
    this.search.set(term)
    this.recordarVista()
  }

  limpiar(): void {
    this.search.set('')
    this.statusFilter.set('all')
    // Limpiar es explícito: no debe resucitar al volver de una ficha.
    this.listState.olvidar(SuppliersComponent.RUTA)
    this.listState.reflejarEnUrl(this.route, { q: undefined, estado: undefined })
  }

  setStatusFilter(f: 'all' | 'active' | 'inactive'): void {
    this.statusFilter.set(f)
    this.recordarVista()
  }

  constructor(
    private suppliersService: SuppliersService,
    private alert: AlertService,
    private router: Router,
    private location: Location,
  ) {}

  ngOnInit(): void {
    /**
     * Volviendo de una ficha manda lo recordado: al abrir un proveedor Angular
     * destruye este componente, y sin esto la vuelta dejaba la lista entera y
     * sin filtro.
     */
    const guardado = this.listState.recuperarSiVuelve(SuppliersComponent.RUTA)
    const params = this.route.snapshot.queryParamMap
    this.search.set(String(guardado?.['q'] ?? params.get('q') ?? ''))
    const estado = String(guardado?.['estado'] ?? params.get('estado') ?? '')
    if (estado === 'active' || estado === 'inactive') this.statusFilter.set(estado)
    const sort = String(guardado?.['sort'] ?? params.get('sort') ?? '')
    const dir = String(guardado?.['dir'] ?? params.get('dir') ?? '')
    if (sort && (dir === 'asc' || dir === 'desc')) this.orden.set({ key: sort, dir })

    // Guardar lo restaurado, no solo leerlo: si nadie toca un filtro no habría
    // nada en memoria, y al volver de una ficha —a la que se llega por la ruta
    // pelada, sin parámetros— la pantalla aparecería sin filtro y en la página 1.
    this.recordarVista()

    this.load()
  }

  load(): void {
    this.loading.set(true)
    this.suppliersService.getAll().pipe(takeUntilDestroyed(this.destroyRef)).subscribe({
      next: list => {
        this.suppliers.set(list)
        this.loading.set(false)
      },
      error: () => this.loading.set(false),
    })
  }

  newSupplier(): void {
    this.router.navigate(['/dashboard/pharmacy/suppliers/new'])
  }

  edit(s: Supplier): void {
    this.router.navigate(['/dashboard/pharmacy/suppliers/edit', s.id])
  }

  delete(s: Supplier): void {
    this.alert
      .confirm({
        title: 'Eliminar proveedor',
        text: `¿Seguro que desea eliminar ${s.nombreComercial || s.name}?`,
        confirmButtonText: 'Eliminar',
        cancelButtonText: 'Cancelar',
      })
      .then(result => {
        if (!result.isConfirmed) return
        this.loading.set(true)
        this.suppliersService.remove(s.id).pipe(takeUntilDestroyed(this.destroyRef)).subscribe({
          next: () => {
            this.alert.success('Eliminado', 'Proveedor eliminado correctamente')
            this.suppliers.set(this.suppliers().filter(x => x.id !== s.id))
            this.loading.set(false)
          },
          error: () => this.loading.set(false),
        })
      })
  }

  restore(s: Supplier): void {
    this.loading.set(true)
    this.suppliersService.restore(s.id).pipe(takeUntilDestroyed(this.destroyRef)).subscribe({
      next: restored => {
        this.alert.success('Restaurado', 'Proveedor restaurado correctamente')
        this.suppliers.set(
          this.suppliers().map(x => (x.id === restored.id ? { ...x, ...restored } : x)),
        )
        this.loading.set(false)
      },
      error: () => this.loading.set(false),
    })
  }

  goBack(): void {
    this.location.back()
  }

  trackById(_: number, item: Supplier) {
    return item.id
  }

  // Helper para mostrar tipo de proveedor legible
  getSupplierTypeLabel(type: SupplierType): string {
    const labels: Record<SupplierType, string> = {
      [SupplierType.MEDICAMENTOS]: 'Medicamentos',
      [SupplierType.INSUMOS]: 'Insumos',
      [SupplierType.SERVICIOS]: 'Servicios',
    }
    return labels[type] || type
  }
}
