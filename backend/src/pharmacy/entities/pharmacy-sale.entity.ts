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

  /**
   * Por qué se rebajó el precio y quién lo autorizó. Existen en `charges` desde
   * el punto de cobro, pero la venta de farmacia solo guardaba el número: se
   * podía descontar cualquier importe sin dejar rastro de la razón, que es
   * justo lo que se necesita para revisar un descuento indebido después.
   */
  @Column('text', { name: 'discount_reason', nullable: true })
  discountReason: string | null;

  @ManyToOne(() => User, { nullable: true, onDelete: 'SET NULL' })
  @JoinColumn({ name: 'discount_authorized_by' })
  discountAuthorizedBy: User | null;

  @Column('uuid', { name: 'discount_authorized_by', nullable: true })
  discountAuthorizedById: string | null;

  @Column('decimal', { precision: 10, scale: 2, default: 0 })
  tax: number;

  // Bug real (auditoría de interrelación de módulos, 2026-08-04): la tasa
  // usada en create() no se persistía en ningún lado, así que update() —
  // que recalcula subtotal/impuesto/total al editar los ítems de una venta —
  // no tenía forma de conocerla y usaba 0.13 hardcodeado, ignorando ventas
  // creadas con una tasa distinta (ej. exentas, taxRate: 0).
  @Column('decimal', { precision: 5, scale: 4, default: 0.13 })
  taxRate: number;

  @Column('decimal', { precision: 10, scale: 2 })
  total: number;

  @Column('decimal', { precision: 10, scale: 2, nullable: true })
  amountPaid: number;

  @Column('decimal', { precision: 10, scale: 2, nullable: true })
  change: number;

  /**
   * La venta no se cobró en farmacia: quedó como cargo en la cuenta del
   * paciente y se cobra en el punto de cobro junto con la consulta y los
   * exámenes. Se guarda para que los reportes de caja de farmacia no cuenten
   * como ingreso propio algo que cobra la caja general.
   */
  @Column('boolean', { name: 'charged_to_account', default: false })
  chargedToAccount: boolean;

  @Column('text', { nullable: true })
  notes: string | undefined;

  /**
   * Rastro de la cancelación — mismo criterio que `Invoice.voidReason`:
   * cancelar revierte stock, cargo a cuenta y receta dispensada, y el motivo
   * estructurado es lo único que queda para revisarlo después (antes se
   * mezclaba, si acaso, en el campo libre `notes`).
   */
  @Column('text', { name: 'cancel_reason', nullable: true })
  cancelReason: string | null;

  @Column('timestamp', { name: 'cancelled_at', nullable: true })
  cancelledAt: Date | null;

  @ManyToOne(() => User, { nullable: true, onDelete: 'SET NULL' })
  @JoinColumn({ name: 'cancelled_by' })
  cancelledBy: User | null;

  @Column('uuid', { name: 'cancelled_by', nullable: true })
  cancelledById: string | null;

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

  /** Motivo del descuento de esta línea; obligatorio si el descuento es > 0. */
  @Column('text', { name: 'discount_reason', nullable: true })
  discountReason: string | null;

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
