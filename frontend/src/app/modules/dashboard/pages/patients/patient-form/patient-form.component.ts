import { Component, OnInit } from '@angular/core'
import { FormBuilder, FormGroup, Validators } from '@angular/forms'
import { ActivatedRoute, Router } from '@angular/router'
import { of } from 'rxjs'
import { catchError, switchMap } from 'rxjs/operators'
import Swal from 'sweetalert2'
import { Clinic } from '../../clinics/interfaces/clinic.interface'
import { ClinicsService } from '../../clinics/services'
import { BloodType, CreatePatientDto, Gender, MaritalStatus, Patient } from '../interfaces'
import { PatientsService } from '../services'

@Component({
  selector: 'app-patient-form',
  templateUrl: './patient-form.component.html',
  styleUrl: './patient-form.component.css',
})
export class PatientFormComponent implements OnInit {
  // Stepper form groups
  personalInfoForm!: FormGroup
  contactInfoForm!: FormGroup
  medicalInfoForm!: FormGroup
  emergencyContactForm!: FormGroup
  insuranceForm!: FormGroup

  // Loading states
  isLoading = false
  isSaving = false

  // Edit mode
  isEditMode = false
  isViewMode = false
  patientId: string | null = null

  // Clinics for select
  clinics: Clinic[] = []
  isClinicsLoading = false

  // Options for dropdowns
  protected readonly genderOptions = [
    { value: Gender.MALE, label: 'Masculino' },
    { value: Gender.FEMALE, label: 'Femenino' },
    { value: Gender.OTHER, label: 'Otro' },
  ]

  protected readonly maritalStatusOptions = [
    { value: MaritalStatus.SINGLE, label: 'Soltero/a' },
    { value: MaritalStatus.MARRIED, label: 'Casado/a' },
    { value: MaritalStatus.DIVORCED, label: 'Divorciado/a' },
    { value: MaritalStatus.WIDOWED, label: 'Viudo/a' },
    { value: MaritalStatus.OTHER, label: 'Otro' },
  ]

  protected readonly bloodTypeOptions = [
    { value: BloodType.A_POSITIVE, label: 'A+' },
    { value: BloodType.A_NEGATIVE, label: 'A-' },
    { value: BloodType.B_POSITIVE, label: 'B+' },
    { value: BloodType.B_NEGATIVE, label: 'B-' },
    { value: BloodType.AB_POSITIVE, label: 'AB+' },
    { value: BloodType.AB_NEGATIVE, label: 'AB-' },
    { value: BloodType.O_POSITIVE, label: 'O+' },
    { value: BloodType.O_NEGATIVE, label: 'O-' },
  ]

  constructor(
    private fb: FormBuilder,
    private router: Router,
    private route: ActivatedRoute,
    private patientsService: PatientsService,
    private clinicsService: ClinicsService,
  ) {
    this.initializeForms()
  }

  ngOnInit(): void {
    this.loadClinics()
    this.checkEditMode()
  }

  getStepProgress(): number {
    let completedSteps = 0
    const totalSteps = 5

    if (this.personalInfoForm.valid) completedSteps++
    if (this.contactInfoForm.valid) completedSteps++
    if (this.medicalInfoForm.valid) completedSteps++
    if (this.emergencyContactForm.valid) completedSteps++
    if (this.insuranceForm.valid) completedSteps++

    return (completedSteps / totalSteps) * 100
  }

  private initializeForms(): void {
    // Paso 1: Información Personal
    this.personalInfoForm = this.fb.group({
      firstName: ['María', [Validators.required, Validators.minLength(2)]],
      lastName: ['González', [Validators.required, Validators.minLength(2)]],
      documentNumber: ['12345678', [Validators.required, Validators.minLength(5)]],
      documentType: ['CI'],
      birthDate: [new Date('1985-03-15'), Validators.required],
      gender: [Gender.FEMALE, Validators.required],
      maritalStatus: [MaritalStatus.SINGLE],
      occupation: ['Profesora'],
    })

    // Paso 2: Información de Contacto
    this.contactInfoForm = this.fb.group({
      email: ['maria.gonzalez@email.com', [Validators.email]],
      phone: ['+591-70123456'],
      address: ['Av. América #123, Zona Central'],
      city: ['La Paz'],
      state: ['La Paz'],
      zipCode: ['00000'],
      country: ['Bolivia'],
    })

    // Paso 3: Información Médica
    this.medicalInfoForm = this.fb.group({
      bloodType: [BloodType.O_POSITIVE],
      allergies: ['Alergia a la penicilina'],
      medications: ['Ninguno actualmente'],
      medicalHistory: ['Hipertensión arterial controlada'],
      notes: ['Paciente colaboradora, sin antecedentes quirúrgicos relevantes'],
    })

    // Paso 4: Contacto de Emergencia
    this.emergencyContactForm = this.fb.group({
      emergencyContactName: ['Pedro González'],
      emergencyContactPhone: ['+591-70654321'],
      emergencyContactRelationship: ['Esposo'],
    })

    // Paso 5: Información de Seguro
    this.insuranceForm = this.fb.group({
      insuranceProvider: ['Caja Nacional de Salud'],
      insuranceNumber: ['CNS-123456789'],
      clinicId: [null, Validators.required],
    })
  }

  private loadClinics(): void {
    this.isClinicsLoading = true
    // Cargar solo clínicas activas para el selector
    this.clinicsService
      .findAll(true)
      .pipe(
        catchError(err => {
          console.error('Error al cargar clínicas:', err)
          Swal.fire({
            title: 'Error al Cargar Clínicas',
            html: `
              <div style="text-align: center; padding: 10px;">
                <p>No se pudieron cargar las clínicas disponibles.</p>
                <p style="color: #64748b; font-size: 0.9em; margin-top: 10px;">
                  ${err.status === 401 ? 'Su sesión ha expirado. Por favor, inicie sesión nuevamente.' : 'Por favor, intente recargar la página.'}
                </p>
              </div>
            `,
            icon: 'error',
            confirmButtonColor: '#2563eb',
            confirmButtonText: 'Reintentar',
            showCancelButton: true,
            cancelButtonText: 'Continuar sin clínicas',
            cancelButtonColor: '#64748b',
          }).then(result => {
            if (result.isConfirmed) {
              this.loadClinics()
            }
          })
          return of([] as Clinic[])
        }),
      )
      .subscribe(clinics => {
        this.clinics = clinics || []
        this.isClinicsLoading = false

        // Mostrar advertencia si no hay clínicas
        if (this.clinics.length === 0 && !this.isEditMode) {
          Swal.fire({
            title: 'Sin Clínicas Activas',
            text: 'No hay clínicas activas disponibles. Por favor, contacte al administrador.',
            icon: 'warning',
            confirmButtonColor: '#2563eb',
            confirmButtonText: 'Entendido',
          })
        }
      })
  }

  private checkEditMode(): void {
    // Verificar si estamos en modo edición o vista
    this.route.paramMap
      .pipe(
        switchMap(params => {
          this.patientId = params.get('id')
          this.isEditMode = !!this.patientId && !this.route.snapshot.data['viewMode']
          this.isViewMode = !!this.patientId && !!this.route.snapshot.data['viewMode']

          if ((this.isEditMode || this.isViewMode) && this.patientId) {
            this.isLoading = true
            return this.patientsService.findOne(this.patientId)
          }
          return of(null)
        }),
        catchError(error => {
          this.isLoading = false
          console.error('Error al cargar paciente:', error)

          if (error.status === 404) {
            Swal.fire({
              title: 'Paciente No Encontrado',
              text: 'El paciente que intenta editar no existe o ha sido eliminado.',
              icon: 'error',
              confirmButtonColor: '#2563eb',
              confirmButtonText: 'Ir a Lista',
            }).then(() => {
              this.router.navigate(['/dashboard/patients'])
            })
          } else {
            Swal.fire({
              title: 'Error al Cargar Paciente',
              text: 'No se pudo cargar la información del paciente. Por favor, intente nuevamente.',
              icon: 'error',
              confirmButtonColor: '#2563eb',
              confirmButtonText: 'Volver',
            }).then(() => {
              this.router.navigate(['/dashboard/patients'])
            })
          }
          return of(null)
        }),
      )
      .subscribe(patient => {
        if (patient) {
          this.populateForms(patient)
        }
        this.isLoading = false
      })
  }

  private populateForms(patient: Patient): void {
    this.personalInfoForm.patchValue({
      firstName: patient.firstName,
      lastName: patient.lastName,
      documentNumber: patient.documentNumber,
      documentType: patient.documentType,
      birthDate: patient.birthDate,
      gender: patient.gender,
      maritalStatus: patient.maritalStatus,
      occupation: patient.occupation,
    })

    this.contactInfoForm.patchValue({
      email: patient.email,
      phone: patient.phone,
      address: patient.address,
      city: patient.city,
      state: patient.state,
      zipCode: patient.zipCode,
      country: patient.country,
    })

    this.medicalInfoForm.patchValue({
      bloodType: patient.bloodType,
      allergies: patient.allergies,
      medications: patient.medications,
      medicalHistory: patient.medicalHistory,
      notes: patient.notes,
    })

    this.emergencyContactForm.patchValue({
      emergencyContactName: patient.emergencyContactName,
      emergencyContactPhone: patient.emergencyContactPhone,
      emergencyContactRelationship: patient.emergencyContactRelationship,
    })

    this.insuranceForm.patchValue({
      insuranceProvider: patient.insuranceProvider,
      insuranceNumber: patient.insuranceNumber,
      clinicId: patient.clinicId,
    })
  }

  onSubmit(): void {
    if (this.isAllFormsValid()) {
      this.isSaving = true

      const patientData = this.createPatientDto()

      if (this.isEditMode && this.patientId) {
        this.updatePatient(patientData)
      } else {
        this.createPatient(patientData)
      }
    } else {
      this.showError('Por favor complete todos los campos requeridos')
    }
  }

  isAllFormsValid(): boolean {
    return (
      this.personalInfoForm.valid &&
      this.contactInfoForm.valid &&
      this.emergencyContactForm.valid &&
      this.insuranceForm.valid
    )
  }

  private createPatientDto(): CreatePatientDto {
    const personalData = this.personalInfoForm.value
    const contactData = this.contactInfoForm.value
    const medicalData = this.medicalInfoForm.value
    const emergencyData = this.emergencyContactForm.value
    const insuranceData = this.insuranceForm.value

    return {
      ...personalData,
      ...contactData,
      ...medicalData,
      ...emergencyData,
      ...insuranceData,
    }
  }

  private createPatient(patientData: CreatePatientDto): void {
    this.patientsService.createPatient(patientData).subscribe({
      next: patient => {
        this.isSaving = false
        Swal.fire({
          title: '¡Paciente Creado!',
          html: `
            <div style="text-align: left; padding: 10px;">
              <p><strong>Nombre:</strong> ${patient.firstName} ${patient.lastName}</p>
              <p><strong>Documento:</strong> ${patient.documentNumber}</p>
              <p style="color: #059669; margin-top: 15px;">✓ El paciente ha sido registrado exitosamente en el sistema</p>
            </div>
          `,
          icon: 'success',
          confirmButtonColor: '#2563eb',
          confirmButtonText: 'Ir a Lista de Pacientes',
          showCancelButton: true,
          cancelButtonText: 'Crear Otro',
          cancelButtonColor: '#64748b',
          reverseButtons: true,
        }).then(result => {
          if (result.isConfirmed) {
            this.router.navigate(['/dashboard/patients'])
          } else {
            // Resetear formulario para crear otro paciente
            this.initializeForms()
          }
        })
      },
      error: error => {
        this.isSaving = false
        this.handlePatientError(error, patientData)
      },
    })
  }

  private updatePatient(patientData: CreatePatientDto): void {
    this.patientsService.updatePatient(this.patientId!, patientData).subscribe({
      next: patient => {
        this.isSaving = false
        Swal.fire({
          title: '¡Paciente Actualizado!',
          text: 'Los datos del paciente han sido actualizados correctamente',
          icon: 'success',
          confirmButtonColor: '#2563eb',
          confirmButtonText: 'Aceptar',
          timer: 3000,
          timerProgressBar: true,
        }).then(() => {
          this.router.navigate(['/dashboard/patients'])
        })
      },
      error: error => {
        this.isSaving = false
        this.handlePatientError(error, patientData)
      },
    })
  }

  private handlePatientError(error: any, patientData: CreatePatientDto): void {
    console.error('Error al guardar paciente:', error)

    // Error de paciente duplicado (409 Conflict)
    if (error.status === 409 || error.error?.message?.includes('already exists')) {
      Swal.fire({
        title: '⚠️ Paciente Ya Registrado',
        html: `
          <div style="text-align: left; padding: 15px;">
            <p style="margin-bottom: 15px;">Ya existe un paciente registrado con el documento:</p>
            <div style="background: #fef3c7; padding: 12px; border-radius: 8px; border-left: 4px solid #f59e0b; margin-bottom: 15px;">
              <strong style="font-size: 1.1em; color: #92400e;">${patientData.documentType || 'CI'}: ${patientData.documentNumber}</strong>
            </div>
            <p style="color: #64748b; font-size: 0.9em;">Por favor, verifique el número de documento o busque al paciente existente.</p>
          </div>
        `,
        icon: 'warning',
        confirmButtonColor: '#2563eb',
        confirmButtonText: 'Buscar Paciente',
        showCancelButton: true,
        cancelButtonText: 'Revisar Documento',
        cancelButtonColor: '#64748b',
        reverseButtons: true,
      }).then(result => {
        if (result.isConfirmed) {
          // Navegar a la lista con búsqueda del documento
          this.router.navigate(['/dashboard/patients/list'], {
            queryParams: { search: patientData.documentNumber },
          })
        }
      })
      return
    }

    // Error de clínica no encontrada (404)
    if (error.status === 404 && error.error?.message?.includes('Clinic not found')) {
      Swal.fire({
        title: 'Clínica No Encontrada',
        text: 'La clínica seleccionada no existe. Por favor, seleccione otra clínica.',
        icon: 'error',
        confirmButtonColor: '#2563eb',
        confirmButtonText: 'Entendido',
      })
      return
    }

    // Error de validación (400 Bad Request)
    if (error.status === 400) {
      const validationErrors = this.extractValidationErrors(error)
      Swal.fire({
        title: 'Datos Inválidos',
        html: `
          <div style="text-align: left; padding: 10px;">
            <p style="margin-bottom: 10px;">Por favor, corrija los siguientes errores:</p>
            <ul style="color: #dc2626; text-align: left;">
              ${validationErrors.map(err => `<li>${err}</li>`).join('')}
            </ul>
          </div>
        `,
        icon: 'error',
        confirmButtonColor: '#2563eb',
        confirmButtonText: 'Corregir',
      })
      return
    }

    // Error de autorización (401/403)
    if (error.status === 401 || error.status === 403) {
      Swal.fire({
        title: 'Sin Autorización',
        text: 'No tiene permisos para realizar esta acción.',
        icon: 'error',
        confirmButtonColor: '#2563eb',
        confirmButtonText: 'Entendido',
      })
      return
    }

    // Error de servidor (500)
    if (error.status >= 500) {
      Swal.fire({
        title: 'Error del Servidor',
        html: `
          <div style="text-align: center; padding: 10px;">
            <p>Ocurrió un error en el servidor. Por favor, intente nuevamente.</p>
            <p style="color: #64748b; font-size: 0.9em; margin-top: 10px;">Si el problema persiste, contacte al administrador.</p>
          </div>
        `,
        icon: 'error',
        confirmButtonColor: '#2563eb',
        confirmButtonText: 'Reintentar',
        showCancelButton: true,
        cancelButtonText: 'Cancelar',
        cancelButtonColor: '#64748b',
      }).then(result => {
        if (result.isConfirmed) {
          this.isSaving = true
          if (this.isEditMode) {
            this.updatePatient(patientData)
          } else {
            this.createPatient(patientData)
          }
        }
      })
      return
    }

    // Error genérico
    Swal.fire({
      title: 'Error al Guardar',
      text:
        error.error?.message ||
        'Ocurrió un error al guardar el paciente. Por favor, intente nuevamente.',
      icon: 'error',
      confirmButtonColor: '#2563eb',
      confirmButtonText: 'Entendido',
    })
  }

  private extractValidationErrors(error: any): string[] {
    const errors: string[] = []

    if (error.error?.message) {
      if (Array.isArray(error.error.message)) {
        errors.push(...error.error.message)
      } else {
        errors.push(error.error.message)
      }
    }

    if (errors.length === 0) {
      errors.push('Datos inválidos. Por favor, revise el formulario.')
    }

    return errors
  }

  saveDraft(): void {
    if (this.personalInfoForm.valid) {
      Swal.fire({
        title: 'Guardar Borrador',
        text: 'Se guardará el paciente solo con la información personal básica. ¿Desea continuar?',
        icon: 'question',
        showCancelButton: true,
        confirmButtonColor: '#2563eb',
        cancelButtonColor: '#64748b',
        confirmButtonText: 'Sí, guardar',
        cancelButtonText: 'Cancelar',
        reverseButtons: true,
      }).then(result => {
        if (result.isConfirmed) {
          this.isSaving = true
          const patientData = this.createPatientDto()
          this.createPatient(patientData)
        }
      })
    } else {
      Swal.fire({
        title: 'Información Incompleta',
        html: `
          <div style="text-align: left; padding: 10px;">
            <p>Debe completar al menos la información personal básica:</p>
            <ul style="color: #dc2626; margin-top: 10px;">
              ${!this.personalInfoForm.get('firstName')?.valid ? '<li>Nombres</li>' : ''}
              ${!this.personalInfoForm.get('lastName')?.valid ? '<li>Apellidos</li>' : ''}
              ${!this.personalInfoForm.get('documentNumber')?.valid ? '<li>Número de documento</li>' : ''}
              ${!this.personalInfoForm.get('birthDate')?.valid ? '<li>Fecha de nacimiento</li>' : ''}
              ${!this.personalInfoForm.get('gender')?.valid ? '<li>Género</li>' : ''}
            </ul>
          </div>
        `,
        icon: 'warning',
        confirmButtonColor: '#2563eb',
        confirmButtonText: 'Completar Datos',
      })
    }
  }

  cancel(): void {
    Swal.fire({
      title: '¿Estás seguro?',
      text: 'Los cambios no guardados se perderán',
      icon: 'warning',
      showCancelButton: true,
      confirmButtonColor: '#2563eb',
      cancelButtonColor: '#64748b',
      confirmButtonText: 'Sí, salir',
      cancelButtonText: 'Cancelar',
      reverseButtons: true,
    }).then(result => {
      if (result.isConfirmed) {
        this.router.navigate(['/dashboard/patients'])
      }
    })
  }

  private showSuccess(message: string): void {
    Swal.fire({
      title: '¡Éxito!',
      text: message,
      icon: 'success',
      confirmButtonColor: '#2563eb',
      confirmButtonText: 'Aceptar',
      timer: 3000,
      timerProgressBar: true,
    })
  }

  private showError(message: string): void {
    Swal.fire({
      title: 'Error',
      text: message,
      icon: 'error',
      confirmButtonColor: '#2563eb',
      confirmButtonText: 'Entendido',
    })
  }

  getErrorMessage(fieldName: string): string {
    const field =
      this.personalInfoForm.get(fieldName) ||
      this.contactInfoForm.get(fieldName) ||
      this.medicalInfoForm.get(fieldName) ||
      this.emergencyContactForm.get(fieldName) ||
      this.insuranceForm.get(fieldName)

    if (field?.hasError('required')) {
      return 'Este campo es requerido'
    }
    if (field?.hasError('email')) {
      return 'Ingrese un email válido'
    }
    if (field?.hasError('minlength')) {
      return `Mínimo ${field.getError('minlength').requiredLength} caracteres`
    }
    return ''
  }
}
