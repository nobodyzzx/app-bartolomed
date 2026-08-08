import { Location } from '@angular/common'
import { Component, DestroyRef, inject, OnInit } from '@angular/core'
import { takeUntilDestroyed } from '@angular/core/rxjs-interop'
import { ActivatedRoute, Router } from '@angular/router'
import { AlertService } from '@core/services/alert.service'
import { formatPlainDate } from '../../../../shared/utils/date-format.util'
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

  searchTerm = ''
  statistics: BillingStatistics | null = null
  recentInvoices: RecentInvoice[] = []
  isLoading = false
  displayedColumns: string[] = ['number', 'patient', 'date', 'amount', 'status', 'actions']

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
    this.loadData()
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

    // Facturas: "recientes" (top 5) en la vista general, o TODAS las del paciente cuando
    // se llega filtrado desde "Accesos Rápidos" en su ficha.
    const filter = this.patientIdFilter ? { patientId: this.patientIdFilter } : {}
    const pageSize = this.patientIdFilter ? 100 : 5
    this.billingService.listInvoices(1, pageSize, filter).pipe(takeUntilDestroyed(this.destroyRef)).subscribe({
      next: (response: any) => {
        const invoices = response.items || []
        this.recentInvoices = this.patientIdFilter ? invoices : invoices.slice(0, 5)
        this.patientNameFilter = this.patientIdFilter && invoices[0]
          ? `${invoices[0].patient?.firstName ?? ''} ${invoices[0].patient?.lastName ?? ''}`.trim()
          : null
      },
      error: error => {
        this.alert.error(
          'Error al cargar facturas recientes',
          error?.message || 'Inténtalo de nuevo',
        )
        this.recentInvoices = []
      },
    })
  }

  clearPatientFilter(): void {
    this.router.navigate([], { queryParams: {} })
    this.patientIdFilter = null
    this.patientNameFilter = null
    this.loadData()
  }

  getPatientName(invoice: RecentInvoice): string {
    return `${invoice.patient.firstName} ${invoice.patient.lastName}`
  }

  getStatusLabel(status: string): string {
    const labels: Record<string, string> = {
      paid: 'Pagada',
      pending: 'Pendiente',
      overdue: 'Vencida',
      cancelled: 'Cancelada',
      draft: 'Borrador',
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
        next: blob => {
          const url = window.URL.createObjectURL(blob)
          const a = document.createElement('a')
          a.href = url
          a.download = `${invoice.invoiceNumber ?? 'recibo'}.pdf`
          document.body.appendChild(a)
          a.click()
          document.body.removeChild(a)
          window.URL.revokeObjectURL(url)
        },
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

  performSearch(): void {
    const term = this.searchTerm?.trim()
    if (!term) return
    // Futuro: filtrar facturas; por ahora navega a lista con query param
    this.alert.fire({
      icon: 'info',
      title: 'Búsqueda',
      text: `Buscando: "${term}". Funcionalidad en desarrollo.`,
    })
  }
}
