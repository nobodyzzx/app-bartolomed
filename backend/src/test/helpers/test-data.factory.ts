import { Gender, BloodType } from 'src/patients/entities/patient.entity';
import { ValidRoles } from 'src/users/interfaces';
import { AppointmentStatus, AppointmentType, AppointmentPriority } from 'src/appointments/entities/appointment.entity';

/** Clínica de prueba */
export const makeClinic = (overrides: Record<string, any> = {}) => ({
  id: 'clinic-1',
  name: 'Clínica San Bartolomé',
  address: 'Chulumani, Sud Yungas',
  isActive: true,
  ...overrides,
});

/** Usuario de prueba */
export const makeUser = (overrides: Record<string, any> = {}) => ({
  id: 'user-1',
  email: 'doctor@test.com',
  password: '$2b$10$hashedpassword',
  roles: [ValidRoles.DOCTOR],
  isActive: true,
  personalInfo: { firstName: 'Juan', lastName: 'Pérez' },
  ...overrides,
});

/** Paciente de prueba */
export const makePatient = (overrides: Record<string, any> = {}) => ({
  id: 'patient-1',
  firstName: 'María',
  lastName: 'López',
  documentNumber: '12345678',
  birthDate: new Date('1990-05-15'),
  gender: Gender.FEMALE,
  isActive: true,
  clinic: makeClinic(),
  ...overrides,
});

/** DTO de creación de paciente */
export const makeCreatePatientDto = (overrides: Record<string, any> = {}) => ({
  firstName: 'Pedro',
  lastName: 'Mamani',
  documentNumber: '87654321',
  birthDate: '1985-03-20',
  gender: Gender.MALE,
  clinicId: 'clinic-1',
  ...overrides,
});

/** Cita de prueba */
export const makeAppointment = (overrides: Record<string, any> = {}) => ({
  id: 'appt-1',
  appointmentDate: new Date(Date.now() + 86_400_000), // mañana
  duration: 30,
  type: AppointmentType.CONSULTATION,
  status: AppointmentStatus.SCHEDULED,
  priority: AppointmentPriority.NORMAL,
  reason: 'Control general',
  isActive: true,
  patient: makePatient(),
  doctor: makeUser(),
  clinic: makeClinic(),
  canBeCancelled: () => true,
  ...overrides,
});

/** Stock de medicamento de prueba */
export const makeMedicationStock = (overrides: Record<string, any> = {}) => ({
  id: 'stock-1',
  quantity: 100,
  reservedQuantity: 0,
  sellingPrice: 25.5,
  batchNumber: 'LOTE-001',
  expiryDate: new Date('2026-12-31'),
  medication: { id: 'med-1', name: 'Paracetamol 500mg' },
  ...overrides,
});
