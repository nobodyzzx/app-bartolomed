import {
  Column,
  CreateDateColumn,
  DeleteDateColumn,
  Entity,
  Index,
  JoinColumn,
  ManyToOne,
  PrimaryGeneratedColumn,
  Unique,
  UpdateDateColumn,
} from 'typeorm';
import { AppointmentType } from '../../appointments/entities/appointment.entity';
import { Clinic } from '../../clinics/entities/clinic.entity';

export enum ServiceCategory {
  CONSULTATION = 'consultation',
  LABORATORY = 'laboratory',
  /**
   * Estudios especiales: ecografía, colonoscopia, electrocardiograma. Van
   * aparte de `PROCEDURE` porque aquello son prácticas terapéuticas (curaciones,
   * inyectables) y esto son estudios diagnósticos, con su propio módulo, su rol
   * y su informe de resultados.
   */
  SPECIAL_STUDY = 'special_study',
  PROCEDURE = 'procedure',
  OTHER = 'other',
}

/**
 * Catálogo de precios de la clínica. Cumple dos funciones:
 *
 * 1. **Tarifario**: qué se cobra por cada consulta, examen o procedimiento.
 *    Hasta ahora no existía ningún precio en el sistema — ni tarifa de
 *    consulta (`Appointment` no tiene campo de precio) ni costo de examen
 *    (`LabOrderItem` tampoco), así que nada se podía cobrar automáticamente.
 * 2. **Catálogo de exámenes**: `LabOrderItem.testName` es texto libre, sin
 *    ninguna lista maestra detrás. Las filas de categoría `LABORATORY` pasan
 *    a ser esa lista.
 *
 * El precio se **copia** al cargo cuando se genera (no se referencia), para
 * que una actualización de tarifa no altere lo ya cobrado.
 */
@Entity('service_prices')
@Index('IDX_service_prices_clinic_category', ['clinic', 'category'])
@Unique('uq_service_price_clinic_code', ['clinic', 'code'])
export class ServicePrice {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  /** Código corto para búsqueda rápida en el punto de cobro. Único por clínica. */
  @Column('text')
  code: string;

  @Column('text')
  name: string;

  @Column('text', { nullable: true })
  description: string | null;

  @Column({
    type: 'enum',
    enum: ServiceCategory,
    default: ServiceCategory.OTHER,
  })
  category: ServiceCategory;

  /**
   * Solo para `CONSULTATION`: liga la tarifa al tipo de cita, de modo que al
   * completar una cita se pueda resolver su precio sin intervención manual.
   */
  @Column({
    type: 'enum',
    enum: AppointmentType,
    nullable: true,
    name: 'appointment_type',
  })
  appointmentType: AppointmentType | null;

  /**
   * `transformer` explícito: sin él TypeORM devuelve los `decimal` como
   * string y cualquier aritmética directa produce NaN o concatenación — el
   * mismo defecto que ya apareció en la tasa de cobro del reporte financiero.
   */
  @Column('decimal', {
    precision: 10,
    scale: 2,
    transformer: {
      to: (value: number) => value,
      from: (value: string | null) => (value === null ? 0 : parseFloat(value)),
    },
  })
  price: number;

  /**
   * Lo que a la clínica le cuesta el estudio cuando lo deriva a un laboratorio
   * externo (precio de convenio). Se guarda junto al de venta para poder ver
   * el margen por examen y contrastar lo que factura el proveedor; `price`
   * sigue siendo lo único que se le cobra al paciente.
   *
   * Nulo en todo lo que la clínica hace por su cuenta (consultas,
   * procedimientos): ahí no hay un tercero que cobre.
   */
  @Column('decimal', {
    precision: 10,
    scale: 2,
    name: 'cost_price',
    nullable: true,
    transformer: {
      to: (value: number | null) => value,
      from: (value: string | null) => (value === null ? null : parseFloat(value)),
    },
  })
  costPrice: number | null;

  /**
   * Categoría clínica del estudio (`HEMATOLOGIA`, `QUIMICA_SANGUINEA`…), que
   * es como se agrupa un tarifario de laboratorio. Distinta de `category`, que
   * dice qué clase de servicio es dentro de la app. Texto y no enum: el
   * tarifario del proveedor puede sumar secciones sin que eso sea un cambio de
   * esquema.
   */
  @Column('text', { name: 'lab_category', nullable: true })
  labCategory: string | null;

  /**
   * Laboratorio externo al que se deriva el estudio. Que esté relleno es lo que
   * marca un estudio como derivado: la clínica no lo procesa, lo manda fuera y
   * espera el resultado. Nulo en todo lo que se hace en casa.
   *
   * Texto y no entidad propia: hoy hay un proveedor y lo que se necesita de él
   * es su nombre en el informe y para conciliar. Una tabla de proveedores sin
   * más datos que el nombre sería estructura sin contenido.
   */
  @Column('text', { name: 'provider_name', nullable: true })
  providerName: string | null;

  /** Días hábiles de entrega del resultado, según el proveedor. */
  @Column('smallint', { name: 'turnaround_min_days', nullable: true })
  turnaroundMinDays: number | null;

  @Column('smallint', { name: 'turnaround_max_days', nullable: true })
  turnaroundMaxDays: number | null;

  /**
   * Para las entregas que no se expresan en días ("después de la tercera
   * muestra"). Si está, manda sobre los días.
   */
  @Column('text', { name: 'turnaround_note', nullable: true })
  turnaroundNote: string | null;

  /**
   * ¿Este estudio exige consentimiento informado firmado antes de realizarse?
   * Marca del catálogo: colonoscopía sí, ecografía y ECG normalmente no. Al
   * pedir el estudio el sistema avisa y ofrece la plantilla, pero **no bloquea**
   * la orden (ver `LabOrder.consentAcknowledged`).
   */
  @Column('boolean', { name: 'requires_consent', default: false })
  requiresConsent: boolean;

  @Column('boolean', { default: true, name: 'is_active' })
  isActive: boolean;

  @ManyToOne(() => Clinic, { nullable: false })
  @JoinColumn({ name: 'clinic_id' })
  clinic: Clinic;

  @Column('uuid', { name: 'clinic_id' })
  clinicId: string;

  @CreateDateColumn()
  createdAt: Date;

  @UpdateDateColumn()
  updatedAt: Date;

  @DeleteDateColumn()
  deletedAt?: Date;
}
