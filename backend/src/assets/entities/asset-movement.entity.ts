import { Column, CreateDateColumn, Entity, Index, JoinColumn, ManyToOne, PrimaryGeneratedColumn } from 'typeorm';
import { Clinic } from '../../clinics/entities/clinic.entity';
import { User } from '../../users/entities/user.entity';
import { Asset } from './asset.entity';

/**
 * Un traspaso de unidades a otro ambiente, sea de la misma clínica o de la de
 * al lado.
 *
 * Es lo que pasa a diario —una silla que va del Consultorio 1 a la Sala de
 * Espera— y hasta ahora no dejaba rastro: mover algo era editar el campo
 * Ambiente del ítem, sin registro de quién lo movió ni cuándo.
 *
 * El movimiento se registra en un paso y no tiene estados: la cosa ya se movió,
 * lo que queda es anotarlo. Cruzar a la otra clínica tampoco los tiene, porque
 * las dos están a una puerta de distancia y el tránsito dura lo que dura
 * abrirla; el flujo de `AssetTransfer` —solicitud, despacho, confirmación de
 * recepción— sigue existiendo para cuando alguien deba firmar que recibió.
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

  /** Clínica de origen. */
  @ManyToOne(() => Clinic, { nullable: true })
  @JoinColumn({ name: 'clinic_id' })
  clinic: Clinic;

  /**
   * Clínica de destino, solo cuando el ítem cruzó de una a otra. Nula en el
   * movimiento corriente entre ambientes de la misma.
   *
   * Sin esta columna el historial sería cojo: la consulta filtra por clínica, y
   * el destino —que es justo quien necesita saber qué le llegó— no vería nada.
   */
  @ManyToOne(() => Clinic, { nullable: true })
  @JoinColumn({ name: 'to_clinic_id' })
  toClinic: Clinic;

  @CreateDateColumn()
  createdAt: Date;
}
