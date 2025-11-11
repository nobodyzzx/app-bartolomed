import * as bcrypt from 'bcrypt';
import { DataSource } from 'typeorm';
import { Clinic } from '../clinics/entities/clinic.entity';
import { PersonalInfo } from '../users/entities/personal-info.entity';
import { User } from '../users/entities/user.entity';

export async function seed(dataSource: DataSource) {
  const userRepo = dataSource.getRepository(User);
  const piRepo = dataSource.getRepository(PersonalInfo);
  const clinicRepo = dataSource.getRepository(Clinic);

  const email = 'doctor2@example.com';

  const existing = await userRepo.findOne({ where: { email } });
  if (existing) {
    console.log('✅ Doctor user already exists:', email);
    return;
  }

  const personalInfo = piRepo.create({
    firstName: 'Doctor2',
    lastName: 'Demo',
    phone: '+59170000003',
    address: 'Consultorio 1',
    birthDate: new Date('1985-03-22'),
  });
  await piRepo.save(personalInfo);

  const clinic = await clinicRepo.findOne({ where: { name: 'Clínica Demo Bartolomé' } });

  const user = userRepo.create({
    email,
    password: bcrypt.hashSync('Abc123', 10),
    roles: ['doctor'],
    isActive: true,
    personalInfo: personalInfo,
    clinic: clinic || undefined,
  } as any);

  await userRepo.save(user);
  console.log('✅ Doctor created:', email);
}
