import {
  Column,
  CreateDateColumn,
  Entity,
  Index,
  JoinColumn,
  ManyToOne,
  PrimaryGeneratedColumn,
} from 'typeorm';
import { Clinic } from '../../clinics/entities/clinic.entity';
import { User } from '../../users/entities/user.entity';
import { Asset } from './asset.entity';

/**
 * Un traspaso de unidades entre ambientes de la misma clínica.
 *
 * Es lo que pasa a diario —una silla que va del Consultorio 1 a la Sala de
 * Espera— y hasta ahora no dejaba rastro: mover algo era editar el campo
 * Ambiente del ítem, sin registro de quién lo movió ni cuándo. El flujo formal
 * de `AssetTransfer` no cubre esto: exige clínica de destino distinta de la de
 * origen y pasa por solicitud, despacho y confirmación de recepción.
 *
 * El movimiento se registra en un paso y no tiene estados: la cosa ya se movió,
 * lo que queda es anotarlo.
 */
@Entity('asset_movements')
@Index(['clinic', 'createdAt'])
export class AssetMovement {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ name: 'asset_id' })
  assetId: string;

  @ManyToOne(() => Asset, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'asset_id' })
  asset: Asset;

  /**
   * Nombre del ítem al momento del movimiento. Se copia en vez de depender del
   * `asset`, porque un traspaso parcial crea un ítem nuevo en destino y el de
   * origen puede renombrarse o darse de baja después: el historial tiene que
   * seguir diciendo qué se movió.
   */
  @Column('text')
  assetName: string;

  @Column('text', { nullable: true })
  fromLocation: string;

  @Column('text')
  toLocation: string;

  @Column('int')
  quantity: number;

  /** Ítem que recibió las unidades en destino, cuando el traspaso fue parcial. */
  @Column({ name: 'target_asset_id', nullable: true })
  targetAssetId: string;

  @Column('text', { nullable: true })
  notes: string;

  @ManyToOne(() => User, { nullable: true })
  @JoinColumn({ name: 'moved_by' })
  movedBy: User;

  @ManyToOne(() => Clinic, { nullable: true })
  @JoinColumn({ name: 'clinic_id' })
  clinic: Clinic;

  @CreateDateColumn()
  createdAt: Date;
}
