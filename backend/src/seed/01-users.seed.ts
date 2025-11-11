import * as bcrypt from 'bcrypt';
import { DataSource } from 'typeorm';
import { PersonalInfo } from '../users/entities/personal-info.entity';
import { User } from '../users/entities/user.entity';

export async function seed(dataSource: DataSource) {
  const userRepo = dataSource.getRepository(User);
  const piRepo = dataSource.getRepository(PersonalInfo);

  const email = 'admin@example.com';

  const existing = await userRepo.findOne({ where: { email } });
  if (existing) {
    console.log('✅ User already exists:', email);
    return;
  }

  const personalInfo = piRepo.create({
    firstName: 'Admin',
    lastName: 'Demo',
    phone: '+59170000001',
    address: 'Oficina Principal',
    birthDate: new Date('1990-01-01'),
  });
  await piRepo.save(personalInfo);

  const user = userRepo.create({
    email,
    password: bcrypt.hashSync('Abc123', 10),
    roles: ['admin'],
    isActive: true,
    personalInfo: personalInfo,
  });

  await userRepo.save(user);
  console.log('✅ User created:', email);
}
