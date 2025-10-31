import { Location } from '@angular/common'
import { Component, OnInit } from '@angular/core'
import { FormBuilder, FormGroup, Validators } from '@angular/forms'
import { ActivatedRoute, Router } from '@angular/router'
import { Observable, of } from 'rxjs'
import Swal from 'sweetalert2'
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

@Component({
  selector: 'app-medical-record-form',
  templateUrl: './medical-record-form.component.html',
  styleUrls: ['./medical-record-form.component.css'],
})
export class MedicalRecordFormComponent implements OnInit {
  // Stepper form groups
  patientInfoForm!: FormGroup
  medicalHistoryForm!: FormGroup
  vitalSignsForm!: FormGroup
  physicalExamForm!: FormGroup
  assessmentForm!: FormGroup
  consentForm!: FormGroup

  // Data for dropdowns
  patients$: Observable<Patient[]> = of([])
  doctors$: Observable<User[]> = of([])

  // Enums for templates
  recordTypes = Object.values(RecordType)
  consentTypes = Object.values(ConsentType)

  // File handling
  selectedFile: File | null = null
  filePreview: string | null = null

  // Loading states
  isLoading = false
  isSaving = false

  // Edit mode
  isEditMode = false
  recordId: string | null = null

  constructor(
    private fb: FormBuilder,
    private router: Router,
    private route: ActivatedRoute,
    private location: Location,
    private medicalRecordsService: MedicalRecordsService,
    private patientsService: PatientsService,
    private usersService: UsersService,
  ) {
    this.initializeForms()
  }

  ngOnInit(): void {
    this.loadData()
    this.checkEditMode()
  }

  private initializeForms(): void {
    // Paso 1: Información del Paciente
    this.patientInfoForm = this.fb.group({
      patientId: ['', Validators.required],
      doctorId: ['', Validators.required],
      type: [RecordType.CONSULTATION, Validators.required],
      isEmergency: [false],
      chiefComplaint: [
        'Dolor abdominal de 2 días de evolución',
        [Validators.required, Validators.minLength(10)],
      ],
    })

    // Paso 2: Historia Médica
    this.medicalHistoryForm = this.fb.group({
      historyOfPresentIllness: [''],
      pastMedicalHistory: [''],
      medications: [''],
      allergies: [''],
      socialHistory: [''],
      familyHistory: [''],
      reviewOfSystems: [''],
    })

    // Paso 3: Signos Vitales
    this.vitalSignsForm = this.fb.group({
      temperature: [''],
      systolicBP: [''],
      diastolicBP: [''],
      heartRate: [''],
      respiratoryRate: [''],
      oxygenSaturation: [''],
      weight: [''],
      height: [''],
    })

    // Paso 4: Examen Físico
    this.physicalExamForm = this.fb.group({
      physicalExamination: [''],
      generalAppearance: [''],
      heent: [''],
      cardiovascular: [''],
      respiratory: [''],
      abdominal: [''],
      neurological: [''],
      musculoskeletal: [''],
      skin: [''],
    })

    // Paso 5: Evaluación y Plan
    this.assessmentForm = this.fb.group({
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

    // Paso 6: Formulario de Consentimiento
    this.consentForm = this.fb.group({
      consentType: [ConsentType.GENERAL_TREATMENT, Validators.required],
      description: ['', [Validators.required, Validators.minLength(20)]],
      signedBy: [''],
    })
  }

  private loadData(): void {
    // Cargar pacientes
    this.patients$ = this.patientsService.findAll()
    this.patients$.subscribe(patients => {
      console.log('Pacientes cargados:', patients)
      if (patients.length > 0) {
        // Pre-seleccionar el primer paciente para facilitar las pruebas
        this.patientInfoForm.patchValue({
          patientId: patients[0].id,
        })
      }
    })

    // Cargar doctores (usuarios con rol médico)
    this.doctors$ = this.usersService.getUsers()
    this.doctors$.subscribe(doctors => {
      console.log('Doctores cargados:', doctors)
      // Filtrar solo los usuarios con rol de doctor
      const filteredDoctors = doctors.filter(
        user =>
          user.roles.includes('doctor') ||
          user.professionalInfo?.role?.toLowerCase().includes('médico'),
      )
      if (filteredDoctors.length > 0) {
        // Pre-seleccionar el primer doctor para facilitar las pruebas
        this.patientInfoForm.patchValue({
          doctorId: filteredDoctors[0].id,
        })
      }
    })
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
    this.medicalRecordsService.getMedicalRecordById(id).subscribe({
      next: record => {
        this.populateForm(record)
        this.isLoading = false
      },
      error: error => {
        this.showError('Error al cargar el expediente médico')
        this.isLoading = false
      },
    })
  }

  private populateForm(record: MedicalRecord): void {
    // Poblar formularios con datos existentes
    this.patientInfoForm.patchValue({
      patientId: record.patientId,
      doctorId: record.doctorId,
      type: record.type,
      isEmergency: record.isEmergency,
      chiefComplaint: record.chiefComplaint,
    })

    this.medicalHistoryForm.patchValue({
      historyOfPresentIllness: record.historyOfPresentIllness,
      pastMedicalHistory: record.pastMedicalHistory,
      medications: record.medications,
      allergies: record.allergies,
      socialHistory: record.socialHistory,
      familyHistory: record.familyHistory,
      reviewOfSystems: record.reviewOfSystems,
    })

    if (record.vitalSigns) {
      this.vitalSignsForm.patchValue({
        temperature: record.vitalSigns.temperature,
        systolicBP: record.vitalSigns.systolicBP,
        diastolicBP: record.vitalSigns.diastolicBP,
        heartRate: record.vitalSigns.heartRate,
        respiratoryRate: record.vitalSigns.respiratoryRate,
        oxygenSaturation: record.vitalSigns.oxygenSaturation,
        weight: record.vitalSigns.weight,
        height: record.vitalSigns.height,
      })
    }

    if (record.physicalExam) {
      this.physicalExamForm.patchValue({
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

    this.assessmentForm.patchValue({
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
  }

  onFileSelected(event: any): void {
    const file = event.target.files[0]
    if (file) {
      this.selectedFile = file

      // Crear preview para archivos de imagen
      if (file.type.startsWith('image/')) {
        const reader = new FileReader()
        reader.onload = e => {
          this.filePreview = e.target?.result as string
        }
        reader.readAsDataURL(file)
      } else {
        this.filePreview = null
      }
    }
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
    return this.patientInfoForm.valid && this.consentForm.valid
  }

  private createMedicalRecordDto(): CreateMedicalRecordDto {
    const patientData = this.patientInfoForm.value
    const historyData = this.medicalHistoryForm.value
    const vitalSignsData = this.vitalSignsForm.value
    const physicalExamData = this.physicalExamForm.value
    const assessmentData = this.assessmentForm.value

    return {
      ...patientData,
      ...historyData,
      ...vitalSignsData,
      ...physicalExamData,
      ...assessmentData,
    }
  }

  private createMedicalRecord(medicalRecord: CreateMedicalRecordDto): void {
    this.medicalRecordsService.createMedicalRecord(medicalRecord).subscribe({
      next: record => {
        if (this.consentForm.valid && this.selectedFile) {
          this.createConsentForm(record.id!)
        } else {
          Swal.fire({
            icon: 'success',
            title: '¡Expediente creado!',
            text: 'El expediente médico ha sido creado exitosamente.',
            confirmButtonText: 'Aceptar',
            confirmButtonColor: '#2563eb',
          }).then(() => {
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
        Swal.fire({
          icon: 'success',
          title: '¡Expediente actualizado!',
          text: 'El expediente médico ha sido actualizado exitosamente.',
          confirmButtonText: 'Aceptar',
          confirmButtonColor: '#2563eb',
        }).then(() => {
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
        if (this.selectedFile) {
          this.uploadConsentFile(consentRecord.id!)
        } else {
          this.router.navigate(['/dashboard/medical-records'])
          this.isSaving = false
        }
      },
      error: error => {
        this.showError('Error al crear el formulario de consentimiento')
        this.isSaving = false
      },
    })
  }

  private uploadConsentFile(consentId: string): void {
    if (this.selectedFile) {
      this.medicalRecordsService.uploadSignedConsent(consentId, this.selectedFile).subscribe({
        next: () => {
          this.showSuccess('Archivo de consentimiento subido exitosamente')
          this.router.navigate(['/dashboard/medical-records'])
          this.isSaving = false
        },
        error: error => {
          this.showError('Error al subir el archivo de consentimiento')
          this.isSaving = false
        },
      })
    }
  }

  saveDraft(): void {
    Swal.fire({
      title: '¿Guardar borrador?',
      text: 'Se guardará el expediente médico en estado borrador con la información actual.',
      icon: 'question',
      showCancelButton: true,
      confirmButtonText: 'Sí, guardar',
      cancelButtonText: 'Cancelar',
      confirmButtonColor: '#2563eb',
    }).then(result => {
      if (result.isConfirmed) {
        if (this.patientInfoForm.valid) {
          this.isSaving = true
          const medicalRecord = this.createMedicalRecordDto()

          this.medicalRecordsService.createMedicalRecord(medicalRecord).subscribe({
            next: record => {
              Swal.fire({
                icon: 'success',
                title: '¡Borrador guardado!',
                text: 'El expediente médico ha sido guardado como borrador.',
                confirmButtonText: 'Aceptar',
                confirmButtonColor: '#2563eb',
              }).then(() => {
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
          Swal.fire({
            icon: 'warning',
            title: 'Información incompleta',
            text: 'Debe completar al menos la información básica del paciente',
            confirmButtonText: 'Entendido',
            confirmButtonColor: '#f59e0b',
          })
        }
      }
    })
  }

  cancel(): void {
    Swal.fire({
      title: '¿Descartar cambios?',
      text: '¿Estás seguro de que deseas salir? Los cambios no guardados se perderán.',
      icon: 'warning',
      showCancelButton: true,
      confirmButtonText: 'Sí, salir',
      cancelButtonText: 'Continuar editando',
      confirmButtonColor: '#dc2626',
      cancelButtonColor: '#2563eb',
    }).then(result => {
      if (result.isConfirmed) {
        this.router.navigate(['/dashboard/medical-records'])
      }
    })
  }

  goBack(): void {
    this.location.back()
  }

  getStepProgress(): number {
    let completed = 0
    const totalSteps = 6

    if (this.patientInfoForm.valid) completed++
    if (this.medicalHistoryForm.valid) completed++
    if (this.vitalSignsForm.valid) completed++
    if (this.physicalExamForm.valid) completed++
    if (this.assessmentForm.valid) completed++
    if (this.consentForm.valid) completed++

    return Math.round((completed / totalSteps) * 100)
  }

  private showSuccess(message: string): void {
    Swal.fire({
      icon: 'success',
      title: '¡Éxito!',
      text: message,
      confirmButtonText: 'Aceptar',
      confirmButtonColor: '#2563eb',
    })
  }

  private showError(message: string): void {
    Swal.fire({
      icon: 'error',
      title: 'Error',
      text: message,
      confirmButtonText: 'Aceptar',
      confirmButtonColor: '#dc2626',
    })
  }
}
