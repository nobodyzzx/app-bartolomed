import {
  BeforeInsert,
  BeforeUpdate,
  Column,
  CreateDateColumn,
  DeleteDateColumn,
  Entity,
  Index,
  JoinColumn,
  ManyToOne,
  PrimaryGeneratedColumn,
  UpdateDateColumn,
} from 'typeorm';
import { Clinic } from '../../clinics/entities/clinic.entity';
import { Patient } from '../../patients/entities/patient.entity';
import { User } from '../../users/entities/user.entity';

/** De qué módulo nació el cargo. */
export enum ChargeOrigin {
  CONSULTATION = 'consultation',
  LABORATORY = 'laboratory',
  PHARMACY = 'pharmacy',
  OTHER = 'other',
}

export enum ChargeStatus {
  PENDING = 'pending',
  INVOICED = 'invoiced',
  CANCELLED = 'cancelled',
}

/**
 * Cómo se imprime el descuento. **No cambia ningún dato ni ningún reporte** —
 * solo el render del recibo:
 *
 * - `ITEMIZED`: línea de descuento visible ("Consulta 100 / Descuento -20").
 * - `ABSORBED`: el precio unitario impreso ya viene neto ("Consulta 80"), sin
 *   mencionar el descuento. La clínica a veces lo pide así.
 *
 * Ocultarlo NUNCA puede ser omitir la línea dejando el total rebajado: el
 * recibo dejaría de cuadrar y se leería como un error del sistema.
 */
export enum DiscountDisplay {
  ITEMIZED = 'itemized',
  ABSORBED = 'absorbed',
}

const decimalTransformer = {
  to: (value: number) => value,
  from: (value: string | null) => (value === null ? 0 : parseFloat(value)),
};

/**
 * Unidad atómica de algo cobrable, que cualquier módulo puede generar.
 *
 * La "cuenta abierta" de un paciente **no es una entidad**: son sus cargos en
 * estado `PENDING`. Eso resuelve el requisito real de la clínica — el paciente
 * suele pagar todo junto, pero a veces paga solo una parte — sin necesidad de
 * una tabla de cuentas ni de casos especiales.
 */
@Entity('charges')
@Index('IDX_charges_clinic_patient_status', ['clinic', 'patient', 'status'])
@Index('IDX_charges_clinic_created', ['clinic', 'createdAt'])
export class Charge {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @ManyToOne(() => Clinic, { nullable: false })
  @JoinColumn({ name: 'clinic_id' })
  clinic: Clinic;

  @Column('uuid', { name: 'clinic_id' })
  clinicId: string;

  /**
   * Nullable a propósito: laboratorio y farmacia atienden gente sin consulta y
   * a veces sin ficha — pacientes derivados de otro consultorio que vienen
   * solo por el examen, o compra de mostrador. Mismo criterio que
   * `PharmacySale`, que ya lo resolvía así.
   */
  @ManyToOne(() => Patient, { nullable: true })
  @JoinColumn({ name: 'patient_id' })
  patient: Patient | null;

  @Column('uuid', { name: 'patient_id', nullable: true })
  patientId: string | null;

  /** Nombre libre cuando no hay ficha de paciente. */
  @Column('text', { name: 'patient_name', nullable: true })
  patientName: string | null;

  @Column({ type: 'enum', enum: ChargeOrigin, default: ChargeOrigin.OTHER })
  origin: ChargeOrigin;

  /**
   * Id del registro que originó el cargo (cita, ítem de orden de laboratorio,
   * venta de farmacia). Sin FK: apunta a tablas distintas según el `origin`.
   */
  @Column('uuid', { name: 'origin_id', nullable: true })
  originId: string | null;

  /** Servicio del catálogo del que salió el precio, si vino de ahí. */
  @Column('uuid', { name: 'service_price_id', nullable: true })
  servicePriceId: string | null;

  @Column('text')
  description: string;

  @Column('integer', { default: 1 })
  quantity: number;

  /**
   * Precio de catálogo al momento de generar el cargo. Se **copia**, no se
   * referencia: si mañana sube la tarifa, lo ya cobrado no cambia.
   */
  @Column('decimal', { precision: 10, scale: 2, name: 'list_price', transformer: decimalTransformer })
  listPrice: number;

  /** Precio efectivamente cobrado (list_price − descuento unitario). */
  @Column('decimal', { precision: 10, scale: 2, name: 'unit_price', transformer: decimalTransformer })
  unitPrice: number;

  @Column('decimal', {
    precision: 10,
    scale: 2,
    name: 'discount_amount',
    default: 0,
    transformer: decimalTransformer,
  })
  discountAmount: number;

  @Column('text', { name: 'discount_reason', nullable: true })
  discountReason: string | null;

  @ManyToOne(() => User, { nullable: true })
  @JoinColumn({ name: 'discount_authorized_by' })
  discountAuthorizedBy: User | null;

  @Column('uuid', { name: 'discount_authorized_by', nullable: true })
  discountAuthorizedById: string | null;

  @Column({
    type: 'enum',
    enum: DiscountDisplay,
    name: 'discount_display',
    default: DiscountDisplay.ITEMIZED,
  })
  discountDisplay: DiscountDisplay;

  @Column('decimal', { precision: 10, scale: 2, transformer: decimalTransformer })
  total: number;

  @Column({ type: 'enum', enum: ChargeStatus, default: ChargeStatus.PENDING })
  status: ChargeStatus;

  /** Se llena al emitir la factura que incluye este cargo (Fase 3). */
  @Column('uuid', { name: 'invoice_id', nullable: true })
  invoiceId: string | null;

  @ManyToOne(() => User, { nullable: true })
  @JoinColumn({ name: 'created_by' })
  createdBy: User | null;

  @Column('uuid', { name: 'created_by', nullable: true })
  createdById: string | null;

  @CreateDateColumn()
  createdAt: Date;

  @UpdateDateColumn()
  updatedAt: Date;

  @DeleteDateColumn()
  deletedAt?: Date;

  /**
   * El total siempre se deriva; nunca se acepta del cliente. `discountAmount`
   * es el descuento **total de la línea**, no unitario, por eso se resta una
   * sola vez.
   */
  @BeforeInsert()
  @BeforeUpdate()
  calculateTotal(): void {
    const gross = Number(this.quantity ?? 0) * Number(this.listPrice ?? 0);
    const discount = Number(this.discountAmount ?? 0);
    this.total = Math.max(0, Number((gross - discount).toFixed(2)));
    this.unitPrice = this.quantity ? Number((this.total / this.quantity).toFixed(2)) : Number(this.listPrice ?? 0);
  }
}
