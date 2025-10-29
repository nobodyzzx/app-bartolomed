import { Component, OnInit, ViewChild } from '@angular/core';
import { MatPaginator } from '@angular/material/paginator';
import { MatSort } from '@angular/material/sort';
import { MatTableDataSource } from '@angular/material/table';
import { Invoice } from '../interfaces/pharmacy.interfaces';
import { InvoicingService } from '../services/invoicing.service';

@Component({
  selector: 'app-invoicing',
  templateUrl: './invoicing.component.html',
  styleUrls: ['./invoicing.component.css']
})
export class InvoicingComponent implements OnInit {
  
  @ViewChild(MatPaginator) paginator!: MatPaginator;
  @ViewChild(MatSort) sort!: MatSort;

  displayedColumns: string[] = ['id', 'patient', 'date', 'total', 'status', 'dueDate', 'actions'];
  dataSource = new MatTableDataSource<Invoice>();
  
  invoices: Invoice[] = [];
  
  stats = {
    totalInvoices: 0,
    paidInvoices: 0,
    pendingInvoices: 0,
    overdueInvoices: 0,
    totalRevenue: 0,
    pendingAmount: 0
  };

  constructor(private invoicingService: InvoicingService) { }

  ngOnInit(): void {
    this.loadInvoices();
    this.loadStats();
  }

  ngAfterViewInit() {
    this.dataSource.paginator = this.paginator;
    this.dataSource.sort = this.sort;
  }

  loadInvoices(): void {
    this.invoicingService.getInvoices().subscribe(invoices => {
      this.invoices = invoices;
      this.dataSource.data = invoices;
      this.calculateStats();
    });
  }

  loadStats(): void {
    this.invoicingService.getTotalRevenue().subscribe(revenue => {
      this.stats.totalRevenue = revenue;
    });
    
    this.invoicingService.getPendingAmount().subscribe(pending => {
      this.stats.pendingAmount = pending;
    });
  }

  calculateStats(): void {
    this.stats.totalInvoices = this.invoices.length;
    this.stats.paidInvoices = this.invoices.filter(i => i.status === 'paid').length;
    this.stats.pendingInvoices = this.invoices.filter(i => i.status === 'pending').length;
    this.stats.overdueInvoices = this.invoices.filter(i => i.status === 'overdue').length;
  }

  applyFilter(event: Event): void {
    const filterValue = (event.target as HTMLInputElement).value;
    this.dataSource.filter = filterValue.trim().toLowerCase();

    if (this.dataSource.paginator) {
      this.dataSource.paginator.firstPage();
    }
  }

  getStatusChipClass(status: string): string {
    switch (status) {
      case 'paid': return 'status-paid';
      case 'pending': return 'status-pending';
      case 'overdue': return 'status-overdue';
      case 'cancelled': return 'status-cancelled';
      default: return '';
    }
  }

  getStatusLabel(status: string): string {
    switch (status) {
      case 'paid': return 'Pagada';
      case 'pending': return 'Pendiente';
      case 'overdue': return 'Vencida';
      case 'cancelled': return 'Cancelada';
      default: return status;
    }
  }

  isOverdue(invoice: Invoice): boolean {
    if (invoice.status === 'paid') return false;
    const today = new Date();
    const dueDate = new Date(invoice.dueDate || invoice.date);
    return dueDate < today;
  }

  getDaysOverdue(invoice: Invoice): number {
    if (!this.isOverdue(invoice)) return 0;
    const today = new Date();
    const dueDate = new Date(invoice.dueDate || invoice.date);
    const diffTime = today.getTime() - dueDate.getTime();
    return Math.ceil(diffTime / (1000 * 60 * 60 * 24));
  }

  viewInvoiceDetails(invoice: Invoice): void {
    // TODO: Implementar vista de detalle de factura
    console.log('Ver detalles de factura:', invoice);
  }

  markAsPaid(invoice: Invoice): void {
    const today = new Date().toISOString().split('T')[0];
    this.invoicingService.updateInvoiceStatus(invoice.id, 'paid', today).subscribe(updatedInvoice => {
      if (updatedInvoice) {
        this.loadInvoices();
        this.loadStats();
      }
    });
  }

  cancelInvoice(invoice: Invoice): void {
    this.invoicingService.updateInvoiceStatus(invoice.id, 'cancelled').subscribe(updatedInvoice => {
      if (updatedInvoice) {
        this.loadInvoices();
        this.loadStats();
      }
    });
  }

  createNewInvoice(): void {
    // TODO: Implementar creación de nueva factura
    console.log('Crear nueva factura');
  }

  printInvoice(invoice: Invoice): void {
    // TODO: Implementar impresión de factura
    console.log('Imprimir factura:', invoice);
  }

  sendReminder(invoice: Invoice): void {
    // TODO: Implementar envío de recordatorio
    console.log('Enviar recordatorio:', invoice);
  }
}
