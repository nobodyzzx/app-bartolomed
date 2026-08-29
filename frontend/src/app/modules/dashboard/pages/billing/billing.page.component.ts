import { Location } from '@angular/common'
import { Component, DestroyRef, inject, OnInit } from '@angular/core'
import { PageEvent } from '@angular/material/paginator'
import { Sort } from '@angular/material/sort'
import { Subject, debounceTime, distinctUntilChanged } from 'rxjs'
import { EstadoOrden, leerOrden } from '../../../../shared/utils/table-sort.util'
import { ListStateService } from '../../../../shared/services/list-state.service'
import { takeUntilDestroyed } from '@angular/core/rxjs-interop'
import { ActivatedRoute, Router } from '@angular/router'
import { AlertService } from '@core/services/alert.service'
import { formatPlainDate } from '../../../../shared/utils/date-format.util'
import { openPdfInNewTab } from '../../../../shared/utils/pdf-viewer.util'
import { BillingService } from './billing.service'
import { BillingStatistics, RecentInvoice } from './interfaces/billing-ui.interfaces'

@Component({
    selector: 'app-billing-page',
    templateUrl: './billing.page.component.html',
    styleUrls: ['./billing.page.component.css'],
    standalone: false
})
export class BillingPageComponent implements OnInit {
  private readonly destroyRef = inject(DestroyRef)
  private readonly listState = inject(ListStateService)

  /** Clave con la que se recuerda la vista de este listado. */
  private static readonly RUTA = '/dashboard/billing'

  searchTerm = ''
  statistics: BillingStatistics | null = null
  /**
   * Las facturas que la tabla muestra. Se llamaba `recentInvoices` y traía las
   * cinco últimas: encima de un buscador que no filtraba nada y sin paginador,
   * la pantalla enseñaba 5 de N haciéndolas pasar por la lista. Ahora es la
   * lista, con búsqueda, orden y paginación resueltos en el servidor.
   */
  invoices: RecentInvoice[] = []
  isLoading = false
  displayedColumns: string[] = ['number', 'patient', 'date', 'amount', 'status', 'actions']

  totalRecords = 0
  page = 0
  pageSize = 25

  /** Columna elegida en la cabecera. El orden lo resuelve el backend. */
  orden: EstadoOrden = { key: '', dir: '' }

  /** La búsqueda pega al servidor, así que se espera a que se deje de teclear. */
  private readonly search$ = new Subject<string>()

  // Filtro por paciente (llegando desde "Accesos Rápidos" en la ficha del paciente)
  patientIdFilter: string | null = null
  patientNameFilter: string | null = null

  constructor(
    private router: Router,
    private route: ActivatedRoute,
    private alert: AlertService,
    private billingService: BillingService,
    private location: Location,
  ) {}

  ngOnInit(): void {
    this.patientIdFilter = this.route.snapshot.queryParamMap.get('patientId')
    this.restaurarVista()

    this.search$
      .pipe(debounceTime(300), distinctUntilChanged(), takeUntilDestroyed(this.destroyRef))
      .subscribe(term => {
        this.searchTerm = term
        this.page = 0
        this.recordarVista()
    this.loadInvoices()
      })

    this.loadData()
  }

  onSearch(term: string): void {
    this.search$.next(term)
  }

  /**
   * Restaura la vista si se vuelve de una factura; si no, lee la URL. Al abrir
   * una Angular destruye este componente, y sin esto la vuelta dejaba el
   * listado entero en la página 1.
   */
  private restaurarVista(): void {
    const guardado = this.listState.recuperarSiVuelve(BillingPageComponent.RUTA)
    const params = this.route.snapshot.queryParamMap
    this.searchTerm = String(guardado?.['q'] ?? params.get('q') ?? '')
    this.page = Math.max(0, Number(guardado?.['page'] ?? params.get('page') ?? 1) - 1)
    const sort = String(guardado?.['sort'] ?? params.get('sort') ?? '')
    const dir = String(guardado?.['dir'] ?? params.get('dir') ?? '')
    if (sort && (dir === 'asc' || dir === 'desc')) this.orden = { key: sort, dir }

    // Guardar lo restaurado, no solo leerlo: si nadie toca un filtro no habría
    // nada en memoria, y al volver de una ficha la pantalla —a la que se llega
    // por su ruta pelada, sin parámetros— aparecería en la página 1 y sin orden.
    this.recordarVista()
  }

  /** Deja la vista en la URL y la recuerda para cuando se vuelva de una factura. */
  private recordarVista(): void {
    const estado = {
      q: this.searchTerm.trim() || undefined,
      sort: this.orden.dir ? this.orden.key : undefined,
      dir: this.orden.dir || undefined,
      page: this.page + 1,
    }
    this.listState.guardar(BillingPageComponent.RUTA, estado)
    this.listState.reflejarEnUrl(this.route, estado)
  }

  onSort(sort: Sort): void {
    this.orden = leerOrden(sort)
    // A la primera página: quien reordena quiere ver lo que quedó arriba.
    this.page = 0
    this.recordarVista()
    this.loadInvoices()
  }

  onPageChange(event: PageEvent): void {
    this.page = event.pageIndex
    this.pageSize = event.pageSize
    this.recordarVista()
    this.loadInvoices()
  }

  clearSearch(): void {
    this.searchTerm = ''
    this.page = 0
    this.recordarVista()
    this.loadInvoices()
  }

  loadData(): void {
    this.isLoading = true

    // Cargar estadísticas
    this.billingService.getStatistics().pipe(takeUntilDestroyed(this.destroyRef)).subscribe({
      next: stats => {
        this.statistics = stats
        this.isLoading = false
      },
      error: error => {
        this.alert.error('Error al cargar estadísticas', error?.message || 'Inténtalo de nuevo')
        this.isLoading = false
        // Inicializar con valores vacíos en caso de error
        this.statistics = {
          totalInvoices: 0,
          paid: 0,
          pending: 0,
          overdue: 0,
          totalRevenue: 0,
          pendingRevenue: 0,
        }
      },
    })

    this.loadInvoices()
  }

  /**
   * Búsqueda, orden y paginación se resuelven en el servidor. En el navegador
   * solo alcanzarían a la página cargada: buscar una factura de la página 3
   * devolvería "sin resultados" aunque exista, y ordenar reordenaría un recorte
   * haciéndolo pasar por la lista entera.
   */
  loadInvoices(): void {
    const filter: Record<string, string> = {}
    if (this.patientIdFilter) filter['patientId'] = this.patientIdFilter
    if (this.searchTerm.trim()) filter['search'] = this.searchTerm.trim()
    if (this.orden.dir) {
      filter['sortBy'] = this.orden.key
      filter['sortDir'] = this.orden.dir === 'asc' ? 'ASC' : 'DESC'
    }

    this.billingService.listInvoices(this.page + 1, this.pageSize, filter)
      .pipe(takeUntilDestroyed(this.destroyRef)).subscribe({
        next: (response: any) => {
          this.invoices = response.items || []
          this.totalRecords = response.total ?? this.invoices.length
          this.patientNameFilter = this.patientIdFilter && this.invoices[0]
            ? `${this.invoices[0].patient?.firstName ?? ''} ${this.invoices[0].patient?.lastName ?? ''}`.trim()
            : null
        },
        error: error => {
          this.alert.error('Error al cargar facturas', error?.message || 'Inténtalo de nuevo')
          this.invoices = []
          this.totalRecords = 0
        },
      })
  }

  clearPatientFilter(): void {
    this.router.navigate([], { queryParams: {} })
    this.patientIdFilter = null
    this.patientNameFilter = null
    this.loadData()
  }

  /**
   * `invoice.patient` puede ser null (venta de mostrador, sin paciente
   * registrado) — antes se accedía directo a `.firstName` y rompía el
   * render de esa fila (y arrastraba la tabla entera) apenas apareciera
   * una factura así.
   */
  getPatientName(invoice: RecentInvoice): string {
    if (!invoice.patient) return 'Cliente sin registrar'
    return `${invoice.patient.firstName} ${invoice.patient.lastName}`
  }

  getStatusLabel(status: string): string {
    const labels: Record<string, string> = {
      paid: 'Pagada',
      pending: 'Pendiente',
      overdue: 'Vencida',
      cancelled: 'Cancelada',
      draft: 'Borrador',
      // Faltaban los dos: la celda enseñaba `partially_paid` y `refunded` en
      // crudo, con guion bajo, entre etiquetas en español.
      partially_paid: 'Pago parcial',
      refunded: 'Reembolsada',
    }
    return labels[status] || status
  }

  getStatusClass(status: string): string {
    const classes: Record<string, string> = {
      paid: 'bg-green-100 text-green-700',
      pending: 'bg-yellow-100 text-yellow-700',
      overdue: 'bg-red-100 text-red-700',
      cancelled: 'bg-slate-100 text-slate-700',
      draft: 'bg-blue-100 text-blue-700',
      // Ámbar: está cobrada a medias, ni pendiente del todo ni saldada.
      partially_paid: 'bg-amber-100 text-amber-700',
      refunded: 'bg-purple-100 text-purple-700',
    }
    return classes[status] || 'bg-gray-100 text-gray-700'
  }

  /**
   * `issueDate` es una columna `date`: formatearla en la zona local del
   * navegador (UTC−4) la retrasaba un día, así que una factura emitida hoy
   * aparecía con la fecha de ayer en el listado.
   */
  formatDate(dateStr: string): string {
    return formatPlainDate(dateStr)
  }

  formatCurrency(amount: number): string {
    return new Intl.NumberFormat('es-BO', {
      style: 'currency',
      currency: 'BOB',
    }).format(amount)
  }
  /** Las facturas nacen de los cargos del paciente, no de un alta manual. */
  goToCheckout(): void {
    this.router.navigate(['/dashboard/checkout'])
  }

  /**
   * Una factura anulada o devuelta no debe nada (ver Invoice.calculateAmounts,
   * remainingAmount = 0 en esos estados) — el resto de estados vivos sí puede
   * tener saldo si el punto de cobro registró un pago parcial.
   */
  canCollectBalance(invoice: RecentInvoice): boolean {
    return (
      Number(invoice.remainingAmount ?? 0) > 0 &&
      invoice.status !== 'cancelled' &&
      invoice.status !== 'refunded'
    )
  }

  collectBalance(invoice: RecentInvoice): void {
    this.router.navigate(['/dashboard/billing/payments/new', invoice.id])
  }

  navigateToInvoicesList(): void {
    // Aún no existe componente de lista dedicado, se reutiliza dashboard filtrando en el futuro
    this.router.navigate(['/dashboard/billing'])
  }

  /**
   * Abre el recibo en PDF de la factura.
   *
   * Antes navegaba a `/dashboard/billing/invoices/:id/edit`, una ruta que no
   * existe en `billing.module.ts` —solo hay la lista y el alta de pagos—, así que
   * el comodín del router devolvía al usuario al dashboard sin decir nada: hacer
   * clic en cualquier factura parecía cerrar la pantalla. Tampoco tendría sentido
   * "editar" una factura emitida: se corrigen anulándolas y volviendo a cobrar.
   * Lo que hace falta en ventanilla es el comprobante, y el recibo ya existe.
   */
  viewInvoice(invoice: RecentInvoice): void {
    this.billingService
      .downloadReceipt(invoice.id)
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: blob => openPdfInNewTab(blob, `${invoice.invoiceNumber ?? 'recibo'}.pdf`),
      })
  }

  /**
   * Anular es la vía para corregir un descuento mal aplicado que se detecta
   * después de emitir el recibo: los cargos vuelven a la cuenta del paciente,
   * el pago se cancela y se vuelve a cobrar con el descuento correcto.
   */
  async voidInvoice(invoice: RecentInvoice): Promise<void> {
    const result = await this.alert.prompt({
      title: `¿Anular la factura ${invoice.invoiceNumber ?? ''}?`.trim(),
      inputLabel: 'Motivo de la anulación',
      inputPlaceholder: 'Por ejemplo: descuento aplicado por error',
      confirmButtonText: 'Anular factura',
      cancelButtonText: 'Cancelar',
      inputValidator: value =>
        (value ?? '').trim().length < 5 ? 'Explique por qué se anula (mínimo 5 caracteres)' : null,
    })
    if (!result.isConfirmed || !result.value) return

    this.billingService
      .voidInvoice(invoice.id, result.value)
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({ next: () => this.loadData() })
  }

  goBack(): void {
    this.location.back()
  }

}
