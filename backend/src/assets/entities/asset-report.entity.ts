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

export enum ReportType {
  LOCATION = 'Por Ubicación',
  STATUS = 'Por Estado',
  MAINTENANCE = 'Mantenimiento',
  DEPRECIATION = 'Depreciación',
  OBSOLETE = 'Obsoletos',
  FINANCIAL = 'Financiero',
}

export enum ReportStatus {
  PENDING = 'Pendiente',
  GENERATING = 'Generando',
  COMPLETED = 'Completado',
  FAILED = 'Fallido',
}

export enum ReportFormat {
  PDF = 'PDF',
  EXCEL = 'EXCEL',
  CSV = 'CSV',
  JSON = 'JSON',
}

@Entity('asset_reports')
export class AssetReport {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ length: 200 })
  title: string;

  @Column({ type: 'text', nullable: true })
  description: string;

  @Column({
    type: 'enum',
    enum: ReportType,
    default: ReportType.STATUS,
  })
  type: ReportType;

  @Column({
    type: 'enum',
    enum: ReportStatus,
    default: ReportStatus.PENDING,
  })
  status: ReportStatus;

  @Column({
    type: 'enum',
    enum: ReportFormat,
    default: ReportFormat.PDF,
  })
  format: ReportFormat;

  @Column({ type: 'date' })
  date: Date;

  @Column({ type: 'date', nullable: true })
  dateFrom: Date;

  @Column({ type: 'date', nullable: true })
  dateTo: Date;

  @Column({ type: 'json', nullable: true })
  parameters: any;

  @Column({ type: 'json', nullable: true })
  filters: any;

  @Column({ type: 'json', nullable: true })
  data: any;

  @Column({ length: 500, nullable: true })
  filePath: string;

  @Column({ type: 'bigint', nullable: true })
  fileSize: number;

  @Column({ length: 100, nullable: true })
  fileName: string;

  @Column({ type: 'text', nullable: true })
  executionTime: string;

  @Column({ type: 'int', nullable: true })
  recordCount: number;

  @Column({ type: 'text', nullable: true })
  errorMessage: string;

  @Column({ type: 'text', nullable: true })
  notes: string;

  @Column({ type: 'boolean', default: false })
  isScheduled: boolean;

  @Column({ type: 'boolean', default: false })
  isRecurring: boolean;

  @Column({ type: 'text', nullable: true })
  scheduleExpression: string;

  @Column({ type: 'date', nullable: true })
  nextExecutionDate: Date;

  @Column({ type: 'boolean', default: true })
  isActive: boolean;

  @ManyToOne(() => User, { nullable: true })
  @JoinColumn({ name: 'generated_by' })
  generatedBy: User;

  @Column({ name: 'generated_by', nullable: true })
  generatedById: string;

  @ManyToOne(() => Clinic, { nullable: true })
  @JoinColumn({ name: 'clinic_id' })
  clinic: Clinic;

  @Column({ name: 'clinic_id', nullable: true })
  clinicId: string;

  @CreateDateColumn()
  createdAt: Date;

  @UpdateDateColumn()
  updatedAt: Date;

  // Helper methods
  isExpired(daysToExpire: number = 30): boolean {
    if (this.status !== ReportStatus.COMPLETED) return false;
    const today = new Date();
    const generatedDate = new Date(this.date);
    const diffTime = today.getTime() - generatedDate.getTime();
    const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
    return diffDays > daysToExpire;
  }

  getFileSizeFormatted(): string {
    if (!this.fileSize) return 'N/A';
    const bytes = Number(this.fileSize);
    const sizes = ['Bytes', 'KB', 'MB', 'GB'];
    if (bytes === 0) return '0 Bytes';
    const i = Math.floor(Math.log(bytes) / Math.log(1024));
    return Math.round((bytes / Math.pow(1024, i)) * 100) / 100 + ' ' + sizes[i];
  }

  getDaysFromGeneration(): number {
    const today = new Date();
    const generatedDate = new Date(this.date);
    const diffTime = today.getTime() - generatedDate.getTime();
    return Math.ceil(diffTime / (1000 * 60 * 60 * 24));
  }

  canBeDownloaded(): boolean {
    return this.status === ReportStatus.COMPLETED && !!this.filePath;
  }

  getStatusColor(): string {
    const colors = {
      [ReportStatus.PENDING]: '#f39c12',
      [ReportStatus.GENERATING]: '#3498db',
      [ReportStatus.COMPLETED]: '#27ae60',
      [ReportStatus.FAILED]: '#e74c3c',
    };
    return colors[this.status] || '#95a5a6';
  }

  getTypeDisplay(): string {
    const typeLabels = {
      [ReportType.LOCATION]: 'Reporte por Ubicación',
      [ReportType.STATUS]: 'Reporte por Estado',
      [ReportType.MAINTENANCE]: 'Reporte de Mantenimiento',
      [ReportType.DEPRECIATION]: 'Reporte de Depreciación',
      [ReportType.OBSOLETE]: 'Reporte de Obsoletos',
      [ReportType.FINANCIAL]: 'Reporte Financiero',
    };
    return typeLabels[this.type] || this.type;
  }

  hasFilters(): boolean {
    return this.filters && Object.keys(this.filters).length > 0;
  }

  hasParameters(): boolean {
    return this.parameters && Object.keys(this.parameters).length > 0;
  }

  isReadyForGeneration(): boolean {
    return this.status === ReportStatus.PENDING && !!this.type && !!this.format;
  }

  markAsCompleted(filePath: string, fileSize: number, recordCount: number): void {
    this.status = ReportStatus.COMPLETED;
    this.filePath = filePath;
    this.fileSize = fileSize;
    this.recordCount = recordCount;
  }

  markAsFailed(errorMessage: string): void {
    this.status = ReportStatus.FAILED;
    this.errorMessage = errorMessage;
  }
}
