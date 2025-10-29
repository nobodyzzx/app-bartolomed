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
import { MedicalRecord } from './medical-record.entity';

export enum ConsentType {
  TREATMENT = 'treatment',
  SURGERY = 'surgery',
  ANESTHESIA = 'anesthesia',
  BLOOD_TRANSFUSION = 'blood_transfusion',
  IMAGING = 'imaging',
  LABORATORY = 'laboratory',
  DISCHARGE = 'discharge',
  GENERAL = 'general',
  OTHER = 'other',
}

export enum ConsentStatus {
  PENDING = 'pending',
  SIGNED = 'signed',
  DECLINED = 'declined',
  EXPIRED = 'expired',
  CANCELLED = 'cancelled',
}

@Entity('consent_forms')
export class ConsentForm {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({
    type: 'enum',
    enum: ConsentType,
    default: ConsentType.GENERAL,
  })
  type: ConsentType;

  @Column({
    type: 'enum',
    enum: ConsentStatus,
    default: ConsentStatus.PENDING,
  })
  status: ConsentStatus;

  @Column('varchar', { length: 255 })
  title: string;

  @Column('text')
  description: string;

  @Column('text', { nullable: true })
  content: string;

  @Column('text', { nullable: true })
  risksBenefits: string;

  @Column('text', { nullable: true })
  alternatives: string;

  @Column('varchar', { length: 500, nullable: true })
  signedDocumentPath: string;

  @Column('varchar', { length: 255, nullable: true })
  signedDocumentName: string;

  @Column('varchar', { length: 50, nullable: true })
  signedDocumentMimeType: string;

  @Column('integer', { nullable: true })
  signedDocumentSize: number;

  @Column('timestamp', { nullable: true })
  signedAt: Date;

  @Column('timestamp', { nullable: true })
  expiresAt: Date;

  @Column('varchar', { length: 255, nullable: true })
  witnessName: string;

  @Column('varchar', { length: 255, nullable: true })
  witnessRelationship: string;

  @Column('boolean', { default: true })
  isActive: boolean;

  @Column('text', { nullable: true })
  notes: string;

  @ManyToOne(() => Patient, { eager: true })
  @JoinColumn({ name: 'patient_id' })
  patient: Patient;

  @ManyToOne(() => User, { eager: true })
  @JoinColumn({ name: 'doctor_id' })
  doctor: User;

  @ManyToOne(() => MedicalRecord, { nullable: true })
  @JoinColumn({ name: 'medical_record_id' })
  medicalRecord: MedicalRecord;

  @ManyToOne(() => User)
  @JoinColumn({ name: 'created_by' })
  createdBy: User;

  @CreateDateColumn()
  createdAt: Date;

  @UpdateDateColumn()
  updatedAt: Date;

  // Helper method para verificar si el consentimiento está vigente
  isValid(): boolean {
    if (this.status !== ConsentStatus.SIGNED) {
      return false;
    }

    if (this.expiresAt && new Date() > this.expiresAt) {
      return false;
    }

    return this.isActive;
  }

  // Helper method para verificar si el consentimiento está expirado
  isExpired(): boolean {
    return this.expiresAt && new Date() > this.expiresAt;
  }
}
