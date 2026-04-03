import { Component, DestroyRef, inject, OnInit } from '@angular/core'
import { takeUntilDestroyed } from '@angular/core/rxjs-interop'
import { FormBuilder, FormGroup, Validators } from '@angular/forms'
import { Router } from '@angular/router'
import { AlertService } from '@core/services/alert.service'
import { GenerateReportParams, MedicalReport } from '../interfaces/reports.interfaces'
import { ReportsService } from '../services/reports.service'

@Component({
  selector: 'app-medical-reports',
  templateUrl: './medical-reports.component.html',
  styleUrls: ['./medical-reports.component.css'],
})
export class MedicalReportsComponent implements OnInit {
  private readonly destroyRef = inject(DestroyRef)

  medicalReports: MedicalReport[] = []
  loading = false
  generating = false
  generateForm: FormGroup
  selectedReport: MedicalReport | null = null

  // Tipos de reportes adaptados al contexto boliviano
  reportTypes = [
    { value: 'Consultas', label: 'Reporte de Consultas Médicas', icon: 'medical_services' },
    { value: 'Diagnósticos', label: 'Diagnósticos Más Frecuentes', icon: 'diagnosis' },
    { value: 'Tratamientos', label: 'Efectividad de Tratamientos', icon: 'medication' },
    { value: 'Epidemiológico', label: 'Análisis Epidemiológico', icon: 'analytics' },
    {
      value: 'Enfermedades Crónicas',
      label: 'Seguimiento de Enfermedades Crónicas',
      icon: 'monitor_heart',
    },
    { value: 'Medicina Preventiva', label: 'Campañas de Medicina Preventiva', icon: 'vaccines' },
    { value: 'Salud Materno-Infantil', label: 'Salud Materno-Infantil', icon: 'pregnant_woman' },
    {
      value: 'Enfermedades Transmisibles',
      label: 'Enfermedades Transmisibles',
      icon: 'coronavirus',
    },
  ]

  // Estadísticas
  totalReports = 0
  consultasCount = 0
  diagnosticosCount = 0
  totalPatients = 0

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
    this.loadMedicalReports()
  }

  loadMedicalReports(): void {
    this.loading = true
    this.reportsService.getMedicalReports().pipe(takeUntilDestroyed(this.destroyRef)).subscribe({
      next: reports => {
        this.medicalReports = reports
        this.calculateStats()
        this.loading = false
      },
      error: error => {
        this.alert.error('Error al cargar reportes médicos')
        this.loading = false
      },
    })
  }

  calculateStats(): void {
    this.totalReports = this.medicalReports.length
    this.consultasCount = this.medicalReports.filter(r => r.type === 'Consultas').length
    this.diagnosticosCount = this.medicalReports.filter(r => r.type === 'Diagnósticos').length
    this.totalPatients = this.medicalReports
      .filter(r => r.patientCount !== undefined)
      .reduce((sum, r) => sum + (r.patientCount || 0), 0)
  }

  async onGenerateReport(): Promise<void> {
    if (this.generateForm.invalid) {
      this.generateForm.markAllAsTouched()
      await this.alert.fire({
        icon: 'warning',
        title: 'Formulario Incompleto',
        text: 'Por favor complete todos los campos requeridos',
      })
      return
    }

    const result = await this.alert.fire({
      icon: 'question',
      title: '¿Generar Reporte Médico?',
      text: `Se generará el reporte "${this.generateForm.value.title}"`,
      showCancelButton: true,
      confirmButtonText: 'Generar',
      cancelButtonText: 'Cancelar',
    })

    if (!result.isConfirmed) return

    this.generating = true
    const formValue = this.generateForm.value

    const params: GenerateReportParams = {
      type: formValue.type,
      title: formValue.title,
      description: formValue.description || undefined,
      filters: {
        startDate: formValue.startDate,
        endDate: formValue.endDate,
      },
    }

    this.reportsService.generateMedicalReport(params).pipe(takeUntilDestroyed(this.destroyRef)).subscribe({
      next: newReport => {
        this.medicalReports.unshift(newReport)
        this.calculateStats()
        this.generateForm.reset()
        this.generating = false
        this.alert.fire({
          icon: 'success',
          title: 'Reporte Generado',
          text: 'El reporte médico se ha generado correctamente',
          timer: 2000,
          showConfirmButton: false,
        })
      },
      error: error => {
        this.alert.error('Error al generar reporte médico')
        this.generating = false
      },
    })
  }

  downloadReport(report: MedicalReport): void {
    if (report.status !== 'generated' && report.status !== 'published') {
      this.alert.fire({
        icon: 'warning',
        title: 'Reporte No Disponible',
        text: 'El reporte aún no está disponible para descarga',
      })
      return
    }

    this.loading = true
    const params: Record<string, string> = {}
    if (report.period?.startDate) params['startDate'] = report.period.startDate
    if (report.period?.endDate) params['endDate'] = report.period.endDate

    // Elegir endpoint según el tipo de reporte
    const type = report.type ?? ''
    let obs$
    if (type === 'Consultas' || type === 'Diagnósticos' || type === 'Tratamientos') {
      obs$ = this.reportsService.downloadMedicalRecordsPdf(params)
    } else {
      obs$ = this.reportsService.downloadAppointmentsPdf(params)
    }

    obs$.pipe(takeUntilDestroyed(this.destroyRef)).subscribe({
      next: () => {
        this.loading = false
        this.alert.fire({
          icon: 'success',
          title: 'PDF Generado',
          text: 'El reporte se descargó correctamente',
          timer: 1500,
          showConfirmButton: false,
        })
      },
      error: () => {
        this.alert.error('Error al generar el PDF con Puppeteer')
        this.loading = false
      },
    })
  }

  async deleteReport(report: MedicalReport): Promise<void> {
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
    this.reportsService.deleteReport(report.id).pipe(takeUntilDestroyed(this.destroyRef)).subscribe({
      next: () => {
        this.medicalReports = this.medicalReports.filter(r => r.id !== report.id)
        this.calculateStats()
        this.loading = false
        this.alert.fire({
          icon: 'success',
          title: 'Reporte Eliminado',
          text: 'El reporte se ha eliminado correctamente',
          timer: 2000,
          showConfirmButton: false,
        })
      },
      error: error => {
        this.alert.error('Error al eliminar el reporte')
        this.loading = false
      },
    })
  }

  getStatusClass(status: string): string {
    const classes: Record<string, string> = {
      published: 'bg-green-100 text-green-700',
      generated: 'bg-blue-100 text-blue-700',
      draft: 'bg-amber-100 text-amber-700',
      archived: 'bg-slate-100 text-slate-700',
    }
    return classes[status] || 'bg-slate-100 text-slate-700'
  }

  getStatusIcon(status: string): string {
    const icons: Record<string, string> = {
      published: 'check_circle',
      generated: 'task_alt',
      draft: 'edit_note',
      archived: 'archive',
    }
    return icons[status] || 'info'
  }

  getStatusText(status: string): string {
    const texts: Record<string, string> = {
      published: 'Publicado',
      generated: 'Generado',
      draft: 'Borrador',
      archived: 'Archivado',
    }
    return texts[status] || status
  }

  goBack(): void {
    this.router.navigate(['/dashboard'])
  }

  viewReport(report: MedicalReport): void {
    this.selectedReport = report
  }

  filterByType(type: string | null): void {
    if (type === null) {
      this.loadMedicalReports()
    } else {
      this.loading = true
      this.reportsService.getMedicalReportsByType(type).pipe(takeUntilDestroyed(this.destroyRef)).subscribe({
        next: (reports: MedicalReport[]) => {
          this.medicalReports = reports
          this.loading = false
        },
        error: (error: any) => {
          this.alert.error('Error al filtrar reportes')
          this.loading = false
        },
      })
    }
  }
}
