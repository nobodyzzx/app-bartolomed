import { Column, Entity, PrimaryColumn, UpdateDateColumn } from 'typeorm';

/** Fila única (id=1) con la configuración SMTP activa del sistema. */
@Entity('smtp_config')
export class SmtpConfig {
  @PrimaryColumn({ default: 1 })
  id: number;

  @Column({ default: '' })
  host: string;

  @Column({ default: 587 })
  port: number;

  /** true → TLS (port 465), false → STARTTLS (port 587) */
  @Column({ default: false })
  secure: boolean;

  @Column({ default: '' })
  user: string;

  @Column({ default: '', select: false })
  pass: string;

  @Column({ name: 'from_name', default: 'Bartolomed' })
  fromName: string;

  @Column({ name: 'from_email', default: '' })
  fromEmail: string;

  @Column({ default: false })
  enabled: boolean;

  @UpdateDateColumn({ name: 'updated_at' })
  updatedAt: Date;
}
