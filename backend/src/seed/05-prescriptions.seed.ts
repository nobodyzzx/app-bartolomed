import { DataSource } from 'typeorm';
import { Clinic } from '../clinics/entities/clinic.entity';
import { Patient } from '../patients/entities/patient.entity';
import { Prescription, PrescriptionStatus } from '../prescriptions/entities/prescription.entity';
import { User } from '../users/entities/user.entity';

// Seed multiple prescriptions with varied statuses & scenarios (idempotent per prescriptionNumber)
// - ACTIVE future expiry
// - DISPENSED with refills used
// - COMPLETED (all refills used)
// - EXPIRED (past expiry)
// - CONTROLLED substance example
export async function seed(dataSource: DataSource) {
  const repo = dataSource.getRepository(Prescription);
  const patientRepo = dataSource.getRepository(Patient);
  const userRepo = dataSource.getRepository(User);
  const clinicRepo = dataSource.getRepository(Clinic);

  const clinic = await clinicRepo.findOne({ where: { name: 'Clínica Demo Bartolomé' } });
  const patient = await patientRepo.findOne({ where: { documentNumber: 'P-0001' } });
  const doctor = await userRepo.findOne({ where: { email: 'doctor2@example.com' } });

  if (!clinic || !patient || !doctor) {
    console.log('⚠️ Missing clinic/patient/doctor - skipping prescriptions seed');
    return;
  }

  const today = new Date();

  const seeds: Array<Partial<Prescription>> = [
    {
      prescriptionNumber: 'RX-DEMO-001',
      prescriptionDate: today,
      expiryDate: addDays(today, 30),
      status: PrescriptionStatus.ACTIVE,
      diagnosis: 'Hipertensión arterial leve',
      patientInstructions: 'Tomar con abundante agua, preferentemente en ayunas',
      pharmacyInstructions: 'Verificar presión arterial cada 2 semanas',
      notes: 'Primera visita de control',
      patient,
      doctor,
      clinic,
      refillsAllowed: 2,
      refillsUsed: 0,
      isElectronic: true,
      items: [
        {
          medicationName: 'Losartán',
          strength: '50mg',
          dosageForm: 'Tableta',
          quantity: '30',
          dosage: '1 tableta',
          frequency: 'Una vez al día',
          route: 'Oral',
          duration: 30,
          instructions: 'Tomar por la mañana',
        },
        {
          medicationName: 'Metformina',
          strength: '850mg',
          dosageForm: 'Tableta',
          quantity: '60',
          dosage: '1 tableta',
          frequency: 'Dos veces al día',
          route: 'Oral',
          duration: 30,
          instructions: 'Con desayuno y cena',
        },
      ],
      isActive: true,
    },
    {
      prescriptionNumber: 'RX-DEMO-002',
      prescriptionDate: addDays(today, -5),
      expiryDate: addDays(today, 25),
      status: PrescriptionStatus.DISPENSED,
      diagnosis: 'Diabetes tipo 2',
      patientInstructions: 'Controlar glucosa diaria',
      pharmacyInstructions: 'Entrega parcial permitida',
      patient,
      doctor,
      clinic,
      refillsAllowed: 3,
      refillsUsed: 1,
      isElectronic: true,
      items: [
        {
          medicationName: 'Metformina',
          strength: '500mg',
          dosageForm: 'Tableta',
          quantity: '60',
          dosage: '1 tableta',
          frequency: 'Dos veces al día',
          route: 'Oral',
          duration: 30,
          instructions: 'Con comida',
        },
      ],
      isActive: true,
    },
    {
      prescriptionNumber: 'RX-DEMO-003',
      prescriptionDate: addDays(today, -40),
      expiryDate: addDays(today, -10), // expired
      status: PrescriptionStatus.EXPIRED,
      diagnosis: 'Alergia estacional',
      patientInstructions: 'Evitar alergenos conocidos',
      patient,
      doctor,
      clinic,
      refillsAllowed: 1,
      refillsUsed: 1,
      isElectronic: true,
      items: [
        {
          medicationName: 'Loratadina',
          strength: '10mg',
          dosageForm: 'Tableta',
          quantity: '10',
          dosage: '1 tableta',
          frequency: 'Una vez al día',
          route: 'Oral',
          duration: 10,
          instructions: 'Solo si hay síntomas',
        },
      ],
      isActive: true,
    },
    {
      prescriptionNumber: 'RX-DEMO-004',
      prescriptionDate: addDays(today, -15),
      expiryDate: addDays(today, 10),
      status: PrescriptionStatus.COMPLETED,
      diagnosis: 'Infección bacteriana leve',
      patientInstructions: 'Completar antibiótico aunque mejore',
      pharmacyInstructions: 'Confirmar que se completó el ciclo',
      patient,
      doctor,
      clinic,
      refillsAllowed: 0,
      refillsUsed: 0,
      isElectronic: true,
      items: [
        {
          medicationName: 'Amoxicilina',
          strength: '500mg',
          dosageForm: 'Cápsula',
          quantity: '21',
          dosage: '1 cápsula',
          frequency: 'Tres veces al día',
          route: 'Oral',
          duration: 7,
          instructions: 'Cada 8 horas',
        },
      ],
      isActive: true,
    },
    {
      prescriptionNumber: 'RX-DEMO-005',
      prescriptionDate: today,
      expiryDate: addDays(today, 7),
      status: PrescriptionStatus.ACTIVE,
      diagnosis: 'Dolor agudo postoperatorio',
      patientInstructions: 'No conducir mientras use el medicamento',
      pharmacyInstructions: 'Controlar entrega por ser controlado',
      notes: 'Dosis reducida si hay mareo',
      patient,
      doctor,
      clinic,
      refillsAllowed: 1,
      refillsUsed: 0,
      isElectronic: true,
      isControlledSubstance: true,
      items: [
        {
          medicationName: 'Tramadol',
          strength: '50mg',
          dosageForm: 'Tableta',
          quantity: '14',
          dosage: '1 tableta',
          frequency: 'Cada 8 horas',
          route: 'Oral',
          duration: 7,
          instructions: 'Suspender si hay somnolencia excesiva',
        },
      ],
      isActive: true,
    },
  ];

  for (const seedData of seeds) {
    const exists = await repo.findOne({ where: { prescriptionNumber: seedData.prescriptionNumber as string } });
    if (exists) {
      console.log(`↪️ Skipping existing prescription ${seedData.prescriptionNumber}`);
      continue;
    }
    const entity = repo.create(seedData as any);
    await repo.save(entity);
    console.log(`✅ Created prescription ${seedData.prescriptionNumber}`);
  }
}

function addDays(base: Date, days: number): Date {
  const d = new Date(base.getTime());
  d.setDate(d.getDate() + days);
  return d;
}
