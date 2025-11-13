import { Location } from '@angular/common'
import { Component, OnInit, inject } from '@angular/core'
import { ActivatedRoute, Router } from '@angular/router'
import { AlertService } from '@core/services/alert.service'
import { Invoice, InvoiceStatus } from '../../interfaces/pharmacy.interfaces'
import { InvoicingService } from '../../services/invoicing.service'

@Component({
  selector: 'app-invoice-detail',
  templateUrl: './invoice-detail.component.html',
  styleUrls: ['./invoice-detail.component.css'],
})
export class InvoiceDetailComponent implements OnInit {
  invoice: Invoice | null = null
  isLoading = false
  invoiceId: string | null = null

  private route = inject(ActivatedRoute)
  private router = inject(Router)
  private location = inject(Location)
  private alert = inject(AlertService)
  private invoicingService = inject(InvoicingService)

  ngOnInit(): void {
    this.invoiceId = this.route.snapshot.paramMap.get('id')
    if (this.invoiceId) {
      this.loadInvoice(this.invoiceId)
    }
  }

  private loadInvoice(id: string): void {
    this.isLoading = true
    this.invoicingService.getInvoice(id).subscribe({
      next: (invoice: Invoice | undefined) => {
        if (!invoice) {
          this.alert.error('Error', 'Factura no encontrada')
          this.isLoading = false
          return
        }
        this.invoice = invoice
        this.isLoading = false
      },
      error: (error: any) => {
        console.error('Error cargando factura:', error)
        this.alert.error('Error', 'No se pudo cargar la factura')
        this.isLoading = false
      },
    })
  }

  goBack(): void {
    this.location.back()
  }

  editInvoice(): void {
    if (this.invoiceId) {
      this.router.navigate(['/dashboard/pharmacy/invoicing/edit', this.invoiceId])
    }
  }

  async printInvoice(): Promise<void> {
    this.alert.warning('En desarrollo', 'Generando PDF de la factura...')
  }

  async markAsPaid(): Promise<void> {
    if (!this.invoice) return

    const result = await this.alert.fire({
      icon: 'question',
      title: '¿Marcar como pagada?',
      text: `¿Confirma que la factura ${this.invoice.id} ha sido pagada?`,
      showCancelButton: true,
      confirmButtonText: 'Sí, marcar como pagada',
      cancelButtonText: 'Cancelar',
    })

    if (result.isConfirmed) {
      const today = new Date().toISOString().split('T')[0]
      this.invoicingService
        .updateInvoiceStatus(this.invoice.id, InvoiceStatus.PAID, today)
        .subscribe({
          next: () => {
            this.alert.success('¡Éxito!', 'Factura marcada como pagada')
            if (this.invoiceId) {
              this.loadInvoice(this.invoiceId)
            }
          },
          error: (error: any) => {
            console.error('Error actualizando factura:', error)
          },
        })
    }
  }

  getStatusClass(status: InvoiceStatus): string {
    switch (status) {
      case InvoiceStatus.PAID:
        return 'bg-green-50 text-green-700 border-green-200'
      case InvoiceStatus.PENDING:
        return 'bg-orange-50 text-orange-700 border-orange-200'
      case InvoiceStatus.OVERDUE:
        return 'bg-red-50 text-red-700 border-red-200'
      case InvoiceStatus.CANCELLED:
        return 'bg-slate-50 text-slate-700 border-slate-200'
      default:
        return 'bg-slate-50 text-slate-700 border-slate-200'
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

  getStatusIcon(status: InvoiceStatus): string {
    switch (status) {
      case InvoiceStatus.PAID:
        return 'check_circle'
      case InvoiceStatus.PENDING:
        return 'pending'
      case InvoiceStatus.OVERDUE:
        return 'warning'
      case InvoiceStatus.CANCELLED:
        return 'cancel'
      default:
        return 'info'
    }
  }
}
