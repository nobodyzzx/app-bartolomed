import { Location } from '@angular/common'
import { AfterViewInit, Component, DestroyRef, OnInit, ViewChild, inject } from '@angular/core'
import { takeUntilDestroyed } from '@angular/core/rxjs-interop'
import { MatPaginator } from '@angular/material/paginator'
import { MatSort } from '@angular/material/sort'
import { MatTableDataSource } from '@angular/material/table'
import { Router } from '@angular/router'
import { AlertService } from '@core/services/alert.service'
import { MedicalRecord, MedicalRecordFilters, RecordStatus, RecordType } from './interfaces'
import { MedicalRecordsService } from './services/medical-records.service'

@Component({
  selector: 'app-medical-records-dashboard',
  templateUrl: './medical-records-dashboard.component.html',
  styleUrls: ['./medical-records-dashboard.component.css'],
})
export class MedicalRecordsDashboardComponent implements OnInit, AfterViewInit {
  private readonly destroyRef = inject(DestroyRef)
  private alert = inject(AlertService)

  displayedColumns: string[] = ['date', 'patient', 'type', 'chiefComplaint', 'doctor', 'status', 'actions']

  dataSource = new MatTableDataSource<MedicalRecord>([])
  totalRecords = 0

  @ViewChild(MatPaginator) paginator!: MatPaginator
  @ViewChild(MatSort) sort!: MatSort

  filters: MedicalRecordFilters = {}
  searchTerm = ''

  stats = { total: 0, drafts: 0, completed: 0, emergencies: 0 }
  loading = false

  readonly RecordStatus = RecordStatus

  private readonly statusColors: Record<string, string> = {
    [RecordStatus.DRAFT]:      'bg-amber-100 text-amber-800',
    [RecordStatus.COMPLETED]:  'bg-green-100 text-green-800',
    [RecordStatus.REVIEWED]:   'bg-blue-100 text-blue-800',
    [RecordStatus.ARCHIVED]:   'bg-slate-100 text-slate-700',
  }

  constructor(
    private medicalRecordsService: MedicalRecordsService,
    private router: Router,
    private location: Location,
  ) {}

  ngOnInit(): void {
    this.loadMedicalRecords()
    this.loadStats()
  }

  ngAfterViewInit(): void {
    this.dataSource.paginator = this.paginator
    this.dataSource.sort = this.sort
  }

  loadMedicalRecords(): void {
    this.loading = true
    this.medicalRecordsService.getMedicalRecords(this.filters).pipe(takeUntilDestroyed(this.destroyRef)).subscribe({
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
    this.medicalRecordsService.getMedicalRecordsStats().pipe(takeUntilDestroyed(this.destroyRef)).subscribe({
      next: (res: any) => {
        this.stats = {
          total:       res.total       ?? 0,
          drafts:      res.byStatus?.draft    ?? 0,
          completed:   res.byStatus?.completed ?? 0,
          emergencies: res.emergencies ?? 0,
        }
      },
      error: () => {},
    })
  }

  applyFilter(value: string): void {
    this.searchTerm = value
    this.dataSource.filter = value.trim().toLowerCase()
    if (this.dataSource.paginator) this.dataSource.paginator.firstPage()
  }

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

  clearFilters(): void {
    this.filters = {}
    this.searchTerm = ''
    this.dataSource.filter = ''
    this.loadMedicalRecords()
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

  viewPatientHistory(patientId: string): void {
    this.router.navigate(['/dashboard/medical-records/patient', patientId, 'history'])
  }

  deleteRecord(record: MedicalRecord): void {
    this.alert
      .fire({
        title: '¿Eliminar expediente?',
        html: `¿Está seguro de eliminar este expediente?<br><br>
               <strong>Paciente:</strong> ${record.patient?.firstName} ${record.patient?.lastName}<br>
               <strong>Tipo:</strong> ${this.getTypeText(record.type)}`,
        icon: 'warning',
        showCancelButton: true,
        confirmButtonText: 'Sí, eliminar',
        cancelButtonText: 'Cancelar',
      })
      .then(result => {
        if (result.isConfirmed) {
          this.medicalRecordsService.deleteMedicalRecord(record.id!).pipe(takeUntilDestroyed(this.destroyRef)).subscribe({
            next: () => {
              this.alert.success('Eliminado', 'El expediente médico ha sido eliminado.')
              this.loadMedicalRecords()
              this.loadStats()
            },
            error: () => {
              this.alert.error('Error', 'No se pudo eliminar el expediente médico.')
            },
          })
        }
      })
  }

  goBack(): void {
    this.location.back()
  }

  getStatusColor(status: string): string {
    return this.statusColors[status] ?? 'bg-slate-100 text-slate-700'
  }

  getStatusText(status: RecordStatus): string {
    const labels: Record<string, string> = {
      [RecordStatus.DRAFT]:     'Borrador',
      [RecordStatus.COMPLETED]: 'Completado',
      [RecordStatus.REVIEWED]:  'Revisado',
      [RecordStatus.ARCHIVED]:  'Archivado',
    }
    return labels[status] ?? status
  }

  getTypeText(type: RecordType): string {
    const labels: Record<string, string> = {
      [RecordType.CONSULTATION]: 'Consulta',
      [RecordType.EMERGENCY]:    'Emergencia',
      [RecordType.SURGERY]:      'Cirugía',
      [RecordType.FOLLOW_UP]:    'Seguimiento',
      [RecordType.LABORATORY]:   'Laboratorio',
      [RecordType.IMAGING]:      'Imagenología',
      [RecordType.OTHER]:        'Otro',
    }
    return labels[type] ?? type
  }

  getPatientInitials(record: MedicalRecord): string {
    const first = record.patient?.firstName?.charAt(0) ?? ''
    const last  = record.patient?.lastName?.charAt(0) ?? ''
    return (first + last).toUpperCase() || '?'
  }

  getRecordIcon(type: RecordType): string {
    const icons: Record<string, string> = {
      [RecordType.CONSULTATION]: 'assignment',
      [RecordType.EMERGENCY]:    'emergency',
      [RecordType.SURGERY]:      'healing',
      [RecordType.FOLLOW_UP]:    'update',
      [RecordType.LABORATORY]:   'biotech',
      [RecordType.IMAGING]:      'camera_alt',
      [RecordType.OTHER]:        'description',
    }
    return icons[type] ?? 'description'
  }

}
