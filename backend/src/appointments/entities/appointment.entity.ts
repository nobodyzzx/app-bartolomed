import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  UpdateDateColumn,
  ManyToOne,
  JoinColumn,
  BeforeInsert,
  BeforeUpdate,
} from 'typeorm';
import { Patient } from '../../patients/entities/patient.entity';
import { User } from '../../users/entities/user.entity';
import { Clinic } from '../../clinics/entities/clinic.entity';

export enum AppointmentStatus {
  SCHEDULED = 'scheduled',
  CONFIRMED = 'confirmed',
  IN_PROGRESS = 'in_progress',
  COMPLETED = 'completed',
  CANCELLED = 'cancelled',
  NO_SHOW = 'no_show',
  RESCHEDULED = 'rescheduled',
}

export enum AppointmentType {
  CONSULTATION = 'consultation',
  FOLLOW_UP = 'follow_up',
  EMERGENCY = 'emergency',
  SURGERY = 'surgery',
  LABORATORY = 'laboratory',
  IMAGING = 'imaging',
  VACCINATION = 'vaccination',
  THERAPY = 'therapy',
  OTHER = 'other',
}

export enum AppointmentPriority {
  LOW = 'low',
  NORMAL = 'normal',
  HIGH = 'high',
  URGENT = 'urgent',
}

@Entity('appointments')
export class Appointment {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column('timestamp with time zone')
  appointmentDate: Date;

  @Column('integer')
  duration: number; // duración en minutos

  @Column({
    type: 'enum',
    enum: AppointmentType,
    default: AppointmentType.CONSULTATION,
  })
  type: AppointmentType;

  @Column({
    type: 'enum',
    enum: AppointmentStatus,
    default: AppointmentStatus.SCHEDULED,
  })
  status: AppointmentStatus;

  @Column({
    type: 'enum',
    enum: AppointmentPriority,
    default: AppointmentPriority.NORMAL,
  })
  priority: AppointmentPriority;

  @Column('text', { nullable: true })
  reason: string;

  @Column('text', { nullable: true })
  notes: string;

  @Column('text', { nullable: true })
  symptoms: string;

  @Column('text', { nullable: true })
  previousTreatments: string;

  @Column('text', { nullable: true })
  currentMedications: string;

  @Column('text', { nullable: true })
  cancellationReason: string;

  @Column('timestamp with time zone', { nullable: true })
  confirmedAt: Date;

  @Column('timestamp with time zone', { nullable: true })
  cancelledAt: Date;

  @Column('timestamp with time zone', { nullable: true })
  completedAt: Date;

  @Column('boolean', { default: false })
  isEmergency: boolean;

  @Column('boolean', { default: false })
  isRecurring: boolean;

  @Column('text', { nullable: true })
  recurringPattern: string; // JSON string para patrones de recurrencia

  @Column('boolean', { default: true })
  isActive: boolean;

  // Información de seguimiento
  @Column('text', { nullable: true })
  patientPhone: string;

  @Column('text', { nullable: true })
  patientEmail: string;

  @Column('boolean', { default: false })
  reminderSent: boolean;

  @Column('timestamp with time zone', { nullable: true })
  reminderSentAt: Date;

  // Información de pago
  @Column('decimal', { precision: 10, scale: 2, nullable: true })
  estimatedCost: number;

  @Column('decimal', { precision: 10, scale: 2, nullable: true })
  finalCost: number;

  @Column('boolean', { default: false })
  isPaid: boolean;

  @Column('text', { nullable: true })
  paymentMethod: string;

  @Column('timestamp with time zone', { nullable: true })
  paidAt: Date;

  // Relaciones
  @ManyToOne(() => Patient, { eager: true })
  @JoinColumn({ name: 'patient_id' })
  patient: Patient;

  @ManyToOne(() => User, { eager: true })
  @JoinColumn({ name: 'doctor_id' })
  doctor: User;

  @ManyToOne(() => Clinic, { eager: true })
  @JoinColumn({ name: 'clinic_id' })
  clinic: Clinic;

  @ManyToOne(() => User, { nullable: true })
  @JoinColumn({ name: 'created_by' })
  createdBy: User;

  @ManyToOne(() => User, { nullable: true })
  @JoinColumn({ name: 'updated_by' })
  updatedBy: User;

  @CreateDateColumn()
  createdAt: Date;

  @UpdateDateColumn()
  updatedAt: Date;

  // Helper methods
  getEndTime(): Date {
    const endTime = new Date(this.appointmentDate);
    endTime.setMinutes(endTime.getMinutes() + this.duration);
    return endTime;
  }

  isToday(): boolean {
    const today = new Date();
    const appointmentDate = new Date(this.appointmentDate);
    return appointmentDate.toDateString() === today.toDateString();
  }

  isPast(): boolean {
    return new Date(this.appointmentDate) < new Date();
  }

  isFuture(): boolean {
    return new Date(this.appointmentDate) > new Date();
  }

  canBeCancelled(): boolean {
    return this.status === AppointmentStatus.SCHEDULED || this.status === AppointmentStatus.CONFIRMED;
  }

  canBeRescheduled(): boolean {
    return this.status === AppointmentStatus.SCHEDULED || this.status === AppointmentStatus.CONFIRMED;
  }

  @BeforeInsert()
  @BeforeUpdate()
  validateAppointment() {
    // Validar que la fecha de la cita no sea en el pasado (para nuevas citas)
    if (this.appointmentDate && new Date(this.appointmentDate) < new Date()) {
      if (!this.id) {
        // Solo para nuevas citas
        throw new Error('Appointment date cannot be in the past');
      }
    }

    // Validar duración mínima
    if (this.duration && this.duration < 15) {
      throw new Error('Appointment duration must be at least 15 minutes');
    }

    // Validar duración máxima
    if (this.duration && this.duration > 480) {
      // 8 horas
      throw new Error('Appointment duration cannot exceed 8 hours');
    }

    // Actualizar timestamps según el estado
    const now = new Date();
    if (this.status === AppointmentStatus.CONFIRMED && !this.confirmedAt) {
      this.confirmedAt = now;
    }
    if (this.status === AppointmentStatus.CANCELLED && !this.cancelledAt) {
      this.cancelledAt = now;
    }
    if (this.status === AppointmentStatus.COMPLETED && !this.completedAt) {
      this.completedAt = now;
    }
  }
}
