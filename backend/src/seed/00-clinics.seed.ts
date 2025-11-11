import { DataSource } from 'typeorm';
import { Clinic } from '../clinics/entities/clinic.entity';

export async function seed(dataSource: DataSource) {
  const repo = dataSource.getRepository(Clinic);

  const name = 'Clínica Demo Bartolomé';

  const existing = await repo.findOne({ where: { name } });
  if (existing) {
    console.log('✅ Clinic already exists:', name);
    return;
  }

  const clinic = repo.create({
    name,
    address: 'Calle Principal 123',
    phone: '+59170000000',
    email: 'demo@bartolomed.local',
    description: 'Clínica de ejemplo para desarrollo',
    isActive: true,
  });

  await repo.save(clinic);
  console.log('✅ Clinic created:', name);
}
