import { DataSource } from 'typeorm';
import { Appointment } from '../appointments/entities/appointment.entity';
import { Clinic } from '../clinics/entities/clinic.entity';
import { Patient } from '../patients/entities/patient.entity';
import { User } from '../users/entities/user.entity';

export async function seed(dataSource: DataSource) {
  const repo = dataSource.getRepository(Appointment);
  const patientRepo = dataSource.getRepository(Patient);
  const userRepo = dataSource.getRepository(User);
  const clinicRepo = dataSource.getRepository(Clinic);

  const clinic = await clinicRepo.findOne({ where: { name: 'Clínica Demo Bartolomé' } });
  const patient = await patientRepo.findOne({ where: { documentNumber: 'P-0001' } });
  const doctor = await userRepo.findOne({ where: { email: 'doctor2@example.com' } });

  if (!clinic || !patient || !doctor) {
    console.log('⚠️ Missing clinic/patient/doctor - skipping appointments seed');
    return;
  }

  // Schedule for tomorrow at 10:00
  const tomorrow = new Date();
  tomorrow.setDate(tomorrow.getDate() + 1);
  tomorrow.setHours(10, 0, 0, 0);

  // Check if similar appointment exists
  const existing = await repo.findOne({ where: { appointmentDate: tomorrow } });
  if (existing) {
    console.log('✅ Appointment already exists at', tomorrow.toISOString());
    return;
  }

  const appointment = repo.create({
    appointmentDate: tomorrow,
    duration: 30,
    type: 'consultation',
    priority: 'normal',
    reason: 'Consulta de prueba',
    patient: patient,
    doctor: doctor,
    clinic: clinic,
    isActive: true,
  } as any);

  await repo.save(appointment);
  console.log('✅ Appointment created for', tomorrow.toISOString());
}
