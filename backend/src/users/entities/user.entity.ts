import {
  BeforeInsert,
  BeforeUpdate,
  Column,
  CreateDateColumn,
  Entity,
  JoinColumn,
  ManyToOne,
  OneToOne,
  PrimaryGeneratedColumn,
  UpdateDateColumn,
} from 'typeorm';
import { Clinic } from '../../clinics/entities';
import { PersonalInfo, ProfessionalInfo } from './';

@Entity('users')
export class User {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column('text', { unique: true })
  email: string;

  @Column('text', { select: false })
  password: string;

  @Column('text')
  fullName: string;

  @Column('bool', { default: true })
  isActive: boolean;

  @Column('text', {
    array: true,
    default: ['user'],
  })
  roles: string[];

  @OneToOne(() => PersonalInfo, (personalInfo) => personalInfo.user, {
    cascade: true,
    eager: true,
  })
  @JoinColumn()
  personalInfo: PersonalInfo;

  @OneToOne(
    () => ProfessionalInfo,
    (professionalInfo) => professionalInfo.user,
    {
      cascade: true,
      eager: true,
    },
  )
  @JoinColumn()
  professionalInfo: ProfessionalInfo;

  @ManyToOne(() => Clinic, (clinic) => clinic.users, {
    eager: true,
  })
  @JoinColumn()
  clinic: Clinic;

  @CreateDateColumn()
  createdAt: Date;

  @UpdateDateColumn()
  updatedAt: Date;

  @BeforeInsert()
  checkFieldsBeforeInsert() {
    this.email = this.email.toLowerCase().trim();
  }

  @BeforeUpdate()
  checkFieldsBeforeUpdate() {
    this.checkFieldsBeforeInsert();
  }
}
