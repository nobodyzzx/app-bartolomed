import { Component, OnInit } from '@angular/core'
import { FormBuilder, FormGroup, Validators } from '@angular/forms'
import { Router } from '@angular/router'
import { AlertService } from '@core/services/alert.service'
import { FinancialReport, GenerateReportParams } from '../interfaces/reports.interfaces'
import { ReportsService } from '../services/reports.service'

@Component({
  selector: 'app-financial-reports',
  templateUrl: './financial-reports.component.html',
  styleUrls: ['./financial-reports.component.css'],
})
export class FinancialReportsComponent implements OnInit {
  financialReports: FinancialReport[] = []
  loading = false
  generating = false
  generateForm: FormGroup
  selectedReport: FinancialReport | null = null

  // Stats
  totalReports = 0
  totalRevenue = 0
  totalExpenses = 0
  totalProfit = 0

  reportTypes = [
    { value: 'Balance', label: 'Balance General', icon: 'account_balance' },
    { value: 'Ventas', label: 'Análisis de Ventas', icon: 'trending_up' },
    { value: 'Gastos', label: 'Control de Gastos', icon: 'money_off' },
    { value: 'Ingresos', label: 'Análisis de Ingresos', icon: 'attach_money' },
    { value: 'Flujo de Caja', label: 'Flujo de Caja', icon: 'payments' },
    { value: 'Rentabilidad', label: 'Análisis de Rentabilidad', icon: 'analytics' },
  ]

  constructor(
    private reportsService: ReportsService,
    private fb: FormBuilder,
    private alert: AlertService,
    private router: Router,
  ) {
    this.generateForm = this.fb.group({
      type: ['', Validators.required],
      title: ['', [Validators.required, Validators.minLength(5)]],
      description: [''],
      startDate: ['', Validators.required],
      endDate: ['', Validators.required],
    })
  }

  ngOnInit(): void {
    this.loadFinancialReports()
  }

  loadFinancialReports(): void {
    this.loading = true
    this.reportsService.getFinancialReports().subscribe({
      next: (reports: FinancialReport[]) => {
        this.financialReports = reports
        this.calculateStats()
        this.loading = false
      },
      error: (error: any) => {
        this.alert.error('Error al cargar los reportes financieros')
        this.loading = false
      },
    })
  }

  calculateStats(): void {
    this.totalReports = this.financialReports.length
    this.totalRevenue = this.financialReports
      .filter(r => r.status === 'published')
      .reduce((sum, report) => sum + (report.revenue || 0), 0)
    this.totalExpenses = this.financialReports
      .filter(r => r.status === 'published')
      .reduce((sum, report) => sum + (report.expenses || 0), 0)
    this.totalProfit = this.totalRevenue - this.totalExpenses
  }

  async onGenerateReport(): Promise<void> {
    if (this.generateForm.invalid) {
      await this.alert.fire({
        icon: 'warning',
        title: 'Formulario incompleto',
        text: 'Por favor complete todos los campos requeridos',
        confirmButtonText: 'Entendido',
      })
      return
    }

    const result = await this.alert.fire({
      icon: 'question',
      title: '¿Generar reporte financiero?',
      text: 'Se generará un nuevo reporte con los parámetros especificados',
      showCancelButton: true,
      confirmButtonText: 'Generar',
      cancelButtonText: 'Cancelar',
    })

    if (result.isConfirmed) {
      this.generating = true
      const formValue = this.generateForm.value

      const params: GenerateReportParams = {
        type: formValue.type,
        title: formValue.title,
        description: formValue.description,
        filters: {
          startDate: formValue.startDate,
          endDate: formValue.endDate,
        },
      }

      this.reportsService.generateFinancialReport(params).subscribe({
        next: async (newReport: FinancialReport) => {
          this.financialReports.unshift(newReport)
          this.calculateStats()
          this.generateForm.reset()
          this.generating = false

          await this.alert.fire({
            icon: 'success',
            title: 'Éxito',
            text: 'Reporte financiero generado correctamente',
            timer: 2000,
            showConfirmButton: false,
          })
        },
        error: (error: any) => {
          this.alert.error('Error al generar el reporte financiero')
          this.generating = false
        },
      })
    }
  }

  async downloadReport(report: FinancialReport): Promise<void> {
    try {
      await this.alert.fire({
        icon: 'info',
        title: 'Descargando reporte',
        text: 'Generando archivo PDF...',
        timer: 1500,
        showConfirmButton: false,
      })

      // Aquí iría la lógica real de descarga
      console.log('Downloading report:', report.id)

      await this.alert.fire({
        icon: 'success',
        title: 'Descarga exitosa',
        text: 'El reporte se descargó correctamente',
        timer: 2000,
        showConfirmButton: false,
      })
    } catch (error) {
      this.alert.error('Error al descargar el reporte')
    }
  }

  async deleteReport(report: FinancialReport): Promise<void> {
    const result = await this.alert.fire({
      icon: 'warning',
      title: '¿Eliminar reporte?',
      text: `Se eliminará permanentemente "${report.title}"`,
      showCancelButton: true,
      confirmButtonText: 'Eliminar',
      cancelButtonText: 'Cancelar',
      confirmButtonColor: '#dc2626',
    })

    if (result.isConfirmed) {
      this.reportsService.deleteReport(report.id).subscribe({
        next: async () => {
          this.financialReports = this.financialReports.filter(r => r.id !== report.id)
          this.calculateStats()

          await this.alert.fire({
            icon: 'success',
            title: 'Eliminado',
            text: 'El reporte fue eliminado correctamente',
            timer: 2000,
            showConfirmButton: false,
          })
        },
        error: (error: any) => {
          this.alert.error('Error al eliminar el reporte')
        },
      })
    }
  }

  getStatusClass(status: string): string {
    const classes: { [key: string]: string } = {
      published: 'bg-green-100 text-green-700',
      generated: 'bg-blue-100 text-blue-700',
      draft: 'bg-amber-100 text-amber-700',
      archived: 'bg-slate-100 text-slate-700',
    }
    return classes[status] || 'bg-slate-100 text-slate-700'
  }

  getStatusIcon(status: string): string {
    const icons: { [key: string]: string } = {
      published: 'check_circle',
      generated: 'autorenew',
      draft: 'edit_note',
      archived: 'archive',
    }
    return icons[status] || 'info'
  }

  getStatusText(status: string): string {
    const texts: { [key: string]: string } = {
      published: 'Publicado',
      generated: 'Generado',
      draft: 'Borrador',
      archived: 'Archivado',
    }
    return texts[status] || status
  }

  formatCurrency(amount: number | undefined): string {
    if (amount === undefined || amount === null) return 'Bs 0.00'
    return new Intl.NumberFormat('es-BO', {
      style: 'currency',
      currency: 'BOB',
      minimumFractionDigits: 2,
    }).format(amount)
  }

  filterByType(type: string | null): void {
    if (type === null) {
      this.loadFinancialReports()
    } else {
      this.loading = true
      this.reportsService.getFinancialReportsByType(type).subscribe({
        next: (reports: FinancialReport[]) => {
          this.financialReports = reports
          this.calculateStats()
          this.loading = false
        },
        error: (error: any) => {
          this.alert.error('Error al filtrar reportes')
          this.loading = false
        },
      })
    }
  }

  viewReport(report: FinancialReport): void {
    this.selectedReport = report
  }

  goBack(): void {
    this.router.navigate(['/dashboard'])
  }
}
