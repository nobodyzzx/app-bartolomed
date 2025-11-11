import { DataSource } from 'typeorm';
import { Clinic } from '../clinics/entities/clinic.entity';
import { Patient } from '../patients/entities/patient.entity';

export async function seed(dataSource: DataSource) {
  const repo = dataSource.getRepository(Patient);
  const clinicRepo = dataSource.getRepository(Clinic);

  const clinic = await clinicRepo.findOne({ where: { name: 'Clínica Demo Bartolomé' } });
  if (!clinic) {
    console.log('⚠️ Clinic not found, skipping patients seed');
    return;
  }

  const documentNumber = 'P-0001';
  const existing = await repo.findOne({ where: { documentNumber } });
  if (existing) {
    console.log('✅ Patient already exists:', documentNumber);
    return;
  }

  const patient = repo.create({
    firstName: 'Paciente',
    lastName: 'Demo',
    documentNumber,
    birthDate: new Date('1990-06-15'),
    gender: 'other',
    phone: '+59170000002',
    email: 'patient.demo@example.com',
    clinic: clinic,
    isActive: true,
  } as any);

  await repo.save(patient);
  console.log('✅ Patient created:', documentNumber);
}
