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

export enum AssetTransferStatus {
  REQUESTED = 'requested',
  IN_TRANSIT = 'in_transit',
  COMPLETED = 'completed',
  REJECTED = 'rejected',
  RETURNED = 'returned',
}

export enum AssetTransferAuditAction {
  REQUESTED = 'requested',
  DISPATCHED = 'dispatched',
  COMPLETED = 'completed',
  REJECTED = 'rejected',
  RETURNED = 'returned',
}

@Entity('asset_transfers')
@Index(['sourceClinicId', 'status'])
@Index(['targetClinicId', 'status'])
@Index(['sourceClinicId', 'createdAt'])
@Index(['targetClinicId', 'createdAt'])
export class AssetTransfer {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ unique: true, length: 20 })
  transferNumber: string;

  @Column({ name: 'source_clinic_id' })
  sourceClinicId: string;

  @ManyToOne(() => Clinic)
  @JoinColumn({ name: 'source_clinic_id' })
  sourceClinic: Clinic;

  @Column({ name: 'target_clinic_id' })
  targetClinicId: string;

  @ManyToOne(() => Clinic)
  @JoinColumn({ name: 'target_clinic_id' })
  targetClinic: Clinic;

  @Column({ type: 'enum', enum: AssetTransferStatus, default: AssetTransferStatus.REQUESTED })
  status: AssetTransferStatus;

  @Column({ type: 'text', nullable: true })
  notes: string;

  @Column({ name: 'requested_by_id' })
  requestedById: string;

  @ManyToOne(() => User)
  @JoinColumn({ name: 'requested_by_id' })
  requestedBy: User;

  @Column({ name: 'dispatched_by_id', nullable: true })
  dispatchedById: string;

  @ManyToOne(() => User, { nullable: true })
  @JoinColumn({ name: 'dispatched_by_id' })
  dispatchedBy: User;

  @Column({ type: 'timestamptz', nullable: true })
  dispatchedAt: Date;

  @Column({ name: 'received_by_id', nullable: true })
  receivedById: string;

  @ManyToOne(() => User, { nullable: true })
  @JoinColumn({ name: 'received_by_id' })
  receivedBy: User;

  @Column({ type: 'timestamptz', nullable: true })
  receivedAt: Date;

  @Column({ type: 'text', nullable: true })
  rejectionReason: string;

  @OneToMany(() => AssetTransferItem, item => item.transfer, { cascade: true })
  items: AssetTransferItem[];

  @CreateDateColumn()
  createdAt: Date;

  @UpdateDateColumn()
  updatedAt: Date;
}

@Entity('asset_transfer_items')
export class AssetTransferItem {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ name: 'transfer_id' })
  transferId: string;

  @ManyToOne(() => AssetTransfer, t => t.items, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'transfer_id' })
  transfer: AssetTransfer;

  @Column({ name: 'asset_id' })
  assetId: string;

  @ManyToOne(() => Asset)
  @JoinColumn({ name: 'asset_id' })
  asset: Asset;

  @Column({ type: 'text', nullable: true })
  notes: string;
}

@Entity('asset_transfer_audit_logs')
@Index(['transferId', 'createdAt'])
export class AssetTransferAuditLog {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ name: 'transfer_id' })
  transferId: string;

  @Column({ type: 'enum', enum: AssetTransferAuditAction })
  action: AssetTransferAuditAction;

  @Column({ name: 'actor_id' })
  actorId: string;

  @ManyToOne(() => User)
  @JoinColumn({ name: 'actor_id' })
  actor: User;

  @Column({ name: 'actor_clinic_id' })
  actorClinicId: string;

  @ManyToOne(() => Clinic)
  @JoinColumn({ name: 'actor_clinic_id' })
  actorClinic: Clinic;

  @Column({ type: 'jsonb', nullable: true })
  snapshot: Record<string, any>;

  @CreateDateColumn()
  createdAt: Date;
}
