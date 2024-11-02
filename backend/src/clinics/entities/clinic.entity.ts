import { User } from '../../users/entities';
import { Column, Entity, OneToMany, PrimaryGeneratedColumn } from 'typeorm';

@Entity('clinics')
export class Clinic {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column('text', { unique: true })
  name: string;

  @Column('text')
  address: string;

  @Column('text')
  phone: string;

  @Column('bool', { default: true })
  isActive: boolean;

  @OneToMany(() => User, (user) => user.clinic)
  users: User[];
}
