import { Column, CreateDateColumn, Entity, Index, JoinColumn, ManyToOne, PrimaryGeneratedColumn, UpdateDateColumn } from 'typeorm';
import { Clinic } from '../../clinics/entities/clinic.entity';

export enum ReportStatus {
  DRAFT = 'draft',
  GENERATED = 'generated',
  PUBLISHED = 'published',
  ARCHIVED = 'archived',
}

export enum MedicalReportType {
  CONSULTAS = 'Consultas',
  DIAGNOSTICOS = 'Diagnósticos',
  TRATAMIENTOS = 'Tratamientos',
  EPIDEMIOLOGICO = 'Epidemiológico',
}

@Entity('medical_reports')
export class MedicalReport {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ length: 255 })
  title: string;

  @Column({
    type: 'enum',
    enum: MedicalReportType,
    default: MedicalReportType.CONSULTAS,
  })
  type: MedicalReportType;

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
  patientCount: number;

  @Column({ type: 'json', nullable: true })
  diagnosisData: any;

  @Column({ type: 'json', nullable: true })
  consultationData: any;

  @Column({ type: 'date', nullable: true })
  periodStartDate: Date;

  @Column({ type: 'date', nullable: true })
  periodEndDate: Date;

  @Column({ length: 100, nullable: true })
  createdBy: string;

  @Index()
  @ManyToOne(() => Clinic, { nullable: true, eager: false })
  @JoinColumn({ name: 'clinic_id' })
  clinic: Clinic;

  @Column({ name: 'clinic_id', nullable: true })
  clinicId: string;

  @Column({ type: 'text', nullable: true })
  filePath: string;

  @CreateDateColumn()
  createdAt: Date;

  @UpdateDateColumn()
  updatedAt: Date;
}
