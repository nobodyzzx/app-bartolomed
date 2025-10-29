import {
  Column,
  CreateDateColumn,
  Entity,
  JoinColumn,
  ManyToOne,
  OneToMany,
  PrimaryGeneratedColumn,
  UpdateDateColumn,
} from 'typeorm';
import { Clinic } from '../../clinics/entities/clinic.entity';
import { Patient } from '../../patients/entities/patient.entity';
import { User } from '../../users/entities/user.entity';

export enum SaleStatus {
  PENDING = 'pending',
  COMPLETED = 'completed',
  CANCELLED = 'cancelled',
  REFUNDED = 'refunded',
}

export enum PaymentMethod {
  CASH = 'cash',
  CREDIT_CARD = 'credit_card',
  DEBIT_CARD = 'debit_card',
  TRANSFER = 'transfer',
  CHECK = 'check',
}

@Entity('pharmacy_sales')
export class PharmacySale {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column('text', { unique: true })
  saleNumber: string;

  @Column('timestamp', { default: () => 'CURRENT_TIMESTAMP' })
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
    default: PaymentMethod.CASH,
  })
  paymentMethod: PaymentMethod;

  @Column('decimal', { precision: 10, scale: 2, default: 0 })
  subtotal: number;

  @Column('decimal', { precision: 5, scale: 2, default: 0 })
  taxRate: number;

  @Column('decimal', { precision: 10, scale: 2, default: 0 })
  taxAmount: number;

  @Column('decimal', { precision: 10, scale: 2, default: 0 })
  discountAmount: number;

  @Column('decimal', { precision: 10, scale: 2, default: 0 })
  totalAmount: number;

  @Column('decimal', { precision: 10, scale: 2, default: 0 })
  amountPaid: number;

  @Column('decimal', { precision: 10, scale: 2, default: 0 })
  changeAmount: number;

  @Column('text', { nullable: true })
  notes: string;

  @Column('text', { nullable: true })
  prescriptionNumber: string;

  @ManyToOne(() => Patient, { nullable: true, eager: true })
  @JoinColumn({ name: 'patient_id' })
  patient: Patient;

  @ManyToOne(() => Clinic)
  @JoinColumn({ name: 'clinic_id' })
  clinic: Clinic;

  @ManyToOne(() => User)
  @JoinColumn({ name: 'sold_by' })
  soldBy: User;

  @OneToMany('PharmacySaleItem', 'sale', { cascade: true })
  items: any[];

  @CreateDateColumn()
  createdAt: Date;

  @UpdateDateColumn()
  updatedAt: Date;
}

@Entity('pharmacy_sale_items')
export class PharmacySaleItem {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column('integer')
  quantity: number;

  @Column('decimal', { precision: 10, scale: 2 })
  unitPrice: number;

  @Column('decimal', { precision: 10, scale: 2 })
  totalPrice: number;

  @Column('decimal', { precision: 5, scale: 2, default: 0 })
  discountPercent: number;

  @Column('decimal', { precision: 10, scale: 2, default: 0 })
  discountAmount: number;

  @Column('text', { nullable: true })
  batchNumber: string;

  @Column('date', { nullable: true })
  expiryDate: Date;

  @ManyToOne('PharmacySale', 'items')
  @JoinColumn({ name: 'sale_id' })
  sale: PharmacySale;

  @ManyToOne('MedicationStock', { eager: true })
  @JoinColumn({ name: 'medication_stock_id' })
  medicationStock: any;

  @CreateDateColumn()
  createdAt: Date;

  @UpdateDateColumn()
  updatedAt: Date;
}
