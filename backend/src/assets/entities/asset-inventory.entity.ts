import {
  Column,
  CreateDateColumn,
  Entity,
  JoinColumn,
  ManyToOne,
  PrimaryGeneratedColumn,
  UpdateDateColumn,
} from 'typeorm';
import { Clinic } from '../../clinics/entities/clinic.entity';
import { User } from '../../users/entities/user.entity';
import { Asset } from './asset.entity';

export enum InventoryType {
  INITIAL = 'Inicial',
  PERIODIC = 'Periódico',
  ADJUSTMENT = 'Ajuste',
  AUDIT = 'Auditoría',
  TRANSFER = 'Transferencia',
}

export enum InventoryStatus {
  PENDING = 'Pendiente',
  IN_PROGRESS = 'En Progreso',
  COMPLETED = 'Completado',
  CANCELLED = 'Cancelado',
}

@Entity('asset_inventory')
export class AssetInventory {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ length: 200 })
  title: string;

  @Column({ type: 'text', nullable: true })
  description: string;

  @Column({
    type: 'enum',
    enum: InventoryType,
    default: InventoryType.PERIODIC,
  })
  type: InventoryType;

  @Column({
    type: 'enum',
    enum: InventoryStatus,
    default: InventoryStatus.PENDING,
  })
  status: InventoryStatus;

  @Column({ type: 'date' })
  inventoryDate: Date;

  @Column({ type: 'int', default: 1 })
  quantity: number;

  @Column({ type: 'int', nullable: true })
  previousQuantity: number;

  @Column({ type: 'int', nullable: true })
  countedQuantity: number;

  @Column({ type: 'int', nullable: true })
  variance: number;

  @Column({ length: 200, nullable: true })
  location: string;

  @Column({ length: 200, nullable: true })
  previousLocation: string;

  @Column({ length: 100, nullable: true })
  condition: string;

  @Column({ length: 100, nullable: true })
  previousCondition: string;

  @Column({ type: 'decimal', precision: 12, scale: 2, nullable: true })
  unitValue: number;

  @Column({ type: 'decimal', precision: 12, scale: 2, nullable: true })
  totalValue: number;

  @Column({ type: 'text', nullable: true })
  notes: string;

  @Column({ type: 'text', nullable: true })
  discrepancyReason: string;

  @Column({ type: 'boolean', default: false })
  requiresVerification: boolean;

  @Column({ type: 'boolean', default: false })
  isVerified: boolean;

  @Column({ type: 'date', nullable: true })
  verificationDate: Date;

  @Column({ type: 'json', nullable: true })
  metadata: any;

  @ManyToOne(() => Asset, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'asset_id' })
  asset: Asset;

  @Column({ name: 'asset_id' })
  assetId: string;

  @ManyToOne(() => Clinic, { nullable: true })
  @JoinColumn({ name: 'clinic_id' })
  clinic: Clinic;

  @Column({ name: 'clinic_id', nullable: true })
  clinicId: string;

  @ManyToOne(() => User, { nullable: true })
  @JoinColumn({ name: 'performed_by' })
  performedBy: User;

  @Column({ name: 'performed_by', nullable: true })
  performedById: string;

  @ManyToOne(() => User, { nullable: true })
  @JoinColumn({ name: 'verified_by' })
  verifiedBy: User;

  @Column({ name: 'verified_by', nullable: true })
  verifiedById: string;

  @CreateDateColumn()
  createdAt: Date;

  @UpdateDateColumn()
  updatedAt: Date;

  // Helper methods
  calculateVariance(): void {
    if (this.previousQuantity !== null && this.countedQuantity !== null) {
      this.variance = this.countedQuantity - this.previousQuantity;
    }
  }

  hasDiscrepancy(): boolean {
    return this.variance !== null && this.variance !== 0;
  }

  getVariancePercentage(): number {
    if (!this.previousQuantity || this.previousQuantity === 0) return 0;
    return ((this.variance || 0) / this.previousQuantity) * 100;
  }

  isSignificantDiscrepancy(threshold: number = 5): boolean {
    return Math.abs(this.getVariancePercentage()) > threshold;
  }

  getVarianceType(): string {
    if (!this.variance) return 'Sin variación';
    if (this.variance > 0) return 'Exceso';
    if (this.variance < 0) return 'Faltante';
    return 'Sin variación';
  }

  getVarianceValue(): number {
    if (!this.variance || !this.unitValue) return 0;
    return this.variance * this.unitValue;
  }

  updateTotalValue(): void {
    if (this.quantity && this.unitValue) {
      this.totalValue = this.quantity * this.unitValue;
    }
  }

  canBeVerified(): boolean {
    return this.status === InventoryStatus.COMPLETED && !this.isVerified && this.requiresVerification;
  }

  getStatusColor(): string {
    const colors = {
      [InventoryStatus.PENDING]: '#f39c12',
      [InventoryStatus.IN_PROGRESS]: '#3498db',
      [InventoryStatus.COMPLETED]: '#27ae60',
      [InventoryStatus.CANCELLED]: '#e74c3c',
    };
    return colors[this.status] || '#95a5a6';
  }

  getDaysFromInventory(): number {
    const today = new Date();
    const inventoryDate = new Date(this.inventoryDate);
    const diffTime = today.getTime() - inventoryDate.getTime();
    return Math.ceil(diffTime / (1000 * 60 * 60 * 24));
  }
}
