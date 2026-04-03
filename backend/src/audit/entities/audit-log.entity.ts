import { Column, CreateDateColumn, Entity, PrimaryGeneratedColumn } from 'typeorm';

@Entity('audit_logs')
export class AuditLog {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  /** LOGIN | LOGOUT | REFRESH | CREATE | UPDATE | DELETE | VIEW */
  @Column({ length: 20 })
  action: string;

  /** Nombre legible del recurso: Pacientes, Facturación, etc. */
  @Column({ length: 120 })
  resource: string;

  @Column({ nullable: true })
  resourceId?: string;

  @Column({ nullable: true })
  userId?: string;

  @Column({ length: 255, nullable: true })
  userEmail?: string;

  @Column({ length: 255, nullable: true })
  userName?: string;

  @Column({ nullable: true })
  clinicId?: string;

  @Column({ type: 'jsonb', nullable: true })
  details?: Record<string, unknown>;

  @Column({ length: 50, nullable: true })
  ipAddress?: string;

  @Column({ length: 10 })
  method: string;

  @Column({ length: 500 })
  path: string;

  @Column()
  statusCode: number;

  /** 'success' | 'failure' */
  @Column({ length: 10, default: 'success' })
  status: string;

  @CreateDateColumn()
  createdAt: Date;
}
