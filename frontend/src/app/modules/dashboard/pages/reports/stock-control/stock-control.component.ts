import { Component, DestroyRef, inject, OnInit } from '@angular/core'
import { takeUntilDestroyed } from '@angular/core/rxjs-interop'
import { FormBuilder, FormGroup, Validators } from '@angular/forms'
import { Router } from '@angular/router'
import { AlertService } from '@core/services/alert.service'
import { GenerateReportParams, StockReport } from '../interfaces/reports.interfaces'
import { ReportsService } from '../services/reports.service'

@Component({
  selector: 'app-stock-control',
  templateUrl: './stock-control.component.html',
  styleUrls: ['./stock-control.component.css'],
})
export class StockControlComponent implements OnInit {
  private readonly destroyRef = inject(DestroyRef)

  stockReports: StockReport[] = []
  loading = false
  generating = false
  generateForm: FormGroup
  selectedReport: StockReport | null = null

  // Stats
  totalProducts = 0
  lowStockCount = 0
  expiringCount = 0
  totalStockValue = 0

  reportTypes = [
    { value: 'Inventario', label: 'Reporte de Inventario General', icon: 'inventory_2' },
    { value: 'Vencimientos', label: 'Productos por Vencer', icon: 'schedule' },
    { value: 'Movimientos', label: 'Movimientos de Stock', icon: 'sync_alt' },
    { value: 'Bajo Stock', label: 'Productos con Stock Bajo', icon: 'warning' },
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
      startDate: [''],
      endDate: [''],
    })
  }

  ngOnInit(): void {
    this.loadStockReports()
  }

  loadStockReports(): void {
    this.loading = true
    this.reportsService.getStockReports().pipe(takeUntilDestroyed(this.destroyRef)).subscribe({
      next: (reports: StockReport[]) => {
        this.stockReports = reports
        this.calculateStats()
        this.loading = false
      },
      error: (_error: any) => {
        this.alert.error('Error al cargar los reportes de stock')
        this.loading = false
      },
    })
  }

  calculateStats(): void {
    const latestInventory = this.stockReports
      .filter(r => r.type === 'Inventario')
      .sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime())[0]

    if (latestInventory) {
      this.totalProducts = latestInventory.totalProducts || 0
      this.lowStockCount = latestInventory.lowStockItems || 0
      this.expiringCount = latestInventory.expiringItems || 0
      this.totalStockValue = latestInventory.stockValue || 0
    } else {
      this.totalProducts = this.stockReports.reduce((s, r) => s + (r.totalProducts || 0), 0)
      this.lowStockCount = this.stockReports.reduce((s, r) => s + (r.lowStockItems || 0), 0)
      this.expiringCount = this.stockReports.reduce((s, r) => s + (r.expiringItems || 0), 0)
      this.totalStockValue = this.stockReports.reduce((s, r) => s + (r.stockValue || 0), 0)
    }
  }

  async onGenerateReport(): Promise<void> {
    if (this.generateForm.invalid) {
      await this.alert.fire({
        icon: 'warning',
        title: 'Formulario incompleto',
        text: 'Por favor complete los campos requeridos',
        confirmButtonText: 'Entendido',
      })
      return
    }

    const result = await this.alert.confirm({
      title: '¿Generar reporte de stock?',
      text: 'Se creará un nuevo reporte con los parámetros indicados',
      confirmButtonText: 'Generar',
      cancelButtonText: 'Cancelar',
    })

    if (!result.isConfirmed) return

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

    this.reportsService.generateStockReport(params).pipe(takeUntilDestroyed(this.destroyRef)).subscribe({
      next: async (newReport: StockReport) => {
        this.stockReports.unshift(newReport)
        this.calculateStats()
        this.generateForm.reset()
        this.generating = false

        await this.alert.fire({
          icon: 'success',
          title: 'Éxito',
          text: 'Reporte de stock generado correctamente',
          timer: 2000,
          showConfirmButton: false,
        })
      },
      error: (_error: any) => {
        this.alert.error('Error al generar el reporte de stock')
        this.generating = false
      },
    })
  }

  downloadReport(report: StockReport): void {
    this.reportsService.downloadReport(report.id, 'pdf').pipe(takeUntilDestroyed(this.destroyRef)).subscribe({
      next: async (blob: Blob) => {
        const url = window.URL.createObjectURL(blob)
        const a = document.createElement('a')
        a.href = url
        a.download = `${report.title}.pdf`
        a.click()
        window.URL.revokeObjectURL(url)

        await this.alert.fire({
          icon: 'success',
          title: 'Descarga exitosa',
          text: 'El reporte se descargó correctamente',
          timer: 1800,
          showConfirmButton: false,
        })
      },
      error: (_error: any) => {
        this.alert.error('Error al descargar el reporte')
      },
    })
  }

  exportToExcel(report: StockReport): void {
    this.reportsService.exportReport(report.id, 'excel').pipe(takeUntilDestroyed(this.destroyRef)).subscribe({
      next: async () => {
        await this.alert.fire({
          icon: 'success',
          title: 'Exportado',
          text: 'El reporte fue exportado a Excel',
          timer: 1800,
          showConfirmButton: false,
        })
      },
      error: (_error: any) => {
        this.alert.error('Error al exportar a Excel')
      },
    })
  }

  async deleteReport(report: StockReport): Promise<void> {
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
      this.reportsService.deleteReport(report.id).pipe(takeUntilDestroyed(this.destroyRef)).subscribe({
        next: async () => {
          this.stockReports = this.stockReports.filter(r => r.id !== report.id)
          this.calculateStats()
          await this.alert.fire({
            icon: 'success',
            title: 'Eliminado',
            text: 'El reporte fue eliminado correctamente',
            timer: 1800,
            showConfirmButton: false,
          })
        },
        error: (_error: any) => {
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
      this.loadStockReports()
    } else {
      this.loading = true
      this.reportsService.getStockReportsByType(type).pipe(takeUntilDestroyed(this.destroyRef)).subscribe({
        next: (reports: StockReport[]) => {
          this.stockReports = reports
          this.calculateStats()
          this.loading = false
        },
        error: (_error: any) => {
          this.alert.error('Error al filtrar reportes')
          this.loading = false
        },
      })
    }
  }

  viewReport(report: StockReport): void {
    this.selectedReport = report
  }

  goBack(): void {
    this.router.navigate(['/dashboard'])
  }

  getTypeIcon(type: string): string {
    switch (type) {
      case 'Inventario':
        return 'inventory_2'
      case 'Vencimientos':
        return 'schedule'
      case 'Movimientos':
        return 'sync_alt'
      case 'Bajo Stock':
        return 'warning'
      default:
        return 'inventory'
    }
  }
}
