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
