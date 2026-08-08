import { Location } from '@angular/common'
import { AfterViewInit, Component, DestroyRef, OnInit, ViewChild, inject } from '@angular/core'
import { takeUntilDestroyed } from '@angular/core/rxjs-interop'
import { MatPaginator } from '@angular/material/paginator'
import { MatSort } from '@angular/material/sort'
import { MatTableDataSource } from '@angular/material/table'
import { Router } from '@angular/router'
import { Permission } from '@core/enums/permission.enum'
import { AlertService } from '@core/services/alert.service'
import { RoleStateService } from '@core/services/role-state.service'
import { MedicalRecord, MedicalRecordFilters, RecordStatus, RecordType } from './interfaces'
import { MedicalRecordsService } from './services/medical-records.service'
import { recordTypeIcon, recordTypeLabel } from './utils/record-type.util'

@Component({
    selector: 'app-medical-records-dashboard',
    templateUrl: './medical-records-dashboard.component.html',
    styleUrls: ['./medical-records-dashboard.component.css'],
    standalone: false
})
export class MedicalRecordsDashboardComponent implements OnInit, AfterViewInit {
  private readonly destroyRef = inject(DestroyRef)
  private alert = inject(AlertService)
  private roleState = inject(RoleStateService)

  /** NURSE tiene RecordsRead (entra al módulo) pero el backend solo permite escribir a DOCTOR/ADMIN. */
  get canWriteRecords(): boolean {
    return this.roleState.hasPermission(Permission.RecordsWrite)
  }

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
    // Las estadísticas están reservadas a médico/admin (el endpoint es
    // @Auth(DOCTOR, ADMIN)). Enfermería ve la lista de expedientes pero no las
    // tarjetas de resumen: no se piden, para no provocar un 403 que la pantalla
    // mostraba como error. Ver `canWriteRecords`.
    if (this.canWriteRecords) this.loadStats()
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
              this.loadMedicalRecords()
              this.loadStats()
            },
            error: () => {},
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

  /** Etiqueta e icono salen del mapa compartido, para que no diverjan por pantalla. */
  getTypeText(type: RecordType): string {
    return recordTypeLabel(type)
  }

  getPatientInitials(record: MedicalRecord): string {
    const first = record.patient?.firstName?.charAt(0) ?? ''
    const last  = record.patient?.lastName?.charAt(0) ?? ''
    return (first + last).toUpperCase() || '?'
  }

  getRecordIcon(type: RecordType): string {
    return recordTypeIcon(type)
  }

}
