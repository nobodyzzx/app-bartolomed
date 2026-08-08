import {
  BeforeInsert,
  BeforeUpdate,
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
import { User } from '../../users/entities/user.entity';

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

  /**
   * El producto llega a la clínica como muestra médica del laboratorio, no
   * comprado a un proveedor.
   *
   * Es una etiqueta informativa, no un candado: en esta clínica las muestras
   * se venden igual (el inventario de muestras lleva su propia columna de
   * "vendidos"), así que marcarla no bloquea nada. Sirve para saber de dónde
   * salió el stock y no confundir su margen con el de lo comprado.
   *
   * Va aquí para los productos que **solo** llegan por esa vía. Cuando el
   * mismo producto entra por las dos, la marca que manda es la del lote
   * (`MedicationStock.isMedicalSample`), porque es cada entrada la que viene de
   * una u otra parte.
   */
  @Column('boolean', { default: false, name: 'is_medical_sample' })
  isMedicalSample: boolean;

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
@Index(['clinic', 'createdAt'])
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

  /**
   * Nulo = vencimiento sin registrar, que no es lo mismo que "no vence".
   *
   * Era obligatorio, y eso obligaba a inventarse una fecha para todo stock que
   * llegara sin ella —el inventario en papel de la clínica no la trae—. Una
   * fecha inventada es peor que ninguna: si es lejana, el control de
   * vencimientos da por bueno cualquier producto para siempre; si es cercana,
   * llena la pantalla de alertas falsas. Con `null` las comprobaciones
   * simplemente no opinan, y la pantalla lo dice.
   */
  @Column('date', { nullable: true })
  expiryDate: Date | null;

  @Column('date')
  receivedDate: Date;

  @Column('text', { nullable: true })
  supplierBatch: string;

  @Column('text', { nullable: true })
  location: string; // shelf, cabinet, refrigerator, etc.

  @Column('integer', { default: 10 })
  minimumStock: number;

  /**
   * Este lote concreto entró como muestra médica del laboratorio.
   *
   * Se marca aquí y no solo en el medicamento porque del mismo producto puede
   * haber 100 unidades compradas y 20 que llegaron de muestra: es la entrada
   * la que viene de una vía o de otra, no el producto.
   */
  @Column('boolean', { default: false, name: 'is_medical_sample' })
  isMedicalSample: boolean;

  @Column('boolean', { default: true })
  isActive: boolean;

  // Relaciones
  @ManyToOne('Medication', 'stock', { eager: true })
  @JoinColumn({ name: 'medication_id' })
  medication: Medication;

  @Index()
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

  // Virtual property for clinicId (for frontend compatibility)
  get clinicId(): string | undefined {
    return this.clinic?.id;
  }

  // Helper methods
  //
  // Los tres devuelven "no opino" cuando no hay fecha registrada. Sin esta
  // guarda, `new Date(null)` da la época Unix (1970) y todo lote sin fecha
  // saldría vencido; `new Date(undefined)` da `Invalid Date`, cuyas
  // comparaciones son siempre falsas y cuya resta es NaN. Ninguna de las dos
  // cosas es "no se sabe".
  isExpired(): boolean {
    if (!this.expiryDate) return false;
    return new Date() > new Date(this.expiryDate);
  }

  isExpiringSoon(days: number = 30): boolean {
    if (!this.expiryDate) return false;
    const today = new Date();
    const expiryDate = new Date(this.expiryDate);
    const diffTime = expiryDate.getTime() - today.getTime();
    const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
    return diffDays <= days && diffDays > 0;
  }

  isLowStock(): boolean {
    return this.availableQuantity <= this.minimumStock;
  }

  /** `null` cuando no hay fecha registrada — distinto de "vence hoy" (0). */
  getDaysUntilExpiry(): number | null {
    if (!this.expiryDate) return null;
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
  reference: string | undefined; // Invoice number, prescription number, etc.

  @Column('text', { nullable: true })
  reason: string | undefined;

  @Column('text', { nullable: true })
  notes: string | undefined;

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
