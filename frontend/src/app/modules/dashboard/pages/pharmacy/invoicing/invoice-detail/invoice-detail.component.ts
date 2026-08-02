import { CommonModule, Location } from '@angular/common'
import { Component, DestroyRef, OnInit, inject } from '@angular/core'
import { takeUntilDestroyed } from '@angular/core/rxjs-interop'
import { ActivatedRoute } from '@angular/router'
import { AlertService } from '@core/services/alert.service'
import { MaterialModule } from '../../../../../../material/material.module'
import { SharedModule } from '../../../../../../shared/shared.module'
import { Invoice, InvoiceStatus } from '../../interfaces/pharmacy.interfaces'
import { InvoicingService } from '../../services/invoicing.service'
import { SalesDispensingService } from '../../services/sales-dispensing.service'

@Component({
  selector: 'app-invoice-detail',
  standalone: true,
  imports: [CommonModule, MaterialModule, SharedModule],
  templateUrl: './invoice-detail.component.html',
  styleUrls: ['./invoice-detail.component.css'],
})
export class InvoiceDetailComponent implements OnInit {
  private readonly destroyRef = inject(DestroyRef)

  invoice: Invoice | null = null
  isLoading = false
  invoiceId: string | null = null
  /** true cuando la venta existe pero todavía no se generó una factura para ella */
  noInvoiceYet = false
  isGenerating = false

  private route = inject(ActivatedRoute)
  private location = inject(Location)
  private alert = inject(AlertService)
  private invoicingService = inject(InvoicingService)
  private salesService = inject(SalesDispensingService)

  ngOnInit(): void {
    // El listado de Facturación navega por id de VENTA (1 venta → a lo sumo 1 factura).
    this.invoiceId = this.route.snapshot.paramMap.get('id')
    if (this.invoiceId) {
      this.loadInvoice(this.invoiceId)
    }
  }

  private loadInvoice(saleId: string): void {
    this.isLoading = true
    this.invoicingService.getInvoiceBySale(saleId).pipe(takeUntilDestroyed(this.destroyRef)).subscribe({
      next: (invoice: Invoice) => {
        this.invoice = invoice
        this.isLoading = false
      },
      error: (error: any) => {
        if (error?.status === 404) {
          this.noInvoiceYet = true
        } else {
          this.alert.error('Error', 'No se pudo cargar la factura')
        }
        this.isLoading = false
      },
    })
  }

  goBack(): void {
    this.location.back()
  }

  generateInvoice(): void {
    if (!this.invoiceId) return
    const saleId = this.invoiceId

    this.isGenerating = true
    this.salesService.getSaleById(saleId).pipe(takeUntilDestroyed(this.destroyRef)).subscribe({
      next: sale => {
        const today = new Date()
        const dueDate = new Date(today)
        dueDate.setDate(dueDate.getDate() + 15)

        this.invoicingService
          .createInvoice({
            saleId,
            patientName: sale.patientName || sale.patient?.fullName || sale.patient?.name || 'Cliente',
            invoiceDate: today.toISOString().split('T')[0],
            dueDate: dueDate.toISOString().split('T')[0],
          })
          .pipe(takeUntilDestroyed(this.destroyRef))
          .subscribe({
            next: () => {
              this.isGenerating = false
              this.noInvoiceYet = false
              this.loadInvoice(saleId)
            },
            error: () => {
              this.isGenerating = false
            },
          })
      },
      error: () => {
        this.isGenerating = false
      },
    })
  }

  editInvoice(): void {
    // No existe todavía un formulario de edición de facturas en este módulo.
    this.alert.warning('En desarrollo', 'La edición de facturas estará disponible próximamente')
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
        .pipe(takeUntilDestroyed(this.destroyRef))
        .subscribe({
          next: () => {
            this.alert.success('¡Éxito!', 'Factura marcada como pagada')
            if (this.invoiceId) {
              this.loadInvoice(this.invoiceId)
            }
          },
          error: () => {},
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
