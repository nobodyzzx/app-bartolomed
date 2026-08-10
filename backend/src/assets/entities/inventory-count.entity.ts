import {
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
import { Asset } from './asset.entity';

export enum InventoryCountStatus {
  OPEN = 'open',
  CLOSED = 'closed',
  CANCELLED = 'cancelled',
}

/**
 * Una toma de inventario físico: se recorre un ambiente contando lo que hay y se
 * carga contra lo que el sistema dice que debería haber.
 *
 * Hasta ahora el ciclo quedaba abierto: la hoja de conteo se imprimía, alguien
 * la recorría con un lápiz y el papel terminaba en un cajón. Nadie podía
 * responder qué se contó, cuándo, ni qué faltó desde la última vez.
 *
 * Al abrirlo se **congela** la cantidad esperada de cada ítem (`expectedQuantity`
 * en cada línea): si alguien edita el inventario mientras se cuenta, la
 * diferencia sigue midiéndose contra lo que había cuando empezó el recorrido, no
 * contra un blanco móvil.
 */
@Entity('inventory_counts')
@Index(['clinic', 'createdAt'])
export class InventoryCount {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  /** Correlativo legible: CONT-2026-0001. */
  @Column('text', { unique: true })
  countNumber: string;

  /** Ambiente recorrido; nulo cuando el conteo abarca toda la clínica. */
  @Column('text', { nullable: true })
  location: string;

  @Column({
    type: 'enum',
    enum: InventoryCountStatus,
    default: InventoryCountStatus.OPEN,
  })
  status: InventoryCountStatus;

  @Column('text', { nullable: true })
  notes: string;

  @OneToMany(() => InventoryCountItem, item => item.count, { cascade: true })
  items: InventoryCountItem[];

  @ManyToOne(() => User, { nullable: true })
  @JoinColumn({ name: 'started_by' })
  startedBy: User;

  @ManyToOne(() => User, { nullable: true })
  @JoinColumn({ name: 'closed_by' })
  closedBy: User;

  @Column({ type: 'timestamp', nullable: true })
  closedAt: Date;

  @ManyToOne(() => Clinic, { nullable: true })
  @JoinColumn({ name: 'clinic_id' })
  clinic: Clinic;

  @CreateDateColumn()
  createdAt: Date;

  @UpdateDateColumn()
  updatedAt: Date;
}

/**
 * Una línea del conteo: lo que el sistema esperaba y lo que se encontró.
 *
 * `countedQuantity` en `null` significa "todavía no se contó", que es distinto
 * de haber contado cero — un ítem que no apareció. Sin esa distinción, abrir un
 * conteo daría por perdido todo el ambiente desde el primer minuto.
 */
@Entity('inventory_count_items')
@Index(['count'])
export class InventoryCountItem {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ name: 'count_id' })
  countId: string;

  @ManyToOne(() => InventoryCount, count => count.items, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'count_id' })
  count: InventoryCount;

  @Column({ name: 'asset_id' })
  assetId: string;

  @ManyToOne(() => Asset, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'asset_id' })
  asset: Asset;

  /** Nombre y código al abrir el conteo, para que el acta no dependa de la ficha. */
  @Column('text')
  assetName: string;

  @Column('text', { nullable: true })
  assetTag: string;

  @Column('int')
  expectedQuantity: number;

  @Column('int', { nullable: true })
  countedQuantity: number;

  @Column('text', { nullable: true })
  notes: string;

  @UpdateDateColumn()
  updatedAt: Date;
}
