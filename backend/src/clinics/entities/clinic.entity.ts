import { Column, CreateDateColumn, Entity, JoinColumn, ManyToOne, OneToMany, PrimaryGeneratedColumn, UpdateDateColumn } from 'typeorm';
import { User } from '../../users/entities';

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

  @Column('text', { nullable: true })
  email?: string;

  @Column('text', { nullable: true })
  description?: string;

  @Column('text', { nullable: true })
  city?: string;

  @Column('text', { nullable: true })
  state?: string;

  @Column('text', { nullable: true })
  zipCode?: string;

  @Column('text', { nullable: true })
  country?: string;

  @Column('bool', { default: true })
  isActive: boolean;

  @CreateDateColumn()
  createdAt: Date;

  @UpdateDateColumn()
  updatedAt: Date;

  @ManyToOne(() => User, { nullable: true })
  @JoinColumn({ name: 'created_by_id' })
  createdBy?: User;

  @OneToMany(() => User, user => user.clinic)
  users: User[];

  @OneToMany('Patient', 'clinic')
  patients: any[];
}
