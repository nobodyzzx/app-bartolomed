import {
  Column,
  CreateDateColumn,
  Entity,
  Index,
  JoinColumn,
  ManyToOne,
  OneToMany,
  PrimaryGeneratedColumn,
  UpdateDateColumn,
} from 'typeorm';
import { Clinic } from '../../clinics/entities/clinic.entity';
import { Patient } from '../../patients/entities/patient.entity';
import { Prescription } from '../../prescriptions/entities/prescription.entity';
import { MedicationStock } from './pharmacy.entity';
import { User } from '../../users/entities/user.entity';

export enum SaleStatus {
  PENDING = 'pending',
  COMPLETED = 'completed',
  CANCELLED = 'cancelled',
}

export enum PaymentMethod {
  CASH = 'cash',
  CARD = 'card',
  TRANSFER = 'transfer',
  INSURANCE = 'insurance',
  MIXED = 'mixed',
  QR = 'qr',
}

@Entity('pharmacy_sales')
@Index(['clinic', 'createdAt'])
export class PharmacySale {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column('text', { unique: true })
  saleNumber: string;

  @Column('text')
  patientName: string;

  @Index()
  @ManyToOne(() => Clinic, { nullable: true, eager: false })
  @JoinColumn({ name: 'clinic_id' })
  clinic: Clinic;

  @Column({ name: 'clinic_id', nullable: true })
  clinicId: string | undefined;

  @ManyToOne(() => Patient, { nullable: true, eager: false })
  @JoinColumn({ name: 'patient_id' })
  patient: Patient | undefined;

  @Column({ name: 'patient_id', nullable: true })
  patientId: string | undefined;

  @ManyToOne(() => Prescription, { nullable: true, eager: false })
  @JoinColumn({ name: 'prescription_id' })
  prescription: Prescription | undefined;

  @Column({ name: 'prescription_id', nullable: true })
  prescriptionId: string | undefined;

  @Column('text', { nullable: true })
  prescriptionNumber: string | undefined;

  @Column('text', { nullable: true })
  doctorName: string | undefined;

  @Column('timestamp')
  saleDate: Date;

  @Column({
    type: 'enum',
    enum: SaleStatus,
    default: SaleStatus.PENDING,
  })
  status: SaleStatus;

  @Column({
    type: 'enum',
    enum: PaymentMethod,
  })
  paymentMethod: PaymentMethod;

  @Column('decimal', { precision: 10, scale: 2 })
  subtotal: number;

  @Column('decimal', { precision: 10, scale: 2, default: 0 })
  discount: number;

  @Column('decimal', { precision: 10, scale: 2, default: 0 })
  tax: number;

  @Column('decimal', { precision: 10, scale: 2 })
  total: number;

  @Column('decimal', { precision: 10, scale: 2, nullable: true })
  amountPaid: number;

  @Column('decimal', { precision: 10, scale: 2, nullable: true })
  change: number;

  @Column('text', { nullable: true })
  notes: string | undefined;

  @ManyToOne(() => User)
  @JoinColumn({ name: 'sold_by' })
  soldBy: User;

  @Column('uuid')
  soldById: string;

  @OneToMany(() => PharmacySaleItem, item => item.sale, { cascade: true })
  items: PharmacySaleItem[];

  @CreateDateColumn()
  createdAt: Date;

  @UpdateDateColumn()
  updatedAt: Date;
}

@Entity('pharmacy_sale_items')
export class PharmacySaleItem {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @ManyToOne(() => PharmacySale, sale => sale.items, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'sale_id' })
  sale: PharmacySale;

  @Column('uuid')
  saleId: string;

  @ManyToOne(() => MedicationStock, { nullable: true, eager: false })
  @JoinColumn({ name: 'medication_stock_id' })
  medicationStock: MedicationStock;

  @Column('uuid', { nullable: true })
  medicationStockId: string;

  @Column('text')
  productName: string;

  @Column('text', { nullable: true })
  productCode: string;

  @Column('text', { nullable: true })
  brand: string;

  @Column('text', { nullable: true })
  batchNumber: string;

  @Column('integer')
  quantity: number;

  @Column('decimal', { precision: 10, scale: 2 })
  unitPrice: number;

  @Column('decimal', { precision: 10, scale: 2, default: 0 })
  discount: number;

  @Column('decimal', { precision: 10, scale: 2 })
  subtotal: number;

  @Column('date', { nullable: true })
  expiryDate: Date | undefined;

  @Column('text', { nullable: true })
  instructions: string | undefined;

  @CreateDateColumn()
  createdAt: Date;

  @UpdateDateColumn()
  updatedAt: Date;
}
