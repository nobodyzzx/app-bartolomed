import {
  Column,
  CreateDateColumn,
  Entity,
  JoinColumn,
  ManyToOne,
  PrimaryGeneratedColumn,
  UpdateDateColumn,
} from 'typeorm';
import { User } from '../../users/entities/user.entity';
import { PharmacySale } from './pharmacy-sale.entity';

export enum InvoiceStatus {
  PENDING = 'pending',
  PAID = 'paid',
  OVERDUE = 'overdue',
  CANCELLED = 'cancelled',
}

@Entity('pharmacy_invoices')
export class PharmacyInvoice {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column('text', { unique: true })
  invoiceNumber: string;

  @ManyToOne(() => PharmacySale)
  @JoinColumn({ name: 'sale_id' })
  sale: PharmacySale;

  @Column('uuid')
  saleId: string;

  @Column('text')
  patientName: string;

  @Column('text', { nullable: true })
  patientAddress: string;

  @Column('text', { nullable: true })
  patientPhone: string;

  @Column('text', { nullable: true })
  patientEmail: string;

  @Column('text', { nullable: true })
  taxId: string;

  @Column('date')
  invoiceDate: Date;

  @Column('date')
  dueDate: Date;

  @Column({
    type: 'enum',
    enum: InvoiceStatus,
    default: InvoiceStatus.PENDING,
  })
  status: InvoiceStatus;

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
  balance: number;

  @Column('date', { nullable: true })
  paymentDate: Date;

  @Column('text', { nullable: true })
  paymentMethod: string;

  @Column('text', { nullable: true })
  paymentReference: string;

  @Column('text', { nullable: true })
  notes: string;

  @ManyToOne(() => User)
  @JoinColumn({ name: 'created_by' })
  createdBy: User;

  @Column('uuid')
  createdById: string;

  @CreateDateColumn()
  createdAt: Date;

  @UpdateDateColumn()
  updatedAt: Date;
}
