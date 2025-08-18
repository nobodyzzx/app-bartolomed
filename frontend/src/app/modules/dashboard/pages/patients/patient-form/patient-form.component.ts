import { Component, OnInit } from '@angular/core';
import { FormBuilder, FormGroup, Validators } from '@angular/forms';
import { ActivatedRoute, Router } from '@angular/router';

@Component({
  selector: 'app-patient-form',
  templateUrl: './patient-form.component.html',
  styleUrl: './patient-form.component.css'
})
export class PatientFormComponent implements OnInit {
  patientForm: FormGroup;
  isEditMode = false;
  patientId: string | null = null;

  constructor(
    private fb: FormBuilder,
    private route: ActivatedRoute,
    private router: Router
  ) {
    this.patientForm = this.createForm();
  }

  ngOnInit(): void {
    this.patientId = this.route.snapshot.paramMap.get('id');
    this.isEditMode = !!this.patientId;
    
    if (this.isEditMode) {
      this.loadPatientData();
    }
  }

  createForm(): FormGroup {
    return this.fb.group({
      // Datos personales
      firstName: ['', [Validators.required, Validators.minLength(2)]],
      lastName: ['', [Validators.required, Validators.minLength(2)]],
      email: ['', [Validators.required, Validators.email]],
      phone: ['', [Validators.required, Validators.pattern(/^\+?[0-9\s\-\(\)]+$/)]],
      birthDate: ['', Validators.required],
      gender: ['', Validators.required],
      nationalId: ['', [Validators.required, Validators.minLength(8)]],
      
      // Información de contacto
      address: ['', Validators.required],
      city: ['', Validators.required],
      state: ['', Validators.required],
      zipCode: ['', Validators.required],
      
      // Contacto de emergencia
      emergencyContactName: ['', Validators.required],
      emergencyContactPhone: ['', [Validators.required, Validators.pattern(/^\+?[0-9\s\-\(\)]+$/)]],
      emergencyContactRelation: ['', Validators.required],
      
      // Información médica
      bloodType: [''],
      allergies: [''],
      medications: [''],
      medicalHistory: [''],
      
      // Información del seguro
      insuranceProvider: [''],
      insuranceNumber: [''],
      insurancePlan: ['']
    });
  }

  loadPatientData() {
    // Simular carga de datos del paciente
    const mockPatientData = {
      firstName: 'Juan',
      lastName: 'Pérez',
      email: 'juan.perez@email.com',
      phone: '+1234567890',
      birthDate: new Date('1980-05-15'),
      gender: 'Masculino',
      nationalId: '12345678',
      address: 'Calle Principal 123',
      city: 'Ciudad',
      state: 'Estado',
      zipCode: '12345',
      emergencyContactName: 'María Pérez',
      emergencyContactPhone: '+1234567891',
      emergencyContactRelation: 'Esposa',
      bloodType: 'O+',
      allergies: 'Ninguna conocida',
      medications: 'Ninguna',
      medicalHistory: 'Sin antecedentes relevantes',
      insuranceProvider: 'Seguro Nacional',
      insuranceNumber: 'SN123456',
      insurancePlan: 'Plan Básico'
    };
    
    this.patientForm.patchValue(mockPatientData);
  }

  onSubmit() {
    if (this.patientForm.valid) {
      const patientData = this.patientForm.value;
      console.log('Datos del paciente:', patientData);
      
      if (this.isEditMode) {
        console.log('Actualizando paciente...');
      } else {
        console.log('Creando nuevo paciente...');
      }
      
      // Redirigir a la lista después de guardar
      this.router.navigate(['/dashboard/patients/list']);
    } else {
      console.log('Formulario inválido');
      this.markFormGroupTouched();
    }
  }

  markFormGroupTouched() {
    Object.keys(this.patientForm.controls).forEach(key => {
      const control = this.patientForm.get(key);
      control?.markAsTouched();
    });
  }

  onCancel() {
    this.router.navigate(['/dashboard/patients/list']);
  }

  getErrorMessage(fieldName: string): string {
    const control = this.patientForm.get(fieldName);
    if (control?.hasError('required')) {
      return 'Este campo es requerido';
    }
    if (control?.hasError('email')) {
      return 'Ingrese un email válido';
    }
    if (control?.hasError('minlength')) {
      return `Mínimo ${control.errors?.['minlength'].requiredLength} caracteres`;
    }
    if (control?.hasError('pattern')) {
      return 'Formato inválido';
    }
    return '';
  }
}
