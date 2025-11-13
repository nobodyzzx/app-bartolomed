import { Injectable } from '@angular/core'
import { Observable, of } from 'rxjs'
import { Invoice, InvoiceStatus } from '../interfaces/pharmacy.interfaces'

@Injectable({
  providedIn: 'root',
})
export class InvoicingService {
  private invoices: Invoice[] = [
    {
      id: 'FACT-001',
      invoiceNumber: 'FACT-001',
      saleId: 'VNT-001',
      issueDate: '2025-09-02',
      dueDate: '2025-09-17',
      paymentDate: '2025-09-02',
      status: InvoiceStatus.PAID,
      subtotal: 14.1,
      taxAmount: 0,
      totalAmount: 14.1,
      amountPaid: 14.1,
      balanceDue: 0,
      patientName: 'Juan Pérez',
      patientId: 'patient-001',
      clinicId: 'clinic-001',
    },
    {
      id: 'FACT-002',
      invoiceNumber: 'FACT-002',
      saleId: 'VNT-002',
      issueDate: '2025-09-03',
      dueDate: '2025-09-18',
      paymentDate: '2025-09-03',
      status: InvoiceStatus.PAID,
      subtotal: 5.75,
      taxAmount: 0,
      totalAmount: 5.75,
      amountPaid: 5.75,
      balanceDue: 0,
      patientName: 'María García',
      patientId: 'patient-002',
      clinicId: 'clinic-001',
    },
    {
      id: 'FACT-003',
      invoiceNumber: 'FACT-003',
      saleId: 'VNT-003',
      issueDate: '2025-09-03',
      dueDate: '2025-09-18',
      status: InvoiceStatus.PENDING,
      subtotal: 10.9,
      taxAmount: 0,
      totalAmount: 10.9,
      amountPaid: 0,
      balanceDue: 10.9,
      patientName: 'Carlos Rodriguez',
      patientId: 'patient-003',
      clinicId: 'clinic-001',
    },
    {
      id: 'FACT-004',
      invoiceNumber: 'FACT-004',
      saleId: 'VNT-004',
      issueDate: '2025-09-01',
      dueDate: '2025-09-16',
      paymentDate: '2025-09-01',
      status: InvoiceStatus.PAID,
      subtotal: 17.1,
      taxAmount: 0,
      totalAmount: 17.1,
      amountPaid: 17.1,
      balanceDue: 0,
      patientName: 'Ana López',
      patientId: 'patient-004',
      clinicId: 'clinic-001',
    },
    {
      id: 'FACT-005',
      invoiceNumber: 'FACT-005',
      saleId: 'VNT-005',
      issueDate: '2025-08-28',
      dueDate: '2025-09-12',
      status: InvoiceStatus.OVERDUE,
      subtotal: 25.3,
      taxAmount: 0,
      totalAmount: 25.3,
      amountPaid: 0,
      balanceDue: 25.3,
      patientName: 'Pedro Martinez',
      patientId: 'patient-005',
      clinicId: 'clinic-001',
    },
  ]

  getInvoices(): Observable<Invoice[]> {
    return of(this.invoices)
  }

  getInvoice(id: string): Observable<Invoice | undefined> {
    const invoice = this.invoices.find(i => i.id === id)
    return of(invoice)
  }

  createInvoice(
    invoice: Omit<Invoice, 'id' | 'invoiceNumber' | 'balanceDue'>,
  ): Observable<Invoice> {
    const newInvoice: Invoice = {
      ...invoice,
      id: this.generateInvoiceId(),
      invoiceNumber: this.generateInvoiceNumber(),
      status: InvoiceStatus.PENDING,
      balanceDue: invoice.totalAmount - invoice.amountPaid,
    }

    // Calcular fecha de vencimiento (15 días después de la fecha de emisión)
    if (!newInvoice.dueDate) {
      const dueDate = new Date(newInvoice.issueDate)
      dueDate.setDate(dueDate.getDate() + 15)
      newInvoice.dueDate = dueDate.toISOString().split('T')[0]
    }

    this.invoices.push(newInvoice)
    return of(newInvoice)
  }

  updateInvoiceStatus(
    id: string,
    status: InvoiceStatus,
    paymentDate?: string,
  ): Observable<Invoice | null> {
    const invoice = this.invoices.find(i => i.id === id)
    if (invoice) {
      invoice.status = status
      if (status === InvoiceStatus.PAID && paymentDate) {
        invoice.paymentDate = paymentDate
        invoice.amountPaid = invoice.totalAmount
        invoice.balanceDue = 0
      }
      return of(invoice)
    }
    return of(null)
  }

  getInvoicesByStatus(status: InvoiceStatus): Observable<Invoice[]> {
    const invoices = this.invoices.filter(i => i.status === status)
    return of(invoices)
  }

  getOverdueInvoices(): Observable<Invoice[]> {
    const today = new Date()
    const overdueInvoices = this.invoices.filter(invoice => {
      if (invoice.status === InvoiceStatus.PAID) return false
      const dueDate = new Date(invoice.dueDate || invoice.issueDate)
      return dueDate < today
    })

    // Actualizar status a overdue automáticamente
    overdueInvoices.forEach(invoice => {
      if (invoice.status !== InvoiceStatus.OVERDUE) {
        invoice.status = InvoiceStatus.OVERDUE
      }
    })

    return of(overdueInvoices)
  }

  getInvoicesByDateRange(startDate: string, endDate: string): Observable<Invoice[]> {
    const start = new Date(startDate)
    const end = new Date(endDate)

    const invoicesInRange = this.invoices.filter(invoice => {
      const invoiceDate = new Date(invoice.issueDate)
      return invoiceDate >= start && invoiceDate <= end
    })

    return of(invoicesInRange)
  }

  getTotalRevenue(startDate?: string, endDate?: string): Observable<number> {
    let invoicesToCalculate = this.invoices.filter(i => i.status === InvoiceStatus.PAID)

    if (startDate && endDate) {
      const start = new Date(startDate)
      const end = new Date(endDate)
      invoicesToCalculate = invoicesToCalculate.filter(invoice => {
        const invoiceDate = new Date(invoice.issueDate)
        return invoiceDate >= start && invoiceDate <= end
      })
    }

    const total = invoicesToCalculate.reduce((sum, invoice) => sum + invoice.totalAmount, 0)
    return of(total)
  }

  getPendingAmount(): Observable<number> {
    const pendingInvoices = this.invoices.filter(
      i => i.status === InvoiceStatus.PENDING || i.status === InvoiceStatus.OVERDUE,
    )
    const total = pendingInvoices.reduce((sum, invoice) => sum + invoice.balanceDue, 0)
    return of(total)
  }

  private generateInvoiceId(): string {
    const invoiceNumber = this.invoices.length + 1
    return `FACT-${invoiceNumber.toString().padStart(3, '0')}`
  }

  private generateInvoiceNumber(): string {
    const invoiceNumber = this.invoices.length + 1
    return `FACT-${invoiceNumber.toString().padStart(3, '0')}`
  }
}
