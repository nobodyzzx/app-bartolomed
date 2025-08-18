import { IsEnum, IsOptional, IsString, IsUUID, IsNumber, IsDateString, IsBoolean, Min, Max } from 'class-validator';
import { RecordType, RecordStatus } from '../entities/medical-record.entity';

export class CreateMedicalRecordDto {
  @IsEnum(RecordType)
  type: RecordType;

  @IsString()
  chiefComplaint: string;

  @IsOptional()
  @IsString()
  historyOfPresentIllness?: string;

  @IsOptional()
  @IsString()
  pastMedicalHistory?: string;

  @IsOptional()
  @IsString()
  medications?: string;

  @IsOptional()
  @IsString()
  allergies?: string;

  @IsOptional()
  @IsString()
  socialHistory?: string;

  @IsOptional()
  @IsString()
  familyHistory?: string;

  @IsOptional()
  @IsString()
  reviewOfSystems?: string;

  // Signos vitales
  @IsOptional()
  @IsNumber()
  @Min(30)
  @Max(45)
  temperature?: number;

  @IsOptional()
  @IsNumber()
  @Min(60)
  @Max(250)
  systolicBP?: number;

  @IsOptional()
  @IsNumber()
  @Min(40)
  @Max(150)
  diastolicBP?: number;

  @IsOptional()
  @IsNumber()
  @Min(30)
  @Max(200)
  heartRate?: number;

  @IsOptional()
  @IsNumber()
  @Min(8)
  @Max(40)
  respiratoryRate?: number;

  @IsOptional()
  @IsNumber()
  @Min(80)
  @Max(100)
  oxygenSaturation?: number;

  @IsOptional()
  @IsNumber()
  @Min(0)
  weight?: number;

  @IsOptional()
  @IsNumber()
  @Min(0)
  height?: number;

  // Examen físico
  @IsOptional()
  @IsString()
  physicalExamination?: string;

  @IsOptional()
  @IsString()
  generalAppearance?: string;

  @IsOptional()
  @IsString()
  heent?: string;

  @IsOptional()
  @IsString()
  cardiovascular?: string;

  @IsOptional()
  @IsString()
  respiratory?: string;

  @IsOptional()
  @IsString()
  abdominal?: string;

  @IsOptional()
  @IsString()
  neurological?: string;

  @IsOptional()
  @IsString()
  musculoskeletal?: string;

  @IsOptional()
  @IsString()
  skin?: string;

  // Evaluación y Plan
  @IsOptional()
  @IsString()
  assessment?: string;

  @IsOptional()
  @IsString()
  plan?: string;

  @IsOptional()
  @IsString()
  diagnosis?: string;

  @IsOptional()
  @IsString()
  differentialDiagnosis?: string;

  @IsOptional()
  @IsString()
  treatmentPlan?: string;

  @IsOptional()
  @IsString()
  followUpInstructions?: string;

  @IsOptional()
  @IsString()
  patientEducation?: string;

  @IsOptional()
  @IsString()
  notes?: string;

  @IsOptional()
  @IsDateString()
  followUpDate?: string;

  @IsOptional()
  @IsBoolean()
  isEmergency?: boolean;

  @IsUUID()
  patientId: string;

  @IsUUID()
  doctorId: string;
}
