import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  UpdateDateColumn,
  ManyToOne,
  OneToMany,
  JoinColumn,
} from 'typeorm';
import { Patient } from '../../patients/entities/patient.entity';
import { User } from '../../users/entities/user.entity';
import { Clinic } from '../../clinics/entities/clinic.entity';

export enum PrescriptionStatus {
  DRAFT = 'draft',
  ACTIVE = 'active',
  DISPENSED = 'dispensed',
  COMPLETED = 'completed',
  CANCELLED = 'cancelled',
  EXPIRED = 'expired',
}

@Entity('prescriptions')
export class Prescription {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column('text')
  prescriptionNumber: string;

  @Column({
    type: 'enum',
    enum: PrescriptionStatus,
    default: PrescriptionStatus.DRAFT,
  })
  status: PrescriptionStatus;

  @Column('date')
  prescriptionDate: Date;

  @Column('date')
  expiryDate: Date;

  @Column('text', { nullable: true })
  diagnosis: string;

  @Column('text', { nullable: true })
  patientInstructions: string;

  @Column('text', { nullable: true })
  pharmacyInstructions: string;

  @Column('text', { nullable: true })
  notes: string;

  @Column('boolean', { default: false })
  isElectronic: boolean;

  @Column('boolean', { default: false })
  isControlledSubstance: boolean;

  @Column('integer', { default: 0 })
  refillsAllowed: number;

  @Column('integer', { default: 0 })
  refillsUsed: number;

  @Column('boolean', { default: true })
  isActive: boolean;

  @ManyToOne(() => Patient, { eager: true })
  @JoinColumn({ name: 'patient_id' })
  patient: Patient;

  @ManyToOne(() => User, { eager: true })
  @JoinColumn({ name: 'doctor_id' })
  doctor: User;

  @ManyToOne(() => Clinic, { eager: true })
  @JoinColumn({ name: 'clinic_id' })
  clinic: Clinic;

  @OneToMany('PrescriptionItem', 'prescription', { cascade: true })
  items: any[];

  @ManyToOne(() => User, { nullable: true })
  @JoinColumn({ name: 'created_by' })
  createdBy: User;

  @CreateDateColumn()
  createdAt: Date;

  @UpdateDateColumn()
  updatedAt: Date;

  // Helper methods
  isExpired(): boolean {
    return new Date() > new Date(this.expiryDate);
  }

  canBeRefilled(): boolean {
    return this.refillsUsed < this.refillsAllowed && 
           !this.isExpired() && 
           this.status === PrescriptionStatus.ACTIVE;
  }

  getRemainingRefills(): number {
    return Math.max(0, this.refillsAllowed - this.refillsUsed);
  }

  getDaysUntilExpiry(): number {
    const today = new Date();
    const expiry = new Date(this.expiryDate);
    const diffTime = expiry.getTime() - today.getTime();
    return Math.ceil(diffTime / (1000 * 60 * 60 * 24));
  }
}

@Entity('prescription_items')
export class PrescriptionItem {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column('text')
  medicationName: string;

  @Column('text', { nullable: true })
  genericName: string;

  @Column('text')
  strength: string;

  @Column('text')
  dosageForm: string; // tablet, capsule, liquid, etc.

  @Column('text')
  quantity: string;

  @Column('text')
  dosage: string;

  @Column('text')
  frequency: string;

  @Column('text', { nullable: true })
  route: string; // oral, topical, injection, etc.

  @Column('integer', { nullable: true })
  duration: number; // duration in days

  @Column('text', { nullable: true })
  instructions: string;

  @Column('text', { nullable: true })
  indication: string;

  @Column('boolean', { default: false })
  isSubstitutionAllowed: boolean;

  @Column('boolean', { default: false })
  isControlled: boolean;

  @Column('decimal', { precision: 10, scale: 2, nullable: true })
  unitPrice: number;

  @Column('decimal', { precision: 10, scale: 2, nullable: true })
  totalPrice: number;

  @Column('boolean', { default: true })
  isActive: boolean;

  @ManyToOne('Prescription', 'items')
  @JoinColumn({ name: 'prescription_id' })
  prescription: Prescription;

  @CreateDateColumn()
  createdAt: Date;

  @UpdateDateColumn()
  updatedAt: Date;

  // Helper methods
  calculateTotalPrice(): number {
    if (this.unitPrice) {
      const qty = parseFloat(this.quantity) || 1;
      return this.unitPrice * qty;
    }
    return 0;
  }
}
