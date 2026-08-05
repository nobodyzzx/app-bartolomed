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

  /**
   * Nullable desde la Fase 2 de facturación: el laboratorio recibe pacientes
   * **derivados de otro consultorio**, que vienen solo por el examen y no
   * tienen ficha en esta clínica. Antes era obligatorio y no había forma de
   * registrarlos. Cuando no hay ficha se usa `patientName`.
   */
  @ManyToOne(() => Patient, { nullable: true })
  @JoinColumn({ name: 'patient_id' })
  patient: Patient | null;

  /** Nombre libre del paciente derivado, cuando no hay ficha. */
  @Column('text', { name: 'patient_name', nullable: true })
  patientName: string | null;

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

  /**
   * Precio del examen tomado del catálogo al crear la orden. Se copia en vez
   * de referenciarse, igual que en `Charge`: si sube la tarifa, lo ya cobrado
   * no cambia.
   */
  @Column('decimal', {
    precision: 10,
    scale: 2,
    name: 'unit_price',
    nullable: true,
    transformer: {
      to: (value: number | null) => value,
      from: (value: string | null) => (value === null ? null : parseFloat(value)),
    },
  })
  unitPrice: number | null;

  /** Servicio del tarifario del que salió el precio, si se encontró. */
  @Column('uuid', { name: 'service_price_id', nullable: true })
  servicePriceId: string | null;

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
