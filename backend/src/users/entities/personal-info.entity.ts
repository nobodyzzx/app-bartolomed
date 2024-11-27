import { Column, Entity, OneToOne, PrimaryGeneratedColumn } from 'typeorm';
import { User } from './user.entity';

@Entity('personal_info')
export class PersonalInfo {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column('text')
  firstName: string;

  @Column('text')
  lastName: string;

  @Column('text')
  phone: string;

  @Column('text')
  address: string;

  @Column('date')
  birthDate: Date;

  @OneToOne(() => User, (user) => user.personalInfo, { onDelete: 'CASCADE' })
  user: User;
}
