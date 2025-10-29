import { Column, CreateDateColumn, Entity, PrimaryGeneratedColumn, UpdateDateColumn } from 'typeorm';

export enum FinancialReportType {
  FINANCIERO = 'Financiero',
  VENTAS = 'Ventas',
  GASTOS = 'Gastos',
  INGRESOS = 'Ingresos',
  BALANCE = 'Balance',
}

export enum ReportStatus {
  DRAFT = 'draft',
  GENERATED = 'generated',
  PUBLISHED = 'published',
  ARCHIVED = 'archived',
}

@Entity('financial_reports')
export class FinancialReport {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ length: 255 })
  title: string;

  @Column({
    type: 'enum',
    enum: FinancialReportType,
    default: FinancialReportType.FINANCIERO,
  })
  type: FinancialReportType;

  @Column({ type: 'text', nullable: true })
  description: string;

  @Column({ type: 'date' })
  reportDate: Date;

  @Column({
    type: 'enum',
    enum: ReportStatus,
    default: ReportStatus.DRAFT,
  })
  status: ReportStatus;

  @Column({ type: 'decimal', precision: 10, scale: 2, nullable: true })
  totalAmount: number;

  @Column({ length: 3, default: 'USD' })
  currency: string;

  @Column({ type: 'decimal', precision: 10, scale: 2, nullable: true })
  revenue: number;

  @Column({ type: 'decimal', precision: 10, scale: 2, nullable: true })
  expenses: number;

  @Column({ type: 'decimal', precision: 10, scale: 2, nullable: true })
  profit: number;

  @Column({ type: 'json', nullable: true })
  categories: any;

  @Column({ type: 'date', nullable: true })
  periodStartDate: Date;

  @Column({ type: 'date', nullable: true })
  periodEndDate: Date;

  @Column({ length: 100, nullable: true })
  createdBy: string;

  @Column({ type: 'text', nullable: true })
  filePath: string;

  @CreateDateColumn()
  createdAt: Date;

  @UpdateDateColumn()
  updatedAt: Date;
}
