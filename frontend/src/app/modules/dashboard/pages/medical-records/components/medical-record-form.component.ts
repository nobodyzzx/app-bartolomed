import { Location } from '@angular/common'
import {
  ChangeDetectionStrategy,
  ChangeDetectorRef,
  Component,
  ElementRef,
  OnDestroy,
  OnInit,
} from '@angular/core'
import { FormBuilder, FormControl, FormGroup, Validators } from '@angular/forms'
import { MatAutocompleteSelectedEvent } from '@angular/material/autocomplete'
import { ErrorStateMatcher } from '@angular/material/core'
import { ActivatedRoute, Router } from '@angular/router'
import { AlertService } from '@core/services/alert.service'
import { combineLatest, Observable, of, Subject } from 'rxjs'
import { auditTime, catchError, map, startWith, takeUntil } from 'rxjs/operators'
import { User } from '../../../../auth/interfaces/user.interface'
import { Patient } from '../../patients/interfaces'
import { PatientsService } from '../../patients/services/patients.service'
import { UsersService } from '../../admin/users/users.service'
import {
  ConsentType,
  CreateConsentDto,
  CreateMedicalRecordDto,
  MedicalRecord,
  RecordStatus,
  RecordType,
} from '../interfaces'
import { ConsentTemplatesService } from '../services/consent-templates.service'
import { MedicalRecordDraftService } from '../services/medical-record-draft.service'
import { MedicalRecordDtoBuilderService } from '../services/medical-record-dto-builder.service'
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

  readonly patientErrorMatcher: ErrorStateMatcher = {
    isErrorState: (): boolean => {
      const c = this.patientInfoForm?.get('patientId')
      return !!(c?.invalid && c?.touched)
    },
  }
  readonly doctorErrorMatcher: ErrorStateMatcher = {
    isErrorState: (): boolean => {
      const c = this.patientInfoForm?.get('doctorId')
      return !!(c?.invalid && c?.touched)
    },
  }

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
    private consentTemplates: ConsentTemplatesService,
    private draftService: MedicalRecordDraftService,
    private dtoBuilder: MedicalRecordDtoBuilderService,
    private elRef: ElementRef,
  ) {
    this.initializeForms()
  }

  ngOnDestroy(): void {
    this.destroy$.next()
    this.destroy$.complete()
  }

  ngOnInit(): void {
    this.loadData()
    this.checkEditMode()

    // Capturar parámetros y decidir comportamiento del borrador en el mismo bloque
    this.route.queryParams.subscribe(params => {
      if (params['patientId']) {
        this.preselectedPatientId = params['patientId']
      }

      if (params['relatedRecordId']) {
        this.handleFollowUpMode(params['relatedRecordId'], params['type'])
      } else if (params['type']) {
        this.patientInfoForm.patchValue({ type: params['type'] })
      }

      if (!this.isEditMode) {
        if (this.preselectedPatientId) {
          // Viene desde la ficha de un paciente: restaurar borrador si existe
          this.draftService.tryRestore(draft => {
            this.patientInfoForm.patchValue(draft)
            this.syncPatientSearchText()
            this.syncDoctorSearchText()
            this.cdr.markForCheck()
          }, this.preselectedPatientId)
        } else {
          // Acceso directo: limpiar siempre y empezar vacío
          this.draftService.clear()
        }
      }
    })

    // Auto-guardado solo cuando viene de un paciente
    this.patientInfoForm.valueChanges
      .pipe(auditTime(800), takeUntil(this.destroy$))
      .subscribe(val => {
        if (this.preselectedPatientId) {
          this.draftService.save(val)
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
      const mapped = this.dtoBuilder.mapConsentTypeToTemplate(type)
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
      consentType: [ConsentType.GENERAL],
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
    this.patients$ = this.patientsService.findAll().pipe(
      map(r => r.data),
      catchError(() => of([] as Patient[])),
    )
    this.patients$.pipe(takeUntil(this.destroy$)).subscribe(patients => {
      this.patientsList = patients

      // Solo preseleccionar paciente si viene de la ficha de un paciente
      if (this.preselectedPatientId && patients.find(p => p.id === this.preselectedPatientId)) {
        this.patientInfoForm.patchValue({
          patientId: this.preselectedPatientId,
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
    this.doctors$ = this.usersService.getUsers().pipe(map(r => r.data))
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
      followUpDate: record.followUpDate ? new Date(record.followUpDate) : null,
    })

    // Nota: syncPatientSearchText y syncDoctorSearchText se llaman después en loadMedicalRecord
  }

  getTypeText(type: RecordType): string {
    return this.dtoBuilder.getTypeText(type)
  }

  getConsentTypeText(type: ConsentType): string {
    return this.dtoBuilder.getConsentTypeText(type)
  }

  onSubmit(): void {
    if (this.isAllFormsValid()) {
      this.isSaving = true

      if (this.isEditMode && this.recordId) {
        this.updateMedicalRecord(this.createMedicalRecordDto())
      } else {
        this.createMedicalRecord(this.createMedicalRecordDto(RecordStatus.COMPLETED))
      }
    } else {
      this.patientInfoForm.markAllAsTouched()
      this.clinicalDataForm.markAllAsTouched()
      this.evaluationForm.markAllAsTouched()
      this.cdr.markForCheck()
      this.scrollToFirstError()
    }
  }

  private isAllFormsValid(): boolean {
    return this.patientInfoForm.valid && this.clinicalDataForm.valid && this.evaluationForm.valid
  }

  private scrollToFirstError(): void {
    requestAnimationFrame(() => {
      const el = this.elRef.nativeElement as HTMLElement
      const invalid = el.querySelector('.mat-form-field-invalid')
      if (invalid) {
        invalid.scrollIntoView({ behavior: 'smooth', block: 'center' })
      }
    })
  }

  private createMedicalRecordDto(status?: RecordStatus): CreateMedicalRecordDto {
    const dto = this.dtoBuilder.buildDto(
      this.patientInfoForm.getRawValue(),
      this.clinicalDataForm.getRawValue(),
      this.evaluationForm.getRawValue(),
      this.isFollowUpMode ? this.relatedRecordId : null,
    )
    if (status) dto.status = status
    return dto
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
              this.draftService.clear()
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
            this.draftService.clear()
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
    const consentType: ConsentType = consentData.consentType ?? ConsentType.GENERAL

    const titleMap: Record<ConsentType, string> = {
      [ConsentType.TREATMENT]:         'Consentimiento de tratamiento',
      [ConsentType.SURGERY]:           'Consentimiento quirúrgico',
      [ConsentType.ANESTHESIA]:        'Consentimiento de anestesia',
      [ConsentType.BLOOD_TRANSFUSION]: 'Consentimiento de transfusión sanguínea',
      [ConsentType.IMAGING]:           'Consentimiento de diagnóstico por imagen',
      [ConsentType.LABORATORY]:        'Consentimiento de laboratorio',
      [ConsentType.DISCHARGE]:         'Consentimiento de alta médica',
      [ConsentType.GENERAL]:           'Consentimiento general de tratamiento',
      [ConsentType.OTHER]:             'Consentimiento informado',
    }

    const consent: CreateConsentDto = {
      medicalRecordId,
      patientId: this.patientInfoForm.value.patientId,
      doctorId:  this.patientInfoForm.value.doctorId,
      type:        consentType,
      title:       titleMap[consentType] ?? 'Consentimiento informado',
      description: consentData.description || titleMap[consentType] || 'Consentimiento informado',
      notes:       consentData.signedBy ? `Firmado por: ${consentData.signedBy}` : undefined,
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
            this.draftService.clear()
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
            const medicalRecord = this.createMedicalRecordDto(RecordStatus.DRAFT)

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
          this.draftService.clear()
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

  // Genera PDF del consentimiento informado vía backend (PDFKit)
  printConsent(): void {
    const patient = this.getSelectedPatient()
    const doctor  = this.getSelectedDoctor()
    const form    = this.consentForm.value

    const dto = {
      ...form,
      patient: {
        firstName:      patient?.firstName ?? '',
        lastName:       patient?.lastName  ?? '',
        documentNumber: patient?.documentNumber ?? '',
        birthDate:      patient?.birthDate ? new Date(patient.birthDate).toLocaleDateString('es-BO') : '',
        address:        patient?.address ?? '',
        phone:          patient?.phone   ?? '',
      },
      doctor: {
        firstName:      doctor?.personalInfo?.firstName ?? '',
        lastName:       doctor?.personalInfo?.lastName  ?? '',
        specialization: doctor?.professionalInfo?.specialization ?? '',
      },
    }

    this.medicalRecordsService.downloadConsentPdf(dto).subscribe({
      next: blob => this.openPdfBlob(blob, 'consentimiento.pdf'),
      error: () => this.showError('No se pudo generar el PDF del consentimiento'),
    })
  }

  // Genera PDF del resumen del expediente médico vía backend (PDFKit)
  printMedicalRecordSummary(): void {
    const patient  = this.getSelectedPatient()
    const doctor   = this.getSelectedDoctor()
    const clinical = this.clinicalDataForm.value
    const evalData = this.evaluationForm.value

    const dto = {
      patient: {
        firstName:      patient?.firstName ?? '',
        lastName:       patient?.lastName  ?? '',
        documentNumber: patient?.documentNumber ?? '',
        birthDate:      patient?.birthDate ? new Date(patient.birthDate).toLocaleDateString('es-BO') : '',
        address:        patient?.address ?? '',
        phone:          patient?.phone   ?? '',
      },
      doctor: {
        firstName:      doctor?.personalInfo?.firstName ?? '',
        lastName:       doctor?.personalInfo?.lastName  ?? '',
        specialization: doctor?.professionalInfo?.specialization ?? '',
      },
      recordType:    this.getTypeText(this.patientInfoForm.get('type')?.value),
      isEmergency:   !!this.patientInfoForm.get('isEmergency')?.value,
      chiefComplaint: this.patientInfoForm.get('chiefComplaint')?.value || '',
      // historia clínica
      historyOfPresentIllness: clinical.historyOfPresentIllness,
      pastMedicalHistory:      clinical.pastMedicalHistory,
      medications:             clinical.medications,
      allergies:               clinical.allergies,
      socialHistory:           clinical.socialHistory,
      familyHistory:           clinical.familyHistory,
      reviewOfSystems:         clinical.reviewOfSystems,
      // signos vitales aplanados como objeto
      vitalSigns: {
        temperature:      clinical.temperature,
        systolicBP:       clinical.systolicBP,
        diastolicBP:      clinical.diastolicBP,
        heartRate:        clinical.heartRate,
        respiratoryRate:  clinical.respiratoryRate,
        oxygenSaturation: clinical.oxygenSaturation,
        weight:           clinical.weight,
        height:           clinical.height,
      },
      // examen físico
      physicalExamination: evalData.physicalExamination,
      generalAppearance:   evalData.generalAppearance,
      heent:               evalData.heent,
      cardiovascular:      evalData.cardiovascular,
      respiratory:         evalData.respiratory,
      abdominal:           evalData.abdominal,
      neurological:        evalData.neurological,
      musculoskeletal:     evalData.musculoskeletal,
      skin:                evalData.skin,
      // evaluación y plan
      assessment:           evalData.assessment,
      plan:                 evalData.plan,
      diagnosis:            evalData.diagnosis,
      differentialDiagnosis:evalData.differentialDiagnosis,
      treatmentPlan:        evalData.treatmentPlan,
      followUpInstructions: evalData.followUpInstructions,
      patientEducation:     evalData.patientEducation,
      notes:                evalData.notes,
      followUpDate:         evalData.followUpDate
        ? new Date(evalData.followUpDate).toLocaleDateString('es-BO')
        : undefined,
    }

    this.medicalRecordsService.downloadSummaryPdf(dto).subscribe({
      next: blob => this.openPdfBlob(blob, 'expediente-medico.pdf'),
      error: () => this.showError('No se pudo generar el PDF del expediente'),
    })
  }

  private openPdfBlob(blob: Blob, filename: string): void {
    const url = URL.createObjectURL(blob)
    const a   = document.createElement('a')
    a.href    = url
    a.target  = '_blank'
    a.rel     = 'noopener'
    document.body.appendChild(a)
    a.click()
    document.body.removeChild(a)
    setTimeout(() => URL.revokeObjectURL(url), 30_000)
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
}
