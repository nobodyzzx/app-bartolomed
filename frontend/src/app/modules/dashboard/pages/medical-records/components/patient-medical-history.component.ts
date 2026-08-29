import { Location } from '@angular/common'
import {
  ChangeDetectionStrategy,
  ChangeDetectorRef,
  Component,
  OnDestroy,
  OnInit,
} from '@angular/core'
import { FormControl } from '@angular/forms'
import { ActivatedRoute, Router } from '@angular/router'
import { Permission } from '@core/enums/permission.enum'
import { AlertService } from '@core/services/alert.service'
import { RoleStateService } from '@core/services/role-state.service'
import { Subject } from 'rxjs'
import { takeUntil } from 'rxjs/operators'
import { formatPlainDate } from '../../../../../shared/utils/date-format.util'
import { matchesSearch } from '../../../../../shared/utils/text-search.util'
import {
  LAB_MODULE_CONFIG,
  LABORATORY_MODULE_CONFIG,
} from '../../lab-orders/lab-module.config'
import { LabOrdersService } from '../../lab-orders/lab-orders.service'
import { Patient } from '../../patients/interfaces'
import { PatientsService } from '../../patients/services/patients.service'
import { MedicalRecord, RecordType } from '../interfaces'
import { MedicalRecordsService } from '../services/medical-records.service'
import { recordTypeIcon, recordTypeLabel } from '../utils/record-type.util'
import { openPdfInNewTab } from '../../../../../shared/utils/pdf-viewer.util'

@Component({
    selector: 'app-patient-medical-history',
    templateUrl: './patient-medical-history.component.html',
    styleUrls: ['./patient-medical-history.component.css'],
    changeDetection: ChangeDetectionStrategy.OnPush,
    standalone: false,
    // `LabOrdersService` sirve a dos módulos (laboratorio y estudios especiales)
    // y toma su ruta de la configuración, así que no se provee en `root`: aquí
    // se declara explícitamente cuál de los dos se está consultando.
    providers: [
      { provide: LAB_MODULE_CONFIG, useValue: LABORATORY_MODULE_CONFIG },
      LabOrdersService,
    ],
})
export class PatientMedicalHistoryComponent implements OnInit, OnDestroy {
  readonly RecordType = RecordType
  private destroy$ = new Subject<void>()

  patientId!: string
  patient: Patient | null = null
  records: MedicalRecord[] = []
  isLoading = true

  labOrders: any[] = []
  labLoading = false
  printingLabOrderId: string | null = null

  // Filtros
  filterType: RecordType | 'ALL' = 'ALL'
  filterDateFromControl = new FormControl<Date | null>(null)
  filterDateToControl = new FormControl<Date | null>(null)
  searchTerm = ''

  recordTypes = Object.values(RecordType)

  constructor(
    private route: ActivatedRoute,
    private router: Router,
    private location: Location,
    private medicalRecordsService: MedicalRecordsService,
    private patientsService: PatientsService,
    private alert: AlertService,
    private cdr: ChangeDetectorRef,
    private roleState: RoleStateService,
    private laboratoryService: LabOrdersService,
  ) {}

  /** NURSE tiene RecordsRead (entra al módulo) pero el backend solo permite escribir a DOCTOR/ADMIN. */
  get canWriteRecords(): boolean {
    return this.roleState.hasPermission(Permission.RecordsWrite)
  }

  ngOnInit(): void {
    this.patientId = this.route.snapshot.paramMap.get('patientId') || ''
    if (!this.patientId) {
      this.alert
        .fire({
          icon: 'error',
          title: 'Error',
          text: 'No se especificó un paciente.',
          confirmButtonText: 'Volver',
        })
        .then(() => this.router.navigate(['/dashboard/medical-records']))
      return
    }
    this.loadPatient()
    this.loadRecords()
    this.loadLabOrders()
  }

  /**
   * Órdenes de laboratorio del paciente. Hasta ahora el resultado vivía solo
   * en el módulo de Laboratorio: el médico que pidió el examen no tenía desde
   * dónde llegar a él salvo ir a buscar la orden a mano.
   */
  private loadLabOrders() {
    if (!this.roleState.hasPermission(Permission.LabRead)) return
    this.labLoading = true
    this.laboratoryService
      .list(1, 50, { patientId: this.patientId })
      .pipe(takeUntil(this.destroy$))
      .subscribe({
        next: (r: any) => {
          this.labOrders = r?.items ?? []
          this.labLoading = false
          this.cdr.markForCheck()
        },
        error: () => {
          this.labLoading = false
          this.cdr.markForCheck()
        },
      })
  }

  /** Estudios con resultado cargado, que es lo que el médico viene a leer. */
  resultedItems(order: any): any[] {
    return (order?.items ?? []).filter((i: any) => !!i.resultedAt)
  }

  hasAbnormal(order: any): boolean {
    return this.resultedItems(order).some((i: any) => i.isAbnormal)
  }

  printLabResults(order: any): void {
    if (this.printingLabOrderId) return
    this.printingLabOrderId = order.id
    this.cdr.markForCheck()
    this.laboratoryService
      .getResultsPdf(order.id)
      .pipe(takeUntil(this.destroy$))
      .subscribe({
        next: blob => {
          this.printingLabOrderId = null
          openPdfInNewTab(blob, 'resultados.pdf')
          this.cdr.markForCheck()
        },
        error: () => {
          this.printingLabOrderId = null
          this.cdr.markForCheck()
        },
      })
  }

  ngOnDestroy(): void {
    this.destroy$.next()
    this.destroy$.complete()
  }

  private loadPatient() {
    this.patientsService
      .getPatientById(this.patientId)
      .pipe(takeUntil(this.destroy$))
      .subscribe({
        next: patient => {
          this.patient = patient
          this.cdr.markForCheck()
        },
        error: () => {
          this.alert.fire({
            icon: 'error',
            title: 'Error',
            text: 'No se pudo cargar la información del paciente.',
            confirmButtonText: 'Aceptar',
          })
        },
      })
  }

  private loadRecords() {
    this.isLoading = true
    this.cdr.markForCheck()

    this.medicalRecordsService
      .getMedicalRecordsByPatient(this.patientId)
      .pipe(takeUntil(this.destroy$))
      .subscribe({
        next: records => {
          // Ordenar por fecha descendente (más reciente primero)
          this.records = records.sort(
            (a, b) => new Date(b.createdAt || '').getTime() - new Date(a.createdAt || '').getTime(),
          )
          this.isLoading = false
          this.cdr.markForCheck()
        },
        error: () => {
          this.isLoading = false
          this.cdr.markForCheck()
        },
      })
  }

  get filteredRecords(): MedicalRecord[] {
    let filtered = this.records

    // Filtro por tipo
    if (this.filterType !== 'ALL') {
      filtered = filtered.filter(r => r.type === this.filterType)
    }

    // Filtro por rango de fechas
    const filterDateFrom = this.filterDateFromControl.value
    const filterDateTo = this.filterDateToControl.value

    if (filterDateFrom) {
      filtered = filtered.filter(r => new Date(r.createdAt || '') >= filterDateFrom)
    }
    if (filterDateTo) {
      const to = new Date(filterDateTo)
      to.setHours(23, 59, 59, 999)
      filtered = filtered.filter(r => new Date(r.createdAt || '') <= to)
    }

    // Búsqueda por texto (motivo de consulta, diagnóstico). matchesSearch
    // ignora tildes además de mayúsculas — texto clínico en español las usa
    // todo el tiempo ("bronquitis crónica", "revisión") y un .includes() a
    // mano no encontraba nada si quien buscaba no las tecleaba exactamente
    // igual que quien las cargó.
    if (this.searchTerm.trim()) {
      filtered = filtered.filter(r =>
        matchesSearch(this.searchTerm, r.chiefComplaint, r.diagnosis, r.assessment),
      )
    }

    return filtered
  }

  /** Etiqueta e icono salen del mapa compartido, para que no diverjan por pantalla. */
  getTypeText(type: RecordType): string {
    return recordTypeLabel(type)
  }

  getTypeIcon(type: RecordType): string {
    return recordTypeIcon(type)
  }

  getTypeColor(type: RecordType): string {
    const colors = {
      [RecordType.CONSULTATION]: 'bg-blue-50 text-blue-700 border-blue-200',
      [RecordType.EMERGENCY]: 'bg-red-50 text-red-700 border-red-200',
      [RecordType.SURGERY]: 'bg-purple-50 text-purple-700 border-purple-200',
      [RecordType.FOLLOW_UP]: 'bg-green-50 text-green-700 border-green-200',
      [RecordType.LABORATORY]: 'bg-yellow-50 text-yellow-700 border-yellow-200',
      [RecordType.IMAGING]: 'bg-indigo-50 text-indigo-700 border-indigo-200',
      [RecordType.OTHER]: 'bg-slate-50 text-slate-700 border-slate-200',
    }
    return colors[type] || 'bg-slate-50 text-slate-700 border-slate-200'
  }

  viewRecord(recordId: string) {
    this.router.navigate(['/dashboard/medical-records', recordId])
  }

  editRecord(recordId: string) {
    this.router.navigate(['/dashboard/medical-records', recordId, 'edit'])
  }

  createFollowUp(originalRecordId: string) {
    // Crear reconsulta vinculada
    this.router.navigate(['/dashboard/medical-records/new'], {
      queryParams: {
        patientId: this.patientId,
        relatedRecordId: originalRecordId,
        type: RecordType.FOLLOW_UP,
      },
    })
  }

  createNewConsultation() {
    // Nueva consulta independiente
    this.router.navigate(['/dashboard/medical-records/new'], {
      queryParams: { patientId: this.patientId },
    })
  }

  goBack() {
    this.location.back()
  }

  /** Columna `date`: día del calendario, sin hora y sin desplazar la zona. */
  formatBirthDate(date: string | Date | undefined): string {
    return formatPlainDate(date)
  }

  /** Para instantes (`createdAt`): sí lleva hora y sí va en zona local. */
  formatDate(date: string | Date | undefined): string {
    if (!date) return ''
    const d = new Date(date)
    return d.toLocaleDateString('es-BO', {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    })
  }

  /**
   * "Atendido por": el nombre del médico vive en `doctor.personalInfo` y su
   * tratamiento en `professionalInfo.title`. La plantilla leía `doctor.firstName`,
   * que no existe en la entidad User, así que salía un "Dr(a)." sin nombre.
   */
  doctorName(record: MedicalRecord): string {
    const doctor = record.doctor
    const fullName = `${doctor?.personalInfo?.firstName ?? ''} ${doctor?.personalInfo?.lastName ?? ''}`.trim()
    if (!fullName) return 'Médico no registrado'
    const title = doctor?.professionalInfo?.title?.trim()
    return title ? `${title} ${fullName}` : fullName
  }

  clearFilters() {
    this.filterType = 'ALL'
    this.filterDateFromControl.setValue(null)
    this.filterDateToControl.setValue(null)
    this.searchTerm = ''
    this.cdr.markForCheck()
  }

  getEmergencyCount(): number {
    return this.records.filter(r => r.isEmergency || r.type === RecordType.EMERGENCY).length
  }

  getLastConsultationDate(): Date | undefined {
    if (this.records.length === 0) return undefined
    return this.records[0]?.createdAt
  }

  getTypeCount(type: string): number {
    return this.records.filter(r => r.type === type).length
  }
}
