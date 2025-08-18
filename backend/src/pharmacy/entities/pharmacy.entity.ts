import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  UpdateDateColumn,
  ManyToOne,
  OneToMany,
  JoinColumn,
  BeforeInsert,
  BeforeUpdate,
} from 'typeorm';
import { User } from '../../users/entities/user.entity';
import { Clinic } from '../../clinics/entities/clinic.entity';

export enum MedicationCategory {
  ANALGESIC = 'analgesic',
  ANTIBIOTIC = 'antibiotic',
  ANTIVIRAL = 'antiviral',
  ANTIHISTAMINE = 'antihistamine',
  CARDIOVASCULAR = 'cardiovascular',
  GASTROINTESTINAL = 'gastrointestinal',
  RESPIRATORY = 'respiratory',
  NEUROLOGICAL = 'neurological',
  DERMATOLOGICAL = 'dermatological',
  ENDOCRINE = 'endocrine',
  VACCINE = 'vaccine',
  SUPPLEMENT = 'supplement',
  CONTROLLED = 'controlled',
  OTHER = 'other',
}

export enum StorageCondition {
  ROOM_TEMPERATURE = 'room_temperature',
  REFRIGERATED = 'refrigerated',
  FROZEN = 'frozen',
  CONTROLLED_TEMPERATURE = 'controlled_temperature',
  DRY_PLACE = 'dry_place',
  LIGHT_PROTECTED = 'light_protected',
}

@Entity('medications')
export class Medication {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column('text', { unique: true })
  code: string;

  @Column('text')
  name: string;

  @Column('text', { nullable: true })
  genericName: string;

  @Column('text', { nullable: true })
  brandName: string;

  @Column('text')
  strength: string;

  @Column('text')
  dosageForm: string; // tablet, capsule, liquid, injection, etc.

  @Column({
    type: 'enum',
    enum: MedicationCategory,
  })
  category: MedicationCategory;

  @Column('text', { nullable: true })
  manufacturer: string;

  @Column('text', { nullable: true })
  supplier: string;

  @Column('text', { nullable: true })
  description: string;

  @Column('text', { nullable: true })
  activeIngredients: string;

  @Column('text', { nullable: true })
  indications: string;

  @Column('text', { nullable: true })
  contraindications: string;

  @Column('text', { nullable: true })
  sideEffects: string;

  @Column('text', { nullable: true })
  dosageInstructions: string;

  @Column({
    type: 'enum',
    enum: StorageCondition,
    default: StorageCondition.ROOM_TEMPERATURE,
  })
  storageCondition: StorageCondition;

  @Column('boolean', { default: false })
  requiresPrescription: boolean;

  @Column('boolean', { default: false })
  isControlledSubstance: boolean;

  @Column('text', { nullable: true })
  controlledSubstanceSchedule: string;

  @Column('boolean', { default: true })
  isActive: boolean;

  @OneToMany('MedicationStock', 'medication')
  stock: any[];

  @CreateDateColumn()
  createdAt: Date;

  @UpdateDateColumn()
  updatedAt: Date;
}

@Entity('medication_stock')
export class MedicationStock {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column('text', { unique: true })
  batchNumber: string;

  @Column('integer')
  quantity: number;

  @Column('integer', { default: 0 })
  reservedQuantity: number;

  @Column('integer', { default: 0 })
  availableQuantity: number;

  @Column('decimal', { precision: 10, scale: 2 })
  unitCost: number;

  @Column('decimal', { precision: 10, scale: 2 })
  sellingPrice: number;

  @Column('date')
  expiryDate: Date;

  @Column('date')
  receivedDate: Date;

  @Column('text', { nullable: true })
  supplierBatch: string;

  @Column('text', { nullable: true })
  location: string; // shelf, cabinet, refrigerator, etc.

  @Column('integer', { default: 10 })
  minimumStock: number;

  @Column('boolean', { default: true })
  isActive: boolean;

  // Relaciones
  @ManyToOne('Medication', 'stock', { eager: true })
  @JoinColumn({ name: 'medication_id' })
  medication: Medication;

  @ManyToOne(() => Clinic, { eager: true })
  @JoinColumn({ name: 'clinic_id' })
  clinic: Clinic;

  @OneToMany('StockMovement', 'stock')
  movements: any[];

  @ManyToOne(() => User, { nullable: true })
  @JoinColumn({ name: 'received_by' })
  receivedBy: User;

  @CreateDateColumn()
  createdAt: Date;

  @UpdateDateColumn()
  updatedAt: Date;

  // Helper methods
  isExpired(): boolean {
    return new Date() > new Date(this.expiryDate);
  }

  isExpiringSoon(days: number = 30): boolean {
    const today = new Date();
    const expiryDate = new Date(this.expiryDate);
    const diffTime = expiryDate.getTime() - today.getTime();
    const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
    return diffDays <= days && diffDays > 0;
  }

  isLowStock(): boolean {
    return this.availableQuantity <= this.minimumStock;
  }

  getDaysUntilExpiry(): number {
    const today = new Date();
    const expiryDate = new Date(this.expiryDate);
    const diffTime = expiryDate.getTime() - today.getTime();
    return Math.ceil(diffTime / (1000 * 60 * 60 * 24));
  }

  @BeforeInsert()
  @BeforeUpdate()
  calculateAvailableQuantity() {
    this.availableQuantity = this.quantity - this.reservedQuantity;
  }
}

export enum MovementType {
  PURCHASE = 'purchase',
  SALE = 'sale',
  ADJUSTMENT = 'adjustment',
  EXPIRY = 'expiry',
  DAMAGE = 'damage',
  TRANSFER = 'transfer',
  RETURN = 'return',
}

@Entity('stock_movements')
export class StockMovement {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({
    type: 'enum',
    enum: MovementType,
  })
  type: MovementType;

  @Column('integer')
  quantity: number;

  @Column('decimal', { precision: 10, scale: 2, nullable: true })
  unitPrice: number;

  @Column('decimal', { precision: 10, scale: 2, nullable: true })
  totalAmount: number;

  @Column('text', { nullable: true })
  reference: string; // Invoice number, prescription number, etc.

  @Column('text', { nullable: true })
  reason: string;

  @Column('text', { nullable: true })
  notes: string;

  @Column('timestamp with time zone')
  movementDate: Date;

  @Column('boolean', { default: true })
  isActive: boolean;

  // Relaciones
  @ManyToOne('MedicationStock', 'movements', { eager: true })
  @JoinColumn({ name: 'stock_id' })
  stock: MedicationStock;

  @ManyToOne(() => User, { nullable: true })
  @JoinColumn({ name: 'processed_by' })
  processedBy: User;

  @CreateDateColumn()
  createdAt: Date;

  @UpdateDateColumn()
  updatedAt: Date;

  @BeforeInsert()
  @BeforeUpdate()
  calculateTotalAmount() {
    if (this.unitPrice) {
      this.totalAmount = this.quantity * this.unitPrice;
    }
  }
}

@Entity('suppliers')
export class Supplier {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column('text', { unique: true })
  code: string;

  @Column('text')
  name: string;

  @Column('text', { nullable: true })
  contactPerson: string;

  @Column('text', { nullable: true })
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
  zipCode: string;

  @Column('text', { nullable: true })
  country: string;

  @Column('text', { nullable: true })
  taxId: string;

  @Column('text', { nullable: true })
  notes: string;

  @Column('boolean', { default: true })
  isActive: boolean;

  @OneToMany('PurchaseOrder', 'supplier')
  purchaseOrders: any[];

  @CreateDateColumn()
  createdAt: Date;

  @UpdateDateColumn()
  updatedAt: Date;
}

export enum OrderStatus {
  DRAFT = 'draft',
  PENDING = 'pending',
  APPROVED = 'approved',
  SENT = 'sent',
  RECEIVED = 'received',
  CANCELLED = 'cancelled',
}

@Entity('purchase_orders')
export class PurchaseOrder {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column('text', { unique: true })
  orderNumber: string;

  @Column({
    type: 'enum',
    enum: OrderStatus,
    default: OrderStatus.DRAFT,
  })
  status: OrderStatus;

  @Column('date')
  orderDate: Date;

  @Column('date', { nullable: true })
  expectedDeliveryDate: Date;

  @Column('date', { nullable: true })
  receivedDate: Date;

  @Column('decimal', { precision: 12, scale: 2 })
  totalAmount: number;

  @Column('text', { nullable: true })
  notes: string;

  @Column('boolean', { default: true })
  isActive: boolean;

  // Relaciones
  @ManyToOne('Supplier', 'purchaseOrders', { eager: true })
  @JoinColumn({ name: 'supplier_id' })
  supplier: Supplier;

  @ManyToOne(() => Clinic, { eager: true })
  @JoinColumn({ name: 'clinic_id' })
  clinic: Clinic;

  @OneToMany('PurchaseOrderItem', 'purchaseOrder', { cascade: true })
  items: any[];

  @ManyToOne(() => User, { nullable: true })
  @JoinColumn({ name: 'created_by' })
  createdBy: User;

  @ManyToOne(() => User, { nullable: true })
  @JoinColumn({ name: 'approved_by' })
  approvedBy: User;

  @CreateDateColumn()
  createdAt: Date;

  @UpdateDateColumn()
  updatedAt: Date;
}

@Entity('purchase_order_items')
export class PurchaseOrderItem {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column('integer')
  quantity: number;

  @Column('decimal', { precision: 10, scale: 2 })
  unitPrice: number;

  @Column('decimal', { precision: 10, scale: 2 })
  totalPrice: number;

  @Column('text', { nullable: true })
  notes: string;

  @Column('boolean', { default: true })
  isActive: boolean;

  // Relaciones
  @ManyToOne('PurchaseOrder', 'items')
  @JoinColumn({ name: 'purchase_order_id' })
  purchaseOrder: PurchaseOrder;

  @ManyToOne('Medication', { eager: true })
  @JoinColumn({ name: 'medication_id' })
  medication: Medication;

  @CreateDateColumn()
  createdAt: Date;

  @UpdateDateColumn()
  updatedAt: Date;

  @BeforeInsert()
  @BeforeUpdate()
  calculateTotalPrice() {
    this.totalPrice = this.quantity * this.unitPrice;
  }
}
