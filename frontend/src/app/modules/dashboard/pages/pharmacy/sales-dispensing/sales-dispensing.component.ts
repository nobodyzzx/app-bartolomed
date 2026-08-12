import { Location } from '@angular/common'
import { Sort } from '@angular/material/sort'
import { EstadoOrden, leerOrden } from '../../../../../shared/utils/table-sort.util'
import { Component, DestroyRef, inject, OnDestroy, OnInit, ViewChild } from '@angular/core'
import { takeUntilDestroyed } from '@angular/core/rxjs-interop'
import { FormControl } from '@angular/forms'
import { MatPaginator, PageEvent } from '@angular/material/paginator'
import { Router } from '@angular/router'
import { Subject } from 'rxjs'
import { debounceTime, distinctUntilChanged, takeUntil } from 'rxjs/operators'
import { PAYMENT_METHODS } from '../../checkout/checkout.service'
import { toLocalISODate } from '../../../../../shared/utils/date-format.util'
import { Sale, SaleStatus } from '../interfaces/pharmacy.interfaces'
import { SalesDispensingService, SalesSummary } from '../services/sales-dispensing.service'

/** Los estados que la pantalla deja filtrar, más el "todas". */
type StatusFilter = 'all' | SaleStatus

@Component({
    selector: 'app-sales-dispensing',
    templateUrl: './sales-dispensing.component.html',
    standalone: false
})
export class SalesDispensingComponent implements OnInit, OnDestroy {
  private readonly destroyRef = inject(DestroyRef)
  private readonly destroy$ = new Subject<void>()

  @ViewChild(MatPaginator) paginator!: MatPaginator

  readonly SaleStatus = SaleStatus
  readonly paymentMethods = PAYMENT_METHODS

  sales: Sale[] = []
  totalRecords = 0
  pageSize = 25
  currentPage = 0
  loading = false
  summary: SalesSummary | null = null

  // ── Filtros ───────────────────────────────────────────────────────────────
  // Todos viajan al backend. Antes la búsqueda usaba `MatTableDataSource.filter`,
  // que solo mira las filas ya cargadas: con 125 ventas, buscar algo de la página
  // 3 devolvía "sin resultados" aunque existiera.
  statFilter: StatusFilter = 'all'
  searchTerm = ''
  paymentFilter = ''
  dateFromControl = new FormControl<Date | null>(null)
  dateToControl = new FormControl<Date | null>(null)

  private readonly search$ = new Subject<string>()

  constructor(
    private salesService: SalesDispensingService,
    private router: Router,
    private location: Location,
  ) {}

  ngOnInit(): void {
    // El término se debouncea para no lanzar una consulta por tecla.
    this.search$
      .pipe(debounceTime(350), distinctUntilChanged(), takeUntil(this.destroy$))
      .subscribe(term => {
        this.searchTerm = term
        this.resetToFirstPage()
        this.loadSales()
      })

    this.dateFromControl.valueChanges.pipe(takeUntil(this.destroy$)).subscribe(() => this.onFilterChange())
    this.dateToControl.valueChanges.pipe(takeUntil(this.destroy$)).subscribe(() => this.onFilterChange())

    this.loadSummary()
    this.loadSales()
  }

  ngOnDestroy(): void {
    this.destroy$.next()
    this.destroy$.complete()
  }

  get hasActiveFilters(): boolean {
    return (
      !!this.searchTerm ||
      this.statFilter !== 'all' ||
      !!this.paymentFilter ||
      !!this.dateFromControl.value ||
      !!this.dateToControl.value
    )
  }

  loadSummary(): void {
    this.salesService.getSalesSummary().pipe(takeUntilDestroyed(this.destroyRef)).subscribe({
      next: summary => { this.summary = summary },
      error: () => { /* no crítico: las tarjetas quedan en 0 */ },
    })
  }

  loadSales(): void {
    this.loading = true
    this.salesService
      .getSales({
        page: this.currentPage + 1,
        limit: this.pageSize,
        status: this.statFilter === 'all' ? undefined : this.statFilter,
        search: this.searchTerm || undefined,
        paymentMethod: this.paymentFilter || undefined,
        startDate: toLocalISODate(this.dateFromControl.value) || undefined,
        endDate: toLocalISODate(this.dateToControl.value) || undefined,
        sortBy: this.orden.dir ? this.orden.key : undefined,
        sortDir: this.orden.dir ? (this.orden.dir === 'asc' ? 'ASC' : 'DESC') : undefined,
      })
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: result => {
          this.sales = result.data
          this.totalRecords = result.total
          this.loading = false
        },
        error: () => (this.loading = false),
      })
  }

  /**
   * Columna elegida en la cabecera. El orden lo resuelve el backend: aquí solo
   * llega una página, así que ordenar en el navegador reordenaría lo cargado y
   * dejaría el resto de las ventas fuera.
   */
  orden: EstadoOrden = { key: '', dir: '' }

  onSort(sort: Sort): void {
    this.orden = leerOrden(sort)
    // A la primera página: quien reordena quiere ver lo que quedó arriba.
    this.currentPage = 0
    this.loadSales()
  }

  onPageChange(event: PageEvent): void {
    this.currentPage = event.pageIndex
    this.pageSize = event.pageSize
    this.loadSales()
  }

  onSearch(term: string): void {
    this.search$.next(term)
  }

  setStatFilter(filter: StatusFilter): void {
    this.statFilter = filter
    this.onFilterChange()
  }

  onPaymentFilterChange(method: string): void {
    this.paymentFilter = method
    this.onFilterChange()
  }

  clearFilters(): void {
    this.searchTerm = ''
    this.statFilter = 'all'
    this.paymentFilter = ''
    this.dateFromControl.setValue(null, { emitEvent: false })
    this.dateToControl.setValue(null, { emitEvent: false })
    this.onFilterChange()
  }

  private onFilterChange(): void {
    this.resetToFirstPage()
    this.loadSales()
  }

  private resetToFirstPage(): void {
    this.currentPage = 0
    if (this.paginator) this.paginator.firstPage()
  }

  // ── Presentación ──────────────────────────────────────────────────────────

  getStatusBadgeClass(status: string): string {
    switch (status) {
      case 'completed': return 'bg-green-100 text-green-700'
      case 'pending': return 'bg-amber-100 text-amber-700'
      case 'cancelled': return 'bg-red-100 text-red-700'
      default: return 'bg-slate-100 text-slate-700'
    }
  }

  getStatusLabel(status: string): string {
    switch (status) {
      case 'completed': return 'Completada'
      case 'pending': return 'Pendiente'
      case 'cancelled': return 'Cancelada'
      default: return status
    }
  }

  /**
   * Icono y etiqueta salen de `PAYMENT_METHODS`, la lista compartida con el punto
   * de cobro. El switch anterior comparaba contra 'efectivo'/'tarjeta' mientras el
   * backend guarda 'cash'/'qr': ninguna rama casaba y siempre caía al icono por
   * defecto, además de imprimir el valor crudo en la columna.
   *
   * La clínica solo cobra en efectivo y por QR, pero hay ventas históricas con
   * tarjeta, transferencia, seguro y mixto. `PAYMENT_METHODS` solo trae los dos
   * vigentes —es la lista del selector—, así que sin este mapa las filas antiguas
   * imprimían el valor crudo de la base: "transfer", "card".
   */
  private static readonly LEGACY_METHODS: Record<string, { label: string; icon: string }> = {
    card: { label: 'Tarjeta', icon: 'credit_card' },
    transfer: { label: 'Transferencia', icon: 'account_balance' },
    insurance: { label: 'Seguro', icon: 'health_and_safety' },
    mixed: { label: 'Mixto', icon: 'account_balance_wallet' },
  }

  getPaymentMethodIcon(method: string): string {
    return (
      this.paymentMethods.find(m => m.value === method)?.icon ??
      SalesDispensingComponent.LEGACY_METHODS[method]?.icon ??
      'payments'
    )
  }

  getPaymentMethodLabel(method: string): string {
    return (
      this.paymentMethods.find(m => m.value === method)?.label ??
      SalesDispensingComponent.LEGACY_METHODS[method]?.label ??
      method
    )
  }

  // ── Acciones ──────────────────────────────────────────────────────────────

  viewSaleDetails(sale: Sale): void {
    this.router.navigate(['/dashboard/pharmacy/sales-dispensing', sale.id])
  }

  canComplete(sale: Sale): boolean {
    return sale.status === SaleStatus.PENDING
  }

  canCancel(sale: Sale): boolean {
    return sale.status !== SaleStatus.CANCELLED
  }

  completeSale(sale: Sale): void {
    this.salesService.updateSaleStatus(sale.id, SaleStatus.COMPLETED).pipe(takeUntilDestroyed(this.destroyRef)).subscribe(updated => {
      if (updated) {
        this.loadSales()
        this.loadSummary()
      }
    })
  }

  cancelSale(sale: Sale): void {
    this.salesService.updateSaleStatus(sale.id, SaleStatus.CANCELLED).pipe(takeUntilDestroyed(this.destroyRef)).subscribe(updated => {
      if (updated) {
        this.loadSales()
        this.loadSummary()
      }
    })
  }

  createNewSale(): void {
    this.router.navigate(['/dashboard/pharmacy/sales-dispensing/new'])
  }

  goBack(): void {
    this.location.back()
  }
}
