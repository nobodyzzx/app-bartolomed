import { Component, OnInit, ViewChild } from '@angular/core'
import { MatPaginator } from '@angular/material/paginator'
import { MatSort } from '@angular/material/sort'
import { MatTableDataSource } from '@angular/material/table'
import { Invoice, InvoiceStatus } from '../interfaces/pharmacy.interfaces'
import { InvoicingService } from '../services/invoicing.service'

@Component({
  selector: 'app-invoicing',
  templateUrl: './invoicing.component.html',
  styleUrls: ['./invoicing.component.css'],
})
export class InvoicingComponent implements OnInit {
  @ViewChild(MatPaginator) paginator!: MatPaginator
  @ViewChild(MatSort) sort!: MatSort

  displayedColumns: string[] = ['id', 'patient', 'date', 'total', 'status', 'dueDate', 'actions']
  dataSource = new MatTableDataSource<Invoice>()

  invoices: Invoice[] = []

  stats = {
    totalInvoices: 0,
    paidInvoices: 0,
    pendingInvoices: 0,
    overdueInvoices: 0,
    totalRevenue: 0,
    pendingAmount: 0,
  }

  constructor(private invoicingService: InvoicingService) {}

  ngOnInit(): void {
    this.loadInvoices()
    this.loadStats()
  }

  ngAfterViewInit() {
    this.dataSource.paginator = this.paginator
    this.dataSource.sort = this.sort
  }

  loadInvoices(): void {
    this.invoicingService.getInvoices().subscribe(invoices => {
      this.invoices = invoices
      this.dataSource.data = invoices
      this.calculateStats()
    })
  }

  loadStats(): void {
    this.invoicingService.getTotalRevenue().subscribe(revenue => {
      this.stats.totalRevenue = revenue
    })

    this.invoicingService.getPendingAmount().subscribe(pending => {
      this.stats.pendingAmount = pending
    })
  }

  calculateStats(): void {
    this.stats.totalInvoices = this.invoices.length
    this.stats.paidInvoices = this.invoices.filter(i => i.status === InvoiceStatus.PAID).length
    this.stats.pendingInvoices = this.invoices.filter(
      i => i.status === InvoiceStatus.PENDING,
    ).length
    this.stats.overdueInvoices = this.invoices.filter(
      i => i.status === InvoiceStatus.OVERDUE,
    ).length
  }

  applyFilter(event: Event): void {
    const filterValue = (event.target as HTMLInputElement).value
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

  isOverdue(invoice: Invoice): boolean {
    if (invoice.status === InvoiceStatus.PAID) return false
    const today = new Date()
    const dueDate = new Date(invoice.dueDate || invoice.issueDate)
    return dueDate < today
  }

  getDaysOverdue(invoice: Invoice): number {
    if (!this.isOverdue(invoice)) return 0
    const today = new Date()
    const dueDate = new Date(invoice.dueDate || invoice.issueDate)
    const diffTime = today.getTime() - dueDate.getTime()
    return Math.ceil(diffTime / (1000 * 60 * 60 * 24))
  }

  viewInvoiceDetails(invoice: Invoice): void {
    // TODO: Implementar vista de detalle de factura
  }

  markAsPaid(invoice: Invoice): void {
    const today = new Date().toISOString().split('T')[0]
    this.invoicingService
      .updateInvoiceStatus(invoice.id, InvoiceStatus.PAID, today)
      .subscribe(updatedInvoice => {
        if (updatedInvoice) {
          this.loadInvoices()
          this.loadStats()
        }
      })
  }

  cancelInvoice(invoice: Invoice): void {
    this.invoicingService
      .updateInvoiceStatus(invoice.id, InvoiceStatus.CANCELLED)
      .subscribe(updatedInvoice => {
        if (updatedInvoice) {
          this.loadInvoices()
          this.loadStats()
        }
      })
  }

  createNewInvoice(): void {
    // TODO: Implementar creación de nueva factura
  }

  printInvoice(invoice: Invoice): void {
    // TODO: Implementar impresión de factura
  }

  sendReminder(invoice: Invoice): void {
    // TODO: Implementar envío de recordatorio
  }
}
