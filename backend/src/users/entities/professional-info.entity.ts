import { Column, Entity, OneToOne, PrimaryGeneratedColumn } from 'typeorm';
import { User } from './user.entity';

@Entity('professional_info')
export class ProfessionalInfo {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column('text')
  specialty: string;

  @Column('text')
  license: string;

  @Column('text', { array: true, default: [] })
  certifications: string[];

  @Column('text', { nullable: true })
  education: string;

  @Column('text', { nullable: true })
  experience: string;

  @OneToOne(() => User, (user) => user.professionalInfo)
  user: User;
}
