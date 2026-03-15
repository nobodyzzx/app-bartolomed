import { StepperSelectionEvent } from '@angular/cdk/stepper'
import { Location } from '@angular/common'
import {
  ChangeDetectionStrategy,
  ChangeDetectorRef,
  Component,
  HostListener,
  OnDestroy,
  OnInit,
} from '@angular/core'
import { FormBuilder, FormControl, FormGroup, Validators } from '@angular/forms'
import { MatAutocompleteSelectedEvent } from '@angular/material/autocomplete'
import { ActivatedRoute, Router } from '@angular/router'
import { AlertService } from '@core/services/alert.service'
import { combineLatest, Observable, of, Subject } from 'rxjs'
import { auditTime, map, startWith, takeUntil } from 'rxjs/operators'
import { environment } from '../../../../../environments/environments'
import { User } from '../../../../auth/interfaces/user.interface'
import { Patient } from '../../patients/interfaces'
import { PatientsService } from '../../patients/services/patients.service'
import { UsersService } from '../../users/users.service'
import {
  ConsentType,
  CreateConsentDto,
  CreateMedicalRecordDto,
  MedicalRecord,
  RecordType,
} from '../interfaces'
import { MedicalRecordsService } from '../services/medical-records.service'
import {
  getVitalSignClasses,
  getVitalSignIcon,
  getVitalSignMessage,
  VITAL_SIGNS_RANGES,
  vitalSignValidator,
} from '../validators/vital-signs.validators'

@Component({
  selector: 'app-medical-record-form',
  templateUrl: './medical-record-form.component.html',
  styleUrls: ['./medical-record-form.component.css'],
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class MedicalRecordFormComponent implements OnInit, OnDestroy {
  // Stepper form groups (reducido de 6 a 4 pasos)
  patientInfoForm!: FormGroup
  clinicalDataForm!: FormGroup // Combina historia médica + signos vitales
  evaluationForm!: FormGroup // Combina examen físico + evaluación
  consentForm!: FormGroup

  // Control del índice del stepper para evitar referencias a template variables no inicializadas
  currentStepIndex = 0

  private readonly destroy$ = new Subject<void>()

  // Data for dropdowns
  patients$: Observable<Patient[]> = of([])
  doctors$: Observable<User[]> = of([])
  // Listas filtradas para selects con búsqueda
  filteredPatients$: Observable<Patient[]> = of([])
  filteredDoctors$: Observable<User[]> = of([])
  // Controles de búsqueda para autocompletes
  patientSearchCtrl = new FormControl<string>('')
  doctorSearchCtrl = new FormControl<string>('')
  // Copias locales para búsquedas síncronas
  private patientsList: Patient[] = []
  private doctorsList: User[] = []

  // Enums for templates
  recordTypes = Object.values(RecordType)
  consentTypes = Object.values(ConsentType)

  // Vital signs ranges for tooltips
  vitalSignsRanges = VITAL_SIGNS_RANGES

  // Loading states
  isLoading = false
  isSaving = false

  // Dates helpers
  today: Date = new Date()

  // Edit mode
  isEditMode = false
  recordId: string | null = null

  // Follow-up mode (to prevent editing historical data)
  isFollowUpMode = false
  relatedRecordId: string | null = null
  originalConsultation: MedicalRecord | null = null

  // Patient preselection from route
  preselectedPatientId: string | null = null

  // UX: detectar si el usuario cambió manualmente el formato de impresión
  private userChangedPrintTemplate = false

  // Autosave borrador (solo Paso 1)
  private readonly DRAFT_KEY = 'medical-record:new:draft:v1'

  constructor(
    private fb: FormBuilder,
    private router: Router,
    private route: ActivatedRoute,
    private location: Location,
    private medicalRecordsService: MedicalRecordsService,
    private patientsService: PatientsService,
    private usersService: UsersService,
    private alert: AlertService,
    private cdr: ChangeDetectorRef,
  ) {
    this.initializeForms()
  }

  ngOnDestroy(): void {
    this.destroy$.next()
    this.destroy$.complete()
  }

  ngOnInit(): void {
    // Capturar parámetros de query params
    this.route.queryParams.subscribe(params => {
      if (params['patientId']) {
        this.preselectedPatientId = params['patientId']
      }

      // Si viene de un seguimiento (follow-up)
      if (params['relatedRecordId']) {
        this.handleFollowUpMode(params['relatedRecordId'], params['type'])
      } else if (params['type']) {
        // Solo establecer el tipo sin seguimiento
        this.patientInfoForm.patchValue({ type: params['type'] })
      }
    })

    this.loadData()
    this.checkEditMode()

    // Restaurar borrador si existe (solo en modo nuevo)
    this.tryRestoreDraft()

    // Guardado automático del Paso 1 (borrador local)
    this.patientInfoForm.valueChanges
      .pipe(auditTime(800), takeUntil(this.destroy$))
      .subscribe(val => {
        try {
          localStorage.setItem(this.DRAFT_KEY, JSON.stringify(val))
        } catch (_) {
          // almacenamiento puede fallar por cuota; ignorar
        }
      })

    // Sincronizar automáticamente consentType -> printTemplate (mejora UX)
    const printCtl = this.consentForm.get('printTemplate')
    const typeCtl = this.consentForm.get('consentType')
    printCtl?.valueChanges.subscribe(() => {
      this.userChangedPrintTemplate = true
    })
    typeCtl?.valueChanges.subscribe((type: ConsentType) => {
      if (!printCtl) return
      if (this.userChangedPrintTemplate) return // respetar elección manual del usuario
      const mapped = this.mapConsentTypeToTemplate(type)
      // Evitar bucles y no marcar como dirty al usuario
      printCtl.patchValue(mapped, { emitEvent: false })
    })
  }

  private initializeForms(): void {
    // Paso 1: Información del Paciente
    this.patientInfoForm = this.fb.group({
      patientId: ['', Validators.required],
      doctorId: ['', Validators.required],
      type: [RecordType.CONSULTATION, Validators.required],
      isEmergency: [false],
      chiefComplaint: ['', [Validators.required, Validators.minLength(10)]],
    })

    // Paso 2: Datos Clínicos (Historia Médica + Signos Vitales)
    this.clinicalDataForm = this.fb.group({
      // Historia Médica
      historyOfPresentIllness: [''],
      pastMedicalHistory: [''],
      medications: [''],
      allergies: [''],
      socialHistory: [''],
      familyHistory: [''],
      reviewOfSystems: [''],

      // Signos Vitales con validadores inteligentes
      temperature: ['', vitalSignValidator('temperature')],
      systolicBP: ['', vitalSignValidator('systolicBP')],
      diastolicBP: ['', vitalSignValidator('diastolicBP')],
      heartRate: ['', vitalSignValidator('heartRate')],
      respiratoryRate: ['', vitalSignValidator('respiratoryRate')],
      oxygenSaturation: ['', vitalSignValidator('oxygenSaturation')],
      weight: [''],
      height: [''],
    })

    // Paso 3: Evaluación (Examen Físico + Evaluación y Plan)
    this.evaluationForm = this.fb.group({
      // Examen Físico
      physicalExamination: [''],
      generalAppearance: [''],
      heent: [''],
      cardiovascular: [''],
      respiratory: [''],
      abdominal: [''],
      neurological: [''],
      musculoskeletal: [''],
      skin: [''],

      // Evaluación y Plan
      assessment: [''],
      plan: [''],
      diagnosis: [''],
      differentialDiagnosis: [''],
      treatmentPlan: [''],
      followUpInstructions: [''],
      patientEducation: [''],
      notes: [''],
      followUpDate: [''],
    })

    // Paso 4: Formulario de Consentimiento (Opcional)
    this.consentForm = this.fb.group({
      // Formato de impresión del documento (no afecta al backend)
      printTemplate: ['diagnostic'], // diagnostic | surgery | blood_transfusion | rejection
      consentType: [ConsentType.GENERAL_TREATMENT],
      // Descripción libre y campos estructurados (todos opcionales para no bloquear el flujo)
      description: [''],
      procedureName: [''],
      objective: [''],
      risks: [''],
      benefits: [''],
      // Fecha y hora del consentimiento separados para mejor UX con datepicker
      consentDate: [''],
      consentTime: [''], // formato esperado HH:mm
      signedBy: [''],

      // Campos para cirugía
      surgicalDiagnosis: [''],
      surgicalProcedureName: [''],
      leadSurgeonName: [''],
      surgeryObjective: [''],
      surgicalAlternatives: [''],
      consequencesNoSurgery: [''],
      surgeryWitnessName: [''],
      surgeryWitnessCi: [''],

      // Campos para transfusión sanguínea
      transfusionDiagnosis: [''],
      bloodProductType: [''],
      treatingPhysicianName: [''],
      transfusionBenefits: [''],
      transfusionAlternatives: [''],

      // Campos para rechazo/revocación
      clinicName: [''],
      clinicalRecordNumber: [''],
      rejectedActName: [''],
      informingPhysicianName: [''],
      rejectionDiagnosis: [''],
      rejectionConsequences: [''],
      witnessName: [''],
      witnessCi: [''],
      rejectionCity: [''],
    })
  }

  private loadData(): void {
    // Cargar pacientes
    this.patients$ = this.patientsService.findAll()
    this.patients$.pipe(takeUntil(this.destroy$)).subscribe(patients => {
      this.patientsList = patients

      // Si hay un patientId preseleccionado del query param, usarlo
      if (this.preselectedPatientId && patients.find(p => p.id === this.preselectedPatientId)) {
        this.patientInfoForm.patchValue({
          patientId: this.preselectedPatientId,
        })
      } else if (patients.length > 0 && !this.isEditMode) {
        this.patientInfoForm.patchValue({
          patientId: patients[0].id,
        })
      }
      // Sincronizar texto del autocomplete del paciente
      this.syncPatientSearchText()
      this.cdr.markForCheck()
    })
    // Stream filtrado de pacientes basado en input de búsqueda
    this.filteredPatients$ = combineLatest([
      this.patients$,
      this.patientSearchCtrl.valueChanges.pipe(startWith('')),
    ]).pipe(
      map(([list, term]) => {
        const t = (term || '').toString().toLowerCase().trim()
        if (!t) return list
        return list.filter(p =>
          `${p.firstName ?? ''} ${p.lastName ?? ''} ${p.documentNumber ?? ''}`
            .toLowerCase()
            .includes(t),
        )
      }),
    )

    // Cargar doctores (usuarios con rol médico)
    this.doctors$ = this.usersService.getUsers()
    this.doctors$.pipe(takeUntil(this.destroy$)).subscribe(doctors => {
      // Filtrar solo los usuarios con rol de doctor (defensivo por si roles viene undefined)
      const filteredDoctors = doctors.filter(user => {
        const roles = Array.isArray((user as any).roles) ? ((user as any).roles as string[]) : []
        const roleName = user.professionalInfo?.role?.toLowerCase?.() || ''
        return (
          roles.includes('doctor') || roleName.includes('médico') || roleName.includes('doctor')
        )
      })
      this.doctorsList = filteredDoctors
      if (filteredDoctors.length > 0 && !this.isEditMode) {
        this.patientInfoForm.patchValue({
          doctorId: filteredDoctors[0].id,
        })
      }
      // Sincronizar texto del autocomplete del doctor
      this.syncDoctorSearchText()
      this.cdr.markForCheck()
    })
    // Stream filtrado de doctores basado en input de búsqueda
    this.filteredDoctors$ = combineLatest([
      this.doctors$,
      this.doctorSearchCtrl.valueChanges.pipe(startWith('')),
    ]).pipe(
      map(([list, term]) => {
        const t = (term || '').toString().toLowerCase().trim()
        if (!t) return list
        return list.filter(d =>
          `${d.personalInfo?.firstName ?? ''} ${d.personalInfo?.lastName ?? ''} ${d.professionalInfo?.role ?? ''}`
            .toLowerCase()
            .includes(t),
        )
      }),
    )
  }

  // Sincronizar cambios del stepper con la UI compacta de navegación
  onStepChange(event: StepperSelectionEvent) {
    this.currentStepIndex = event.selectedIndex
  }

  // Atajos de teclado: Ctrl + ← / Ctrl + → para navegar pasos
  @HostListener('window:keydown', ['$event'])
  onKeydown(event: KeyboardEvent) {
    if (this.isLoading) return
    const ctrl = event.ctrlKey || event.metaKey
    if (!ctrl) return
    if (event.key === 'ArrowRight') {
      event.preventDefault()
      if (this.currentStepIndex === 0 && this.patientInfoForm.invalid) return
      this.currentStepIndex = Math.min(3, this.currentStepIndex + 1)
      this.cdr.markForCheck()
    }
    if (event.key === 'ArrowLeft') {
      event.preventDefault()
      this.currentStepIndex = Math.max(0, this.currentStepIndex - 1)
      this.cdr.markForCheck()
    }
  }

  // trackBy helpers para listas en *ngFor
  trackById(_index: number, item: { id?: string } | null): string | null {
    return item?.id ?? null
  }
  trackByValue(_index: number, value: any): any {
    return value
  }

  // Autocomplete: selección de paciente/doctor
  onPatientSelected(event: MatAutocompleteSelectedEvent) {
    const patient: Patient | null = event.option.value || null
    this.patientInfoForm.patchValue({ patientId: patient?.id || '' })
    // reflejar texto en input
    this.patientSearchCtrl.setValue(this.patientDisplay(patient), { emitEvent: false })
    this.cdr.markForCheck()
  }

  onDoctorSelected(event: MatAutocompleteSelectedEvent) {
    const doctor: User | null = event.option.value || null
    this.patientInfoForm.patchValue({ doctorId: doctor?.id || '' })
    this.doctorSearchCtrl.setValue(this.doctorDisplay(doctor), { emitEvent: false })
    this.cdr.markForCheck()
  }

  clearPatientSelection() {
    this.patientInfoForm.patchValue({ patientId: '' })
    this.patientSearchCtrl.setValue('', { emitEvent: true })
    this.cdr.markForCheck()
  }

  clearDoctorSelection() {
    this.patientInfoForm.patchValue({ doctorId: '' })
    this.doctorSearchCtrl.setValue('', { emitEvent: true })
    this.cdr.markForCheck()
  }

  // Scroll suave a secciones dentro del paso
  scrollTo(elementId: string) {
    const el = document.getElementById(elementId)
    if (el) el.scrollIntoView({ behavior: 'smooth', block: 'start' })
  }

  private checkEditMode(): void {
    const id = this.route.snapshot.paramMap.get('id')
    if (id) {
      this.isEditMode = true
      this.recordId = id
      this.loadMedicalRecord(id)
    }
  }

  private loadMedicalRecord(id: string): void {
    this.isLoading = true
    this.medicalRecordsService
      .getMedicalRecordById(id)
      .pipe(takeUntil(this.destroy$))
      .subscribe({
        next: record => {
          this.populateForm(record)
          // Esperar a que las listas se carguen antes de sincronizar
          setTimeout(() => {
            this.syncPatientSearchText()
            this.syncDoctorSearchText()
            this.cdr.markForCheck()
          }, 500)
          this.isLoading = false
          this.cdr.markForCheck()
        },
        error: () => {
          this.showError('Error al cargar el expediente médico')
          this.isLoading = false
          this.cdr.markForCheck()
        },
      })
  }

  private handleFollowUpMode(relatedRecordId: string, type?: string): void {
    // Activar modo seguimiento
    this.isFollowUpMode = true
    this.relatedRecordId = relatedRecordId

    this.medicalRecordsService
      .getMedicalRecordById(relatedRecordId)
      .pipe(takeUntil(this.destroy$))
      .subscribe({
        next: originalRecord => {
          // Guardar consulta original para referencia
          this.originalConsultation = originalRecord

          // Establecer el tipo como FOLLOW_UP
          const followUpType = type || RecordType.FOLLOW_UP

          // Pre-cargar información del paciente y doctor (DESHABILITADOS)
          const patientId = originalRecord.patient?.id || originalRecord.patientId
          const doctorId = originalRecord.doctor?.id || originalRecord.doctorId

          this.patientInfoForm.patchValue({
            patientId: patientId,
            doctorId: doctorId,
            type: followUpType,
            chiefComplaint: `Seguimiento: ${originalRecord.chiefComplaint || 'Consulta previa'}`,
          })

          // IMPORTANTE:
          // - SOLO bloqueamos el paciente (no puede cambiar en un seguimiento)
          // - El doctor NO se bloquea (otro médico puede atender el seguimiento)
          // - El tipo se bloquea (siempre debe ser FOLLOW_UP)
          // Deshabilitamos el control de búsqueda del paciente para evitar cambios
          this.patientSearchCtrl.disable()
          this.patientInfoForm.get('type')?.disable()

          // Pre-cargar historia médica relevante del registro anterior (DESHABILITADA)
          this.clinicalDataForm.patchValue({
            pastMedicalHistory: originalRecord.pastMedicalHistory,
            medications: originalRecord.medications,
            allergies: originalRecord.allergies,
            socialHistory: originalRecord.socialHistory,
            familyHistory: originalRecord.familyHistory,
          })

          // BLOQUEAR campos de historia médica (son del registro original)
          this.clinicalDataForm.get('pastMedicalHistory')?.disable()
          this.clinicalDataForm.get('medications')?.disable()
          this.clinicalDataForm.get('allergies')?.disable()
          this.clinicalDataForm.get('socialHistory')?.disable()
          this.clinicalDataForm.get('familyHistory')?.disable()

          // Pre-cargar información del diagnóstico previo en el assessment
          this.evaluationForm.patchValue({
            assessment: `Seguimiento de: ${originalRecord.diagnosis || originalRecord.assessment || 'Consulta anterior'}\n\nEvolución: `,
          })

          // Mostrar mensaje informativo
          this.alert.fire({
            icon: 'info',
            title: 'Seguimiento de Expediente Médico',
            html: `
              <div class="text-left space-y-3">
                <p class="text-sm text-slate-600">Se ha cargado información de la consulta original para seguimiento:</p>
                
                <div class="bg-blue-50 p-3 rounded-lg text-sm border border-blue-200">
                  <p class="font-semibold text-blue-900 mb-2">📋 Consulta Original</p>
                  <p><strong>Paciente:</strong> ${originalRecord.patient?.firstName} ${originalRecord.patient?.lastName}</p>
                  <p><strong>Doctor anterior:</strong> Dr(a). ${originalRecord.doctor?.firstName} ${originalRecord.doctor?.lastName}</p>
                  <p><strong>Motivo:</strong> ${originalRecord.chiefComplaint}</p>
                  <p><strong>Diagnóstico previo:</strong> ${originalRecord.diagnosis || 'No especificado'}</p>
                </div>

                <div class="bg-amber-50 p-3 rounded-lg text-sm border border-amber-200">
                  <p class="font-semibold text-amber-900 mb-1">🔒 Campos Protegidos</p>
                  <ul class="text-xs text-amber-700 space-y-1 list-disc list-inside">
                    <li><strong>Paciente:</strong> Bloqueado (no puede cambiar en seguimiento)</li>
                    <li><strong>Historia médica:</strong> Bloqueada (datos históricos del paciente)</li>
                    <li><strong>Doctor:</strong> Puedes cambiar si otro médico atiende el seguimiento</li>
                  </ul>
                </div>

                <p class="text-xs text-slate-500">
                  Puedes documentar la evolución actual del paciente en los campos habilitados.
                </p>
              </div>
            `,
            confirmButtonText: 'Entendido',
            customClass: {
              popup: 'swal-wide',
            },
          })

          // Sincronizar autocompletes
          setTimeout(() => {
            this.syncPatientSearchText()
            this.syncDoctorSearchText()
            this.cdr.markForCheck()
          }, 500)
        },
        error: () => {
          this.showError('No se pudo cargar la consulta original. Se creará una consulta nueva.')

          // Si falla, desactivar modo seguimiento y al menos establecer el tipo
          this.isFollowUpMode = false
          if (type) {
            this.patientInfoForm.patchValue({ type })
          }
        },
      })
  }

  private populateForm(record: MedicalRecord): void {
    const patientId = record.patient?.id || record.patientId
    const doctorId = record.doctor?.id || record.doctorId

    // Poblar formularios con datos existentes
    this.patientInfoForm.patchValue({
      patientId: patientId,
      doctorId: doctorId,
      type: record.type,
      isEmergency: record.isEmergency,
      chiefComplaint: record.chiefComplaint,
    })

    // Poblar datos clínicos (historia médica + signos vitales)
    this.clinicalDataForm.patchValue({
      historyOfPresentIllness: record.historyOfPresentIllness,
      pastMedicalHistory: record.pastMedicalHistory,
      medications: record.medications,
      allergies: record.allergies,
      socialHistory: record.socialHistory,
      familyHistory: record.familyHistory,
      reviewOfSystems: record.reviewOfSystems,
      // Signos vitales directamente del record (no vitalSigns.*)
      temperature: record.temperature,
      systolicBP: record.systolicBP,
      diastolicBP: record.diastolicBP,
      heartRate: record.heartRate,
      respiratoryRate: record.respiratoryRate,
      oxygenSaturation: record.oxygenSaturation,
      weight: record.weight,
      height: record.height,
    })

    // Poblar evaluación (examen físico + plan)
    if (record.physicalExam) {
      this.evaluationForm.patchValue({
        physicalExamination: record.physicalExamination,
        generalAppearance: record.physicalExam.generalAppearance,
        heent: record.physicalExam.heent,
        cardiovascular: record.physicalExam.cardiovascular,
        respiratory: record.physicalExam.respiratory,
        abdominal: record.physicalExam.abdominal,
        neurological: record.physicalExam.neurological,
        musculoskeletal: record.physicalExam.musculoskeletal,
        skin: record.physicalExam.skin,
      })
    }

    this.evaluationForm.patchValue({
      assessment: record.assessment,
      plan: record.plan,
      diagnosis: record.diagnosis,
      differentialDiagnosis: record.differentialDiagnosis,
      treatmentPlan: record.treatmentPlan,
      followUpInstructions: record.followUpInstructions,
      patientEducation: record.patientEducation,
      notes: record.notes,
      followUpDate: record.followUpDate,
    })

    // Nota: syncPatientSearchText y syncDoctorSearchText se llaman después en loadMedicalRecord
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

  getConsentTypeText(type: ConsentType): string {
    const types = {
      [ConsentType.GENERAL_TREATMENT]: 'Tratamiento General',
      [ConsentType.SURGERY]: 'Cirugía',
      [ConsentType.ANESTHESIA]: 'Anestesia',
      [ConsentType.BLOOD_TRANSFUSION]: 'Transfusión Sanguínea',
      [ConsentType.EXPERIMENTAL_TREATMENT]: 'Tratamiento Experimental',
      [ConsentType.PHOTOGRAPHY]: 'Fotografías Médicas',
      [ConsentType.DATA_SHARING]: 'Compartir Datos',
      [ConsentType.OTHER]: 'Otro',
    }
    return types[type] || type
  }

  onSubmit(): void {
    if (this.isAllFormsValid()) {
      this.isSaving = true

      const medicalRecord = this.createMedicalRecordDto()

      if (this.isEditMode && this.recordId) {
        this.updateMedicalRecord(medicalRecord)
      } else {
        this.createMedicalRecord(medicalRecord)
      }
    } else {
      this.showError('Por favor complete todos los campos requeridos')
    }
  }

  private isAllFormsValid(): boolean {
    return this.patientInfoForm.valid
  }

  private createMedicalRecordDto(): CreateMedicalRecordDto {
    // Usar getRawValue() en lugar de value para incluir campos deshabilitados
    const patientData = this.patientInfoForm.getRawValue()
    const clinicalData = this.clinicalDataForm.getRawValue()
    const evaluationData = this.evaluationForm.getRawValue()

    const dto: CreateMedicalRecordDto = {
      ...patientData,
      ...clinicalData,
      ...evaluationData,
    }

    // Si estamos en modo seguimiento, incluir el relatedRecordId
    if (this.isFollowUpMode && this.relatedRecordId) {
      dto.relatedRecordId = this.relatedRecordId
    }

    // Limpiar campos null, undefined o vacíos que puedan causar errores de validación
    const cleanDto = this.cleanDto(dto)

    // CRÍTICO: Asegurar que patientId y doctorId siempre estén presentes
    // Estos son obligatorios y pueden estar deshabilitados en modo seguimiento
    if (!cleanDto.patientId && patientData.patientId) {
      cleanDto.patientId = patientData.patientId
    }
    if (!cleanDto.doctorId && patientData.doctorId) {
      cleanDto.doctorId = patientData.doctorId
    }

    return cleanDto
  }

  /**
   * Limpia el DTO eliminando propiedades null, undefined o strings vacíos
   * Mantiene números 0 y booleanos false
   * IMPORTANTE: patientId y doctorId se validan después de esta limpieza
   */
  private cleanDto(dto: any): CreateMedicalRecordDto {
    const cleaned: any = {}

    // Campos de signos vitales que deben ser números
    const numericFields = [
      'temperature',
      'systolicBP',
      'diastolicBP',
      'heartRate',
      'respiratoryRate',
      'oxygenSaturation',
      'weight',
      'height',
    ]

    for (const key in dto) {
      const value = dto[key]

      // Skip null o undefined
      if (value === null || value === undefined) {
        continue
      }

      // Campos numéricos: convertir strings a números si es posible
      if (numericFields.includes(key)) {
        const numValue = typeof value === 'string' ? parseFloat(value) : value
        if (!isNaN(numValue) && numValue !== 0) {
          // Solo incluir si es un número válido y no es 0 (evitar enviar 0 por defecto)
          cleaned[key] = numValue
        }
        continue
      }

      // Mantener valores válidos:
      if (typeof value === 'string') {
        // Mantener strings no vacíos O UUIDs (patientId, doctorId, etc)
        if (value.trim() !== '' || this.isUUID(value)) {
          cleaned[key] = value
        }
      } else if (typeof value === 'number' || typeof value === 'boolean' || value instanceof Date) {
        cleaned[key] = value
      }
    }

    return cleaned as CreateMedicalRecordDto
  }

  /**
   * Verifica si un string es un UUID válido
   */
  private isUUID(str: string): boolean {
    const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i
    return uuidRegex.test(str)
  }

  private createMedicalRecord(medicalRecord: CreateMedicalRecordDto): void {
    this.medicalRecordsService.createMedicalRecord(medicalRecord).subscribe({
      next: record => {
        if (this.consentForm.valid) {
          this.createConsentForm(record.id!)
        } else {
          this.alert
            .fire({
              icon: 'success',
              title: '¡Expediente creado!',
              text: 'El expediente médico ha sido creado exitosamente.',
              confirmButtonText: 'Aceptar',
            })
            .then(() => {
              this.clearDraft()
              this.router.navigate(['/dashboard/medical-records'])
            })
        }
      },
      error: error => {
        this.showError('Error al crear el expediente médico')
        this.isSaving = false
      },
    })
  }

  private updateMedicalRecord(medicalRecord: CreateMedicalRecordDto): void {
    this.medicalRecordsService.updateMedicalRecord(this.recordId!, medicalRecord).subscribe({
      next: record => {
        this.alert
          .fire({
            icon: 'success',
            title: '¡Expediente actualizado!',
            text: 'El expediente médico ha sido actualizado exitosamente.',
            confirmButtonText: 'Aceptar',
          })
          .then(() => {
            this.clearDraft()
            this.router.navigate(['/dashboard/medical-records'])
          })
        this.isSaving = false
      },
      error: error => {
        this.showError('Error al actualizar el expediente médico')
        this.isSaving = false
      },
    })
  }

  private createConsentForm(medicalRecordId: string): void {
    const consentData = this.consentForm.value
    const consent: CreateConsentDto = {
      medicalRecordId,
      patientId: this.patientInfoForm.value.patientId,
      doctorId: this.patientInfoForm.value.doctorId,
      consentType: consentData.consentType,
      description: consentData.description,
      signedBy: consentData.signedBy,
    }

    this.medicalRecordsService.createConsentForm(consent).subscribe({
      next: consentRecord => {
        this.alert
          .fire({
            icon: 'success',
            title: '¡Expediente y consentimiento creados!',
            text: 'El expediente médico y el consentimiento han sido creados exitosamente.',
            confirmButtonText: 'Aceptar',
          })
          .then(() => {
            this.clearDraft()
            this.router.navigate(['/dashboard/medical-records'])
          })
        this.isSaving = false
      },
      error: error => {
        this.showError('Error al crear el formulario de consentimiento')
        this.isSaving = false
      },
    })
  }

  saveDraft(): void {
    this.alert
      .fire({
        title: '¿Guardar borrador?',
        text: 'Se guardará el expediente médico en estado borrador con la información actual.',
        icon: 'question',
        showCancelButton: true,
        confirmButtonText: 'Sí, guardar',
        cancelButtonText: 'Cancelar',
      })
      .then(result => {
        if (result.isConfirmed) {
          if (this.patientInfoForm.valid) {
            this.isSaving = true
            const medicalRecord = this.createMedicalRecordDto()

            this.medicalRecordsService.createMedicalRecord(medicalRecord).subscribe({
              next: record => {
                this.alert
                  .fire({
                    icon: 'success',
                    title: '¡Borrador guardado!',
                    text: 'El expediente médico ha sido guardado como borrador.',
                    confirmButtonText: 'Aceptar',
                  })
                  .then(() => {
                    this.router.navigate(['/dashboard/medical-records'])
                  })
                this.isSaving = false
              },
              error: error => {
                this.showError('Error al guardar el borrador')
                this.isSaving = false
              },
            })
          } else {
            this.alert.fire({
              icon: 'warning',
              title: 'Información incompleta',
              text: 'Debe completar al menos la información básica del paciente',
              confirmButtonText: 'Entendido',
            })
          }
        }
      })
  }

  cancel(): void {
    this.alert
      .fire({
        title: '¿Descartar cambios?',
        text: '¿Estás seguro de que deseas salir? Los cambios no guardados se perderán.',
        icon: 'warning',
        showCancelButton: true,
        confirmButtonText: 'Sí, salir',
        cancelButtonText: 'Continuar editando',
      })
      .then(result => {
        if (result.isConfirmed) {
          this.clearDraft()
          this.router.navigate(['/dashboard/medical-records'])
        }
      })
  }

  goBack(): void {
    this.location.back()
  }

  // Métodos auxiliares para validación de signos vitales
  getVitalSignClasses(controlName: string): { [key: string]: boolean } {
    return getVitalSignClasses(this.clinicalDataForm.get(controlName))
  }

  getVitalSignMessage(controlName: string): string {
    return getVitalSignMessage(this.clinicalDataForm.get(controlName))
  }

  getVitalSignIcon(controlName: string): string {
    return getVitalSignIcon(this.clinicalDataForm.get(controlName))
  }

  // Obtener el paciente seleccionado para mostrar información médica
  getSelectedPatient(): Patient | undefined {
    const patientId = this.patientInfoForm.get('patientId')?.value
    if (!patientId) return undefined
    return this.patientsList.find(p => p.id === patientId)
  }

  // Obtener el doctor seleccionado (para impresión del consentimiento)
  getSelectedDoctor(): User | undefined {
    const doctorId = this.patientInfoForm.get('doctorId')?.value
    if (!doctorId) return undefined
    return this.doctorsList.find(d => d.id === doctorId)
  }

  patientDisplay(p?: Patient | null): string {
    if (!p) return ''
    const names = `${p.firstName ?? ''} ${p.lastName ?? ''}`.trim()
    const id = p.documentNumber ? ` - ${p.documentNumber}` : ''
    return `${names}${id}`
  }

  doctorDisplay(d?: User | null): string {
    if (!d) return ''
    const names = `${d.personalInfo?.firstName ?? ''} ${d.personalInfo?.lastName ?? ''}`.trim()
    const role = d.professionalInfo?.role ? ` - ${d.professionalInfo.role}` : ''
    return `${names}${role}`
  }

  private syncPatientSearchText() {
    const patient = this.getSelectedPatient()
    if (patient) {
      this.patientSearchCtrl.setValue(this.patientDisplay(patient), { emitEvent: false })
    }
  }

  private syncDoctorSearchText() {
    const doctor = this.getSelectedDoctor()
    if (doctor) {
      this.doctorSearchCtrl.setValue(this.doctorDisplay(doctor), { emitEvent: false })
    }
  }

  // Generar impresión/exportación del consentimiento informado (formato Bolivia)
  printConsent(): void {
    const patient = this.getSelectedPatient()
    const doctor = this.getSelectedDoctor()
    const c = this.consentForm.value
    const template: string = c.printTemplate || 'diagnostic'

    // Fecha y hora del consentimiento (si no está definida, usar ahora)
    let consentDate: Date
    if (c.consentDate) {
      // c.consentDate proviene del mat-datepicker (Date)
      const d = new Date(c.consentDate)
      if (c.consentTime) {
        const [hh, mm] = String(c.consentTime).split(':')
        d.setHours(Number(hh) || 0, Number(mm) || 0, 0, 0)
      } else {
        const now = new Date()
        d.setHours(now.getHours(), now.getMinutes(), 0, 0)
      }
      consentDate = d
    } else {
      consentDate = new Date()
    }
    const formattedConsentDate = this.formatDateTime(consentDate)

    // Número de expediente médico (simple, idealmente backend)
    const today = new Date()
    const expedienteNumber = `EM-${today.getFullYear()}${this.pad2(today.getMonth() + 1)}${this.pad2(today.getDate())}-${Math.floor(1000 + Math.random() * 9000)}`

    // Campos derivados del paciente
    const patientName = patient ? `${patient.firstName} ${patient.lastName}` : ''
    const patientDoc = patient?.documentNumber || ''
    const birthDate = patient?.birthDate ? this.formatDate(new Date(patient.birthDate)) : ''
    const addressPhone = [patient?.address, patient?.phone].filter(Boolean).join(' · ')

    // Campos derivados del profesional
    const doctorName = doctor
      ? `${doctor.personalInfo?.firstName || ''} ${doctor.personalInfo?.lastName || ''}`.trim()
      : ''
    const doctorLicense = doctor?.professionalInfo?.license || ''

    // Preferir campos estructurados si existen; fallback a descripción libre
    const procedureName = c.procedureName || ''
    const objective = c.objective || ''
    const risks = c.risks || ''
    const benefits = c.benefits || ''
    const freeDescription = c.description || ''
    const signedBy = c.signedBy || patientName

    // Logo para PDF (usar asset estático)
    const logoUrl = `${window.location.origin}/assets/images/logo-big-horizontal-bartolomed.png`

    // Plantilla Diagnóstico (Bajo Riesgo)
    const htmlDiagnostic = `
<html lang="es">
<head>
  <meta charset="utf-8" />
  <title>Consentimiento Informado</title>
  <style>
    @page { size: A4; margin: 18mm; }
    body { font-family: Arial, Helvetica, sans-serif; color: #0f172a; }
    h1 { font-size: 20px; margin: 0 0 8px; color: #0f172a; }
    h2 { font-size: 14px; margin: 20px 0 6px; color: #0f172a; }
    p, li, td { font-size: 12px; line-height: 1.45; }
    .muted { color: #475569; }
    .small { font-size: 11px; }
    .card { border: 1px solid #cbd5e1; border-radius: 8px; padding: 12px; background: #fff; }
    .grid { display: grid; grid-template-columns: 1fr 1fr; gap: 10px; }
    .row { display: flex; gap: 12px; align-items: flex-start; }
    table { width: 100%; border-collapse: collapse; }
    th, td { border: 1px solid #cbd5e1; padding: 8px; text-align: left; vertical-align: top; }
    th { background: #f1f5f9; font-weight: 600; }
    .titlebar { display:flex; justify-content: space-between; align-items: center; margin-bottom: 14px; }
    .brand { font-weight: 700; font-size: 14px; color: #0ea5e9; }
    .logo { height: 40px; object-fit: contain; }
    .section { margin-top: 12px; }
    .sign { height: 60px; border-bottom: 1px solid #cbd5e1; margin-bottom: 4px; }
  </style>
  <script>function afterLoad(){ window.print(); }</script>
  </head>
  <body onload="afterLoad()">
    <div class="titlebar">
      <div>
        <h1>Consentimiento Informado para Procedimiento Diagnóstico (Bajo Riesgo)</h1>
        <div class="small muted">N° Expediente: ${expedienteNumber}</div>
        <div class="small muted">Fecha y hora del consentimiento: ${formattedConsentDate}</div>
      </div>
      <div>
        <img class="logo" src="${logoUrl}" alt="Bartolomed Medical System" />
      </div>
    </div>

    <div class="card section">
      <table>
        <tr>
          <th style="width:40%">CAMPO A LLENAR (SOFTWARE)</th>
          <th>DATOS DEL PACIENTE/REPRESENTANTE</th>
        </tr>
        <tr>
          <td><strong>Nombre Completo del Paciente</strong></td>
          <td>${patientName}</td>
        </tr>
        <tr>
          <td><strong>Nro. Cédula de Identidad/Pasaporte</strong></td>
          <td>${patientDoc}</td>
        </tr>
        <tr>
          <td><strong>Fecha de Nacimiento</strong></td>
          <td>${birthDate}</td>
        </tr>
        <tr>
          <td><strong>Domicilio y Teléfono</strong></td>
          <td>${addressPhone}</td>
        </tr>
        <tr>
          <td><strong>Representante Legal (si aplica)</strong></td>
          <td>${signedBy && signedBy !== patientName ? signedBy : ''}</td>
        </tr>
        <tr>
          <td><strong>Nro. C.I. del Representante</strong></td>
          <td></td>
        </tr>
      </table>
    </div>

    <div class="section card">
      <p><strong>Yo, ${signedBy || '_____________________________'}</strong>, con Nro. de C.I. <strong>${patientDoc || '________________'}</strong>, en calidad de <strong>${signedBy && signedBy !== patientName ? 'Representante Legal/Familiar' : 'Paciente'}</strong>, DECLARO:</p>
      <ol>
        <li>Que el Dr(a)./Lic. <strong>${doctorName || '_____________________________'}</strong>, con matrícula <strong>${doctorLicense || '____________'}</strong>, me ha informado de manera clara y comprensible sobre la necesidad de realizar el siguiente procedimiento: <strong>${procedureName || '_____________________________'}</strong>.</li>
        <li>Que he entendido que el objetivo de este procedimiento es <strong>${objective || (freeDescription ? freeDescription : '_____________________________')}</strong>.</li>
        <li>Que me han explicado los riesgos más comunes asociados a este procedimiento, tales como <strong>${risks || '_____________________________'}</strong>, y sus beneficios esperados <strong>${benefits || '_____________________________'}</strong>.</li>
        <li>Que he tenido la oportunidad de hacer preguntas y que todas han sido respondidas a mi satisfacción.</li>
        <li>Que entiendo que este consentimiento es voluntario y que puedo revocarlo en cualquier momento antes de la realización del procedimiento.</li>
      </ol>
      <p><strong>Por lo expuesto, OTORGO</strong> mi consentimiento libre y voluntario para que se me realice el procedimiento diagnóstico mencionado.</p>
    </div>

    <div class="section card">
      <table>
        <tr>
          <th>FIRMAS</th>
          <th></th>
        </tr>
        <tr>
          <td>
            <div class="sign"></div>
            <div class="small">Firma del Paciente/Representante Legal</div>
            <div class="small muted">Aclaración de Firma: ${signedBy || patientName}</div>
            <div class="small muted">Fecha: ${formattedConsentDate}</div>
          </td>
          <td>
            <div class="sign"></div>
            <div class="small">Firma del Médico/Profesional Informante</div>
            <div class="small muted">Aclaración de Firma: ${doctorName}</div>
            <div class="small muted">Matrícula: ${doctorLicense}</div>
          </td>
        </tr>
      </table>
    </div>
    <div class="small muted section">Documento generado por Bartolomed Medical System. Este formato sigue la normativa boliviana de consentimiento informado para procedimientos diagnósticos de bajo riesgo.</div>
  </body>
</html>`

    // Plantilla Cirugía
    const htmlSurgery = `
<html lang="es">
<head>
  <meta charset="utf-8" />
  <title>Consentimiento Informado para Intervención Quirúrgica</title>
  <style>
    @page { size: A4; margin: 18mm; }
    body { font-family: Arial, Helvetica, sans-serif; color: #0f172a; }
    h1 { font-size: 20px; margin: 0 0 8px; color: #0f172a; }
    p, li, td { font-size: 12px; line-height: 1.45; }
    .muted { color: #475569; }
    .small { font-size: 11px; }
    .card { border: 1px solid #cbd5e1; border-radius: 8px; padding: 12px; background: #fff; }
    table { width: 100%; border-collapse: collapse; }
    th, td { border: 1px solid #cbd5e1; padding: 8px; text-align: left; vertical-align: top; }
    th { background: #f1f5f9; font-weight: 600; }
    .titlebar { display:flex; justify-content: space-between; align-items: center; margin-bottom: 14px; }
    .brand { font-weight: 700; font-size: 14px; color: #0ea5e9; }
    .logo { height: 40px; object-fit: contain; }
    .section { margin-top: 12px; }
    .sign { height: 60px; border-bottom: 1px solid #cbd5e1; margin-bottom: 4px; }
  </style>
  </head>
  <body>
    <div class="titlebar">
      <div>
        <h1>Consentimiento Informado para Intervención Quirúrgica</h1>
        <div class="small muted">N° Expediente: ${expedienteNumber}</div>
        <div class="small muted">Fecha y hora: ${formattedConsentDate}</div>
      </div>
      <div>
        <img class="logo" src="${logoUrl}" alt="Bartolomed Medical System" />
      </div>
    </div>

    <div class="card section">
      <table>
        <tr>
          <th style="width:40%">CAMPO A LLENAR (SOFTWARE)</th>
          <th>DATOS DE IDENTIFICACIÓN</th>
        </tr>
        <tr><td><strong>Nombre Completo del Paciente</strong></td><td>${patientName}</td></tr>
        <tr><td><strong>Nro. C.I. del Paciente</strong></td><td>${patientDoc}</td></tr>
        <tr><td><strong>Diagnóstico Clínico Actual</strong></td><td>${c.surgicalDiagnosis || ''}</td></tr>
        <tr><td><strong>Nombre de la Intervención Quirúrgica Propuesta</strong></td><td>${c.surgicalProcedureName || c.procedureName || ''}</td></tr>
        <tr><td><strong>Nombre del Cirujano Principal</strong></td><td>${c.leadSurgeonName || doctorName}</td></tr>
      </table>
    </div>

    <div class="section card">
      <p><strong>Yo, ${signedBy || patientName}</strong>, con Nro. de C.I. <strong>${patientDoc || '________________'}</strong>, en calidad de <strong>${signedBy && signedBy !== patientName ? 'Representante Legal' : 'Paciente'}</strong>, CERTIFICO que el Dr(a). <strong>${c.leadSurgeonName || doctorName}</strong>, con Matrícula <strong>${doctorLicense || '____________'}</strong>, me ha explicado lo siguiente:</p>
      <ol>
        <li><strong>Enfermedad y Tratamiento Propuesto:</strong> Se me ha explicado mi condición de salud, el diagnóstico de <strong>${c.surgicalDiagnosis || ''}</strong>, y la necesidad de realizar la Intervención Quirúrgica denominada <strong>${c.surgicalProcedureName || c.procedureName || ''}</strong>.</li>
        <li><strong>Objetivo:</strong> El propósito de la cirugía es <strong>${c.surgeryObjective || c.objective || ''}</strong>.</li>
        <li><strong>Riesgos y Complicaciones:</strong> He sido informado(a) detalladamente de los riesgos comunes (ej. dolor, infección de herida, sangrado), graves o poco comunes (ej. lesión de órganos adyacentes, necesidad de transfusión, riesgo de muerte), y de las posibles complicaciones post-operatorias.</li>
        <li><strong>Alternativas y Riesgo de No Operar:</strong> Se me ha informado sobre <strong>${c.surgicalAlternatives || ''}</strong> y los riesgos de no realizar la cirugía, siendo estos <strong>${c.consequencesNoSurgery || ''}</strong>.</li>
        <li><strong>Procedimientos Adicionales:</strong> Autorizo a que se realicen otros procedimientos no previstos inicialmente, siempre que el equipo médico los considere necesarios e indispensables para preservar mi vida o evitar secuelas graves.</li>
      </ol>
      <p><strong>Por la presente, AUTORIZO</strong> la realización de la Intervención Quirúrgica <strong>${c.surgicalProcedureName || c.procedureName || ''}</strong>, el uso de anestesia, y la participación de personal de apoyo.</p>
    </div>

    <div class="section card">
      <table>
        <tr><th>FIRMAS</th><th></th></tr>
        <tr>
          <td>
            <div class="sign"></div>
            <div class="small">Firma del Paciente/Representante Legal</div>
            <div class="small muted">Aclaración de Firma: ${signedBy || patientName}</div>
            <div class="small muted">Fecha y Hora: ${formattedConsentDate}</div>
          </td>
          <td>
            <div class="sign"></div>
            <div class="small">Firma del Cirujano Principal</div>
            <div class="small muted">Aclaración de Firma: ${c.leadSurgeonName || doctorName}</div>
          </td>
        </tr>
        <tr>
          <td colspan="2" class="small muted">Testigo (Opcional): ${c.surgeryWitnessName || ''} ${c.surgeryWitnessCi ? '(C.I. ' + c.surgeryWitnessCi + ')' : ''}</td>
        </tr>
      </table>
    </div>
    <div class="small muted section">Documento generado por Bartolomed Medical System.</div>
  </body>
</html>`

    // Plantilla Transfusión Sanguínea
    const htmlTransfusion = `
<html lang="es">
<head>
  <meta charset="utf-8" />
  <title>Consentimiento Informado para Transfusión Sanguínea</title>
  <style>
    @page { size: A4; margin: 18mm; }
    body { font-family: Arial, Helvetica, sans-serif; color: #0f172a; }
    h1 { font-size: 20px; margin: 0 0 8px; color: #0f172a; }
    p, li, td { font-size: 12px; line-height: 1.45; }
    .muted { color: #475569; }
    .small { font-size: 11px; }
    .card { border: 1px solid #cbd5e1; border-radius: 8px; padding: 12px; background: #fff; }
    table { width: 100%; border-collapse: collapse; }
    th, td { border: 1px solid #cbd5e1; padding: 8px; text-align: left; vertical-align: top; }
    th { background: #f1f5f9; font-weight: 600; }
    .titlebar { display:flex; justify-content: space-between; align-items: center; margin-bottom: 14px; }
    .brand { font-weight: 700; font-size: 14px; color: #0ea5e9; }
    .logo { height: 40px; object-fit: contain; }
    .section { margin-top: 12px; }
    .sign { height: 60px; border-bottom: 1px solid #cbd5e1; margin-bottom: 4px; }
  </style>
  </head>
  <body>
    <div class="titlebar">
      <div>
        <h1>Consentimiento Informado para Transfusión Sanguínea</h1>
        <div class="small muted">N° Expediente: ${expedienteNumber}</div>
        <div class="small muted">Fecha y hora: ${formattedConsentDate}</div>
      </div>
      <div>
        <img class="logo" src="${logoUrl}" alt="Bartolomed Medical System" />
      </div>
    </div>

    <div class="card section">
      <table>
        <tr><th style="width:40%">CAMPO A LLENAR (SOFTWARE)</th><th>DATOS DEL PACIENTE</th></tr>
        <tr><td><strong>Nombre Completo del Paciente</strong></td><td>${patientName}</td></tr>
        <tr><td><strong>Nro. C.I. del Paciente</strong></td><td>${patientDoc}</td></tr>
        <tr><td><strong>Diagnóstico/Indicación para Transfusión</strong></td><td>${c.transfusionDiagnosis || ''}</td></tr>
        <tr><td><strong>Tipo de Hemoderivado</strong></td><td>${c.bloodProductType || ''}</td></tr>
      </table>
    </div>

    <div class="section card">
      <p><strong>Yo, ${signedBy || patientName}</strong>, con Nro. de C.I. <strong>${patientDoc || '________________'}</strong>, en calidad de <strong>${signedBy && signedBy !== patientName ? 'Representante Legal' : 'Paciente'}</strong>, DECLARO:</p>
      <ol>
        <li>Que el Dr(a). <strong>${c.treatingPhysicianName || doctorName}</strong> me ha informado que mi estado de salud requiere una <strong>Transfusión Sanguínea</strong> (o de hemoderivados) para tratar <strong>${c.transfusionDiagnosis || ''}</strong>.</li>
        <li><strong>Riesgos Conocidos:</strong> He sido informado(a) de los riesgos potenciales, incluyendo, pero no limitándose a, reacciones alérgicas leves (fiebre, escalofríos), y reacciones graves (reacciones hemolíticas agudas, transmisión de enfermedades infecciosas - riesgo mínimo).</li>
        <li><strong>Beneficios y Alternativas:</strong> El beneficio principal es <strong>${c.transfusionBenefits || ''}</strong>. Se me ha indicado que las alternativas son <strong>${c.transfusionAlternatives || ''}</strong>.</li>
        <li>Comprendo que, en caso de urgencia vital, el médico podrá proceder a la transfusión si no fuera posible obtener mi consentimiento o el de mi representante a tiempo.</li>
      </ol>
      <p><strong>Por lo anterior, ACEPTO</strong> libre y voluntariamente la Transfusión de Sangre y/o Hemoderivados.</p>
    </div>

    <div class="section card">
      <table>
        <tr><th>FIRMAS</th><th></th></tr>
        <tr>
          <td>
            <div class="sign"></div>
            <div class="small">Firma del Paciente/Representante Legal</div>
            <div class="small muted">Aclaración de Firma: ${signedBy || patientName}</div>
            <div class="small muted">Fecha y Hora: ${formattedConsentDate}</div>
          </td>
          <td>
            <div class="sign"></div>
            <div class="small">Firma del Médico Tratante</div>
            <div class="small muted">Aclaración de Firma: ${c.treatingPhysicianName || doctorName}</div>
            <div class="small muted">Matrícula: ${doctorLicense}</div>
          </td>
        </tr>
      </table>
    </div>
    <div class="small muted section">Documento generado por Bartolomed Medical System.</div>
  </body>
</html>`

    // Plantilla Rechazo o Revocación
    const htmlRejection = `
<html lang="es">
<head>
  <meta charset="utf-8" />
  <title>Documento de Rechazo o Revocación de Indicación Médica</title>
  <style>
    @page { size: A4; margin: 18mm; }
    body { font-family: Arial, Helvetica, sans-serif; color: #0f172a; }
    h1 { font-size: 20px; margin: 0 0 8px; color: #0f172a; }
    p, li, td { font-size: 12px; line-height: 1.45; }
    .muted { color: #475569; }
    .small { font-size: 11px; }
    .card { border: 1px solid #cbd5e1; border-radius: 8px; padding: 12px; background: #fff; }
    table { width: 100%; border-collapse: collapse; }
    th, td { border: 1px solid #cbd5e1; padding: 8px; text-align: left; vertical-align: top; }
    th { background: #f1f5f9; font-weight: 600; }
    .titlebar { display:flex; justify-content: space-between; align-items: center; margin-bottom: 14px; }
    .brand { font-weight: 700; font-size: 14px; color: #0ea5e9; }
    .logo { height: 40px; object-fit: contain; }
    .section { margin-top: 12px; }
    .sign { height: 60px; border-bottom: 1px solid #cbd5e1; margin-bottom: 4px; }
  </style>
  </head>
  <body>
    <div class="titlebar">
      <div>
        <h1>Documento de Rechazo o Revocación de Indicación Médica</h1>
        <div class="small muted">N° Expediente: ${expedienteNumber}</div>
        <div class="small muted">Lugar y Fecha: ${c.rejectionCity || ''}, ${formattedConsentDate}</div>
      </div>
      <div>
        <img class="logo" src="${logoUrl}" alt="Bartolomed Medical System" />
      </div>
    </div>

    <div class="card section">
      <table>
        <tr><th style="width:40%">CAMPO A LLENAR (SOFTWARE/MÉDICO)</th><th>INFORMACIÓN REQUERIDA</th></tr>
        <tr><td><strong>Nombre del Establecimiento de Salud</strong></td><td>${c.clinicName || ''}</td></tr>
        <tr><td><strong>Nro. de Registro Clínico/Historia Clínica</strong></td><td>${c.clinicalRecordNumber || ''}</td></tr>
        <tr><td><strong>Nombre Completo del Paciente</strong></td><td>${patientName}</td></tr>
        <tr><td><strong>Nro. de Cédula de Identidad/Pasaporte</strong></td><td>${patientDoc}</td></tr>
        <tr><td><strong>Nombre del Acto Médico o Tratamiento Rechazado</strong></td><td>${c.rejectedActName || ''}</td></tr>
        <tr><td><strong>Nombre del Médico Tratante/Informante</strong></td><td>${c.informingPhysicianName || doctorName}</td></tr>
      </table>
    </div>

    <div class="section card">
      <p><strong>Yo, ${signedBy || patientName}</strong>, con C.I. <strong>${patientDoc || '________________'}</strong>, en calidad de <strong>${signedBy && signedBy !== patientName ? 'Representante Legal' : 'Paciente'}</strong>, DECLARO BAJO JURAMENTO:</p>
      <ol>
        <li><strong>Indicación Médica:</strong> El Dr(a). <strong>${c.informingPhysicianName || doctorName}</strong> me ha informado sobre mi condición de salud (Diagnóstico: <strong>${c.rejectionDiagnosis || ''}</strong>) y me ha indicado el siguiente procedimiento/tratamiento como necesario: <strong>${c.rejectedActName || ''}</strong>.</li>
        <li><strong>Información Recibida:</strong> El médico me ha explicado clara y comprensiblemente los beneficios del tratamiento propuesto, y las consecuencias directas y previsibles de mi rechazo, siendo estas: <strong>${c.rejectionConsequences || ''}</strong>.</li>
        <li><strong>Decisión Voluntaria:</strong> A pesar de haber comprendido los beneficios y riesgos que implica mi decisión, <strong>HE DECIDIDO LIBRE Y VOLUNTARIAMENTE RECHAZAR/REVOCAR</strong> el tratamiento/procedimiento médico antes mencionado.</li>
        <li><strong>Exoneración de Responsabilidad:</strong> <strong>EXONERO</strong> al médico tratante, al equipo de salud y al establecimiento sanitario de toda responsabilidad que pudiera derivarse de la negativa a someterme al tratamiento o procedimiento, asumiendo yo mismo(a) las consecuencias de mi decisión.</li>
      </ol>
    </div>

    <div class="section card">
      <table>
        <tr><th>FIRMAS</th><th>PROFESIONAL DE SALUD INFORMANDO</th><th>TESTIGO (Obligatorio en Rechazo)</th></tr>
        <tr>
          <td>
            <div class="sign"></div>
            <div class="small">Firma/Huella Digital (Paciente/Representante)</div>
            <div class="small muted">Nombre: ${signedBy || patientName}</div>
            <div class="small muted">C.I.: ${patientDoc}</div>
          </td>
          <td>
            <div class="sign"></div>
            <div class="small">Firma del Médico/Profesional</div>
            <div class="small muted">Nombre: ${c.informingPhysicianName || doctorName}</div>
            <div class="small muted">Matrícula: ${doctorLicense}</div>
          </td>
          <td>
            <div class="sign"></div>
            <div class="small">Firma del Testigo</div>
            <div class="small muted">Nombre: ${c.witnessName || ''}</div>
            <div class="small muted">C.I.: ${c.witnessCi || ''}</div>
          </td>
        </tr>
      </table>
    </div>
    <div class="small muted section">Documento generado por Bartolomed Medical System.</div>
  </body>
</html>`

    let html: string = ''
    if (template === 'surgery') {
      html = htmlSurgery
    } else if (template === 'blood_transfusion') {
      html = htmlTransfusion
    } else if (template === 'rejection') {
      html = htmlRejection
    } else {
      html = htmlDiagnostic
    }

    this.printHtml(html)
  }

  // Impresión de Resumen del Expediente Médico (consolidado de los pasos 1-3)
  printMedicalRecordSummary(): void {
    const patient = this.getSelectedPatient()
    const doctor = this.getSelectedDoctor()
    const now = new Date()
    const printedAt = this.formatDateTime(now)

    const recType = this.getTypeText(this.patientInfoForm.get('type')?.value)
    const isEmergency = !!this.patientInfoForm.get('isEmergency')?.value
    const chiefComplaint = this.patientInfoForm.get('chiefComplaint')?.value || ''

    // Historia y datos clínicos
    const c = this.clinicalDataForm.value
    const e = this.evaluationForm.value

    // Paciente y profesional
    const patientName = patient ? `${patient.firstName} ${patient.lastName}` : ''
    const patientDoc = patient?.documentNumber || ''
    const patientBirth = patient?.birthDate ? this.formatDate(new Date(patient.birthDate)) : ''
    const doctorName = doctor
      ? `${doctor.personalInfo?.firstName || ''} ${doctor.personalInfo?.lastName || ''}`.trim()
      : ''
    const doctorLicense = doctor?.professionalInfo?.license || ''

    const vit = {
      temperature: c.temperature,
      systolicBP: c.systolicBP,
      diastolicBP: c.diastolicBP,
      heartRate: c.heartRate,
      respiratoryRate: c.respiratoryRate,
      oxygenSaturation: c.oxygenSaturation,
      weight: c.weight,
      height: c.height,
    }

    const logoUrl = `${window.location.origin}/assets/images/logo-big-horizontal-bartolomed.png`

    // Construcción del HTML imprimible
    const html = `
<!doctype html>
<html lang="es">
<head>
  <meta charset="utf-8" />
  <title>Resumen de Expediente Médico</title>
  <style>
    @page { size: A4; margin: 16mm; }
    body { font-family: Arial, Helvetica, sans-serif; color: #0f172a; }
    h1 { font-size: 20px; margin: 0 0 8px; color: #0f172a; }
    h2 { font-size: 14px; margin: 18px 0 8px; color: #0f172a; }
    p, li, td { font-size: 12px; line-height: 1.45; }
    small { color: #475569; }
    .muted { color: #475569; }
    .small { font-size: 11px; }
    .titlebar { display:flex; justify-content: space-between; align-items: center; margin-bottom: 12px; }
    .logo { height: 38px; object-fit: contain; }
    .tag { display:inline-block; padding: 2px 8px; border-radius: 999px; font-size: 11px; border:1px solid #cbd5e1; background:#f1f5f9; color:#0f172a; }
    .tag.emerg { border-color:#fecaca; background:#fee2e2; color:#991b1b; }
    .card { border:1px solid #e2e8f0; border-radius: 8px; padding: 10px; background:#fff; margin-top:10px; }
    table { width: 100%; border-collapse: collapse; }
    th, td { border: 1px solid #e2e8f0; padding: 8px; text-align: left; vertical-align: top; }
    th { background: #f8fafc; font-weight: 600; }
    .grid2 { display: grid; grid-template-columns: 1fr 1fr; gap: 10px; }
    .grid3 { display: grid; grid-template-columns: 1fr 1fr 1fr; gap: 10px; }
  </style>
  </head>
  <body>
    <div class="titlebar">
      <div>
        <h1>Resumen del Expediente Médico</h1>
        <div class="small muted">Fecha de impresión: ${printedAt}</div>
      </div>
      <div>
        <img class="logo" src="${logoUrl}" alt="Bartolomed Medical System" />
      </div>
    </div>

    <div class="card">
      <h2>Datos del Paciente</h2>
      <div class="grid2">
        <div><strong>Nombre</strong><br/>${patientName || ''}</div>
        <div><strong>Cédula / Pasaporte</strong><br/>${patientDoc || ''}</div>
      </div>
      <div class="grid2" style="margin-top:6px;">
        <div><strong>Fecha de Nacimiento</strong><br/>${patientBirth || ''}</div>
        <div><strong>Profesional Responsable</strong><br/>${doctorName || ''} ${doctorLicense ? '(Mat. ' + doctorLicense + ')' : ''}</div>
      </div>
    </div>

    <div class="card">
      <h2>Consulta</h2>
      <div class="grid2">
        <div><strong>Tipo</strong><br/><span class="tag ${isEmergency ? 'emerg' : ''}">${recType}</span></div>
        <div><strong>Emergencia</strong><br/>${isEmergency ? 'Sí' : 'No'}</div>
      </div>
      <div style="margin-top:6px;"><strong>Motivo de Consulta</strong><br/>${chiefComplaint || ''}</div>
    </div>

    <div class="card">
      <h2>Historia Clínica</h2>
      <div class="grid2">
        <div><strong>Historia de la Enfermedad Actual</strong><br/>${c.historyOfPresentIllness || ''}</div>
        <div><strong>Antecedentes Médicos</strong><br/>${c.pastMedicalHistory || ''}</div>
      </div>
      <div class="grid2" style="margin-top:6px;">
        <div><strong>Medicamentos</strong><br/>${c.medications || ''}</div>
        <div><strong>Alergias</strong><br/>${c.allergies || ''}</div>
      </div>
      <div class="grid2" style="margin-top:6px;">
        <div><strong>Historia Social</strong><br/>${c.socialHistory || ''}</div>
        <div><strong>Historia Familiar</strong><br/>${c.familyHistory || ''}</div>
      </div>
      <div style="margin-top:6px;"><strong>Revisión por Sistemas</strong><br/>${c.reviewOfSystems || ''}</div>
    </div>

    <div class="card">
      <h2>Signos Vitales</h2>
      <table>
        <tr>
          <th>Temperatura</th><th>PA Sistólica</th><th>PA Diastólica</th><th>Frec. Cardíaca</th><th>Frec. Respiratoria</th><th>Sat. O₂</th><th>Peso</th><th>Altura</th>
        </tr>
        <tr>
          <td>${vit.temperature ? vit.temperature + ' °C' : ''}</td>
          <td>${vit.systolicBP ? vit.systolicBP + ' mmHg' : ''}</td>
          <td>${vit.diastolicBP ? vit.diastolicBP + ' mmHg' : ''}</td>
          <td>${vit.heartRate ? vit.heartRate + ' lpm' : ''}</td>
          <td>${vit.respiratoryRate ? vit.respiratoryRate + ' rpm' : ''}</td>
          <td>${vit.oxygenSaturation ? vit.oxygenSaturation + ' %' : ''}</td>
          <td>${vit.weight ? vit.weight + ' kg' : ''}</td>
          <td>${vit.height ? vit.height + ' cm' : ''}</td>
        </tr>
      </table>
      <div class="small muted" style="margin-top:6px;">Valores vacíos no fueron registrados.</div>
    </div>

    <div class="card">
      <h2>Examen Físico</h2>
      <div><strong>Resumen</strong><br/>${e.physicalExamination || ''}</div>
      <div class="grid3" style="margin-top:6px;">
        <div><strong>Apariencia General</strong><br/>${e.generalAppearance || ''}</div>
        <div><strong>HEENT</strong><br/>${e.heent || ''}</div>
        <div><strong>Cardiovascular</strong><br/>${e.cardiovascular || ''}</div>
      </div>
      <div class="grid3" style="margin-top:6px;">
        <div><strong>Respiratorio</strong><br/>${e.respiratory || ''}</div>
        <div><strong>Abdominal</strong><br/>${e.abdominal || ''}</div>
        <div><strong>Neurológico</strong><br/>${e.neurological || ''}</div>
      </div>
      <div class="grid3" style="margin-top:6px;">
        <div><strong>Musculoesquelético</strong><br/>${e.musculoskeletal || ''}</div>
        <div><strong>Piel</strong><br/>${e.skin || ''}</div>
        <div></div>
      </div>
    </div>

    <div class="card">
      <h2>Evaluación y Plan</h2>
      <div><strong>Evaluación</strong><br/>${e.assessment || ''}</div>
      <div class="grid2" style="margin-top:6px;">
        <div><strong>Diagnóstico Principal</strong><br/>${e.diagnosis || ''}</div>
        <div><strong>Diagnóstico Diferencial</strong><br/>${e.differentialDiagnosis || ''}</div>
      </div>
      <div class="grid2" style="margin-top:6px;">
        <div><strong>Plan de Tratamiento</strong><br/>${e.treatmentPlan || ''}</div>
        <div><strong>Instrucciones de Seguimiento</strong><br/>${e.followUpInstructions || ''}</div>
      </div>
      <div class="grid2" style="margin-top:6px;">
        <div><strong>Educación al Paciente</strong><br/>${e.patientEducation || ''}</div>
        <div><strong>Fecha de Seguimiento</strong><br/>${e.followUpDate ? this.formatDate(new Date(e.followUpDate)) : ''}</div>
      </div>
      <div style="margin-top:8px;"><strong>Notas</strong><br/>${e.notes || ''}</div>
    </div>

    <div class="small muted" style="margin-top:10px;">Documento generado por Bartolomed Medical System.</div>
  </body>
</html>`

    this.printHtml(html)
  }

  // Utilidad: imprimir HTML sin abrir pestaña (usa iframe oculto)
  private printHtml(html: string) {
    try {
      const iframe = document.createElement('iframe')
      iframe.style.position = 'fixed'
      iframe.style.right = '0'
      iframe.style.bottom = '0'
      iframe.style.width = '0'
      iframe.style.height = '0'
      iframe.style.border = '0'
      iframe.setAttribute('aria-hidden', 'true')
      document.body.appendChild(iframe)

      let printed = false
      const onLoad = () => {
        if (printed) return
        printed = true
        try {
          iframe.contentWindow?.focus()
          iframe.contentWindow?.print()
        } finally {
          setTimeout(() => {
            if (iframe.parentNode) iframe.parentNode.removeChild(iframe)
          }, 1000)
        }
      }

      const doc = iframe.contentWindow?.document
      if (!doc) throw new Error('no-iframe-doc')
      iframe.onload = onLoad
      doc.open()
      doc.write(html)
      doc.close()
    } catch {
      this.showError('No se pudo preparar la impresión. Intente nuevamente.')
    }
  }

  // Helpers
  private mapConsentTypeToTemplate(
    type: ConsentType,
  ): 'diagnostic' | 'surgery' | 'blood_transfusion' | 'rejection' {
    switch (type) {
      case ConsentType.SURGERY:
      case ConsentType.ANESTHESIA:
        return 'surgery'
      case ConsentType.BLOOD_TRANSFUSION:
        return 'blood_transfusion'
      default:
        return 'diagnostic'
    }
  }

  private pad2(n: number): string {
    return n.toString().padStart(2, '0')
  }

  private formatDate(d: Date): string {
    const dd = this.pad2(d.getDate())
    const mm = this.pad2(d.getMonth() + 1)
    const yyyy = d.getFullYear()
    return `${dd}/${mm}/${yyyy}`
  }

  private formatDateTime(d: Date): string {
    const date = this.formatDate(d)
    const HH = this.pad2(d.getHours())
    const MM = this.pad2(d.getMinutes())
    return `${date} ${HH}:${MM}`
  }

  private showSuccess(message: string): void {
    this.alert.fire({
      icon: 'success',
      title: '¡Éxito!',
      text: message,
      confirmButtonText: 'Aceptar',
    })
  }

  private showError(message: string): void {
    this.alert.fire({
      icon: 'error',
      title: 'Error',
      text: message,
      confirmButtonText: 'Aceptar',
    })
  }

  private tryRestoreDraft() {
    if (this.isEditMode) return
    try {
      const raw = localStorage.getItem(this.DRAFT_KEY)
      if (!raw) return
      const draft = JSON.parse(raw)
      if (!draft || typeof draft !== 'object') return
      // TODO: El botón gris "deny" de SweetAlert2 aparece a pesar de showDenyButton: false
      // Posible solución: modificar AlertService para deshabilitarlo globalmente o usar otra librería
      // Preguntar al usuario si desea restaurar el borrador
      this.alert
        .fire({
          title: 'Restaurar borrador',
          text: 'Encontramos un borrador sin enviar. ¿Desea restaurarlo?',
          icon: 'question',
          showCancelButton: true,
          showDenyButton: false,
          showCloseButton: false,
          confirmButtonText: 'Sí, restaurar',
          cancelButtonText: 'No, descartar',
          reverseButtons: true,
          allowOutsideClick: false,
          didOpen: (popup: HTMLElement) => {
            // Forzar ocultar el botón deny/gris si aparece
            const denyBtn = popup.querySelector('.swal2-deny')
            if (denyBtn) {
              ;(denyBtn as HTMLElement).style.display = 'none'
            }
          },
        })
        .then(res => {
          if (res.isConfirmed) {
            this.patientInfoForm.patchValue(draft)
            // Intentar sincronizar los nombres mostrados
            this.syncPatientSearchText()
            this.syncDoctorSearchText()
            this.cdr.markForCheck()
          }
        })
    } catch (_) {
      // ignorar
    }
  }

  private clearDraft() {
    try {
      localStorage.removeItem(this.DRAFT_KEY)
    } catch (_) {
      // ignorar
    }
  }
}
