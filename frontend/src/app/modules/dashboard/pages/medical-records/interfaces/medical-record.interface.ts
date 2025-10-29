export enum RecordType {
  CONSULTATION = 'consultation',
  EMERGENCY = 'emergency',
  SURGERY = 'surgery',
  FOLLOW_UP = 'follow_up',
  LABORATORY = 'laboratory',
  IMAGING = 'imaging',
  OTHER = 'other',
}

export enum RecordStatus {
  DRAFT = 'draft',
  COMPLETED = 'completed',
  REVIEWED = 'reviewed',
  ARCHIVED = 'archived',
}

export interface VitalSigns {
  temperature?: number;
  systolicBP?: number;
  diastolicBP?: number;
  heartRate?: number;
  respiratoryRate?: number;
  oxygenSaturation?: number;
  weight?: number;
  height?: number;
  bmi?: number;
}

export interface PhysicalExam {
  generalAppearance?: string;
  heent?: string; // Head, Eyes, Ears, Nose, Throat
  cardiovascular?: string;
  respiratory?: string;
  abdominal?: string;
  neurological?: string;
  musculoskeletal?: string;
  skin?: string;
}

export interface MedicalRecord {
  id?: string;
  type: RecordType;
  status: RecordStatus;
  
  // Historia clínica
  chiefComplaint: string;
  historyOfPresentIllness?: string;
  pastMedicalHistory?: string;
  medications?: string;
  allergies?: string;
  socialHistory?: string;
  familyHistory?: string;
  reviewOfSystems?: string;
  
  // Signos vitales
  vitalSigns?: VitalSigns;
  
  // Examen físico
  physicalExamination?: string;
  physicalExam?: PhysicalExam;
  
  // Evaluación y Plan
  assessment?: string;
  plan?: string;
  diagnosis?: string;
  differentialDiagnosis?: string;
  treatmentPlan?: string;
  followUpInstructions?: string;
  patientEducation?: string;
  notes?: string;
  followUpDate?: Date;
  
  // Metadatos
  isEmergency?: boolean;
  isActive?: boolean;
  patientId?: string;
  doctorId?: string;
  createdBy?: string;
  createdAt?: Date;
  updatedAt?: Date;
  
  // Información del paciente y doctor (para mostrar)
  patient?: {
    id: string;
    firstName: string;
    lastName: string;
    documentNumber: string;
  };
  doctor?: {
    id: string;
    firstName: string;
    lastName: string;
    specialization?: string;
  };
}

export interface CreateMedicalRecordDto {
  type: RecordType;
  chiefComplaint: string;
  historyOfPresentIllness?: string;
  pastMedicalHistory?: string;
  medications?: string;
  allergies?: string;
  socialHistory?: string;
  familyHistory?: string;
  reviewOfSystems?: string;
  
  // Signos vitales
  temperature?: number;
  systolicBP?: number;
  diastolicBP?: number;
  heartRate?: number;
  respiratoryRate?: number;
  oxygenSaturation?: number;
  weight?: number;
  height?: number;
  
  // Examen físico
  physicalExamination?: string;
  generalAppearance?: string;
  heent?: string;
  cardiovascular?: string;
  respiratory?: string;
  abdominal?: string;
  neurological?: string;
  musculoskeletal?: string;
  skin?: string;
  
  // Evaluación y Plan
  assessment?: string;
  plan?: string;
  diagnosis?: string;
  differentialDiagnosis?: string;
  treatmentPlan?: string;
  followUpInstructions?: string;
  patientEducation?: string;
  notes?: string;
  followUpDate?: Date;
  
  isEmergency?: boolean;
  patientId: string;
  doctorId: string;
}

export interface UpdateMedicalRecordDto extends Partial<CreateMedicalRecordDto> {
  status?: RecordStatus;
}

export interface ConsentForm {
  id?: string;
  medicalRecordId: string;
  patientId: string;
  doctorId: string;
  consentType: ConsentType;
  description: string;
  signedAt?: Date;
  signedBy?: string;
  documentPath?: string;
  isActive: boolean;
  createdAt?: Date;
  updatedAt?: Date;
}

export enum ConsentType {
  GENERAL_TREATMENT = 'general_treatment',
  SURGERY = 'surgery',
  ANESTHESIA = 'anesthesia',
  BLOOD_TRANSFUSION = 'blood_transfusion',
  EXPERIMENTAL_TREATMENT = 'experimental_treatment',
  PHOTOGRAPHY = 'photography',
  DATA_SHARING = 'data_sharing',
  OTHER = 'other',
}

export interface CreateConsentDto {
  medicalRecordId: string;
  patientId: string;
  doctorId: string;
  consentType: ConsentType;
  description: string;
  signedBy?: string;
}

export interface MedicalRecordFilters {
  patientId?: string;
  doctorId?: string;
  type?: RecordType;
  status?: RecordStatus;
  startDate?: Date;
  endDate?: Date;
  isEmergency?: boolean;
  search?: string;
}
