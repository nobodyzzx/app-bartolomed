import { Location } from '@angular/common'
import { Component, OnDestroy, OnInit, signal } from '@angular/core'
import { ActivatedRoute, Router } from '@angular/router'
import { PageEvent } from '@angular/material/paginator'
import { AlertService } from '@core/services/alert.service'
import { Subject, debounceTime, distinctUntilChanged, takeUntil } from 'rxjs'
import { ClinicContextService } from '../../../../clinics/services/clinic-context.service'
import { MedicationStock } from '../interfaces/pharmacy.interfaces'
import { matchesSearch } from '../../../../../shared/utils/text-search.util'
import { Sort } from '@angular/material/sort'
import { EstadoOrden, leerOrden, num, ordenar } from '../../../../../shared/utils/table-sort.util'
import { ListStateService } from '../../../../../shared/services/list-state.service'
import { InventoryService } from '../services/inventory.service'

/**
 * El inventario se trae entero: el buscador filtra en cliente y las tarjetas de
 * resumen se calculan sobre lo cargado, así que paginar aquí no escondería una
 * página, escondería productos del buscador y falsearía el valor total. San
 * Bartolomé ronda los 475 lotes.
 */
const INVENTORY_PAGE_SIZE = 2000

/**
 * Filas pintadas a la vez, por defecto. Se carga el inventario entero —el
 * buscador filtra en cliente y el resumen se calcula sobre todo— pero se dibuja
 * de a poco: 475 filas, cada una con sus tooltips y sus cinco llamadas de
 * plantilla, bastan para colgar el navegador. El usuario puede cambiarlo desde
 * el paginador.
 */
const DEFAULT_PAGE_SIZE = 50

@Component({
    selector: 'app-inventory',
    templateUrl: './inventory.component.html',
    styleUrls: ['./inventory.component.css'],
    standalone: false
})
export class InventoryComponent implements OnInit, OnDestroy {
  products: MedicationStock[] = []
  lowStockProducts: MedicationStock[] = []
  expiringProducts: MedicationStock[] = []
  searchTermRaw: string = ''
  searchTerm: string = ''
  clinicId: string | null = null
  loading = signal<boolean>(false)

  private destroy$ = new Subject<void>()
  private searchInput$ = new Subject<string>()

  stats = {
    totalProducts: 0,
    lowStock: 0,
    expiring: 0,
    totalValue: 0,
  }

  statFilter = signal<'all' | 'low' | 'expiring'>('all')

  setStatFilter(filter: 'all' | 'low' | 'expiring'): void {
    this.statFilter.set(filter)
    this.refreshView()
    this.recordarVista()
  }

  constructor(
    private inventoryService: InventoryService,
    private location: Location,
    private clinicContext: ClinicContextService,
    private alertService: AlertService,
    private router: Router,
    private route: ActivatedRoute,
    private listState: ListStateService,
  ) {}

  ngOnInit(): void {
    this.clinicId = this.clinicContext.clinicId
    if (!this.clinicId) {
      this.alertService.error(
        'Contexto de clínica',
        'Seleccione una clínica para ver el inventario',
      )
      return
    }
    // Volviendo de una ficha manda lo recordado: sin esto, editar el stock de
    // un lote devolvía los 488 desde la página 1 y sin la tarjeta activa.
    this.restaurarVista()

    this.reloadAll()
    this.searchInput$
      .pipe(debounceTime(300), distinctUntilChanged(), takeUntil(this.destroy$))
      .subscribe(value => {
        this.searchTerm = (value || '').trim()
        this.refreshView()
        this.recordarVista()
      })
  }

  ngOnDestroy(): void {
    this.destroy$.next()
    this.destroy$.complete()
  }

  reloadAll(): void {
    this.loading.set(true)
    this.loadProducts()
    this.loadLowStockProducts()
    this.loadExpiringProducts()
  }

  goBack(): void {
    this.location.back()
  }

  goToMedications(): void {
    this.router.navigate(['/dashboard/pharmacy/medications'])
  }

  loadProducts(): void {
    if (!this.clinicId) return
    // Sin límite explícito el servicio pide 100, y con el inventario real
    // (475 lotes) eso dejaba fuera a 375: no salían en la tabla, el buscador
    // —que filtra en cliente— no los encontraba, y las tarjetas de resumen
    // contaban solo los cargados, así que el valor del inventario aparecía por
    // la sexta parte de lo que es.
    this.inventoryService.getProducts(this.clinicId, 1, INVENTORY_PAGE_SIZE).subscribe({
      next: result => {
        this.products = result.data
        this.calculateStats()
        this.refreshView()
        this.loading.set(false)
      },
      error: () => this.loading.set(false),
    })
  }

  loadLowStockProducts(): void {
    if (!this.clinicId) return
    this.inventoryService.getLowStockProducts(this.clinicId).subscribe(products => {
      this.lowStockProducts = products
      this.calculateStats()
      this.refreshView()
    })
  }

  loadExpiringProducts(): void {
    if (!this.clinicId) return
    this.inventoryService.getExpiringProducts(this.clinicId, 30).subscribe(products => {
      this.expiringProducts = products
      this.calculateStats()
      this.refreshView()
    })
  }

  calculateStats(): void {
    this.stats.totalProducts = this.products.length
    this.stats.lowStock = this.lowStockProducts.length
    this.stats.expiring = this.expiringProducts.length
    this.stats.totalValue = this.products.reduce(
      (sum, product) => sum + product.quantity * product.sellingPrice,
      0,
    )
  }

  applyFilterManual(): void {
    this.searchInput$.next(this.searchTermRaw)
  }

  isLowStock(product: MedicationStock): boolean {
    return product.quantity <= (product.minimumStock || 0)
  }

  /**
   * Sin fecha registrada no se opina. `new Date(null)` daría 1970 y todo lote
   * sin vencimiento saldría en rojo como si estuviera por caducar.
   */
  isExpiring(product: MedicationStock): boolean {
    if (!product.expiryDate) return false
    const today = new Date()
    const thirtyDaysFromNow = new Date(today.getTime() + 30 * 24 * 60 * 60 * 1000)
    const expirationDate = new Date(product.expiryDate)
    return expirationDate <= thirtyDaysFromNow
  }

  /** Sin tarifa asignada. El punto de venta lo rechaza hasta que se le ponga. */
  needsPrice(product: MedicationStock): boolean {
    return Number(product.sellingPrice) <= 0
  }

  /** El vencimiento no está registrado: se muestra como tal, no como vacío. */
  hasNoExpiry(product: MedicationStock): boolean {
    return !product.expiryDate
  }

  /**
   * Muestra médica. La marca del lote manda sobre la del producto: hay
   * medicamentos que entran comprados y de muestra a la vez, y cada fila del
   * inventario es un lote concreto. La del producto cubre a los que solo
   * llegan por esa vía y por tanto no marcan lote a lote.
   */
  isSample(product: MedicationStock): boolean {
    return !!(product.isMedicalSample || product.medication?.isMedicalSample)
  }

  createMedication(): void {
    this.router.navigate(['/dashboard/pharmacy/inventory/medication/new'])
  }

  addProduct(): void {
    this.router.navigate(['/dashboard/pharmacy/inventory/stock/new'])
  }

  editProduct(product: MedicationStock): void {
    this.router.navigate(['/dashboard/pharmacy/inventory/stock/edit', product.id])
  }

  deleteProduct(product: MedicationStock): void {
    this.alertService
      .confirm({
        title: 'Dar de baja el lote',
        text: product.quantity > 0
          ? `${product.medication?.name ?? 'Este lote'} — lote ${product.batchNumber} tiene ${product.quantity} unidades. Al darlo de baja sale del inventario y del listado impreso. ¿Continuar?`
          : `${product.medication?.name ?? 'Este lote'} — lote ${product.batchNumber} saldrá del inventario. ¿Continuar?`,
      })
      .then(result => {
        if (result.isConfirmed) {
          this.inventoryService.deleteProduct(product.id).subscribe({
            next: success => {
              if (success) {
                this.products = this.products.filter(p => p.id !== product.id)
                this.refreshView()
                this.lowStockProducts = this.lowStockProducts.filter(p => p.id !== product.id)
                this.expiringProducts = this.expiringProducts.filter(p => p.id !== product.id)
                this.calculateStats()
              }
            },
          })
        }
      })
  }

  /**
   * Lista filtrada y ordenada, recalculada **solo** cuando cambia lo que la
   * determina.
   *
   * Era un getter llamado desde la plantilla, y eso significaba copiar y
   * ordenar el arreglo entero en cada ciclo de detección de cambios. Con los 28
   * productos de demostración no se notaba; con los 475 del inventario real
   * congelaba la pestaña hasta dejarla sin responder.
   */
  filteredProducts: MedicationStock[] = []

  /** Solo lo que se pinta. Ver `DEFAULT_PAGE_SIZE`. */
  pagedProducts: MedicationStock[] = []
  page = signal(1)
  pageSize = DEFAULT_PAGE_SIZE

  get rangeFrom(): number {
    return this.filteredProducts.length === 0 ? 0 : (this.page() - 1) * this.pageSize + 1
  }

  get rangeTo(): number {
    return Math.min(this.page() * this.pageSize, this.filteredProducts.length)
  }

  /** `mat-paginator` cuenta las páginas desde 0; aquí se llevan desde 1. */
  onPageChange(event: PageEvent): void {
    this.pageSize = event.pageSize
    this.page.set(event.pageIndex + 1)
    this.applyPage()
    this.recordarVista()
  }

  private applyPage(): void {
    const start = (this.page() - 1) * this.pageSize
    this.pagedProducts = this.filteredProducts.slice(start, start + this.pageSize)
  }

  /**
   * Columna elegida en la cabecera. Vacío = el orden por defecto de la
   * pantalla, que no es alfabético: primero lo que falta.
   */
  orden = signal<EstadoOrden>({ key: '', dir: '' })

  onSort(sort: Sort): void {
    this.orden.set(leerOrden(sort))
    this.refreshView()
    this.recordarVista()
  }

  /** Clave con la que se recuerda la vista de este listado. */
  private static readonly RUTA = '/dashboard/pharmacy/inventory'

  /** Deja la vista en la URL y la recuerda para cuando se vuelva de una ficha. */
  private recordarVista(): void {
    const estado = {
      q: (this.searchTerm || '').trim() || undefined,
      tarjeta: this.statFilter() || undefined,
      sort: this.orden().dir ? this.orden().key : undefined,
      dir: this.orden().dir || undefined,
      page: this.page(),
    }
    this.listState.guardar(InventoryComponent.RUTA, estado)
    this.listState.reflejarEnUrl(this.route, estado)
  }

  /** Restaura la vista si se vuelve de una ficha; si no, lee la URL. */
  private restaurarVista(): void {
    const guardado = this.listState.recuperarSiVuelve(InventoryComponent.RUTA)
    const params = this.route.snapshot.queryParamMap
    this.searchTerm = String(guardado?.['q'] ?? params.get('q') ?? '')
    const tarjeta = String(guardado?.['tarjeta'] ?? params.get('tarjeta') ?? '')
    if (tarjeta === 'low' || tarjeta === 'expiring') this.statFilter.set(tarjeta)
    const sort = String(guardado?.['sort'] ?? params.get('sort') ?? '')
    const dir = String(guardado?.['dir'] ?? params.get('dir') ?? '')
    if (sort && (dir === 'asc' || dir === 'desc')) this.orden.set({ key: sort, dir })
    const page = Number(guardado?.['page'] ?? params.get('page') ?? 1)
    if (page > 1) this.page.set(page)
  }

  /** Rehace la vista. Llamar cada vez que cambien datos, búsqueda o filtro. */
  private refreshView(): void {
    const term = (this.searchTerm || '').toLowerCase()
    let base = this.products
    if (this.statFilter() === 'low') base = this.lowStockProducts
    else if (this.statFilter() === 'expiring') base = this.expiringProducts
    const rows = !term
      ? base
      : base.filter(p =>
          matchesSearch(term, p.medication?.name, p.medication?.brandName, p.batchNumber, p.location),
        )
    // Sin columna elegida se conserva el orden propio de esta pantalla: el
    // stock bajo primero. No es una preferencia estética — es la lista de lo
    // que hay que reponer, y alfabético la escondería entre 475 lotes.
    this.filteredProducts = this.orden().dir
      ? ordenar(rows, this.orden(), (p, key) => {
          switch (key) {
            case 'lote': return p.batchNumber
            case 'medicamento': return p.medication?.name
            case 'marca': return p.medication?.brandName
            case 'stock': return num(p.quantity)
            // Sin precio es un hueco, no un cero: el helper lo manda al final
            // en los dos sentidos, que es donde estorba menos.
            case 'precio': return this.needsPrice(p) ? null : num(p.sellingPrice)
            case 'vencimiento': return p.expiryDate ? new Date(p.expiryDate) : null
            case 'estado': return this.productStatus(p).label
            default: return null
          }
        })
      : [...rows].sort((a, b) => {
          const lowA = this.isLowStock(a) ? 1 : 0
          const lowB = this.isLowStock(b) ? 1 : 0
          if (lowA !== lowB) return lowB - lowA
          const nameA = a.medication?.name || ''
          const nameB = b.medication?.name || ''
          return nameA.localeCompare(nameB, 'es')
        })
    // Al filtrar, volver a la primera página: quedarse en la 7 de una lista que
    // ahora tiene 2 mostraría una tabla vacía con resultados detrás.
    this.page.set(1)
    this.applyPage()
  }

  trackById(_: number, item: MedicationStock) {
    return item.id
  }

  productStatus(product: MedicationStock): { label: string; classes: string; dot: string } {
    const low = this.isLowStock(product)
    const exp = this.isExpiring(product)
    if (low && exp) {
      return {
        label: 'Stock bajo y por vencer',
        classes: 'bg-red-50 text-red-700 border-red-200',
        dot: 'bg-red-500',
      }
    }
    if (low) {
      return {
        label: 'Stock bajo',
        classes: 'bg-orange-50 text-orange-700 border-orange-200',
        dot: 'bg-orange-500',
      }
    }
    if (exp) {
      return {
        label: 'Por vencer',
        classes: 'bg-amber-50 text-amber-700 border-amber-200',
        dot: 'bg-amber-500',
      }
    }
    return {
      label: 'OK',
      classes: 'bg-green-50 text-green-700 border-green-200',
      dot: 'bg-green-500',
    }
  }
}
