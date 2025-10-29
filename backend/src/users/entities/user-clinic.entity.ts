import { Column, Entity, JoinColumn, ManyToOne, PrimaryGeneratedColumn, Unique } from 'typeorm';
import { Clinic } from '../../clinics/entities/clinic.entity';
import { User } from './user.entity';

@Entity('user_clinics')
@Unique('uq_user_clinic', ['user', 'clinic'])
export class UserClinic {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @ManyToOne(() => User, user => user.id, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'user_id' })
  user: User;

  @ManyToOne(() => Clinic, clinic => clinic.id, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'clinic_id' })
  clinic: Clinic;

  // Roles del usuario dentro de esta clínica (admin, doctor, pharmacist, etc.)
  @Column('text', { array: true, default: [] })
  roles: string[];
}
