import { Component, OnInit } from '@angular/core'
import { FormBuilder, FormGroup, Validators } from '@angular/forms'
import { MatSnackBar } from '@angular/material/snack-bar'
import { ActivatedRoute, Router } from '@angular/router'
import { of } from 'rxjs'
import { catchError, switchMap } from 'rxjs/operators'
import { BloodType, CreatePatientDto, Gender, MaritalStatus, Patient } from '../interfaces'
import { PatientsService } from '../services'

@Component({
  selector: 'app-patient-form',
  templateUrl: './patient-form.component.html',
  styleUrl: './patient-form.component.css'
})
export class PatientFormComponent implements OnInit {
  
  // Stepper form groups
  personalInfoForm!: FormGroup;
  contactInfoForm!: FormGroup;
  medicalInfoForm!: FormGroup;
  emergencyContactForm!: FormGroup;
  insuranceForm!: FormGroup;
  
  // Loading states
  isLoading = false;
  isSaving = false;
  
  // Edit mode
  isEditMode = false;
  isViewMode = false;
  patientId: string | null = null;

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
    private snackBar: MatSnackBar,
    private patientsService: PatientsService
  ) {
    this.initializeForms();
  }

  ngOnInit(): void {
    this.checkEditMode();
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
      occupation: ['Profesora']
    });

    // Paso 2: Información de Contacto
    this.contactInfoForm = this.fb.group({
      email: ['maria.gonzalez@email.com', [Validators.email]],
      phone: ['+591-70123456'],
      address: ['Av. América #123, Zona Central'],
      city: ['La Paz'],
      state: ['La Paz'],
      zipCode: ['00000'],
      country: ['Bolivia']
    });

    // Paso 3: Información Médica
    this.medicalInfoForm = this.fb.group({
      bloodType: [BloodType.O_POSITIVE],
      allergies: ['Alergia a la penicilina'],
      medications: ['Ninguno actualmente'],
      medicalHistory: ['Hipertensión arterial controlada'],
      notes: ['Paciente colaboradora, sin antecedentes quirúrgicos relevantes']
    });

    // Paso 4: Contacto de Emergencia
    this.emergencyContactForm = this.fb.group({
      emergencyContactName: ['Pedro González'],
      emergencyContactPhone: ['+591-70654321'],
      emergencyContactRelationship: ['Esposo']
    });

    // Paso 5: Información de Seguro
    this.insuranceForm = this.fb.group({
      insuranceProvider: ['Caja Nacional de Salud'],
      insuranceNumber: ['CNS-123456789'],
      clinicId: ['1', Validators.required]
    });
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
            this.isLoading = true;
            return this.patientsService.findOne(this.patientId)
          }
          return of(null)
        }),
        catchError(error => {
          this.showError('Error al cargar el paciente');
          return of(null);
        })
      )
      .subscribe(patient => {
        if (patient) {
          this.populateForms(patient);
        }
        this.isLoading = false;
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
      occupation: patient.occupation
    });

    this.contactInfoForm.patchValue({
      email: patient.email,
      phone: patient.phone,
      address: patient.address,
      city: patient.city,
      state: patient.state,
      zipCode: patient.zipCode,
      country: patient.country
    });

    this.medicalInfoForm.patchValue({
      bloodType: patient.bloodType,
      allergies: patient.allergies,
      medications: patient.medications,
      medicalHistory: patient.medicalHistory,
      notes: patient.notes
    });

    this.emergencyContactForm.patchValue({
      emergencyContactName: patient.emergencyContactName,
      emergencyContactPhone: patient.emergencyContactPhone,
      emergencyContactRelationship: patient.emergencyContactRelationship
    });

    this.insuranceForm.patchValue({
      insuranceProvider: patient.insuranceProvider,
      insuranceNumber: patient.insuranceNumber,
      clinicId: patient.clinicId
    });
  }

  onSubmit(): void {
    if (this.isAllFormsValid()) {
      this.isSaving = true;
      
      const patientData = this.createPatientDto();
      
      if (this.isEditMode && this.patientId) {
        this.updatePatient(patientData);
      } else {
        this.createPatient(patientData);
      }
    } else {
      this.showError('Por favor complete todos los campos requeridos');
    }
  }

  isAllFormsValid(): boolean {
    return this.personalInfoForm.valid && 
           this.contactInfoForm.valid && 
           this.emergencyContactForm.valid && 
           this.insuranceForm.valid;
  }

  private createPatientDto(): CreatePatientDto {
    const personalData = this.personalInfoForm.value;
    const contactData = this.contactInfoForm.value;
    const medicalData = this.medicalInfoForm.value;
    const emergencyData = this.emergencyContactForm.value;
    const insuranceData = this.insuranceForm.value;

    return {
      ...personalData,
      ...contactData,
      ...medicalData,
      ...emergencyData,
      ...insuranceData
    };
  }

  private createPatient(patientData: CreatePatientDto): void {
    this.patientsService.createPatient(patientData).subscribe({
      next: (patient) => {
        this.showSuccess('Paciente creado exitosamente');
        this.router.navigate(['/dashboard/patients']);
      },
      error: (error) => {
        this.showError('Error al crear el paciente');
        this.isSaving = false;
      }
    });
  }

  private updatePatient(patientData: CreatePatientDto): void {
    this.patientsService.updatePatient(this.patientId!, patientData).subscribe({
      next: (patient) => {
        this.showSuccess('Paciente actualizado exitosamente');
        this.router.navigate(['/dashboard/patients']);
      },
      error: (error) => {
        this.showError('Error al actualizar el paciente');
        this.isSaving = false;
      }
    });
  }

  saveDraft(): void {
    if (this.personalInfoForm.valid) {
      this.isSaving = true;
      const patientData = this.createPatientDto();
      
      this.createPatient(patientData);
    } else {
      this.showError('Debe completar al menos la información personal básica');
    }
  }

  cancel(): void {
    this.router.navigate(['/dashboard/patients']);
  }

  private showSuccess(message: string): void {
    this.snackBar.open(message, 'Cerrar', {
      duration: 3000,
      panelClass: ['success-snackbar']
    });
  }

  private showError(message: string): void {
    this.snackBar.open(message, 'Cerrar', {
      duration: 3000,
      panelClass: ['error-snackbar']
    });
  }

  getErrorMessage(fieldName: string): string {
    const field = this.personalInfoForm.get(fieldName) || 
                  this.contactInfoForm.get(fieldName) || 
                  this.medicalInfoForm.get(fieldName) || 
                  this.emergencyContactForm.get(fieldName) || 
                  this.insuranceForm.get(fieldName);
                  
    if (field?.hasError('required')) {
      return 'Este campo es requerido';
    }
    if (field?.hasError('email')) {
      return 'Ingrese un email válido';
    }
    if (field?.hasError('minlength')) {
      return `Mínimo ${field.getError('minlength').requiredLength} caracteres`;
    }
    return '';
  }
}

