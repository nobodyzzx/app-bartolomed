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

export enum PurchaseOrderStatus {
  DRAFT = 'draft',
  PENDING = 'pending',
  APPROVED = 'approved',
  SENT = 'sent',
  PARTIALLY_RECEIVED = 'partially_received',
  RECEIVED = 'received',
  DELIVERED = 'delivered',
  CANCELLED = 'cancelled',
}

@Entity('suppliers')
export class Supplier {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column('text', { unique: true })
  code: string;

  @Column('text')
  name: string;

  @Column('text')
  contactPerson: string;

  @Column('text')
  email: string;

  @Column('text', { nullable: true })
  phone: string;

  @Column('text', { nullable: true })
  address: string;

  @Column('text', { nullable: true })
  city: string;

  @Column('text', { nullable: true })
  state: string;

  @Column('text', { nullable: true })
  country: string;

  @Column('text', { nullable: true })
  postalCode: string;

  @Column('text', { nullable: true })
  taxId: string;

  @Column('boolean', { default: true })
  isActive: boolean;

  @Column('text', { nullable: true })
  notes: string;

  @OneToMany(() => PurchaseOrder, order => order.supplier)
  orders: PurchaseOrder[];

  @CreateDateColumn()
  createdAt: Date;

  @UpdateDateColumn()
  updatedAt: Date;
}

@Entity('purchase_orders')
export class PurchaseOrder {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column('text', { unique: true })
  orderNumber: string;

  @ManyToOne(() => Supplier, supplier => supplier.orders)
  @JoinColumn({ name: 'supplier_id' })
  supplier: Supplier;

  @Column('uuid')
  supplierId: string;

  @Column('uuid', { nullable: true })
  clinicId: string;

  @Column('date')
  orderDate: Date;

  @Column('date', { nullable: true })
  expectedDeliveryDate: Date;

  @Column('date', { nullable: true })
  actualDeliveryDate: Date;

  @Column({
    type: 'enum',
    enum: PurchaseOrderStatus,
    default: PurchaseOrderStatus.PENDING,
  })
  status: PurchaseOrderStatus;

  @Column('decimal', { precision: 10, scale: 2, default: 0 })
  subtotal: number;

  @Column('decimal', { precision: 5, scale: 2, default: 0 })
  taxRate: number;

  @Column('decimal', { precision: 10, scale: 2, default: 0 })
  taxAmount: number;

  @Column('decimal', { precision: 10, scale: 2, default: 0 })
  discountAmount: number;

  @Column('decimal', { precision: 10, scale: 2, default: 0 })
  shippingCost: number;

  @Column('decimal', { precision: 10, scale: 2, default: 0 })
  totalAmount: number;

  // Legacy field for backward compatibility
  @Column('decimal', { precision: 10, scale: 2, default: 0 })
  tax: number;

  @Column('decimal', { precision: 10, scale: 2, default: 0 })
  total: number;

  @Column('text', { nullable: true })
  notes: string;

  @ManyToOne(() => User)
  @JoinColumn({ name: 'created_by' })
  createdBy: User;

  @Column('uuid')
  createdById: string;

  @ManyToOne(() => User, { nullable: true })
  @JoinColumn({ name: 'approved_by' })
  approvedBy: User;

  @Column('uuid', { nullable: true })
  approvedById: string;

  @Column('timestamp', { nullable: true })
  approvedAt: Date;

  @OneToMany(() => PurchaseOrderItem, item => item.purchaseOrder, { cascade: true })
  items: PurchaseOrderItem[];

  @CreateDateColumn()
  createdAt: Date;

  @UpdateDateColumn()
  updatedAt: Date;
}

@Entity('purchase_order_items')
export class PurchaseOrderItem {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @ManyToOne(() => PurchaseOrder, order => order.items, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'order_id' })
  purchaseOrder: PurchaseOrder;

  @Column('uuid')
  orderId: string;

  @Column('text')
  productName: string;

  @Column('text', { nullable: true })
  productCode: string;

  @Column('text', { nullable: true })
  medicationId: string;

  @Column('text', { nullable: true })
  medicationName: string;

  @Column('text', { nullable: true })
  brand: string;

  @Column('integer')
  quantity: number;

  @Column('integer', { default: 0 })
  receivedQuantity: number;

  @Column('decimal', { precision: 10, scale: 2 })
  unitPrice: number;

  @Column('decimal', { precision: 10, scale: 2 })
  totalPrice: number;

  // Legacy field for backward compatibility
  @Column('decimal', { precision: 10, scale: 2 })
  subtotal: number;

  @Column('text', { nullable: true })
  notes: string;

  @CreateDateColumn()
  createdAt: Date;

  @UpdateDateColumn()
  updatedAt: Date;
}
