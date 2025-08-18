import { Component, OnInit } from '@angular/core'
import { FormControl, FormGroup, Validators } from '@angular/forms'
import { Router, ActivatedRoute } from '@angular/router'
import Swal from 'sweetalert2'
import { ErrorService } from '../../../../shared/components/services/error.service'
import { SidenavService } from '../../../../shared/components/services/sidenav.services'
import { switchMap } from 'rxjs/operators'
import { of } from 'rxjs'

export enum Gender {
  MALE = 'male',
  FEMALE = 'female',
  OTHER = 'other',
}

export enum MaritalStatus {
  SINGLE = 'single',
  MARRIED = 'married',
  DIVORCED = 'divorced',
  WIDOWED = 'widowed',
  OTHER = 'other',
}

export enum BloodType {
  A_POSITIVE = 'A+',
  A_NEGATIVE = 'A-',
  B_POSITIVE = 'B+',
  B_NEGATIVE = 'B-',
  AB_POSITIVE = 'AB+',
  AB_NEGATIVE = 'AB-',
  O_POSITIVE = 'O+',
  O_NEGATIVE = 'O-',
}

@Component({
  selector: 'app-patient-form',
  templateUrl: './patient-form.component.html',
})
export class PatientFormComponent implements OnInit {
  isExpanded: boolean = true
  isEditMode: boolean = false
  patientId: string | null = null

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

  public patientForm: FormGroup = new FormGroup({
    personalInfo: new FormGroup({
      firstName: new FormControl('', Validators.required),
      lastName: new FormControl('', Validators.required),
      email: new FormControl('', [Validators.email]),
      phone: new FormControl('', Validators.required),
      address: new FormControl(''),
      birthDate: new FormControl('', Validators.required),
      gender: new FormControl('', Validators.required),
      maritalStatus: new FormControl(''),
      occupation: new FormControl(''),
    }),
    medicalInfo: new FormGroup({
      bloodType: new FormControl(''),
      allergies: new FormControl([]),
      chronicConditions: new FormControl([]),
      emergencyContact: new FormGroup({
        name: new FormControl('', Validators.required),
        relationship: new FormControl('', Validators.required),
        phone: new FormControl('', Validators.required),
      }),
    }),
    insuranceInfo: new FormGroup({
      provider: new FormControl(''),
      policyNumber: new FormControl(''),
      groupNumber: new FormControl(''),
      expiryDate: new FormControl(''),
    }),
    clinicId: new FormControl('', Validators.required),
  })

  constructor(
    public router: Router,
    private route: ActivatedRoute,
    private errorService: ErrorService,
    private sidenavService: SidenavService,
  ) {}

  ngOnInit() {
    this.sidenavService.isExpanded$.subscribe(isExpanded => (this.isExpanded = isExpanded))

    // Verificar si estamos en modo edición
    this.route.paramMap
      .pipe(
        switchMap(params => {
          this.patientId = params.get('id')
          this.isEditMode = !!this.patientId

          if (this.isEditMode && this.patientId) {
            // Aquí cargarías los datos del paciente
            // return this.patientsService.findOne(this.patientId)
            return of(null)
          }
          return of(null)
        }),
      )
      .subscribe({
        next: patient => {
          if (patient) {
            this.fillFormWithPatientData(patient)
          }
        },
        error: error => {
          this.errorService.handleError(error)
          this.router.navigate(['/dashboard/patients/list'])
        },
      })
  }

  fillFormWithPatientData(patient: any) {
    this.patientForm.patchValue({
      personalInfo: {
        firstName: patient.personalInfo?.firstName || '',
        lastName: patient.personalInfo?.lastName || '',
        email: patient.personalInfo?.email || '',
        phone: patient.personalInfo?.phone || '',
        address: patient.personalInfo?.address || '',
        birthDate: patient.personalInfo?.birthDate || '',
        gender: patient.personalInfo?.gender || '',
        maritalStatus: patient.personalInfo?.maritalStatus || '',
        occupation: patient.personalInfo?.occupation || '',
      },
      medicalInfo: {
        bloodType: patient.medicalInfo?.bloodType || '',
        allergies: patient.medicalInfo?.allergies || [],
        chronicConditions: patient.medicalInfo?.chronicConditions || [],
        emergencyContact: {
          name: patient.medicalInfo?.emergencyContact?.name || '',
          relationship: patient.medicalInfo?.emergencyContact?.relationship || '',
          phone: patient.medicalInfo?.emergencyContact?.phone || '',
        },
      },
      insuranceInfo: {
        provider: patient.insuranceInfo?.provider || '',
        policyNumber: patient.insuranceInfo?.policyNumber || '',
        groupNumber: patient.insuranceInfo?.groupNumber || '',
        expiryDate: patient.insuranceInfo?.expiryDate || '',
      },
      clinicId: patient.clinicId || '',
    })
  }

  onSubmit() {
    if (this.patientForm.invalid) {
      this.patientForm.markAllAsTouched()
      return
    }

    const patientData = this.patientForm.value

    if (this.isEditMode && this.patientId) {
      // Modo edición
      const updateData = {
        ...patientData,
        id: this.patientId,
      }

      // Aquí llamarías al servicio de actualización
      // this.patientsService.updatePatient(updateData).subscribe({...})
      console.log('Actualizando paciente:', updateData)
      
      Swal.fire({
        icon: 'success',
        title: 'Paciente actualizado',
        text: 'El paciente ha sido actualizado correctamente',
        timer: 2000,
        showConfirmButton: false,
      }).then(() => {
        this.router.navigate(['/dashboard/patients/list'])
      })
    } else {
      // Modo crear
      // this.patientsService.createPatient(patientData).subscribe({...})
      console.log('Creando paciente:', patientData)
      
      Swal.fire({
        icon: 'success',
        title: 'Paciente creado',
        text: 'El paciente ha sido registrado correctamente',
        timer: 2000,
        showConfirmButton: false,
      }).then(() => {
        this.router.navigate(['/dashboard/patients/list'])
      })
    }
  }

  // Métodos auxiliares para manejar arrays
  addAllergy() {
    const allergies = this.patientForm.get('medicalInfo.allergies')?.value || []
    // Aquí podrías abrir un modal o usar un input inline
    const newAllergy = prompt('Ingrese una nueva alergia:')
    if (newAllergy && newAllergy.trim()) {
      allergies.push(newAllergy.trim())
      this.patientForm.get('medicalInfo.allergies')?.setValue(allergies)
    }
  }

  removeAllergy(index: number) {
    const allergies = this.patientForm.get('medicalInfo.allergies')?.value || []
    allergies.splice(index, 1)
    this.patientForm.get('medicalInfo.allergies')?.setValue(allergies)
  }

  addChronicCondition() {
    const conditions = this.patientForm.get('medicalInfo.chronicConditions')?.value || []
    const newCondition = prompt('Ingrese una nueva condición crónica:')
    if (newCondition && newCondition.trim()) {
      conditions.push(newCondition.trim())
      this.patientForm.get('medicalInfo.chronicConditions')?.setValue(conditions)
    }
  }

  removeChronicCondition(index: number) {
    const conditions = this.patientForm.get('medicalInfo.chronicConditions')?.value || []
    conditions.splice(index, 1)
    this.patientForm.get('medicalInfo.chronicConditions')?.setValue(conditions)
  }
}
