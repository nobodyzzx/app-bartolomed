import { Column, Entity, OneToOne, PrimaryGeneratedColumn } from 'typeorm';
import { User } from './user.entity';

@Entity('personal_info')
export class PersonalInfo {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column('text')
  address: string;

  @Column('text')
  phone: string;

  @Column('date')
  birthDate: Date;

  @Column('text')
  documentType: string;

  @Column('text', { unique: true })
  documentNumber: string;

  @OneToOne(() => User, (user) => user.personalInfo)
  user: User;
}
