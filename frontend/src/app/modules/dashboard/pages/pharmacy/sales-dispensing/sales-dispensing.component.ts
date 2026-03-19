import { Location } from '@angular/common'
import { Component, OnInit, ViewChild, computed, effect, signal } from '@angular/core'
import { MatPaginator } from '@angular/material/paginator'
import { MatSort } from '@angular/material/sort'
import { MatTableDataSource } from '@angular/material/table'
import { Router } from '@angular/router'
import { Sale, SaleStatus } from '../interfaces/pharmacy.interfaces'
import { SalesDispensingService } from '../services/sales-dispensing.service'

@Component({
  selector: 'app-sales-dispensing',
  templateUrl: './sales-dispensing.component.html',
  styleUrls: ['./sales-dispensing.component.css'],
})
export class SalesDispensingComponent implements OnInit {
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

  sales = signal<Sale[]>([])
  statFilter = signal<'all' | 'completed' | 'pending'>('all')
  loading = signal(false)

  stats = computed(() => {
    const all = this.sales()
    return {
      totalSales: all.length,
      completedSales: all.filter(s => s.status === SaleStatus.COMPLETED).length,
      pendingSales: all.filter(s => s.status === SaleStatus.PENDING).length,
      totalRevenue: all
        .filter(s => s.status === SaleStatus.COMPLETED)
        .reduce((sum, sale) => sum + sale.totalAmount, 0),
    }
  })

  filtered = computed(() => {
    const filter = this.statFilter()
    const all = this.sales()
    if (filter === 'completed') return all.filter(s => s.status === SaleStatus.COMPLETED)
    if (filter === 'pending') return all.filter(s => s.status === SaleStatus.PENDING)
    return all
  })

  constructor(
    private salesService: SalesDispensingService,
    private router: Router,
    private location: Location,
  ) {
    effect(() => {
      this.dataSource.data = this.filtered()
      if (this.dataSource.paginator) this.dataSource.paginator.firstPage()
    })
  }

  ngOnInit(): void {
    this.loadSales()
  }

  ngAfterViewInit() {
    this.dataSource.paginator = this.paginator
    this.dataSource.sort = this.sort
  }

  setStatFilter(filter: 'all' | 'completed' | 'pending'): void {
    this.statFilter.set(filter)
  }

  loadSales(): void {
    this.loading.set(true)
    this.salesService.getSales().subscribe({
      next: sales => {
        this.sales.set(sales)
        this.loading.set(false)
      },
      error: () => this.loading.set(false),
    })
  }

  applyFilter(event: Event): void {
    const filterValue = (event.target as HTMLInputElement).value
    this.dataSource.filter = filterValue.trim().toLowerCase()
    if (this.dataSource.paginator) this.dataSource.paginator.firstPage()
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
    this.salesService.updateSaleStatus(sale.id, SaleStatus.COMPLETED).subscribe(updatedSale => {
      if (updatedSale) this.loadSales()
    })
  }

  cancelSale(sale: Sale): void {
    this.salesService.updateSaleStatus(sale.id, SaleStatus.CANCELLED).subscribe(updatedSale => {
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
