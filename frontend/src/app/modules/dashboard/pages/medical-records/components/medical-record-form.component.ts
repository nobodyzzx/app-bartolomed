import { Component, OnInit } from '@angular/core';
import { FormBuilder, FormGroup, Validators } from '@angular/forms';
import { ActivatedRoute, Router } from '@angular/router';
import { MatSnackBar } from '@angular/material/snack-bar';
import { Observable, forkJoin } from 'rxjs';
import { 
  MedicalRecord, 
  CreateMedicalRecordDto, 
  UpdateMedicalRecordDto, 
  RecordType, 
  RecordStatus,
  ConsentType,
  CreateConsentDto
} from '../interfaces';
import { MedicalRecordsService } from '../services/medical-records.service';

@Component({
  selector: 'app-medical-record-form',
  templateUrl: './medical-record-form.component.html',
  styleUrls: ['./medical-record-form.component.css']
})
export class MedicalRecordFormComponent implements OnInit {
  medicalRecordForm!: FormGroup;
  consentForm!: FormGroup;
  
  isEditMode = false;
  recordId: string | null = null;
  loading = false;
  currentStep = 0;
  
  recordTypes = Object.values(RecordType);
  recordStatuses = Object.values(RecordStatus);
  consentTypes = Object.values(ConsentType);
  
  // Para subida de archivos
  selectedConsentFile: File | null = null;
  uploadProgress = 0;
  
  // Para autocompletado de pacientes y doctores
  patients: any[] = [];
  doctors: any[] = [];

  constructor(
    private fb: FormBuilder,
    private medicalRecordsService: MedicalRecordsService,
    private route: ActivatedRoute,
    private router: Router,
    private snackBar: MatSnackBar
  ) {
    this.initializeForms();
  }

  ngOnInit(): void {
    this.recordId = this.route.snapshot.paramMap.get('id');
    this.isEditMode = !!this.recordId;
    
    if (this.isEditMode) {
      this.loadMedicalRecord();
    }
    
    this.loadPatients();
    this.loadDoctors();
  }

  private initializeForms(): void {
    this.medicalRecordForm = this.fb.group({
      // Información básica
      type: [RecordType.CONSULTATION, Validators.required],
      status: [RecordStatus.DRAFT],
      patientId: ['', Validators.required],
      doctorId: ['', Validators.required],
      isEmergency: [false],
      
      // Historia clínica
      chiefComplaint: ['', Validators.required],
      historyOfPresentIllness: [''],
      pastMedicalHistory: [''],
      medications: [''],
      allergies: [''],
      socialHistory: [''],
      familyHistory: [''],
      reviewOfSystems: [''],
      
      // Signos vitales
      temperature: [''],
      systolicBP: [''],
      diastolicBP: [''],
      heartRate: [''],
      respiratoryRate: [''],
      oxygenSaturation: [''],
      weight: [''],
      height: [''],
      
      // Examen físico
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
      followUpDate: ['']
    });

    this.consentForm = this.fb.group({
      consentType: [ConsentType.GENERAL_TREATMENT, Validators.required],
      description: ['', Validators.required],
      signedBy: [''],
      patientSignature: [false, Validators.requiredTrue],
      doctorSignature: [false, Validators.requiredTrue],
      witnessSignature: [false],
      consentDocument: ['']
    });
  }

  private loadMedicalRecord(): void {
    if (!this.recordId) return;
    
    this.loading = true;
    this.medicalRecordsService.getMedicalRecordById(this.recordId).subscribe({
      next: (record) => {
        this.populateForm(record);
        this.loading = false;
      },
      error: (error) => {
        console.error('Error cargando expediente:', error);
        this.snackBar.open('Error cargando el expediente', 'Cerrar', { duration: 3000 });
        this.loading = false;
      }
    });
  }

  private populateForm(record: MedicalRecord): void {
    this.medicalRecordForm.patchValue({
      type: record.type,
      status: record.status,
      patientId: record.patientId,
      doctorId: record.doctorId,
      isEmergency: record.isEmergency,
      chiefComplaint: record.chiefComplaint,
      historyOfPresentIllness: record.historyOfPresentIllness,
      pastMedicalHistory: record.pastMedicalHistory,
      medications: record.medications,
      allergies: record.allergies,
      socialHistory: record.socialHistory,
      familyHistory: record.familyHistory,
      reviewOfSystems: record.reviewOfSystems,
      temperature: record.vitalSigns?.temperature,
      systolicBP: record.vitalSigns?.systolicBP,
      diastolicBP: record.vitalSigns?.diastolicBP,
      heartRate: record.vitalSigns?.heartRate,
      respiratoryRate: record.vitalSigns?.respiratoryRate,
      oxygenSaturation: record.vitalSigns?.oxygenSaturation,
      weight: record.vitalSigns?.weight,
      height: record.vitalSigns?.height,
      physicalExamination: record.physicalExamination,
      generalAppearance: record.physicalExam?.generalAppearance,
      heent: record.physicalExam?.heent,
      cardiovascular: record.physicalExam?.cardiovascular,
      respiratory: record.physicalExam?.respiratory,
      abdominal: record.physicalExam?.abdominal,
      neurological: record.physicalExam?.neurological,
      musculoskeletal: record.physicalExam?.musculoskeletal,
      skin: record.physicalExam?.skin,
      assessment: record.assessment,
      plan: record.plan,
      diagnosis: record.diagnosis,
      differentialDiagnosis: record.differentialDiagnosis,
      treatmentPlan: record.treatmentPlan,
      followUpInstructions: record.followUpInstructions,
      patientEducation: record.patientEducation,
      notes: record.notes,
      followUpDate: record.followUpDate
    });
  }

  private loadPatients(): void {
    // Aquí deberías llamar a un servicio para cargar pacientes
    // this.patientsService.getPatients().subscribe(patients => this.patients = patients);
    this.patients = []; // Temporal
  }

  private loadDoctors(): void {
    // Aquí deberías llamar a un servicio para cargar doctores
    // this.usersService.getDoctors().subscribe(doctors => this.doctors = doctors);
    this.doctors = []; // Temporal
  }

  onFileSelected(event: any): void {
    const file = event.target.files[0];
    if (file) {
      if (file.type === 'application/pdf' || file.type.startsWith('image/')) {
        this.selectedConsentFile = file;
        this.consentForm.patchValue({ consentDocument: file.name });
      } else {
        this.snackBar.open('Solo se permiten archivos PDF o imágenes', 'Cerrar', { duration: 3000 });
      }
    }
  }

  calculateBMI(): void {
    const weight = this.medicalRecordForm.get('weight')?.value;
    const height = this.medicalRecordForm.get('height')?.value;
    
    if (weight && height) {
      const heightInMeters = height / 100;
      const bmi = weight / (heightInMeters * heightInMeters);
      // Mostrar BMI calculado (podríías agregarlo como campo readonly)
      console.log('BMI calculado:', bmi.toFixed(2));
    }
  }

  nextStep(): void {
    if (this.currentStep === 0 && this.medicalRecordForm.valid) {
      this.currentStep++;
    } else if (this.currentStep === 1) {
      this.currentStep++;
    }
  }

  previousStep(): void {
    if (this.currentStep > 0) {
      this.currentStep--;
    }
  }

  onSubmit(): void {
    if (this.medicalRecordForm.valid) {
      this.loading = true;
      
      const formData = this.medicalRecordForm.value;
      
      if (this.isEditMode) {
        this.updateMedicalRecord(formData);
      } else {
        this.createMedicalRecord(formData);
      }
    } else {
      this.markFormGroupTouched(this.medicalRecordForm);
      this.snackBar.open('Por favor complete todos los campos obligatorios', 'Cerrar', { duration: 3000 });
    }
  }

  private createMedicalRecord(formData: any): void {
    const createDto: CreateMedicalRecordDto = {
      ...formData
    };
    
    this.medicalRecordsService.createMedicalRecord(createDto).subscribe({
      next: (record) => {
        this.snackBar.open('Expediente médico creado exitosamente', 'Cerrar', { duration: 3000 });
        
        // Si hay consentimiento, crearlo también
        if (this.consentForm.valid && this.consentForm.value.description) {
          this.createConsentForm(record.id!);
        } else {
          this.router.navigate(['/dashboard/medical-records']);
        }
        
        this.loading = false;
      },
      error: (error) => {
        console.error('Error creando expediente:', error);
        this.snackBar.open('Error al crear el expediente médico', 'Cerrar', { duration: 3000 });
        this.loading = false;
      }
    });
  }

  private updateMedicalRecord(formData: any): void {
    const updateDto: UpdateMedicalRecordDto = {
      ...formData
    };
    
    this.medicalRecordsService.updateMedicalRecord(this.recordId!, updateDto).subscribe({
      next: (record) => {
        this.snackBar.open('Expediente médico actualizado exitosamente', 'Cerrar', { duration: 3000 });
        this.router.navigate(['/dashboard/medical-records']);
        this.loading = false;
      },
      error: (error) => {
        console.error('Error actualizando expediente:', error);
        this.snackBar.open('Error al actualizar el expediente médico', 'Cerrar', { duration: 3000 });
        this.loading = false;
      }
    });
  }

  private createConsentForm(medicalRecordId: string): void {
    const consentData: CreateConsentDto = {
      medicalRecordId,
      patientId: this.medicalRecordForm.get('patientId')?.value,
      doctorId: this.medicalRecordForm.get('doctorId')?.value,
      consentType: this.consentForm.get('consentType')?.value,
      description: this.consentForm.get('description')?.value,
      signedBy: this.consentForm.get('signedBy')?.value
    };

    this.medicalRecordsService.createConsentForm(consentData).subscribe({
      next: (consent) => {
        // Si hay archivo, subirlo
        if (this.selectedConsentFile) {
          this.uploadConsentDocument(consent.id!);
        } else {
          this.router.navigate(['/dashboard/medical-records']);
        }
      },
      error: (error) => {
        console.error('Error creando consentimiento:', error);
        this.snackBar.open('Error al crear el consentimiento', 'Cerrar', { duration: 3000 });
        this.router.navigate(['/dashboard/medical-records']);
      }
    });
  }

  private uploadConsentDocument(consentId: string): void {
    if (!this.selectedConsentFile) return;
    
    this.medicalRecordsService.uploadSignedConsent(consentId, this.selectedConsentFile).subscribe({
      next: (consent) => {
        this.snackBar.open('Documento de consentimiento subido exitosamente', 'Cerrar', { duration: 3000 });
        this.router.navigate(['/dashboard/medical-records']);
      },
      error: (error) => {
        console.error('Error subiendo documento:', error);
        this.snackBar.open('Error al subir el documento de consentimiento', 'Cerrar', { duration: 3000 });
        this.router.navigate(['/dashboard/medical-records']);
      }
    });
  }

  cancel(): void {
    this.router.navigate(['/dashboard/medical-records']);
  }

  saveDraft(): void {
    this.medicalRecordForm.patchValue({ status: RecordStatus.DRAFT });
    this.onSubmit();
  }

  private markFormGroupTouched(formGroup: FormGroup): void {
    Object.keys(formGroup.controls).forEach(key => {
      const control = formGroup.get(key);
      control?.markAsTouched();
    });
  }

  getTypeText(type: RecordType): string {
    switch (type) {
      case RecordType.CONSULTATION: return 'Consulta';
      case RecordType.EMERGENCY: return 'Emergencia';
      case RecordType.SURGERY: return 'Cirugía';
      case RecordType.FOLLOW_UP: return 'Seguimiento';
      case RecordType.LABORATORY: return 'Laboratorio';
      case RecordType.IMAGING: return 'Imagenología';
      case RecordType.OTHER: return 'Otro';
      default: return type;
    }
  }

  getConsentTypeText(type: ConsentType): string {
    switch (type) {
      case ConsentType.GENERAL_TREATMENT: return 'Tratamiento General';
      case ConsentType.SURGERY: return 'Cirugía';
      case ConsentType.ANESTHESIA: return 'Anestesia';
      case ConsentType.BLOOD_TRANSFUSION: return 'Transfusión Sanguínea';
      case ConsentType.EXPERIMENTAL_TREATMENT: return 'Tratamiento Experimental';
      case ConsentType.PHOTOGRAPHY: return 'Fotografía Médica';
      case ConsentType.DATA_SHARING: return 'Compartir Datos';
      case ConsentType.OTHER: return 'Otro';
      default: return type;
    }
  }
}
