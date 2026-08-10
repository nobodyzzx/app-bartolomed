import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  UpdateDateColumn,
  Index,
  ManyToOne,
  JoinColumn,
} from 'typeorm';
import { User } from '../../users/entities/user.entity';
import { Clinic } from '../../clinics/entities/clinic.entity';

export enum AssetType {
  MEDICAL_EQUIPMENT = 'medical_equipment',
  FURNITURE = 'furniture',
  COMPUTER = 'computer',
  VEHICLE = 'vehicle',
  BUILDING = 'building',
  OTHER = 'other',
}

export enum AssetStatus {
  ACTIVE = 'active',
  INACTIVE = 'inactive',
  MAINTENANCE = 'maintenance',
  RETIRED = 'retired',
  SOLD = 'sold',
  LOST = 'lost',
  DAMAGED = 'damaged',
}

export enum AssetCondition {
  EXCELLENT = 'excellent',
  GOOD = 'good',
  FAIR = 'fair',
  POOR = 'poor',
  CRITICAL = 'critical',
}

/**
 * Ítem del inventario de la clínica: qué es, cuántos hay, dónde está y si sirve.
 *
 * La ficha tenía 40 columnas heredadas de un registro de activos fijos contable
 * —precio y fecha de compra, proveedor, factura, garantía, método de
 * depreciación, vida útil, valor residual, valor actual, depreciación acumulada
 * y mensual, categoría, edificio, piso, sala, responsable asignado, adjuntos—.
 * Sobre los 235 ítems reales, **ninguna de esas columnas tenía un solo dato**:
 * el inventario se lleva contando existencias por ambiente, no para amortizar.
 * Se retiraron en `SlimDownAssets`.
 *
 * Se conservan `serialNumber`, `manufacturer` y `model` a pedido: hoy están
 * vacíos, pero son los que el equipamiento médico caro terminará necesitando.
 */
@Entity('assets')
@Index(['clinic', 'createdAt'])
export class Asset {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column('text', { unique: true })
  assetTag: string;

  @Column('text')
  name: string;

  /**
   * Cuántas unidades hay de este ítem en su ubicación.
   *
   * Sin este campo, la misma planilla se cargaba con dos criterios —una caja de
   * 137 agujas quedaba como una ficha con la cantidad escondida en una nota,
   * mientras 4 sensores se abrían en cuatro fichas "(1 de 4)"—, y ninguno de los
   * dos permitía responder cuántos hay.
   */
  @Column('int', { default: 1 })
  quantity: number;

  @Column({
    type: 'enum',
    enum: AssetType,
  })
  type: AssetType;

  @Column('text', { nullable: true })
  manufacturer: string;

  @Column('text', { nullable: true })
  model: string;

  @Column('text', { nullable: true })
  serialNumber: string;

  @Column({
    type: 'enum',
    enum: AssetStatus,
    default: AssetStatus.ACTIVE,
  })
  status: AssetStatus;

  @Column({
    type: 'enum',
    enum: AssetCondition,
    default: AssetCondition.GOOD,
  })
  condition: AssetCondition;

  /** Ambiente donde está el ítem: "SALA ECOGRAFIA", "ESTERILIZACION". */
  @Column('text', { nullable: true })
  location: string;

  @Column('text', { nullable: true })
  notes: string;

  @Column('bool', { default: true })
  isActive: boolean;

  @CreateDateColumn()
  createdAt: Date;

  @UpdateDateColumn()
  updatedAt: Date;

  @ManyToOne(() => Clinic, { nullable: true })
  @JoinColumn({ name: 'clinic_id' })
  clinic: Clinic;

  @ManyToOne(() => User, { nullable: true })
  @JoinColumn({ name: 'created_by' })
  createdBy: User;
}
