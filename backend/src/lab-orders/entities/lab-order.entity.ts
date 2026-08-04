import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  DeleteDateColumn,
  UpdateDateColumn,
  Index,
  ManyToOne,
  OneToMany,
  JoinColumn,
} from 'typeorm';
import { Patient } from '../../patients/entities/patient.entity';
import { User } from '../../users/entities/user.entity';
import { Clinic } from '../../clinics/entities/clinic.entity';
import { MedicalRecord } from '../../medical-records/entities/medical-record.entity';

export enum LabOrderStatus {
  REQUESTED = 'requested',
  SAMPLE_COLLECTED = 'sample_collected',
  IN_PROGRESS = 'in_progress',
  COMPLETED = 'completed',
  CANCELLED = 'cancelled',
}

export enum LabTestCategory {
  BLOOD = 'blood',
  IMAGING = 'imaging',
  OTHER = 'other',
}

@Entity('lab_orders')
@Index(['clinic', 'createdAt'])
export class LabOrder {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column('text')
  orderNumber: string;

  @Column({
    type: 'enum',
    enum: LabOrderStatus,
    default: LabOrderStatus.REQUESTED,
  })
  status: LabOrderStatus;

  @Column('date')
  orderDate: Date;

  @Column('text', { nullable: true })
  clinicalNotes: string;

  @Column('boolean', { default: false })
  isUrgent: boolean;

  @ManyToOne(() => Patient)
  @JoinColumn({ name: 'patient_id' })
  patient: Patient;

  @ManyToOne(() => User)
  @JoinColumn({ name: 'doctor_id' })
  doctor: User;

  @Index()
  @ManyToOne(() => Clinic)
  @JoinColumn({ name: 'clinic_id' })
  clinic: Clinic;

  // Vínculo opcional a la consulta que originó la orden — no obligatorio,
  // sigue el mismo patrón unidireccional que MedicalRecord.relatedRecord.
  @ManyToOne(() => MedicalRecord, { nullable: true })
  @JoinColumn({ name: 'medical_record_id' })
  medicalRecord: MedicalRecord;

  @OneToMany('LabOrderItem', 'order', { cascade: true })
  items: any[];

  @ManyToOne(() => User, { nullable: true })
  @JoinColumn({ name: 'created_by' })
  createdBy: User;

  @CreateDateColumn()
  createdAt: Date;

  @UpdateDateColumn()
  updatedAt: Date;

  @DeleteDateColumn({ nullable: true })
  deletedAt?: Date;

  // Helper methods
  isCompleted(): boolean {
    return this.status === LabOrderStatus.COMPLETED;
  }

  canCancel(): boolean {
    return this.status !== LabOrderStatus.COMPLETED && this.status !== LabOrderStatus.CANCELLED;
  }
}

@Entity('lab_order_items')
export class LabOrderItem {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column('text')
  testName: string;

  @Column({
    type: 'enum',
    enum: LabTestCategory,
    default: LabTestCategory.OTHER,
  })
  category: LabTestCategory;

  @Column('text', { nullable: true })
  specimenType: string;

  @Column('text', { nullable: true })
  resultValue: string;

  @Column('text', { nullable: true })
  resultUnit: string;

  @Column('text', { nullable: true })
  referenceRange: string;

  @Column('boolean', { default: false })
  isAbnormal: boolean;

  @Column('text', { nullable: true })
  resultNotes: string;

  @Column('text', { nullable: true })
  resultFileUrl: string;

  @Column('timestamptz', { nullable: true })
  collectedAt: Date;

  @Column('timestamptz', { nullable: true })
  resultedAt: Date;

  @ManyToOne(() => User, { nullable: true })
  @JoinColumn({ name: 'entered_by' })
  enteredBy: User;

  @Column('timestamptz', { nullable: true })
  validatedAt: Date;

  @ManyToOne(() => User, { nullable: true })
  @JoinColumn({ name: 'validated_by' })
  validatedBy: User;

  @ManyToOne('LabOrder', 'items')
  @JoinColumn({ name: 'order_id' })
  order: LabOrder;

  @CreateDateColumn()
  createdAt: Date;

  @UpdateDateColumn()
  updatedAt: Date;

  // Helper methods
  hasResult(): boolean {
    return !!this.resultedAt;
  }
}
