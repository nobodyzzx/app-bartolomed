export interface PatientPdfInfo {
  firstName: string;
  lastName: string;
  documentNumber?: string;
  birthDate?: string;
  address?: string;
  phone?: string;
}

export interface DoctorPdfInfo {
  firstName: string;
  lastName: string;
  specialization?: string;
}

export interface VitalSignsPdfInfo {
  temperature?: number | string;
  systolicBP?: number | string;
  diastolicBP?: number | string;
  heartRate?: number | string;
  respiratoryRate?: number | string;
  oxygenSaturation?: number | string;
  weight?: number | string;
  height?: number | string;
  bmi?: number | string;
}

// ─── Consentimiento informado ─────────────────────────────────────────────────

export interface ConsentPdfDto {
  patient: PatientPdfInfo;
  doctor: DoctorPdfInfo;
  /** Valor del campo printTemplate del formulario: diagnostic | surgery | blood_transfusion | rejection */
  printTemplate: string;
  consentType: string;
  title?: string;
  description?: string;
  signedAt?: string;   // ISO string o DD/MM/YYYY HH:mm
  signedBy?: string;
  // campos diagnóstico/general
  procedureName?: string;
  objective?: string;
  risks?: string;
  benefits?: string;
  // campos quirúrgicos
  surgicalDiagnosis?: string;
  surgicalProcedureName?: string;
  leadSurgeonName?: string;
  surgeryObjective?: string;
  surgicalAlternatives?: string;
  consequencesNoSurgery?: string;
  surgeryWitnessName?: string;
  surgeryWitnessCi?: string;
  // campos transfusión
  transfusionDiagnosis?: string;
  bloodProductType?: string;
  treatingPhysicianName?: string;
  transfusionBenefits?: string;
  transfusionAlternatives?: string;
  // campos rechazo
  clinicName?: string;
  clinicalRecordNumber?: string;
  rejectedActName?: string;
  informingPhysicianName?: string;
  rejectionDiagnosis?: string;
  rejectionConsequences?: string;
  witnessName?: string;
  witnessCi?: string;
  rejectionCity?: string;
  // fecha y hora separadas (como vienen del datepicker)
  consentDate?: string;
  consentTime?: string;
}

// ─── Resumen del expediente médico ───────────────────────────────────────────

export interface SummaryPdfDto {
  patient: PatientPdfInfo;
  doctor: DoctorPdfInfo;
  recordType: string;
  isEmergency: boolean;
  chiefComplaint: string;
  // historia clínica
  historyOfPresentIllness?: string;
  pastMedicalHistory?: string;
  medications?: string;
  allergies?: string;
  socialHistory?: string;
  familyHistory?: string;
  reviewOfSystems?: string;
  // signos vitales
  vitalSigns?: VitalSignsPdfInfo;
  // examen físico
  physicalExamination?: string;
  generalAppearance?: string;
  heent?: string;
  cardiovascular?: string;
  respiratory?: string;
  abdominal?: string;
  neurological?: string;
  musculoskeletal?: string;
  skin?: string;
  // evaluación y plan
  assessment?: string;
  plan?: string;
  diagnosis?: string;
  differentialDiagnosis?: string;
  treatmentPlan?: string;
  followUpInstructions?: string;
  patientEducation?: string;
  notes?: string;
  followUpDate?: string;
}
