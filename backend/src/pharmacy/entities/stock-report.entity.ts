import { Column, CreateDateColumn, Entity, PrimaryGeneratedColumn, UpdateDateColumn } from 'typeorm';

export enum StockReportType {
  INVENTARIO = 'Inventario',
  VENCIMIENTOS = 'Vencimientos',
  MOVIMIENTOS = 'Movimientos',
  BAJO_STOCK = 'Bajo Stock',
}

export enum ReportStatus {
  DRAFT = 'draft',
  GENERATED = 'generated',
  PUBLISHED = 'published',
  ARCHIVED = 'archived',
}

@Entity('stock_reports')
export class StockReport {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ length: 255 })
  title: string;

  @Column({
    type: 'enum',
    enum: StockReportType,
    default: StockReportType.INVENTARIO,
  })
  type: StockReportType;

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

  @Column({ type: 'int', nullable: true })
  totalProducts: number;

  @Column({ type: 'int', nullable: true })
  lowStockItems: number;

  @Column({ type: 'int', nullable: true })
  expiringItems: number;

  @Column({ type: 'int', nullable: true })
  outOfStockItems: number;

  @Column({ type: 'decimal', precision: 10, scale: 2, nullable: true })
  stockValue: number;

  @Column({ type: 'json', nullable: true })
  movements: any;

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
