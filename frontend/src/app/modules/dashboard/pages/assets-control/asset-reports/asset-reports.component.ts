import { Component, DestroyRef, inject, OnInit } from '@angular/core'
import { takeUntilDestroyed } from '@angular/core/rxjs-interop'
import { FormBuilder, FormGroup, Validators } from '@angular/forms'
import { Router } from '@angular/router'
import { AlertService } from '@core/services/alert.service'
import {
  AssetReport,
  AssetStatus,
  GenerateReportDto,
  ReportStatus,
  ReportType,
} from '../interfaces/assets.interfaces'
import { AssetReportsService } from '../services/asset-reports.service'

@Component({
    selector: 'app-asset-reports',
    templateUrl: './asset-reports.component.html',
    styleUrls: ['./asset-reports.component.css'],
    standalone: false
})
export class AssetReportsComponent implements OnInit {
  private readonly destroyRef = inject(DestroyRef)

  reportsForm: FormGroup
  reports: AssetReport[] = []
  loading = false
  generating = false
  selectedReport: AssetReport | null = null

  reportTypes = Object.values(ReportType)
  assetStatuses = Object.values(AssetStatus)
  reportStatuses = Object.values(ReportStatus)

  // Estadísticas
  totalReports = 0
  completedReports = 0
  generatingReports = 0
  failedReports = 0

  constructor(
    private fb: FormBuilder,
    private assetReportsService: AssetReportsService,
    private alert: AlertService,
    private router: Router,
  ) {
    this.reportsForm = this.fb.group({
      title: ['', [Validators.required, Validators.minLength(3)]],
      reportType: ['', Validators.required],
      description: [''],
      dateFrom: [''],
      dateTo: [''],
      status: [''],
      format: ['pdf', Validators.required],
    })
  }

  ngOnInit(): void {
    this.loadReports()
  }

  loadReports(): void {
    this.loading = true
    this.assetReportsService.getReports().pipe(takeUntilDestroyed(this.destroyRef)).subscribe({
      next: reports => {
        this.reports = reports
        this.calculateStats()
        this.loading = false
      },
      error: (_error: any) => {
        this.alert.error('Error al cargar los reportes de activos')
        this.loading = false
      },
    })
  }

  calculateStats(): void {
    this.totalReports = this.reports.length
    this.completedReports = this.reports.filter(r => r.status === ReportStatus.COMPLETED).length
    this.generatingReports = this.reports.filter(r => r.status === ReportStatus.GENERATING).length
    this.failedReports = this.reports.filter(r => r.status === ReportStatus.FAILED).length
  }

  async generateReport(): Promise<void> {
    if (this.reportsForm.invalid) {
      this.reportsForm.markAllAsTouched()
      await this.alert.fire({
        icon: 'warning',
        title: 'Formulario Incompleto',
        text: 'Por favor complete todos los campos requeridos',
      })
      return
    }

    const result = await this.alert.fire({
      icon: 'question',
      title: '¿Generar Reporte?',
      text: `Se generará el reporte "${this.reportsForm.value.title}"`,
      showCancelButton: true,
      confirmButtonText: 'Generar',
      cancelButtonText: 'Cancelar',
    })

    if (!result.isConfirmed) return

    this.generating = true
    const formValue = this.reportsForm.value

    const reportData: GenerateReportDto = {
      title: formValue.title,
      type: formValue.reportType,
      description: formValue.description || undefined,
      format: formValue.format,
      filters: {
        status: formValue.status || undefined,
        dateFrom: formValue.dateFrom || undefined,
        dateTo: formValue.dateTo || undefined,
      },
    }

    this.assetReportsService.generateReport(reportData).pipe(takeUntilDestroyed(this.destroyRef)).subscribe({
      next: async (report: AssetReport) => {
        this.reports.unshift(report)
        this.calculateStats()
        this.resetForm()
        this.generating = false
        await this.alert.fire({
          icon: 'success',
          title: 'Reporte Generado',
          text: 'El reporte se ha generado correctamente',
          timer: 2000,
          showConfirmButton: false,
        })
      },
      error: (_error: any) => {
        this.alert.error('Error al generar el reporte')
        this.generating = false
      },
    })
  }

  downloadReport(report: AssetReport): void {
    if (report.status !== ReportStatus.COMPLETED) {
      this.alert.fire({
        icon: 'warning',
        title: 'Reporte No Disponible',
        text: 'El reporte aún no está disponible para descarga',
      })
      return
    }

    this.loading = true
    this.assetReportsService.downloadReport(report.id).pipe(takeUntilDestroyed(this.destroyRef)).subscribe({
      next: async (blob: Blob) => {
        const url = window.URL.createObjectURL(blob)
        const a = document.createElement('a')
        a.href = url
        const extension = report.filePath?.split('.').pop() || 'pdf'
        a.download = `${report.title.replace(/\s+/g, '-')}.${extension}`
        document.body.appendChild(a)
        a.click()
        document.body.removeChild(a)
        window.URL.revokeObjectURL(url)
        this.loading = false
        await this.alert.fire({
          icon: 'success',
          title: 'Descarga Iniciada',
          text: 'El reporte se está descargando',
          timer: 1500,
          showConfirmButton: false,
        })
      },
      error: (_error: any) => {
        this.alert.error('Error al descargar el reporte')
        this.loading = false
      },
    })
  }

  viewReport(report: AssetReport): void {
    this.selectedReport = report
  }

  async deleteReport(report: AssetReport): Promise<void> {
    const result = await this.alert.fire({
      icon: 'warning',
      title: '¿Eliminar Reporte?',
      text: `¿Está seguro de eliminar el reporte "${report.title}"? Esta acción no se puede deshacer.`,
      showCancelButton: true,
      confirmButtonText: 'Eliminar',
      cancelButtonText: 'Cancelar',
      confirmButtonColor: '#dc2626',
    })

    if (!result.isConfirmed) return

    this.loading = true
    this.assetReportsService.deleteReport(report.id).pipe(takeUntilDestroyed(this.destroyRef)).subscribe({
      next: async () => {
        this.reports = this.reports.filter(r => r.id !== report.id)
        this.calculateStats()
        this.loading = false
        await this.alert.fire({
          icon: 'success',
          title: 'Reporte Eliminado',
          text: 'El reporte se ha eliminado correctamente',
          timer: 2000,
          showConfirmButton: false,
        })
      },
      error: (_error: any) => {
        this.alert.error('Error al eliminar el reporte')
        this.loading = false
      },
    })
  }

  getReportTypeDisplay(type: ReportType): string {
    const typeLabels: Record<ReportType, string> = {
      [ReportType.LOCATION]: 'Por Ubicación',
      [ReportType.STATUS]: 'Por Estado',
      [ReportType.MAINTENANCE]: 'Mantenimiento',
      [ReportType.DEPRECIATION]: 'Depreciación',
      [ReportType.OBSOLETE]: 'Obsoletos',
      [ReportType.FINANCIAL]: 'Financiero',
    }
    return typeLabels[type] || type
  }

  getStatusDisplay(status: AssetStatus): string {
    const statusLabels: Record<AssetStatus, string> = {
      [AssetStatus.ACTIVE]: 'Activo',
      [AssetStatus.INACTIVE]: 'Inactivo',
      [AssetStatus.MAINTENANCE]: 'En Mantenimiento',
      [AssetStatus.RETIRED]: 'Retirado',
      [AssetStatus.DISPOSED]: 'Desechado',
    }
    return statusLabels[status] || status
  }

  resetForm(): void {
    this.reportsForm.reset()
    this.reportsForm.patchValue({ format: 'pdf' })
  }

  goBack(): void {
    this.router.navigate(['/dashboard'])
  }

  getStatusClass(status: ReportStatus): string {
    const classes: Record<ReportStatus, string> = {
      [ReportStatus.COMPLETED]: 'bg-green-100 text-green-700',
      [ReportStatus.GENERATING]: 'bg-blue-100 text-blue-700',
      [ReportStatus.PENDING]: 'bg-amber-100 text-amber-700',
      [ReportStatus.FAILED]: 'bg-red-100 text-red-700',
    }
    return classes[status] || 'bg-slate-100 text-slate-700'
  }

  getStatusIcon(status: ReportStatus): string {
    const icons: Record<ReportStatus, string> = {
      [ReportStatus.COMPLETED]: 'check_circle',
      [ReportStatus.GENERATING]: 'sync',
      [ReportStatus.PENDING]: 'schedule',
      [ReportStatus.FAILED]: 'error',
    }
    return icons[status] || 'info'
  }

  filterByStatus(status: ReportStatus | null): void {
    if (status === null) {
      this.loadReports()
    } else {
      this.loading = true
      this.assetReportsService.getReportsByStatus(status).pipe(takeUntilDestroyed(this.destroyRef)).subscribe({
        next: (reports: AssetReport[]) => {
          this.reports = reports
          this.calculateStats()
          this.loading = false
        },
        error: (_error: any) => {
          this.alert.error('Error al filtrar reportes por estado')
          this.loading = false
        },
      })
    }
  }

  filterByType(type: ReportType | null): void {
    if (type === null) {
      this.loadReports()
    } else {
      this.loading = true
      this.assetReportsService.getReportsByType(type).pipe(takeUntilDestroyed(this.destroyRef)).subscribe({
        next: (reports: AssetReport[]) => {
          this.reports = reports
          this.calculateStats()
          this.loading = false
        },
        error: (_error: any) => {
          this.alert.error('Error al filtrar reportes por tipo')
          this.loading = false
        },
      })
    }
  }
}
