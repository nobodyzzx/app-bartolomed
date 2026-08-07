import { Location } from '@angular/common'
import { AfterViewInit, Component, DestroyRef, inject, OnInit, ViewChild } from '@angular/core'
import { takeUntilDestroyed } from '@angular/core/rxjs-interop'
import { MatPaginator, PageEvent } from '@angular/material/paginator'
import { MatSort } from '@angular/material/sort'
import { MatTableDataSource } from '@angular/material/table'
import { Router } from '@angular/router'
import { Sale, SaleStatus } from '../interfaces/pharmacy.interfaces'
import { SalesDispensingService, SalesSummary } from '../services/sales-dispensing.service'

@Component({
    selector: 'app-sales-dispensing',
    templateUrl: './sales-dispensing.component.html',
    styleUrls: ['./sales-dispensing.component.css'],
    standalone: false
})
export class SalesDispensingComponent implements OnInit, AfterViewInit {
  private readonly destroyRef = inject(DestroyRef)

  @ViewChild(MatPaginator) paginator!: MatPaginator
  @ViewChild(MatSort) sort!: MatSort

  displayedColumns: string[] = [
    'id',
    'patient',
    'date',
    'total',
    'status',
    'paymentMethod',
    'actions',
  ]
  dataSource = new MatTableDataSource<Sale>()

  totalRecords = 0
  pageSize = 25
  currentPage = 0
  statFilter: 'all' | 'completed' | 'pending' = 'all'
  loading = false
  summary: SalesSummary | null = null

  constructor(
    private salesService: SalesDispensingService,
    private router: Router,
    private location: Location,
  ) {}

  ngOnInit(): void {
    this.loadSummary()
    this.loadSales()
  }

  ngAfterViewInit() {
    this.dataSource.sort = this.sort
  }

  loadSummary(): void {
    this.salesService.getSalesSummary().pipe(takeUntilDestroyed(this.destroyRef)).subscribe({
      next: summary => { this.summary = summary },
      error: () => { /* non-critical */ },
    })
  }

  loadSales(): void {
    this.loading = true
    const status = this.statFilter === 'all' ? undefined : this.statFilter as SaleStatus
    this.salesService.getSales({
      page: this.currentPage + 1,
      limit: this.pageSize,
      status,
    }).pipe(takeUntilDestroyed(this.destroyRef)).subscribe({
      next: result => {
        this.dataSource.data = result.data
        this.totalRecords = result.total
        this.loading = false
      },
      error: () => this.loading = false,
    })
  }

  onPageChange(event: PageEvent): void {
    this.currentPage = event.pageIndex
    this.pageSize = event.pageSize
    this.loadSales()
  }

  setStatFilter(filter: 'all' | 'completed' | 'pending'): void {
    this.statFilter = filter
    this.currentPage = 0
    if (this.paginator) this.paginator.firstPage()
    this.loadSales()
  }

  applyFilter(value: string): void {
    this.dataSource.filter = value.trim().toLowerCase()
  }

  getStatusChipClass(status: string): string {
    switch (status) {
      case 'completed': return 'status-completed'
      case 'pending': return 'status-pending'
      case 'cancelled': return 'status-cancelled'
      default: return ''
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

  getPaymentMethodIcon(method: string): string {
    switch (method?.toLowerCase()) {
      case 'efectivo': return 'payments'
      case 'tarjeta': return 'credit_card'
      case 'transferencia': return 'account_balance'
      default: return 'payment'
    }
  }

  viewSaleDetails(sale: Sale): void {
    this.router.navigate(['/dashboard/pharmacy/sales-dispensing', sale.id])
  }

  completeSale(sale: Sale): void {
    this.salesService.updateSaleStatus(sale.id, SaleStatus.COMPLETED).pipe(takeUntilDestroyed(this.destroyRef)).subscribe(updatedSale => {
      if (updatedSale) this.loadSales()
    })
  }

  cancelSale(sale: Sale): void {
    this.salesService.updateSaleStatus(sale.id, SaleStatus.CANCELLED).pipe(takeUntilDestroyed(this.destroyRef)).subscribe(updatedSale => {
      if (updatedSale) this.loadSales()
    })
  }

  createNewSale(): void {
    this.router.navigate(['/dashboard/pharmacy/sales-dispensing/new'])
  }

  goBack(): void {
    this.location.back()
  }

  printReceipt(_sale: Sale): void {
    // TODO: Implementar impresión de recibo
  }
}
