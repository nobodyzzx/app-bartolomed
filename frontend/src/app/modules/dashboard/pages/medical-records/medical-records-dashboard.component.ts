import { Location } from '@angular/common'
import { Component, OnInit, ViewChild, inject } from '@angular/core'
import { MatDialog } from '@angular/material/dialog'
import { MatPaginator } from '@angular/material/paginator'
import { MatSort } from '@angular/material/sort'
import { MatTableDataSource } from '@angular/material/table'
import { Router } from '@angular/router'
import { AlertService } from '@core/services/alert.service'
import { AuthStatus } from '../../../auth/interfaces/auth-status.enum'
import { AuthService as AppAuthService } from '../../../auth/services/auth.service'
import { MedicalRecord, MedicalRecordFilters, RecordStatus, RecordType } from './interfaces'
import { MedicalRecordsService } from './services/medical-records.service'

@Component({
  selector: 'app-medical-records-dashboard',
  templateUrl: './medical-records-dashboard.component.html',
  styleUrls: ['./medical-records-dashboard.component.css'],
})
export class MedicalRecordsDashboardComponent implements OnInit {
  displayedColumns: string[] = [
    'date',
    'patient',
    'type',
    'chiefComplaint',
    'doctor',
    'status',
    'actions',
  ]

  dataSource = new MatTableDataSource<MedicalRecord>([])
  totalRecords = 0

  @ViewChild(MatPaginator) paginator!: MatPaginator
  @ViewChild(MatSort) sort!: MatSort

  // Filtros
  filters: MedicalRecordFilters = {}
  recordTypes = Object.values(RecordType)
  recordStatuses = Object.values(RecordStatus)

  // Estadísticas
  stats = {
    total: 0,
    drafts: 0,
    completed: 0,
    emergencies: 0,
  }

  loading = false

  constructor(
    private medicalRecordsService: MedicalRecordsService,
    private dialog: MatDialog,
    private router: Router,
    private location: Location,
  ) {}
  private appAuth = inject(AppAuthService)
  private alert = inject(AlertService)

  ngOnInit(): void {
    // Evitar llamadas al backend en modo DEMO (cuando no hay autenticación real)
    if (this.isAuthenticated()) {
      this.loadMedicalRecords()
      this.loadStats()
    }
  }

  ngAfterViewInit(): void {
    this.dataSource.paginator = this.paginator
    this.dataSource.sort = this.sort
  }

  loadMedicalRecords(): void {
    if (!this.isAuthenticated()) return
    this.loading = true
    this.medicalRecordsService.getMedicalRecords(this.filters).subscribe({
      next: response => {
        this.dataSource.data = response.data
        this.totalRecords = response.total
        this.loading = false
      },
      error: () => {
        this.loading = false
      },
    })
  }

  loadStats(): void {
    if (!this.isAuthenticated()) return
    this.medicalRecordsService.getMedicalRecordsStats().subscribe({
      next: stats => {
        this.stats = stats
      },
      error: () => {},
    })
  }

  // Acciones de tarjetas de estadísticas
  showAllRecords(): void {
    this.filters = {}
    this.loadMedicalRecords()
  }

  showDrafts(): void {
    this.filters = { ...this.filters, status: RecordStatus.DRAFT }
    this.loadMedicalRecords()
  }

  showCompleted(): void {
    this.filters = { ...this.filters, status: RecordStatus.COMPLETED }
    this.loadMedicalRecords()
  }

  showEmergencies(): void {
    this.filters = { ...this.filters, isEmergency: true }
    this.loadMedicalRecords()
  }

  applyFilter(event: Event): void {
    const filterValue = (event.target as HTMLInputElement).value
    this.dataSource.filter = filterValue.trim().toLowerCase()

    if (this.dataSource.paginator) {
      this.dataSource.paginator.firstPage()
    }
  }

  applyFilters(): void {
    this.loadMedicalRecords()
  }

  clearFilters(): void {
    this.filters = {}
    if (this.isAuthenticated()) this.loadMedicalRecords()
  }

  createNewRecord(): void {
    this.router.navigate(['/dashboard/medical-records/new'])
  }

  viewRecord(record: MedicalRecord): void {
    this.router.navigate(['/dashboard/medical-records', record.id])
  }

  editRecord(record: MedicalRecord): void {
    this.router.navigate(['/dashboard/medical-records', record.id, 'edit'])
  }

  deleteRecord(record: MedicalRecord): void {
    if (!this.isAuthenticated()) {
      this.alert.fire({
        icon: 'info',
        title: 'Modo demo',
        text: 'Para eliminar expedientes, primero inicia sesión con un usuario válido.',
      })
      return
    }
    this.alert
      .fire({
        title: '¿Eliminar expediente?',
        html: `¿Está seguro de que desea eliminar este expediente médico?<br><br>
             <strong>Paciente:</strong> ${record.patient?.firstName} ${record.patient?.lastName}<br>
             <strong>Tipo:</strong> ${this.getTypeText(record.type)}`,
        icon: 'warning',
        showCancelButton: true,
        confirmButtonText: 'Sí, eliminar',
        cancelButtonText: 'Cancelar',
      })
      .then(result => {
        if (result.isConfirmed) {
          this.medicalRecordsService.deleteMedicalRecord(record.id!).subscribe({
            next: () => {
              this.alert.fire({
                icon: 'success',
                title: '¡Eliminado!',
                text: 'El expediente médico ha sido eliminado.',
              })
              this.loadMedicalRecords()
              this.loadStats()
            },
            error: error => {
              this.alert.fire({
                icon: 'error',
                title: 'Error',
                text: 'No se pudo eliminar el expediente médico.',
              })
            },
          })
        }
      })
  }

  goBack(): void {
    this.location.back()
  }

  viewPatientHistory(patientId: string): void {
    this.router.navigate(['/dashboard/medical-records/patient', patientId, 'history'])
  }

  completeRecord(record: MedicalRecord): void {
    // Actualizar el estado del expediente a 'completed'
    const updateData = { status: 'completed' as any }
    if (!this.isAuthenticated()) return
    this.medicalRecordsService.updateMedicalRecord(record.id!, updateData).subscribe({
      next: () => {
        this.loadMedicalRecords()
      },
      error: () => {},
    })
  }

  reviewRecord(record: MedicalRecord): void {
    // Actualizar el estado del expediente a 'reviewed'
    const updateData = { status: 'reviewed' as any }
    if (!this.isAuthenticated()) return
    this.medicalRecordsService.updateMedicalRecord(record.id!, updateData).subscribe({
      next: () => {
        this.loadMedicalRecords()
      },
      error: () => {},
    })
  }

  exportRecord(record: MedicalRecord): void {
    // Por ahora, mostrar un mensaje indicando que la funcionalidad estará disponible próximamente
    // TODO: Implementar exportación cuando esté disponible en el backend
  }

  getStatusColor(status: RecordStatus): string {
    switch (status) {
      case RecordStatus.DRAFT:
        return 'warn'
      case RecordStatus.COMPLETED:
        return 'primary'
      case RecordStatus.REVIEWED:
        return 'accent'
      case RecordStatus.ARCHIVED:
        return 'basic'
      default:
        return 'basic'
    }
  }

  getStatusText(status: RecordStatus): string {
    switch (status) {
      case RecordStatus.DRAFT:
        return 'Borrador'
      case RecordStatus.COMPLETED:
        return 'Completado'
      case RecordStatus.REVIEWED:
        return 'Revisado'
      case RecordStatus.ARCHIVED:
        return 'Archivado'
      default:
        return status
    }
  }

  getTypeText(type: RecordType): string {
    switch (type) {
      case RecordType.CONSULTATION:
        return 'Consulta'
      case RecordType.EMERGENCY:
        return 'Emergencia'
      case RecordType.SURGERY:
        return 'Cirugía'
      case RecordType.FOLLOW_UP:
        return 'Seguimiento'
      case RecordType.LABORATORY:
        return 'Laboratorio'
      case RecordType.IMAGING:
        return 'Imagenología'
      case RecordType.OTHER:
        return 'Otro'
      default:
        return type
    }
  }

  getRecordIcon(type: RecordType): string {
    switch (type) {
      case RecordType.CONSULTATION:
        return 'assignment'
      case RecordType.EMERGENCY:
        return 'emergency'
      case RecordType.SURGERY:
        return 'healing'
      case RecordType.FOLLOW_UP:
        return 'update'
      case RecordType.LABORATORY:
        return 'biotech'
      case RecordType.IMAGING:
        return 'camera_alt'
      case RecordType.OTHER:
        return 'description'
      default:
        return 'description'
    }
  }
  private isAuthenticated(): boolean {
    try {
      return this.appAuth.authStatus() === AuthStatus.authenticated
    } catch {
      return false
    }
  }

  // Exponer a la plantilla si estamos en modo demo (sin autenticación real)
  get isDemo(): boolean {
    return !this.isAuthenticated()
  }
}
