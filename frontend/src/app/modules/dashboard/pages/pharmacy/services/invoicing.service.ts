import { Injectable } from '@angular/core';
import { Observable, of } from 'rxjs';
import { Invoice } from '../interfaces/pharmacy.interfaces';

@Injectable({
  providedIn: 'root'
})
export class InvoicingService {

  private invoices: Invoice[] = [
    { 
      id: 'FACT-001', 
      saleId: 'VNT-001', 
      date: '2025-09-02', 
      total: 15.65, 
      status: 'paid',
      patientName: 'Juan Pérez',
      dueDate: '2025-09-17',
      paymentDate: '2025-09-02'
    },
    { 
      id: 'FACT-002', 
      saleId: 'VNT-002', 
      date: '2025-09-03', 
      total: 5.75, 
      status: 'paid',
      patientName: 'María García',
      dueDate: '2025-09-18',
      paymentDate: '2025-09-03'
    },
    { 
      id: 'FACT-003', 
      saleId: 'VNT-003', 
      date: '2025-09-03', 
      total: 12.40, 
      status: 'pending',
      patientName: 'Carlos Rodriguez',
      dueDate: '2025-09-18'
    },
    { 
      id: 'FACT-004', 
      saleId: 'VNT-004', 
      date: '2025-09-01', 
      total: 18.90, 
      status: 'paid',
      patientName: 'Ana López',
      dueDate: '2025-09-16',
      paymentDate: '2025-09-01'
    },
    { 
      id: 'FACT-005', 
      saleId: 'VNT-005', 
      date: '2025-08-28', 
      total: 25.30, 
      status: 'overdue',
      patientName: 'Pedro Martinez',
      dueDate: '2025-09-12'
    }
  ];

  getInvoices(): Observable<Invoice[]> {
    return of(this.invoices);
  }

  getInvoice(id: string): Observable<Invoice | undefined> {
    const invoice = this.invoices.find(i => i.id === id);
    return of(invoice);
  }

  createInvoice(invoice: Omit<Invoice, 'id'>): Observable<Invoice> {
    const newInvoice: Invoice = {
      ...invoice,
      id: this.generateInvoiceId(),
      status: 'pending'
    };
    
    // Calcular fecha de vencimiento (15 días después de la fecha de factura)
    if (!newInvoice.dueDate) {
      const dueDate = new Date(newInvoice.date);
      dueDate.setDate(dueDate.getDate() + 15);
      newInvoice.dueDate = dueDate.toISOString().split('T')[0];
    }
    
    this.invoices.push(newInvoice);
    return of(newInvoice);
  }

  updateInvoiceStatus(id: string, status: Invoice['status'], paymentDate?: string): Observable<Invoice | null> {
    const invoice = this.invoices.find(i => i.id === id);
    if (invoice) {
      invoice.status = status;
      if (status === 'paid' && paymentDate) {
        invoice.paymentDate = paymentDate;
      }
      return of(invoice);
    }
    return of(null);
  }

  getInvoicesByStatus(status: Invoice['status']): Observable<Invoice[]> {
    const invoices = this.invoices.filter(i => i.status === status);
    return of(invoices);
  }

  getOverdueInvoices(): Observable<Invoice[]> {
    const today = new Date();
    const overdueInvoices = this.invoices.filter(invoice => {
      if (invoice.status === 'paid') return false;
      const dueDate = new Date(invoice.dueDate || invoice.date);
      return dueDate < today;
    });
    
    // Actualizar status a overdue automáticamente
    overdueInvoices.forEach(invoice => {
      if (invoice.status !== 'overdue') {
        invoice.status = 'overdue';
      }
    });
    
    return of(overdueInvoices);
  }

  getInvoicesByDateRange(startDate: string, endDate: string): Observable<Invoice[]> {
    const start = new Date(startDate);
    const end = new Date(endDate);
    
    const invoicesInRange = this.invoices.filter(invoice => {
      const invoiceDate = new Date(invoice.date);
      return invoiceDate >= start && invoiceDate <= end;
    });
    
    return of(invoicesInRange);
  }

  getTotalRevenue(startDate?: string, endDate?: string): Observable<number> {
    let invoicesToCalculate = this.invoices.filter(i => i.status === 'paid');
    
    if (startDate && endDate) {
      const start = new Date(startDate);
      const end = new Date(endDate);
      invoicesToCalculate = invoicesToCalculate.filter(invoice => {
        const invoiceDate = new Date(invoice.date);
        return invoiceDate >= start && invoiceDate <= end;
      });
    }
    
    const total = invoicesToCalculate.reduce((sum, invoice) => sum + invoice.total, 0);
    return of(total);
  }

  getPendingAmount(): Observable<number> {
    const pendingInvoices = this.invoices.filter(i => i.status === 'pending' || i.status === 'overdue');
    const total = pendingInvoices.reduce((sum, invoice) => sum + invoice.total, 0);
    return of(total);
  }

  private generateInvoiceId(): string {
    const invoiceNumber = this.invoices.length + 1;
    return `FACT-${invoiceNumber.toString().padStart(3, '0')}`;
  }
}
