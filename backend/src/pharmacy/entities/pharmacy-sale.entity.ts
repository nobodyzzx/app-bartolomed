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
}

@Entity('pharmacy_sales')
export class PharmacySale {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column('text', { unique: true })
  saleNumber: string;

  @Column('text')
  patientName: string;

  @Column('text', { nullable: true })
  patientId: string;

  @Column('text', { nullable: true })
  prescriptionNumber: string;

  @Column('text', { nullable: true })
  doctorName: string;

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
  notes: string;

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
  expiryDate: Date;

  @Column('text', { nullable: true })
  instructions: string;

  @CreateDateColumn()
  createdAt: Date;

  @UpdateDateColumn()
  updatedAt: Date;
}
