import {
  Column,
  CreateDateColumn,
  Entity,
  JoinColumn,
  ManyToOne,
  PrimaryGeneratedColumn,
  UpdateDateColumn,
} from 'typeorm';
import { User } from '../../users/entities/user.entity';
import { Asset } from './asset.entity';

export enum MaintenanceType {
  PREVENTIVE = 'Preventivo',
  CORRECTIVE = 'Correctivo',
  EMERGENCY = 'Emergencia',
  CALIBRATION = 'Calibración',
  INSPECTION = 'Inspección',
}

export enum MaintenanceStatus {
  SCHEDULED = 'Programado',
  IN_PROGRESS = 'En Progreso',
  COMPLETED = 'Completado',
  CANCELLED = 'Cancelado',
  DELAYED = 'Retrasado',
}

@Entity('asset_maintenance')
export class AssetMaintenance {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ length: 200 })
  title: string;

  @Column({ type: 'text', nullable: true })
  description: string;

  @Column({
    type: 'enum',
    enum: MaintenanceType,
    default: MaintenanceType.PREVENTIVE,
  })
  type: MaintenanceType;

  @Column({
    type: 'enum',
    enum: MaintenanceStatus,
    default: MaintenanceStatus.SCHEDULED,
  })
  status: MaintenanceStatus;

  @Column({ type: 'date' })
  scheduledDate: Date;

  @Column({ type: 'date', nullable: true })
  completedDate: Date;

  @Column({ type: 'decimal', precision: 10, scale: 2, nullable: true })
  estimatedCost: number;

  @Column({ type: 'decimal', precision: 10, scale: 2, nullable: true })
  actualCost: number;

  @Column({ length: 100, nullable: true })
  technician: string;

  @Column({ length: 100, nullable: true })
  vendor: string;

  @Column({ type: 'text', nullable: true })
  workPerformed: string;

  @Column({ type: 'text', nullable: true })
  partsReplaced: string;

  @Column({ type: 'text', nullable: true })
  notes: string;

  @Column({ type: 'int', default: 1, comment: 'Prioridad: 1=Baja, 2=Media, 3=Alta, 4=Crítica' })
  priority: number;

  @Column({ type: 'date', nullable: true })
  nextMaintenanceDate: Date;

  @Column({ type: 'boolean', default: true })
  isActive: boolean;

  @ManyToOne(() => Asset, asset => asset.maintenanceRecords, {
    onDelete: 'CASCADE',
  })
  @JoinColumn({ name: 'asset_id' })
  asset: Asset;

  @Column({ name: 'asset_id' })
  assetId: string;

  @ManyToOne(() => User, { nullable: true })
  @JoinColumn({ name: 'scheduled_by' })
  scheduledBy: User;

  @Column({ name: 'scheduled_by', nullable: true })
  scheduledById: string;

  @ManyToOne(() => User, { nullable: true })
  @JoinColumn({ name: 'completed_by' })
  completedBy: User;

  @Column({ name: 'completed_by', nullable: true })
  completedById: string;

  @CreateDateColumn()
  createdAt: Date;

  @UpdateDateColumn()
  updatedAt: Date;

  // Helper methods
  isOverdue(): boolean {
    if (this.status === MaintenanceStatus.COMPLETED || this.status === MaintenanceStatus.CANCELLED) {
      return false;
    }
    return new Date() > new Date(this.scheduledDate);
  }

  getDaysOverdue(): number {
    if (!this.isOverdue()) return 0;
    const today = new Date();
    const scheduledDate = new Date(this.scheduledDate);
    const diffTime = today.getTime() - scheduledDate.getTime();
    return Math.ceil(diffTime / (1000 * 60 * 60 * 24));
  }

  getDaysUntilScheduled(): number {
    const today = new Date();
    const scheduledDate = new Date(this.scheduledDate);
    const diffTime = scheduledDate.getTime() - today.getTime();
    return Math.ceil(diffTime / (1000 * 60 * 60 * 24));
  }

  getDuration(): number {
    if (!this.completedDate) return 0;
    const startDate = new Date(this.scheduledDate);
    const endDate = new Date(this.completedDate);
    const diffTime = endDate.getTime() - startDate.getTime();
    return Math.ceil(diffTime / (1000 * 60 * 60 * 24));
  }

  getCostVariance(): number {
    if (!this.estimatedCost || !this.actualCost) return 0;
    return this.actualCost - this.estimatedCost;
  }

  getPriorityLabel(): string {
    const priorities = {
      1: 'Baja',
      2: 'Media',
      3: 'Alta',
      4: 'Crítica',
    };
    return priorities[this.priority] || 'Desconocida';
  }
}
