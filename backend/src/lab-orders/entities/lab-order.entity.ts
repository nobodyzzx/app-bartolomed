import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  DeleteDateColumn,
  UpdateDateColumn,
  Index,
  ManyToOne,
  OneToMany,
  JoinColumn,
} from 'typeorm';
import { Patient } from '../../patients/entities/patient.entity';
import { User } from '../../users/entities/user.entity';
import { Clinic } from '../../clinics/entities/clinic.entity';
import { MedicalRecord } from '../../medical-records/entities/medical-record.entity';

export enum LabOrderStatus {
  REQUESTED = 'requested',
  SAMPLE_COLLECTED = 'sample_collected',
  /**
   * La muestra salió hacia el laboratorio externo. Sin este tramo, una orden
   * derivada se quedaba en "en proceso" durante días y nadie sabía si llegó a
   * enviarse o seguía en un cajón.
   */
  SENT_TO_PROVIDER = 'sent_to_provider',
  IN_PROGRESS = 'in_progress',
  COMPLETED = 'completed',
  CANCELLED = 'cancelled',
}

export enum LabTestCategory {
  BLOOD = 'blood',
  IMAGING = 'imaging',
  OTHER = 'other',
}

/**
 * De dónde nace la solicitud. `INTERNAL` es una indicación médica de la casa
 * y siempre tiene `doctor`. `EXTERNAL` es el paciente que llega al mesón con
 * una orden en papel de otro consultorio, o el particular que se paga el
 * examen sin consulta previa: no hay médico de la casa que la firme, así que
 * el solicitante se guarda como texto en `referringDoctorName`.
 */
export enum LabOrderOrigin {
  INTERNAL = 'internal',
  EXTERNAL = 'external',
}

/**
 * Qué clase de estudio es. Separa dos módulos que comparten motor:
 *
 * - `LAB`: análisis clínicos, con muestra que se toma y se procesa.
 * - `SPECIAL`: estudios especiales (ecografía, colonoscopia,
 *   electrocardiograma). Se hacen sobre el paciente, no hay muestra que
 *   recoger ni derivar.
 *
 * Comparten cargos, informe en PDF, estados y solicitud externa; lo que cambia
 * es quién los ve y quién los hace. Cada módulo tiene su endpoint y su rol, y
 * filtra por este campo: así el gabinete no ve las órdenes del laboratorio ni
 * al revés.
 */
export enum LabOrderType {
  LAB = 'lab',
  SPECIAL = 'special',
}

@Entity('lab_orders')
@Index(['clinic', 'createdAt'])
export class LabOrder {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column('text')
  orderNumber: string;

  @Column({
    type: 'enum',
    enum: LabOrderStatus,
    default: LabOrderStatus.REQUESTED,
  })
  status: LabOrderStatus;

  @Column('date')
  orderDate: Date;

  @Column('text', { nullable: true })
  clinicalNotes: string;

  @Column('boolean', { default: false })
  isUrgent: boolean;

  /**
   * ¿El consentimiento informado ya está firmado y archivado? Es una constancia,
   * **no un bloqueo**: la orden se puede emitir sin marcarlo (a veces el papel
   * firmado llega después). Solo tiene sentido cuando algún estudio de la orden
   * lo exige (`LabOrderItem.requiresConsent`).
   */
  @Column('boolean', { name: 'consent_acknowledged', default: false })
  consentAcknowledged: boolean;

  /** Cuándo salió la muestra hacia el laboratorio externo. */
  @Column('timestamptz', { name: 'sent_to_provider_at', nullable: true })
  sentToProviderAt: Date | null;

  /**
   * Cuándo debería estar el resultado, calculado al enviar con los días de
   * entrega del estudio más lento de la orden. Es lo que se le dice al paciente
   * y lo que permite ver qué órdenes ya se pasaron de plazo.
   *
   * Tipado como `string` ('YYYY-MM-DD') y no `Date` a propósito: es lo que
   * TypeORM devuelve para una columna `date`, y tratarlo como instante es
   * justo lo que corre las fechas un día (ver `date-format.util`).
   */
  @Column('date', { name: 'expected_result_date', nullable: true })
  expectedResultDate: string | null;

  /**
   * Nullable desde la Fase 2 de facturación: el laboratorio recibe pacientes
   * **derivados de otro consultorio**, que vienen solo por el examen y no
   * tienen ficha en esta clínica. Antes era obligatorio y no había forma de
   * registrarlos. Cuando no hay ficha se usa `patientName`.
   */
  @ManyToOne(() => Patient, { nullable: true })
  @JoinColumn({ name: 'patient_id' })
  patient: Patient | null;

  /** Nombre libre del paciente derivado, cuando no hay ficha. */
  @Column('text', { name: 'patient_name', nullable: true })
  patientName: string | null;

  /**
   * Nullable solo para las órdenes `EXTERNAL`: el médico que las indicó no es
   * usuario del sistema. En las `INTERNAL` sigue siendo obligatorio — lo
   * garantiza el DTO, no la columna, porque la regla depende de `origin`.
   */
  @ManyToOne(() => User, { nullable: true })
  @JoinColumn({ name: 'doctor_id' })
  doctor: User | null;

  @Column({
    type: 'enum',
    enum: LabOrderOrigin,
    default: LabOrderOrigin.INTERNAL,
  })
  origin: LabOrderOrigin;

  @Column({
    type: 'enum',
    enum: LabOrderType,
    default: LabOrderType.LAB,
    name: 'order_type',
  })
  orderType: LabOrderType;

  /**
   * Quién indicó el examen cuando no es un médico de la casa: "Dr. Pérez —
   * Consultorio San Luis", o "Particular, sin orden médica". Solo se usa en
   * las órdenes `EXTERNAL`.
   */
  @Column('text', { name: 'referring_doctor_name', nullable: true })
  referringDoctorName: string | null;

  @Index()
  @ManyToOne(() => Clinic)
  @JoinColumn({ name: 'clinic_id' })
  clinic: Clinic;

  // Vínculo opcional a la consulta que originó la orden — no obligatorio,
  // sigue el mismo patrón unidireccional que MedicalRecord.relatedRecord.
  @ManyToOne(() => MedicalRecord, { nullable: true })
  @JoinColumn({ name: 'medical_record_id' })
  medicalRecord: MedicalRecord;

  @OneToMany('LabOrderItem', 'order', { cascade: true })
  items: any[];

  @ManyToOne(() => User, { nullable: true })
  @JoinColumn({ name: 'created_by' })
  createdBy: User;

  @CreateDateColumn()
  createdAt: Date;

  @UpdateDateColumn()
  updatedAt: Date;

  @DeleteDateColumn({ nullable: true })
  deletedAt?: Date;

  // Helper methods
  isCompleted(): boolean {
    return this.status === LabOrderStatus.COMPLETED;
  }

  canCancel(): boolean {
    return this.status !== LabOrderStatus.COMPLETED && this.status !== LabOrderStatus.CANCELLED;
  }
}

@Entity('lab_order_items')
export class LabOrderItem {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column('text')
  testName: string;

  @Column({
    type: 'enum',
    enum: LabTestCategory,
    default: LabTestCategory.OTHER,
  })
  category: LabTestCategory;

  @Column('text', { nullable: true })
  specimenType: string;

  /**
   * Precio del examen tomado del catálogo al crear la orden. Se copia en vez
   * de referenciarse, igual que en `Charge`: si sube la tarifa, lo ya cobrado
   * no cambia.
   */
  @Column('decimal', {
    precision: 10,
    scale: 2,
    name: 'unit_price',
    nullable: true,
    transformer: {
      to: (value: number | null) => value,
      from: (value: string | null) => (value === null ? null : parseFloat(value)),
    },
  })
  unitPrice: number | null;

  /** Servicio del tarifario del que salió el precio, si se encontró. */
  @Column('uuid', { name: 'service_price_id', nullable: true })
  servicePriceId: string | null;

  /**
   * Laboratorio externo al que se deriva este estudio, copiado del tarifario al
   * crear la orden. Que esté relleno es lo que dice que hay que enviarlo fuera.
   * Se copia en vez de referenciarse, igual que el precio: el informe debe
   * poder decir a qué laboratorio se mandó aunque el convenio cambie después.
   */
  @Column('text', { name: 'provider_name', nullable: true })
  providerName: string | null;

  /**
   * Categoría clínica del tarifario (`HEMATOLOGIA`, `QUIMICA_SANGUINEA`…),
   * copiada al crear la orden. Es la que usa de verdad un laboratorio para
   * agrupar su trabajo; `category` solo distingue el tipo de muestra.
   */
  @Column('text', { name: 'lab_category', nullable: true })
  labCategory: string | null;

  /**
   * ¿Este estudio exige consentimiento informado? Copiado del tarifario al
   * pedir la orden, igual que `labCategory`/`providerName`: así el detalle sabe
   * qué avisar sin volver a consultar el catálogo, y la constancia refleja lo
   * que era cierto cuando se pidió. Colonoscopía sí; ecografía y ECG no.
   */
  @Column('boolean', { name: 'requires_consent', default: false })
  requiresConsent: boolean;

  @Column('text', { nullable: true })
  resultValue: string;

  @Column('text', { nullable: true })
  resultUnit: string;

  @Column('text', { nullable: true })
  referenceRange: string;

  @Column('boolean', { default: false })
  isAbnormal: boolean;

  @Column('text', { nullable: true })
  resultNotes: string;

  @Column('text', { nullable: true })
  resultFileUrl: string;

  @Column('timestamptz', { nullable: true })
  collectedAt: Date;

  @Column('timestamptz', { nullable: true })
  resultedAt: Date;

  @ManyToOne(() => User, { nullable: true })
  @JoinColumn({ name: 'entered_by' })
  enteredBy: User;

  @Column('timestamptz', { nullable: true })
  validatedAt: Date;

  @ManyToOne(() => User, { nullable: true })
  @JoinColumn({ name: 'validated_by' })
  validatedBy: User;

  @ManyToOne('LabOrder', 'items')
  @JoinColumn({ name: 'order_id' })
  order: LabOrder;

  @CreateDateColumn()
  createdAt: Date;

  @UpdateDateColumn()
  updatedAt: Date;

  // Helper methods
  hasResult(): boolean {
    return !!this.resultedAt;
  }
}
