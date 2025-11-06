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
import { AlertService } from '@core/services/alert.service'
import { Subject } from 'rxjs'
import { takeUntil } from 'rxjs/operators'
import { Patient } from '../../patients/interfaces'
import { PatientsService } from '../../patients/services/patients.service'
import { MedicalRecord, RecordType } from '../interfaces'
import { MedicalRecordsService } from '../services/medical-records.service'

@Component({
  selector: 'app-patient-medical-history',
  templateUrl: './patient-medical-history.component.html',
  styleUrls: ['./patient-medical-history.component.css'],
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class PatientMedicalHistoryComponent implements OnInit, OnDestroy {
  private destroy$ = new Subject<void>()

  patientId!: string
  patient: Patient | null = null
  records: MedicalRecord[] = []
  isLoading = true

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
  ) {}

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
    console.log('[PatientHistory] Cargando expedientes para paciente:', this.patientId)

    this.medicalRecordsService
      .getMedicalRecordsByPatient(this.patientId)
      .pipe(takeUntil(this.destroy$))
      .subscribe({
        next: records => {
          console.log('[PatientHistory] Expedientes recibidos:', records.length)
          // Ordenar por fecha descendente (más reciente primero)
          this.records = records.sort(
            (a, b) => new Date(b.createdAt || '').getTime() - new Date(a.createdAt || '').getTime(),
          )
          this.isLoading = false
          this.cdr.markForCheck()
          console.log('[PatientHistory] Carga completada, isLoading = false')
        },
        error: error => {
          console.error('[PatientHistory] Error cargando expedientes:', error)
          this.isLoading = false
          this.cdr.markForCheck()
          this.alert.fire({
            icon: 'error',
            title: 'Error',
            text: 'No se pudo cargar el historial médico.',
            confirmButtonText: 'Aceptar',
          })
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

    // Búsqueda por texto (motivo de consulta, diagnóstico)
    if (this.searchTerm.trim()) {
      const term = this.searchTerm.toLowerCase()
      filtered = filtered.filter(
        r =>
          (r.chiefComplaint || '').toLowerCase().includes(term) ||
          (r.diagnosis || '').toLowerCase().includes(term) ||
          (r.assessment || '').toLowerCase().includes(term),
      )
    }

    return filtered
  }

  getTypeText(type: RecordType): string {
    const types = {
      [RecordType.CONSULTATION]: 'Consulta',
      [RecordType.EMERGENCY]: 'Emergencia',
      [RecordType.SURGERY]: 'Cirugía',
      [RecordType.FOLLOW_UP]: 'Seguimiento',
      [RecordType.LABORATORY]: 'Laboratorio',
      [RecordType.IMAGING]: 'Imagenología',
      [RecordType.OTHER]: 'Otro',
    }
    return types[type] || type
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
