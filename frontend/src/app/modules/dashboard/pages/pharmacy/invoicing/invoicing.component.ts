import { Location } from '@angular/common'
import { Component, DestroyRef, OnInit, ViewChild, inject } from '@angular/core'
import { takeUntilDestroyed } from '@angular/core/rxjs-interop'
import { MatPaginator } from '@angular/material/paginator'
import { MatSort } from '@angular/material/sort'
import { MatTableDataSource } from '@angular/material/table'
import { Router } from '@angular/router'
import { AlertService } from '@core/services/alert.service'
import { InvoiceStatus, PaginatedResult, Sale, SaleRow } from '../interfaces/pharmacy.interfaces'
import { SalesDispensingService, SalesSummary } from '../services/sales-dispensing.service'

@Component({
  selector: 'app-invoicing',
  templateUrl: './invoicing.component.html',
  styleUrls: ['./invoicing.component.css'],
})
export class InvoicingComponent implements OnInit {
  private readonly destroyRef = inject(DestroyRef)

  @ViewChild(MatPaginator) paginator!: MatPaginator
  @ViewChild(MatSort) sort!: MatSort

  displayedColumns: string[] = ['saleNumber', 'patient', 'date', 'paymentMethod', 'total', 'status']
  dataSource = new MatTableDataSource<SaleRow>([])

  invoices: SaleRow[] = [] // objetos derivados de ventas
  selectedPaymentMethod: string | null = null
  loading = false

  // Exponer enum para uso en template
  InvoiceStatus = InvoiceStatus

  // Filtros
  selectedStatus: InvoiceStatus | null = null
  startDate: Date | null = null
  endDate: Date | null = null

  stats = {
    totalInvoices: 0,
    paidInvoices: 0,
    pendingInvoices: 0,
    overdueInvoices: 0,
    totalRevenue: 0,
    pendingAmount: 0,
  }

  private alert = inject(AlertService)
  private router = inject(Router)
  private location = inject(Location)

  constructor(private salesService: SalesDispensingService) {}

  ngOnInit(): void {
    this.loadPaidSales()
    this.loadStats()
  }

  ngAfterViewInit() {
    this.dataSource.paginator = this.paginator
    this.dataSource.sort = this.sort
  }

  loadPaidSales(): void {
    this.loading = true
    this.salesService
      .getCompletedSalesFiltered({
        paymentMethod: this.selectedPaymentMethod || undefined,
        startDate: this.startDate || undefined,
        endDate: this.endDate || undefined,
        limit: 200,
      })
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: (result: PaginatedResult<Sale>) => {
          const sales = result.data
          this.invoices = sales.map(
            (s: Sale): SaleRow => ({
              saleNumber: s.saleNumber,
              id: s.id,
              saleId: s.id,
              patientName: (s as any).patient?.fullName || (s as any).patient?.name || 'Paciente',
              date: (s as any).createdAt || new Date().toISOString(),
              paymentMethod: (s as any).paymentMethod,
              total: (s as any).totalAmount,
              status: InvoiceStatus.PAID,
            }),
          )
          this.dataSource.data = this.invoices
          this.calculateStats()
          this.loading = false
        },
        error: () => {
          this.loading = false
        },
      })
  }

  loadStats(): void {
    this.salesService
      .getSalesSummary(this.startDate || undefined, this.endDate || undefined)
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: (summary: SalesSummary) => {
          this.stats.totalInvoices = summary.totalSales
          this.stats.paidInvoices = summary.completedSales
          this.stats.pendingInvoices = summary.pendingSales
          this.stats.overdueInvoices = 0
          this.stats.totalRevenue = summary.totalRevenue
          this.stats.pendingAmount = 0 // pendiente real podría mapearse a ventas pending si se reintroducen
        },
        error: () => {},
      })
  }

  calculateStats(): void {
    this.stats.totalInvoices = this.invoices.length
    this.stats.paidInvoices = this.invoices.length
    this.stats.pendingInvoices = 0
    this.stats.overdueInvoices = 0
    this.loadStats()
  }

  applyFilter(value: string): void {
    const filterValue = value
    this.dataSource.filter = filterValue.trim().toLowerCase()

    if (this.dataSource.paginator) {
      this.dataSource.paginator.firstPage()
    }
  }

  getStatusChipClass(status: InvoiceStatus): string {
    switch (status) {
      case InvoiceStatus.PAID:
        return 'status-paid'
      case InvoiceStatus.PENDING:
        return 'status-pending'
      case InvoiceStatus.OVERDUE:
        return 'status-overdue'
      case InvoiceStatus.CANCELLED:
        return 'status-cancelled'
      default:
        return ''
    }
  }

  getStatusLabel(status: InvoiceStatus): string {
    switch (status) {
      case InvoiceStatus.PAID:
        return 'Pagada'
      case InvoiceStatus.PENDING:
        return 'Pendiente'
      case InvoiceStatus.OVERDUE:
        return 'Vencida'
      case InvoiceStatus.CANCELLED:
        return 'Cancelada'
      default:
        return status
    }
  }

  isOverdue(_invoice: any): boolean {
    return false
  }
  getDaysOverdue(_invoice: any): number {
    return 0
  }

  // Modo solo visualización
  viewInvoiceDetails(invoice: any): void {
    // Navegación opcional deshabilitada; mantener sólo lectura.
    // Si se desea activar detalle más adelante, descomentar la línea siguiente.
    // this.router.navigate(['/dashboard/pharmacy/invoicing', invoice.id])
  }

  goBack(): void {
    this.location.back()
  }

  // Métodos de filtrado
  onStatusFilterChange(): void {
    this.applyFilters()
  }

  onDateFilterChange(): void {
    this.loadPaidSales()
    this.loadStats()
  }

  clearFilters(): void {
    this.selectedStatus = null
    this.selectedPaymentMethod = null
    this.startDate = null
    this.endDate = null
    this.dataSource.filter = ''
    this.loadPaidSales()
    this.loadStats()
  }

  onPaymentMethodChange(): void {
    this.loadPaidSales()
    this.loadStats()
  }

  applyFilters(): void {
    let filteredData = [...this.invoices]

    // Filtro por estado
    if (this.selectedStatus) {
      filteredData = filteredData.filter(invoice => invoice.status === this.selectedStatus)
    }

    // Filtro por rango de fechas
    const parseDate = (inv: any) => {
      const raw = inv.date
      return raw ? new Date(raw) : null
    }
    if (this.startDate) {
      filteredData = filteredData.filter(inv => {
        const d = parseDate(inv)
        return d ? d >= this.startDate! : false
      })
    }
    if (this.endDate) {
      filteredData = filteredData.filter(inv => {
        const d = parseDate(inv)
        return d ? d <= this.endDate! : false
      })
    }

    this.dataSource.data = filteredData
  }

  exportToExcel(): void {
    const rows = [
      ['Nro Venta', 'Paciente', 'Fecha', 'Método Pago', 'Total'],
      ...this.invoices.map(i => [
        i.saleNumber,
        i.patientName,
        new Date(i.date).toLocaleDateString(),
        i.paymentMethod,
        i.total,
      ]),
    ]
    const csv = rows.map(r => r.map(v => '"' + (v ?? '') + '"').join(',')).join('\n')
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = `ventas_${Date.now()}.csv`
    a.click()
    URL.revokeObjectURL(url)
    this.alert.success('Exportación', 'CSV generado')
  }

  filterByStatus(status: InvoiceStatus | null): void {
    this.selectedStatus = status
    this.applyFilters()
  }
}
