import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  UpdateDateColumn,
  ManyToOne,
  OneToMany,
  JoinColumn,
  BeforeInsert,
  BeforeUpdate,
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

export enum DepreciationMethod {
  STRAIGHT_LINE = 'straight_line',
  DECLINING_BALANCE = 'declining_balance',
  UNITS_OF_PRODUCTION = 'units_of_production',
  NO_DEPRECIATION = 'no_depreciation',
}

@Entity('assets')
export class Asset {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column('text', { unique: true })
  assetTag: string;

  @Column('text')
  name: string;

  @Column('text', { nullable: true })
  description: string;

  @Column({
    type: 'enum',
    enum: AssetType,
  })
  type: AssetType;

  @Column('text', { nullable: true })
  category: string;

  @Column('text', { nullable: true })
  subCategory: string;

  @Column('text', { nullable: true })
  manufacturer: string;

  @Column('text', { nullable: true })
  model: string;

  @Column('text', { nullable: true })
  serialNumber: string;

  @Column('text', { nullable: true })
  barcodeNumber: string;

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

  // Información financiera
  @Column('decimal', { precision: 12, scale: 2 })
  purchasePrice: number;

  @Column('date')
  purchaseDate: Date;

  @Column('text', { nullable: true })
  vendor: string;

  @Column('text', { nullable: true })
  invoiceNumber: string;

  @Column('text', { nullable: true })
  warrantyInfo: string;

  @Column('date', { nullable: true })
  warrantyExpiry: Date;

  // Depreciación
  @Column({
    type: 'enum',
    enum: DepreciationMethod,
    default: DepreciationMethod.STRAIGHT_LINE,
  })
  depreciationMethod: DepreciationMethod;

  @Column('integer', { default: 5 })
  usefulLifeYears: number;

  @Column('decimal', { precision: 12, scale: 2, default: 0 })
  salvageValue: number;

  @Column('decimal', { precision: 12, scale: 2, default: 0 })
  currentValue: number;

  @Column('decimal', { precision: 12, scale: 2, default: 0 })
  accumulatedDepreciation: number;

  @Column('decimal', { precision: 12, scale: 2, default: 0 })
  monthlyDepreciation: number;

  // Ubicación
  @Column('text', { nullable: true })
  location: string;

  @Column('text', { nullable: true })
  room: string;

  @Column('text', { nullable: true })
  building: string;

  @Column('text', { nullable: true })
  floor: string;

  // Mantenimiento
  @Column('date', { nullable: true })
  lastMaintenanceDate: Date;

  @Column('date', { nullable: true })
  nextMaintenanceDate: Date;

  @Column('integer', { default: 12 })
  maintenanceIntervalMonths: number;

  @Column('decimal', { precision: 10, scale: 2, default: 0 })
  totalMaintenanceCost: number;

  // Información adicional
  @Column('text', { nullable: true })
  notes: string;

  @Column('json', { nullable: true })
  specifications: any; // Especificaciones técnicas

  @Column('json', { nullable: true })
  attachments: any; // URLs de documentos, fotos, etc.

  @Column('boolean', { default: true })
  isActive: boolean;

  // Relaciones
  @ManyToOne(() => Clinic, { eager: true })
  @JoinColumn({ name: 'clinic_id' })
  clinic: Clinic;

  @ManyToOne(() => User, { nullable: true })
  @JoinColumn({ name: 'assigned_to' })
  assignedTo: User;

  @OneToMany('MaintenanceRecord', 'asset')
  maintenanceRecords: any[];

  @ManyToOne(() => User, { nullable: true })
  @JoinColumn({ name: 'created_by' })
  createdBy: User;

  @CreateDateColumn()
  createdAt: Date;

  @UpdateDateColumn()
  updatedAt: Date;

  // Helper methods
  getAge(): number {
    const today = new Date();
    const purchaseDate = new Date(this.purchaseDate);
    const diffTime = today.getTime() - purchaseDate.getTime();
    return Math.floor(diffTime / (1000 * 60 * 60 * 24 * 365.25));
  }

  isUnderWarranty(): boolean {
    if (!this.warrantyExpiry) return false;
    return new Date() <= new Date(this.warrantyExpiry);
  }

  isMaintenanceDue(): boolean {
    if (!this.nextMaintenanceDate) return false;
    return new Date() >= new Date(this.nextMaintenanceDate);
  }

  getDaysUntilMaintenance(): number {
    if (!this.nextMaintenanceDate) return -1;
    const today = new Date();
    const maintenanceDate = new Date(this.nextMaintenanceDate);
    const diffTime = maintenanceDate.getTime() - today.getTime();
    return Math.ceil(diffTime / (1000 * 60 * 60 * 24));
  }

  @BeforeInsert()
  @BeforeUpdate()
  calculateDepreciation() {
    if (this.depreciationMethod === DepreciationMethod.NO_DEPRECIATION) {
      this.currentValue = this.purchasePrice;
      this.monthlyDepreciation = 0;
      return;
    }

    const monthsOwned = this.getMonthsOwned();
    const totalMonths = this.usefulLifeYears * 12;

    if (this.depreciationMethod === DepreciationMethod.STRAIGHT_LINE) {
      const depreciableAmount = this.purchasePrice - this.salvageValue;
      this.monthlyDepreciation = depreciableAmount / totalMonths;
      this.accumulatedDepreciation = Math.min(this.monthlyDepreciation * monthsOwned, depreciableAmount);
      this.currentValue = this.purchasePrice - this.accumulatedDepreciation;
    }
  }

  private getMonthsOwned(): number {
    const today = new Date();
    const purchaseDate = new Date(this.purchaseDate);
    const diffTime = today.getTime() - purchaseDate.getTime();
    return Math.floor(diffTime / (1000 * 60 * 60 * 24 * 30.44)); // Promedio de días por mes
  }
}

@Entity('maintenance_records')
export class MaintenanceRecord {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column('text')
  type: string; // preventive, corrective, emergency

  @Column('text')
  description: string;

  @Column('date')
  scheduledDate: Date;

  @Column('date', { nullable: true })
  completedDate: Date;

  @Column('decimal', { precision: 10, scale: 2 })
  cost: number;

  @Column('text', { nullable: true })
  vendor: string;

  @Column('text', { nullable: true })
  technician: string;

  @Column('text', { nullable: true })
  workPerformed: string;

  @Column('text', { nullable: true })
  partsReplaced: string;

  @Column('text', { nullable: true })
  notes: string;

  @Column('text', { default: 'scheduled' })
  status: string; // scheduled, in_progress, completed, cancelled

  @Column('boolean', { default: true })
  isActive: boolean;

  @ManyToOne('Asset', 'maintenanceRecords')
  @JoinColumn({ name: 'asset_id' })
  asset: Asset;

  @ManyToOne(() => User, { nullable: true })
  @JoinColumn({ name: 'scheduled_by' })
  scheduledBy: User;

  @ManyToOne(() => User, { nullable: true })
  @JoinColumn({ name: 'completed_by' })
  completedBy: User;

  @CreateDateColumn()
  createdAt: Date;

  @UpdateDateColumn()
  updatedAt: Date;

  isOverdue(): boolean {
    return new Date() > new Date(this.scheduledDate) && this.status !== 'completed';
  }
}
