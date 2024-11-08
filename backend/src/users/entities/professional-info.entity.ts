import { Column, Entity, OneToOne, PrimaryGeneratedColumn } from 'typeorm';
import { User } from './user.entity';
import { ProfessionalRoles } from '../interfaces/professional-roles';

@Entity('professional_info')
export class ProfessionalInfo {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column('text')
  title: string;

  @Column({
    type: 'enum',
    enum: ProfessionalRoles,
    default: ProfessionalRoles.OTHER,
  })
  role: ProfessionalRoles;

  @Column('text')
  specialization: string;

  @Column('text')
  license: string;

  @Column('text', { array: true, default: [] })
  certifications: string[];

  @Column('date')
  startDate: Date;

  @Column('text', { nullable: true })
  description?: string;

  @Column('text', { array: true, default: [], nullable: true })
  areas?: string[];

  @OneToOne(() => User, (user) => user.professionalInfo, {
    onDelete: 'CASCADE',
  })
  user: User;
}
