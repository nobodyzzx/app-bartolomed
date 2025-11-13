import { Location } from '@angular/common'
import { Component, OnInit } from '@angular/core'
import { Router } from '@angular/router'
import { AlertService } from '@core/services/alert.service'
import { BillingService } from './billing.service'

interface BillingStatistics {
  totalInvoices: number
  paid: number
  pending: number
  overdue: number
  totalRevenue: number
  pendingRevenue: number
}

interface RecentInvoice {
  id: string
  invoiceNumber: string
  patient: {
    firstName: string
    lastName: string
  }
  issueDate: string
  totalAmount: number
  status: 'paid' | 'pending' | 'overdue' | 'cancelled' | 'draft'
}

@Component({
  selector: 'app-billing-page',
  templateUrl: './billing.page.component.html',
  styleUrls: ['./billing.page.component.css'],
})
export class BillingPageComponent implements OnInit {
  searchTerm = ''
  statistics: BillingStatistics | null = null
  recentInvoices: RecentInvoice[] = []
  isLoading = false
  displayedColumns: string[] = ['number', 'patient', 'date', 'amount', 'status', 'actions']

  constructor(
    private router: Router,
    private alert: AlertService,
    private billingService: BillingService,
    private location: Location,
  ) {}

  ngOnInit(): void {
    this.loadData()
  }

  loadData(): void {
    this.isLoading = true

    // Cargar estadísticas
    this.billingService.getStatistics().subscribe({
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

    // Cargar facturas recientes
    this.billingService.listInvoices(1, 5).subscribe({
      next: (response: any) => {
        const invoices = response.items || []
        this.recentInvoices = invoices.slice(0, 5)
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

  formatDate(dateStr: string): string {
    const date = new Date(dateStr)
    return date.toLocaleDateString('es-ES', {
      day: '2-digit',
      month: '2-digit',
      year: 'numeric',
    })
  }

  formatCurrency(amount: number): string {
    return new Intl.NumberFormat('es-ES', {
      style: 'currency',
      currency: 'EUR',
    }).format(amount)
  }

  navigateToNewInvoice(): void {
    this.router.navigate(['/dashboard/billing/invoices/new'])
  }

  navigateToInvoicesList(): void {
    // Aún no existe componente de lista dedicado, se reutiliza dashboard filtrando en el futuro
    this.router.navigate(['/dashboard/billing'])
  }

  viewInvoice(invoice: RecentInvoice): void {
    this.router.navigate(['/dashboard/billing/invoices', invoice.id, 'edit'])
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
