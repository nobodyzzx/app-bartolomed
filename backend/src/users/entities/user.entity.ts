import {
  BeforeInsert,
  BeforeUpdate,
  Column,
  Entity,
  JoinColumn,
  ManyToOne,
  OneToOne,
  PrimaryGeneratedColumn,
} from 'typeorm';
import { PersonalInfo } from './personal-info.entity';
import { ProfessionalInfo } from './professional-info.entity';
import { Clinic } from '../../clinics/entities/clinic.entity';

@Entity('users')
export class User {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column('text', { unique: true })
  email: string;

  @Column('text', { select: false })
  password: string;

  @Column('text', {
    array: true,
    default: ['user'],
  })
  roles: string[];

  @Column('bool', { default: true })
  isActive: boolean;

  @OneToOne(() => PersonalInfo, personalInfo => personalInfo.user, {
    cascade: true,
    eager: true,
  })
  @JoinColumn()
  personalInfo: PersonalInfo;

  @OneToOne(() => ProfessionalInfo, professionalInfo => professionalInfo.user, { cascade: true, eager: true })
  @JoinColumn()
  professionalInfo: ProfessionalInfo;

  @ManyToOne(() => Clinic, clinic => clinic.users)
  clinic: Clinic;

  @BeforeInsert()
  checkFieldsBeforeInsert() {
    this.email = this.email.toLowerCase().trim();
  }

  @BeforeUpdate()
  checkFieldsBeforeUpdate() {
    this.checkFieldsBeforeInsert();
  }
}
