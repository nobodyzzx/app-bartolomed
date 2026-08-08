import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  UpdateDateColumn,
  Index,
  ManyToOne,
  OneToMany,
  JoinColumn,
  BeforeInsert,
  BeforeUpdate,
} from 'typeorm';
import { Patient } from '../../patients/entities/patient.entity';
import { User } from '../../users/entities/user.entity';
import { Clinic } from '../../clinics/entities/clinic.entity';
import { Appointment } from '../../appointments/entities/appointment.entity';

export enum InvoiceStatus {
  DRAFT = 'draft',
  PENDING = 'pending',
  PAID = 'paid',
  PARTIALLY_PAID = 'partially_paid',
  OVERDUE = 'overdue',
  CANCELLED = 'cancelled',
  REFUNDED = 'refunded',
}

/**
 * La clínica solo cobra en efectivo y por QR; el resto de valores se conserva
 * porque hay pagos históricos registrados con ellos y los reportes agrupan por
 * método. La interfaz solo ofrece los dos primeros (ver `PAYMENT_METHODS` en el
 * frontend), así que ninguno nuevo puede nacer con un método en desuso.
 */
export enum PaymentMethod {
  CASH = 'cash',
  QR = 'qr',
  CREDIT_CARD = 'credit_card',
  DEBIT_CARD = 'debit_card',
  BANK_TRANSFER = 'bank_transfer',
  CHECK = 'check',
  INSURANCE = 'insurance',
  OTHER = 'other',
}

export enum PaymentStatus {
  PENDING = 'pending',
  COMPLETED = 'completed',
  FAILED = 'failed',
  CANCELLED = 'cancelled',
  REFUNDED = 'refunded',
}

@Entity('invoices')
@Index(['clinic', 'createdAt'])
export class Invoice {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column('text', { unique: true })
  invoiceNumber: string;

  @Column({
    type: 'enum',
    enum: InvoiceStatus,
    default: InvoiceStatus.DRAFT,
  })
  status: InvoiceStatus;

  @Column('date')
  issueDate: Date;

  @Column('date')
  dueDate: Date;

  @Column('decimal', { precision: 10, scale: 2 })
  subtotal: number;

  @Column('decimal', { precision: 10, scale: 2, default: 0 })
  taxAmount: number;

  @Column('decimal', { precision: 5, scale: 2, default: 0 })
  taxRate: number;

  @Column('decimal', { precision: 10, scale: 2, default: 0 })
  discountAmount: number;

  @Column('decimal', { precision: 5, scale: 2, default: 0 })
  discountRate: number;

  @Column('decimal', { precision: 10, scale: 2 })
  totalAmount: number;

  @Column('decimal', { precision: 10, scale: 2, default: 0 })
  paidAmount: number;

  @Column('decimal', { precision: 10, scale: 2, default: 0 })
  remainingAmount: number;

  @Column('text', { nullable: true })
  notes: string;

  @Column('text', { nullable: true })
  terms: string;

  @Column('boolean', { default: false })
  isInsuranceClaim: boolean;

  @Column('text', { nullable: true })
  insuranceProvider: string;

  @Column('text', { nullable: true })
  insuranceClaimNumber: string;

  @Column('decimal', { precision: 10, scale: 2, nullable: true })
  insuranceCoverage: number;

  @Column('boolean', { default: true })
  isActive: boolean;

  /**
   * Rastro de la anulación. La factura conserva su número y su importe: pasa a
   * `cancelled` pero no desaparece, porque un hueco en la numeración es
   * indistinguible de un cobro que alguien borró. Con descuentos sin tope, esto
   * es la única defensa contra un descuento indebido que se anula para taparlo.
   */
  @Column('text', { nullable: true })
  voidReason: string | null;

  @Column('timestamp', { nullable: true })
  voidedAt: Date | null;

  // Relaciones
  @ManyToOne(() => User, { nullable: true })
  @JoinColumn({ name: 'voided_by' })
  voidedBy: User | null;

  @ManyToOne(() => Patient)
  @JoinColumn({ name: 'patient_id' })
  patient: Patient;

  @Index()
  @ManyToOne(() => Clinic)
  @JoinColumn({ name: 'clinic_id' })
  clinic: Clinic;

  @ManyToOne(() => Appointment, { nullable: true })
  @JoinColumn({ name: 'appointment_id' })
  appointment: Appointment;

  @OneToMany('InvoiceItem', 'invoice', { cascade: true })
  items: any[];

  @OneToMany('Payment', 'invoice')
  payments: any[];

  @ManyToOne(() => User, { nullable: true })
  @JoinColumn({ name: 'created_by' })
  createdBy: User;

  @CreateDateColumn()
  createdAt: Date;

  @UpdateDateColumn()
  updatedAt: Date;

  // Helper methods
  isOverdue(): boolean {
    return new Date() > new Date(this.dueDate) && this.status !== InvoiceStatus.PAID;
  }

  getDaysOverdue(): number {
    if (!this.isOverdue()) return 0;
    const today = new Date();
    const dueDate = new Date(this.dueDate);
    const diffTime = today.getTime() - dueDate.getTime();
    return Math.ceil(diffTime / (1000 * 60 * 60 * 24));
  }

  isPaid(): boolean {
    return this.status === InvoiceStatus.PAID;
  }

  isPartiallyPaid(): boolean {
    return this.paidAmount > 0 && this.paidAmount < this.totalAmount;
  }

  @BeforeInsert()
  @BeforeUpdate()
  calculateAmounts() {
    const isTerminalStatus = [InvoiceStatus.CANCELLED, InvoiceStatus.REFUNDED].includes(this.status);

    // Los `default: 0` de las columnas los aplica Postgres al insertar, pero
    // este hook corre ANTES: si el importe no se seteó explícitamente llega
    // como `undefined` y cualquier suma da NaN, que es lo que se persiste.
    // Además TypeORM devuelve los `decimal` como string, así que un update
    // sobre una factura releída concatenaría en vez de sumar.
    const num = (value: unknown): number => {
      const n = Number(value ?? 0);
      return isNaN(n) ? 0 : n;
    };

    this.subtotal = num(this.subtotal);
    this.discountAmount = num(this.discountAmount);
    this.discountRate = num(this.discountRate);
    this.taxAmount = num(this.taxAmount);
    this.taxRate = num(this.taxRate);
    this.paidAmount = num(this.paidAmount);

    // Calcular subtotal desde los items si no está establecido
    if (!this.subtotal && this.items) {
      this.subtotal = this.items.reduce((sum: number, item: any) => {
        return sum + num(item.quantity) * num(item.unitPrice);
      }, 0);
    }

    // Calcular monto de descuento
    if (this.discountRate > 0) {
      this.discountAmount = this.subtotal * (this.discountRate / 100);
    }

    // Calcular base imponible después del descuento
    const taxableAmount = this.subtotal - this.discountAmount;

    // Calcular impuestos
    if (this.taxRate > 0) {
      this.taxAmount = taxableAmount * (this.taxRate / 100);
    }

    // Calcular total
    this.totalAmount = taxableAmount + this.taxAmount;

    // Calcular monto restante. Una factura anulada o devuelta no debe nada: el
    // saldo se extingue con ella. Este cálculo estaba fuera del `if` de abajo y
    // corría siempre, así que deshacía en silencio el `remainingAmount = 0` que
    // `voidInvoice()` acababa de asignar —el hook corre después—, y toda factura
    // anulada conservaba su saldo vivo para siempre. De ahí el "0 facturas
    // pendientes" junto a un monto por cobrar que salía entero de anuladas.
    this.remainingAmount = isTerminalStatus ? 0 : this.totalAmount - this.paidAmount;

    if (!isTerminalStatus) {
      // Actualizar estado basado en pagos
      if (this.paidAmount === 0) {
        if (this.status === InvoiceStatus.PAID || this.status === InvoiceStatus.PARTIALLY_PAID) {
          this.status = InvoiceStatus.PENDING;
        }
      } else if (this.paidAmount >= this.totalAmount) {
        this.status = InvoiceStatus.PAID;
        this.remainingAmount = 0;
      } else {
        this.status = InvoiceStatus.PARTIALLY_PAID;
      }

      // Verificar si está vencida
      if (this.remainingAmount > 0 && new Date() > new Date(this.dueDate)) {
        this.status = InvoiceStatus.OVERDUE;
      }
    }
  }
}

@Entity('invoice_items')
export class InvoiceItem {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column('text')
  description: string;

  @Column('integer')
  quantity: number;

  @Column('decimal', { precision: 10, scale: 2 })
  unitPrice: number;

  @Column('decimal', { precision: 10, scale: 2 })
  totalPrice: number;

  @Column('text', { nullable: true })
  serviceCode: string;

  @Column('text', { nullable: true })
  category: string;

  @Column('boolean', { default: true })
  isActive: boolean;

  @ManyToOne('Invoice', 'items')
  @JoinColumn({ name: 'invoice_id' })
  invoice: Invoice;

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

@Entity('payments')
export class Payment {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column('text', { unique: true })
  paymentNumber: string;

  @Column('decimal', { precision: 10, scale: 2 })
  amount: number;

  @Column({
    type: 'enum',
    enum: PaymentMethod,
  })
  method: PaymentMethod;

  @Column({
    type: 'enum',
    enum: PaymentStatus,
    default: PaymentStatus.PENDING,
  })
  status: PaymentStatus;

  @Column('timestamp with time zone')
  paymentDate: Date;

  @Column('text', { nullable: true })
  reference: string;

  @Column('text', { nullable: true })
  transactionId: string;

  @Column('text', { nullable: true })
  notes: string;

  @Column('boolean', { default: true })
  isActive: boolean;

  @ManyToOne('Invoice', 'payments')
  @JoinColumn({ name: 'invoice_id' })
  invoice: Invoice;

  @ManyToOne(() => User, { nullable: true })
  @JoinColumn({ name: 'processed_by' })
  processedBy: User;

  @CreateDateColumn()
  createdAt: Date;

  @UpdateDateColumn()
  updatedAt: Date;
}
