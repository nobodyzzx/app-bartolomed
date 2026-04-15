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
import { MedicationStock } from '../../pharmacy/entities/pharmacy.entity';
import { User } from '../../users/entities/user.entity';

export enum TransferStatus {
  REQUESTED  = 'requested',
  IN_TRANSIT = 'in_transit',
  COMPLETED  = 'completed',
  REJECTED   = 'rejected',
  RETURNED   = 'returned',
}

export enum TransferAuditAction {
  REQUESTED  = 'requested',
  DISPATCHED = 'dispatched',
  COMPLETED  = 'completed',
  REJECTED   = 'rejected',
  RETURNED   = 'returned',
}

@Entity('stock_transfers')
@Index(['sourceClinicId', 'status'])
@Index(['targetClinicId', 'status'])
@Index(['sourceClinicId', 'createdAt'])
@Index(['targetClinicId', 'createdAt'])
export class StockTransfer {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column('text', { unique: true })
  transferNumber: string;

  @ManyToOne(() => Clinic, { eager: false })
  @JoinColumn({ name: 'source_clinic_id' })
  sourceClinic: Clinic;

  @Column({ name: 'source_clinic_id' })
  sourceClinicId: string;

  @ManyToOne(() => Clinic, { eager: false })
  @JoinColumn({ name: 'target_clinic_id' })
  targetClinic: Clinic;

  @Column({ name: 'target_clinic_id' })
  targetClinicId: string;

  @Column({ type: 'enum', enum: TransferStatus, default: TransferStatus.REQUESTED })
  status: TransferStatus;

  @Column('text', { nullable: true })
  notes: string | undefined;

  @ManyToOne(() => User, { eager: false })
  @JoinColumn({ name: 'requested_by_id' })
  requestedBy: User;

  @Column({ name: 'requested_by_id' })
  requestedById: string;

  @ManyToOne(() => User, { nullable: true, eager: false })
  @JoinColumn({ name: 'dispatched_by_id' })
  dispatchedBy: User | undefined;

  @Column({ name: 'dispatched_by_id', nullable: true })
  dispatchedById: string | undefined;

  @Column('timestamp', { nullable: true })
  dispatchedAt: Date | undefined;

  @ManyToOne(() => User, { nullable: true, eager: false })
  @JoinColumn({ name: 'received_by_id' })
  receivedBy: User | undefined;

  @Column({ name: 'received_by_id', nullable: true })
  receivedById: string | undefined;

  @Column('timestamp', { nullable: true })
  receivedAt: Date | undefined;

  @Column('text', { nullable: true })
  rejectionReason: string | undefined;

  @OneToMany(() => StockTransferItem, item => item.transfer, { cascade: true })
  items: StockTransferItem[];

  @CreateDateColumn()
  createdAt: Date;

  @UpdateDateColumn()
  updatedAt: Date;
}

@Entity('stock_transfer_items')
export class StockTransferItem {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @ManyToOne(() => StockTransfer, t => t.items, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'transfer_id' })
  transfer: StockTransfer;

  @Column({ name: 'transfer_id' })
  transferId: string;

  @ManyToOne(() => MedicationStock, { eager: false })
  @JoinColumn({ name: 'source_stock_id' })
  sourceStock: MedicationStock;

  @Column({ name: 'source_stock_id' })
  sourceStockId: string;

  @ManyToOne(() => MedicationStock, { nullable: true, eager: false })
  @JoinColumn({ name: 'target_stock_id' })
  targetStock: MedicationStock | undefined;

  @Column({ name: 'target_stock_id', nullable: true })
  targetStockId: string | undefined;

  @Column('integer')
  requestedQuantity: number;

  @Column('integer', { nullable: true })
  dispatchedQuantity: number | undefined;

  @Column('integer', { nullable: true })
  receivedQuantity: number | undefined;
}

@Entity('transfer_audit_logs')
@Index(['transferId', 'createdAt'])
export class TransferAuditLog {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @ManyToOne(() => StockTransfer, { onDelete: 'CASCADE', eager: false })
  @JoinColumn({ name: 'transfer_id' })
  transfer: StockTransfer;

  @Column({ name: 'transfer_id' })
  transferId: string;

  @Column({ type: 'enum', enum: TransferAuditAction })
  action: TransferAuditAction;

  @ManyToOne(() => User, { eager: false })
  @JoinColumn({ name: 'actor_id' })
  actor: User;

  @Column({ name: 'actor_id' })
  actorId: string;

  @ManyToOne(() => Clinic, { eager: false })
  @JoinColumn({ name: 'actor_clinic_id' })
  actorClinic: Clinic;

  @Column({ name: 'actor_clinic_id' })
  actorClinicId: string;

  @Column({ type: 'jsonb' })
  snapshot: Record<string, unknown>;

  @CreateDateColumn()
  createdAt: Date;
}
