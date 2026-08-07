import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  UpdateDateColumn,
  Index,
  ManyToOne,
  JoinColumn,
} from 'typeorm';
import { Clinic } from '../../clinics/entities/clinic.entity';
import { User } from '../../users/entities/user.entity';

export enum Gender {
  MALE = 'male',
  FEMALE = 'female',
}

export enum BloodType {
  A_POSITIVE = 'A+',
  A_NEGATIVE = 'A-',
  B_POSITIVE = 'B+',
  B_NEGATIVE = 'B-',
  AB_POSITIVE = 'AB+',
  AB_NEGATIVE = 'AB-',
  O_POSITIVE = 'O+',
  O_NEGATIVE = 'O-',
}

export enum MaritalStatus {
  SINGLE = 'single',
  MARRIED = 'married',
  DIVORCED = 'divorced',
  WIDOWED = 'widowed',
  OTHER = 'other',
}

@Entity('patients')
@Index(['clinic', 'createdAt'])
// Único solo entre pacientes activos: al "eliminar" (soft-delete) un paciente
// su CI queda libre para reutilizarse sin necesidad de mutarlo (ver remove()
// en patients.service.ts) — antes esto se lograba reescribiendo documentNumber
// a `DEL_<timestamp>_<CI>`, lo que corrompía el CI mostrado en PDFs históricos
// (recetas) generados después del borrado, porque esos documentos leen la
// relación viva al paciente en vez de un snapshot.
@Index('UQ_patients_document_number_active', ['documentNumber'], { unique: true, where: '"isActive" = true' })
export class Patient {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column('text')
  firstName: string;

  @Column('text')
  lastName: string;

  @Column('text')
  documentNumber: string;

  @Column('text', { nullable: true })
  documentType: string;

  @Column('date')
  birthDate: Date;

  @Column({
    type: 'enum',
    enum: Gender,
  })
  gender: Gender;

  @Column('text', { nullable: true })
  email: string;

  @Column('text', { nullable: true })
  phone: string;

  @Column('text', { nullable: true })
  address: string;

  @Column('text', { nullable: true })
  city: string;

  @Column('text', { nullable: true })
  state: string;

  @Column('text', { nullable: true })
  zipCode: string;

  @Column('text', { nullable: true })
  country: string;

  @Column({
    type: 'enum',
    enum: BloodType,
    nullable: true,
  })
  bloodType: BloodType;

  @Column({
    type: 'enum',
    enum: MaritalStatus,
    nullable: true,
  })
  maritalStatus: MaritalStatus;

  @Column('text', { nullable: true })
  occupation: string;

  @Column('text', { nullable: true })
  emergencyContactName: string;

  @Column('text', { nullable: true })
  emergencyContactPhone: string;

  @Column('text', { nullable: true })
  emergencyContactRelationship: string;

  @Column('text', { nullable: true })
  allergies: string;

  @Column('text', { nullable: true })
  medications: string;

  @Column('text', { nullable: true })
  medicalHistory: string;

  @Column('text', { nullable: true })
  insuranceProvider: string;

  @Column('text', { nullable: true })
  insuranceNumber: string;

  @Column('boolean', { default: true })
  isActive: boolean;

  @Column('text', { nullable: true })
  notes: string;

  @Index()
  @ManyToOne(() => Clinic, clinic => clinic.patients)
  clinic: Clinic;

  @ManyToOne(() => User, user => user.id, { nullable: true })
  @JoinColumn({ name: 'created_by' })
  createdBy: User;

  @CreateDateColumn()
  createdAt: Date;

  @UpdateDateColumn()
  updatedAt: Date;

  // Método helper para calcular la edad
  getAge(): number {
    const today = new Date();
    const birthDate = new Date(this.birthDate);
    let age = today.getFullYear() - birthDate.getFullYear();
    const monthDiff = today.getMonth() - birthDate.getMonth();

    if (monthDiff < 0 || (monthDiff === 0 && today.getDate() < birthDate.getDate())) {
      age--;
    }

    return age;
  }

  // Método helper para obtener el nombre completo
  getFullName(): string {
    return `${this.firstName} ${this.lastName}`;
  }
}
