import { Injectable, OnModuleInit } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import * as bcrypt from 'bcrypt';
import { Not, Repository } from 'typeorm';
import {
  Appointment,
  AppointmentPriority,
  AppointmentStatus,
  AppointmentType,
} from '../appointments/entities/appointment.entity';
import { Clinic } from '../clinics/entities/clinic.entity';
import { Gender, Patient } from '../patients/entities/patient.entity';
import { Prescription, PrescriptionItem, PrescriptionStatus } from '../prescriptions/entities/prescription.entity';
import { Role } from '../roles/entities/role.entity';
import { PersonalInfo } from '../users/entities/personal-info.entity';
import { ProfessionalInfo } from '../users/entities/professional-info.entity';
import { UserClinic } from '../users/entities/user-clinic.entity';
import { User } from '../users/entities/user.entity';

import { MedicalRecord, RecordStatus, RecordType } from '../medical-records/entities';
import { ProfessionalRoles } from '../users/interfaces/professional-roles';

@Injectable()
export class SeedService implements OnModuleInit {
  constructor(
    @InjectRepository(Role)
    private rolesRepository: Repository<Role>,
    @InjectRepository(User)
    private usersRepository: Repository<User>,
    @InjectRepository(UserClinic)
    private userClinicRepository: Repository<UserClinic>,
    @InjectRepository(PersonalInfo)
    private personalInfoRepository: Repository<PersonalInfo>,
    @InjectRepository(ProfessionalInfo)
    private professionalInfoRepository: Repository<ProfessionalInfo>,
    @InjectRepository(Clinic)
    private clinicsRepository: Repository<Clinic>,
    @InjectRepository(Patient)
    private patientsRepository: Repository<Patient>,
    @InjectRepository(Appointment)
    private appointmentsRepository: Repository<Appointment>,
    @InjectRepository(Prescription)
    private prescriptionsRepository: Repository<Prescription>,
    @InjectRepository(PrescriptionItem)
    private prescriptionItemsRepository: Repository<PrescriptionItem>,
    @InjectRepository(MedicalRecord)
    private medicalRecordRepository: Repository<MedicalRecord>,
  ) {}

  async onModuleInit() {
    await this.seedRoles();
  }

  private async seedRoles() {
    const roles = [
      {
        name: 'super-admin',
        description: 'Acceso completo y gestión de administradores',
        permissions: ['crear', 'editar', 'eliminar', 'ver', 'gestionar_roles', 'gestionar_usuarios'],
        isActive: true,
      },
      {
        name: 'admin',
        description: 'Control total del sistema',
        permissions: ['crear', 'editar', 'eliminar', 'ver', 'gestionar_usuarios'],
        isActive: true,
      },
      {
        name: 'doctor',
        description: 'Médico profesional',
        permissions: ['crear', 'editar', 'ver', 'crear_expediente', 'crear_receta'],
        isActive: true,
      },
      {
        name: 'nurse',
        description: 'Personal de enfermería',
        permissions: ['ver', 'editar', 'crear_expediente'],
        isActive: true,
      },
      {
        name: 'pharmacist',
        description: 'Especialista en farmacia',
        permissions: ['ver', 'editar', 'gestionar_inventario', 'dispensar'],
        isActive: true,
      },
      {
        name: 'receptionist',
        description: 'Personal de recepción',
        permissions: ['ver', 'crear_cita', 'editar_cita', 'ver_pacientes'],
        isActive: true,
      },
      {
        name: 'user',
        description: 'Acceso estándar al sistema',
        permissions: ['ver'],
        isActive: true,
      },
    ];

    for (const roleData of roles) {
      const existingRole = await this.rolesRepository.findOne({
        where: { name: roleData.name },
      });

      if (!existingRole) {
        const role = this.rolesRepository.create(roleData);
        await this.rolesRepository.save(role);
        console.log(`✓ Role creado: ${roleData.name}`);
      } else {
        console.log(`✓ Role ya existe: ${roleData.name}`);
      }
    }
  }

  // Public method to seed demo data manually

  async seedDemo(): Promise<{ ok: true }> {
    // 1. Eliminar todos los datos excepto el usuario admin@bartolomed.com
    const admin = await this.usersRepository.findOne({ where: { email: 'admin@bartolomed.com' } });
    if (!admin) throw new Error('Usuario admin@bartolomed.com no existe');

    // Eliminar en orden seguro por FK
    await this.prescriptionItemsRepository.delete({});
    await this.prescriptionsRepository.delete({});
    await this.appointmentsRepository.delete({});
    await this.medicalRecordRepository.delete({});
    await this.patientsRepository.delete({});
    await this.userClinicRepository.delete({});

    // Desasociar FKs circulares antes de borrar (incluyendo admin temporalmente)
    await this.clinicsRepository.update({}, { createdBy: null }); // clinics.createdBy → users
    await this.usersRepository.update({}, { clinic: null }); // users.clinic → clinics (todos, incluyendo admin)

    // Ahora sí borrar usuarios (excepto admin) y clínicas
    await this.usersRepository.delete({ email: Not('admin@bartolomed.com') });
    await this.clinicsRepository.delete({});

    // 2. Crear clínicas sin createdBy (lo asignamos después)
    const clinic1 = this.clinicsRepository.create({
      name: 'Clínica Central',
      address: 'Av. Principal 123',
      phone: '+591-70000001',
      email: 'central@clinic.local',
      description: 'Clínica principal para datos de demostración',
      isActive: true,
    });
    await this.clinicsRepository.save(clinic1);
    const clinic2 = this.clinicsRepository.create({
      name: 'Clínica Norte',
      address: 'Av. Norte 456',
      phone: '+591-70000021',
      email: 'norte@clinic.local',
      description: 'Clínica secundaria para pruebas',
      isActive: true,
    });
    await this.clinicsRepository.save(clinic2);

    // 3. Crear usuarios (doctores, enfermeros, recepcionistas) y vincularlos a clínicas
    const { doctor: doctor1 } = await this.createDemoUsers(clinic1);
    const { doctor: doctor2 } = await this.createDemoUsers(clinic2);

    // Asignar createdBy a las clínicas ahora que tenemos usuarios
    clinic1.createdBy = doctor1;
    clinic2.createdBy = doctor2;
    await this.clinicsRepository.save([clinic1, clinic2]);

    // 4. Crear pacientes y vincularlos a clínicas y creadores
    const patients1 = await this.createDemoPatients(clinic1, doctor1);
    const patients2 = await this.createDemoPatients(clinic2, doctor2);

    // 5. Crear expedientes médicos relacionados
    await this.createDemoMedicalRecords(clinic1, doctor1, patients1);
    await this.createDemoMedicalRecords(clinic2, doctor2, patients2);

    // 6. Crear citas y recetas relacionadas
    await this.createDemoAppointments(clinic1, doctor1, patients1);
    await this.createDemoAppointments(clinic2, doctor2, patients2);
    await this.createDemoPrescriptions(clinic1, doctor1, patients1);
    await this.createDemoPrescriptions(clinic2, doctor2, patients2);

    // 7. Vincular admin a clínica principal
    await this.ensureAdminClinicAccess(clinic1);

    return { ok: true };
  }

  // Crea expedientes médicos de ejemplo para una clínica
  private async createDemoMedicalRecords(clinic: Clinic, doctor: User, patients: Patient[]): Promise<void> {
    // Pacientes con mucho historial (primeros 2)
    for (let i = 0; i < Math.min(2, patients.length); i++) {
      const patient = patients[i];
      for (let j = 1; j <= 8; j++) {
        const exists = await this.medicalRecordRepository.findOne({
          where: {
            patient: { id: patient.id },
            doctor: { id: doctor.id },
            chiefComplaint: `Historial extenso ${j}`,
          } as any,
        });
        if (exists) continue;
        const record = this.medicalRecordRepository.create({
          type: RecordType.CONSULTATION,
          status: RecordStatus.COMPLETED,
          chiefComplaint: `Historial extenso ${j}`,
          historyOfPresentIllness: `Consulta número ${j} para historial extenso`,
          diagnosis: 'Cefalea recurrente',
          treatmentPlan: 'Ibuprofeno 400mg cada 8h por 5 días.',
          temperature: 36.5 + j * 0.1,
          systolicBP: 120 + j,
          diastolicBP: 80,
          heartRate: 75,
          respiratoryRate: 16,
          oxygenSaturation: 98,
          weight: 70,
          height: 170,
          bmi: 24.2,
          isEmergency: false,
          isActive: true,
          patient,
          doctor,
          createdBy: doctor,
        });
        await this.medicalRecordRepository.save(record);
      }
    }

    // Pacientes con poco historial (siguientes 2)
    for (let i = 2; i < Math.min(4, patients.length); i++) {
      const patient = patients[i];
      for (let j = 1; j <= 2; j++) {
        const exists = await this.medicalRecordRepository.findOne({
          where: {
            patient: { id: patient.id },
            doctor: { id: doctor.id },
            chiefComplaint: `Historial corto ${j}`,
          } as any,
        });
        if (exists) continue;
        const record = this.medicalRecordRepository.create({
          type: RecordType.CONSULTATION,
          status: RecordStatus.COMPLETED,
          chiefComplaint: `Historial corto ${j}`,
          historyOfPresentIllness: `Consulta número ${j} para historial corto`,
          diagnosis: 'Dolor abdominal',
          treatmentPlan: 'Omeprazol 20mg cada 12h por 7 días.',
          temperature: 36.7,
          systolicBP: 118,
          diastolicBP: 78,
          heartRate: 72,
          respiratoryRate: 15,
          oxygenSaturation: 99,
          weight: 65,
          height: 165,
          bmi: 23.9,
          isEmergency: false,
          isActive: true,
          patient,
          doctor,
          createdBy: doctor,
        });
        await this.medicalRecordRepository.save(record);
      }
    }

    // Pacientes sin historial (resto)
    // No se crean expedientes
  }

  private async cleanupStrayClinic() {
    // Try to remove any clinic with name exactly '1212'
    const strayByName = await this.clinicsRepository.find({ where: { name: '1212' } });
    // No consultar por id '1212' porque el tipo es UUID y provoca error de casteo en Postgres
    const toRemove = [...strayByName];
    for (const c of toRemove) {
      try {
        await this.clinicsRepository.remove(c);
        // eslint-disable-next-line no-console
        console.log(`✓ Clínica eliminada (stray): ${c.id} - ${c.name}`);
      } catch {
        // If FK constraints block deletion, deactivate and rename to mark as removed
        c.isActive = false as any;
        c.name = `Eliminada-${c.name}`;
        await this.clinicsRepository.save(c);
        // eslint-disable-next-line no-console
        console.log(`⚠ No se pudo eliminar clínica ${c.id}; marcada como inactiva`);
      }
    }
  }

  private async ensureAdminClinicAccess(clinic: Clinic) {
    const adminEmail = 'admin@bartolomed.com';
    const admin = await this.usersRepository.findOne({ where: { email: adminEmail }, relations: ['clinic'] });
    if (!admin) return;

    // Set primary clinic if different
    if (!admin.clinic || admin.clinic.id !== clinic.id) {
      admin.clinic = clinic;
      await this.usersRepository.save(admin);
    }

    // Ensure membership record exists with admin role
    const existing = await this.userClinicRepository.findOne({
      where: { user: { id: admin.id }, clinic: { id: clinic.id } } as any,
    });
    if (!existing) {
      const membership = this.userClinicRepository.create({ user: admin, clinic, roles: ['admin'] });
      await this.userClinicRepository.save(membership);
    } else if (!existing.roles?.includes('admin')) {
      existing.roles = Array.from(new Set([...(existing.roles || []), 'admin']));
      await this.userClinicRepository.save(existing);
    }
  }

  private async findOrCreateClinic(): Promise<Clinic> {
    let clinic = await this.clinicsRepository.findOne({ where: { name: 'Clínica Central' } });
    if (!clinic) {
      clinic = this.clinicsRepository.create({
        name: 'Clínica Central',
        address: 'Av. Principal 123',
        phone: '+591-70000001',
        email: 'central@clinic.local',
        description: 'Clínica principal para datos de demostración',
        isActive: true,
      });
      clinic = await this.clinicsRepository.save(clinic);
      // Attach creator later if needed
    }
    return clinic;
  }

  private async createDemoUsers(clinic: Clinic): Promise<{ doctor: User; nurse: User; receptionist: User }> {
    const ensureUser = async (
      email: string,
      roles: string[],
      firstName: string,
      lastName: string,
      prof?: Partial<ProfessionalInfo>,
    ) => {
      let user = await this.usersRepository.findOne({ where: { email } });
      if (user) return user;
      const personal = this.personalInfoRepository.create({
        firstName,
        lastName,
        phone: '+591-70000000',
        address: 'Centro',
        birthDate: new Date('1990-01-01'),
      });
      await this.personalInfoRepository.save(personal);

      const professional = this.professionalInfoRepository.create({
        title: prof?.title || 'Lic.',
        role: (prof?.role as ProfessionalRoles) || ProfessionalRoles.OTHER,
        specialization: prof?.specialization || 'General',
        license: prof?.license || 'TMP-0001',
        certifications: [],
        startDate: new Date('2020-01-01'),
      });
      await this.professionalInfoRepository.save(professional);

      user = this.usersRepository.create({
        email,
        password: bcrypt.hashSync('Abc123', 10),
        roles,
        isActive: true,
        personalInfo: personal,
        professionalInfo: professional,
        clinic,
      });
      await this.usersRepository.save(user);
      return user;
    };

    const doctor = await ensureUser('doctor2@example.com', ['doctor', 'user'], 'Doctora', 'Demo', {
      title: 'Dr.',
      role: ProfessionalRoles.DOCTOR,
      specialization: 'Medicina General',
      license: 'MD-12345',
    });
    const nurse = await ensureUser('nurse@example.com', ['nurse', 'user'], 'Enfermera', 'Demo', {
      title: 'Enf.',
      role: ProfessionalRoles.NURSE,
      specialization: 'Enfermería',
      license: 'ENF-9876',
    });
    const receptionist = await ensureUser('reception@example.com', ['receptionist', 'user'], 'Recepción', 'Demo', {
      title: 'Sr./Sra.',
      role: ProfessionalRoles.RECEPTIONIST,
      specialization: 'Atención',
      license: 'REC-0001',
    });

    // Optionally set clinic.createdBy
    const c = await this.clinicsRepository.findOne({ where: { id: clinic.id } });
    if (c && !c.createdBy) {
      c.createdBy = doctor;
      await this.clinicsRepository.save(c);
    }

    return { doctor, nurse, receptionist };
  }

  private async createDemoPatients(clinic: Clinic, createdBy: User): Promise<Patient[]> {
    // 10 pacientes, documentos bolivianos (CI) de 7-8 dígitos, teléfonos con prefijo +591
    const toCreate = [
      { firstName: 'Juan', lastName: 'Pérez', doc: '5537336', phone: '+591-70000002', gender: Gender.MALE },
      { firstName: 'María', lastName: 'García', doc: '7438291', phone: '+591-70000003', gender: Gender.FEMALE },
      { firstName: 'Carlos', lastName: 'López', doc: '6782145', phone: '+591-70000004', gender: Gender.MALE },
      { firstName: 'Ana', lastName: 'Rodríguez', doc: '8123456', phone: '+591-70000005', gender: Gender.FEMALE },
      { firstName: 'Luis', lastName: 'Torres', doc: '7012345', phone: '+591-70000006', gender: Gender.MALE },
      { firstName: 'Sofía', lastName: 'Vargas', doc: '7654321', phone: '+591-70000007', gender: Gender.FEMALE },
      { firstName: 'Miguel', lastName: 'Suárez', doc: '7345678', phone: '+591-70000008', gender: Gender.MALE },
      { firstName: 'Elena', lastName: 'Rivas', doc: '8234567', phone: '+591-70000009', gender: Gender.FEMALE },
      { firstName: 'Diego', lastName: 'Mendoza', doc: '5934123', phone: '+591-70000010', gender: Gender.MALE },
      { firstName: 'Valeria', lastName: 'Quispe', doc: '7845123', phone: '+591-70000011', gender: Gender.FEMALE },
    ];
    const patients: Patient[] = [];
    let idx = 0;
    for (const p of toCreate) {
      let patient = await this.patientsRepository.findOne({ where: { documentNumber: p.doc } });
      if (!patient) {
        patient = this.patientsRepository.create({
          firstName: p.firstName,
          lastName: p.lastName,
          documentNumber: p.doc, // CI boliviano 7-8 dígitos
          birthDate: new Date('1990-06-15'),
          gender: p.gender,
          email: `paciente${++idx}@demo.local`,
          phone: p.phone,
          address: 'Zona Central',
          city: 'Cochabamba',
          state: 'CBBA',
          country: 'BO',
          clinic,
          createdBy,
          isActive: true,
        });
        patient = await this.patientsRepository.save(patient);
      }
      patients.push(patient);
    }
    return patients;
  }

  private async createDemoAppointments(clinic: Clinic, doctor: User, patients: Patient[]): Promise<void> {
    const base = new Date();
    // Garantizar siempre futuro (al menos +24h para evitar validaciones por TZ)
    base.setHours(base.getHours() + 24);
    const count = Math.max(10, patients.length); // al menos 10 citas
    for (let i = 0; i < count; i++) {
      const date = new Date(base.getTime() + i * 60 * 60 * 1000); // intervalos de 1 hora
      const patient = patients[i % patients.length];
      const exists = await this.appointmentsRepository.findOne({
        where: { appointmentDate: date, doctor: { id: doctor.id }, patient: { id: patient.id } },
      });
      if (exists) continue;
      const appt = this.appointmentsRepository.create({
        appointmentDate: date,
        duration: 30,
        type: AppointmentType.CONSULTATION,
        status: i % 2 === 0 ? AppointmentStatus.CONFIRMED : AppointmentStatus.SCHEDULED,
        priority: AppointmentPriority.NORMAL,
        reason: 'Consulta general',
        notes: 'Cita de demostración',
        patient,
        doctor,
        clinic,
        patientEmail: patient.email,
        patientPhone: patient.phone,
      });
      await this.appointmentsRepository.save(appt);
    }
  }

  private async createDemoPrescriptions(clinic: Clinic, doctor: User, patients: Patient[]): Promise<void> {
    const makeNumber = (n: number) => `RX-DEMO-${String(n).padStart(3, '0')}`;
    for (let i = 1; i <= 6; i++) {
      const number = makeNumber(i);
      let rx = await this.prescriptionsRepository.findOne({ where: { prescriptionNumber: number } as any });
      if (rx) continue;
      const patient = patients[(i - 1) % patients.length];
      rx = this.prescriptionsRepository.create({
        prescriptionNumber: number,
        status: PrescriptionStatus.ACTIVE,
        prescriptionDate: new Date(),
        expiryDate: new Date(new Date().getTime() + 30 * 24 * 60 * 60 * 1000),
        diagnosis: 'Infección respiratoria',
        notes: 'Tomar con agua',
        isElectronic: true,
        refillsAllowed: 1,
        refillsUsed: 0,
        patient,
        doctor,
        clinic,
        items: [],
      });
      rx = await this.prescriptionsRepository.save(rx);

      const items = [
        this.prescriptionItemsRepository.create({
          prescription: rx,
          medicationName: 'Paracetamol',
          strength: '500mg',
          dosageForm: 'tablet',
          quantity: '10',
          dosage: '1 tableta',
          frequency: 'cada 8h',
          duration: 5,
          instructions: 'No exceder 3g/día',
          unitPrice: 1.5,
          totalPrice: 15,
        }),
        this.prescriptionItemsRepository.create({
          prescription: rx,
          medicationName: 'Amoxicilina',
          strength: '500mg',
          dosageForm: 'capsule',
          quantity: '21',
          dosage: '1 cápsula',
          frequency: 'cada 8h',
          duration: 7,
          instructions: 'Completar tratamiento',
          unitPrice: 0.8,
          totalPrice: 16.8,
          isControlled: false,
        }),
      ];
      await this.prescriptionItemsRepository.save(items);
    }
  }
}
