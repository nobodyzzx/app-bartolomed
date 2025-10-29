import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  UpdateDateColumn,
  ManyToOne,
  JoinColumn,
} from 'typeorm';
import { Patient } from '../../patients/entities/patient.entity';
import { User } from '../../users/entities/user.entity';

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

@Entity('medical_records')
export class MedicalRecord {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({
    type: 'enum',
    enum: RecordType,
    default: RecordType.CONSULTATION,
  })
  type: RecordType;

  @Column({
    type: 'enum',
    enum: RecordStatus,
    default: RecordStatus.DRAFT,
  })
  status: RecordStatus;

  @Column('text')
  chiefComplaint: string;

  @Column('text', { nullable: true })
  historyOfPresentIllness: string;

  @Column('text', { nullable: true })
  pastMedicalHistory: string;

  @Column('text', { nullable: true })
  medications: string;

  @Column('text', { nullable: true })
  allergies: string;

  @Column('text', { nullable: true })
  socialHistory: string;

  @Column('text', { nullable: true })
  familyHistory: string;

  @Column('text', { nullable: true })
  reviewOfSystems: string;

  // Signos vitales
  @Column('decimal', { precision: 5, scale: 2, nullable: true })
  temperature: number;

  @Column('integer', { nullable: true })
  systolicBP: number;

  @Column('integer', { nullable: true })
  diastolicBP: number;

  @Column('integer', { nullable: true })
  heartRate: number;

  @Column('integer', { nullable: true })
  respiratoryRate: number;

  @Column('decimal', { precision: 5, scale: 2, nullable: true })
  oxygenSaturation: number;

  @Column('decimal', { precision: 5, scale: 2, nullable: true })
  weight: number;

  @Column('decimal', { precision: 5, scale: 2, nullable: true })
  height: number;

  @Column('decimal', { precision: 5, scale: 2, nullable: true })
  bmi: number;

  // Examen físico
  @Column('text', { nullable: true })
  physicalExamination: string;

  @Column('text', { nullable: true })
  generalAppearance: string;

  @Column('text', { nullable: true })
  heent: string; // Head, Eyes, Ears, Nose, Throat

  @Column('text', { nullable: true })
  cardiovascular: string;

  @Column('text', { nullable: true })
  respiratory: string;

  @Column('text', { nullable: true })
  abdominal: string;

  @Column('text', { nullable: true })
  neurological: string;

  @Column('text', { nullable: true })
  musculoskeletal: string;

  @Column('text', { nullable: true })
  skin: string;

  // Evaluación y Plan
  @Column('text', { nullable: true })
  assessment: string;

  @Column('text', { nullable: true })
  plan: string;

  @Column('text', { nullable: true })
  diagnosis: string;

  @Column('text', { nullable: true })
  differentialDiagnosis: string;

  @Column('text', { nullable: true })
  treatmentPlan: string;

  @Column('text', { nullable: true })
  followUpInstructions: string;

  @Column('text', { nullable: true })
  patientEducation: string;

  @Column('text', { nullable: true })
  notes: string;

  @Column('date', { nullable: true })
  followUpDate: Date;

  @Column('boolean', { default: false })
  isEmergency: boolean;

  @Column('boolean', { default: true })
  isActive: boolean;

  @ManyToOne(() => Patient, { eager: true })
  @JoinColumn({ name: 'patient_id' })
  patient: Patient;

  @ManyToOne(() => User, { eager: true })
  @JoinColumn({ name: 'doctor_id' })
  doctor: User;

  @ManyToOne(() => User, { nullable: true })
  @JoinColumn({ name: 'created_by' })
  createdBy: User;

  @CreateDateColumn()
  createdAt: Date;

  @UpdateDateColumn()
  updatedAt: Date;

  // Helper method para calcular BMI automáticamente
  calculateBMI(): number {
    if (this.weight && this.height) {
      const heightInMeters = this.height / 100;
      return this.weight / (heightInMeters * heightInMeters);
    }
    return null;
  }
}
