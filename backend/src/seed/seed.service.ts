import { Injectable, Logger, OnModuleInit } from '@nestjs/common';
import { InjectDataSource, InjectRepository } from '@nestjs/typeorm';
import * as bcrypt from 'bcrypt';
import { DataSource, Not, Repository } from 'typeorm';
import {
  Appointment,
  AppointmentPriority,
  AppointmentStatus,
  AppointmentType,
} from '../appointments/entities/appointment.entity';
import { Clinic } from '../clinics/entities/clinic.entity';
import { MedicalRecord, RecordStatus, RecordType } from '../medical-records/entities';
import { Gender, Patient } from '../patients/entities/patient.entity';
import {
  MedicationCategory,
  MedicationStock,
  Medication,
  StorageCondition,
} from '../pharmacy/entities/pharmacy.entity';
import { Prescription, PrescriptionItem, PrescriptionStatus } from '../prescriptions/entities/prescription.entity';
import { Role } from '../roles/entities/role.entity';
import { PersonalInfo } from '../users/entities/personal-info.entity';
import { ProfessionalInfo } from '../users/entities/professional-info.entity';
import { UserClinic } from '../users/entities/user-clinic.entity';
import { User } from '../users/entities/user.entity';
import { ProfessionalRoles } from '../users/interfaces/professional-roles';

// ---------------------------------------------------------------------------
// Datos de medicamentos extraídos de los CSV plantillas
// ---------------------------------------------------------------------------

interface MedDef {
  code: string;
  name: string;
  genericName?: string;
  strength: string;
  dosageForm: string;
  category: MedicationCategory;
  storageCondition?: StorageCondition;
  requiresPrescription?: boolean;
  isControlledSubstance?: boolean;
  description?: string;
}

interface StockDef {
  code: string;
  batchSuffix: string; // se prefixa con CLINIC para unicidad
  quantity: number;
  unitCost: number;
  sellingPrice: number;
  expiryDate: string;
  location: string;
  minimumStock: number;
}

const MEDS_CHULUMANI: MedDef[] = [
  { code: 'CHU-003', name: 'Ambroxol 30 mg jarabe adulto', genericName: 'Ambroxol', strength: '30mg', dosageForm: 'jarabe', category: MedicationCategory.RESPIRATORY, description: 'Mucolítico y expectorante' },
  { code: 'CHU-004', name: 'Ambroxol 15 mg jarabe pediátrico', genericName: 'Ambroxol', strength: '15mg', dosageForm: 'jarabe', category: MedicationCategory.RESPIRATORY, description: 'Mucolítico pediátrico' },
  { code: 'CHU-007', name: 'Amoxicilina 500 mg', genericName: 'Amoxicilina', strength: '500mg', dosageForm: 'tablet', category: MedicationCategory.ANTIBIOTIC, requiresPrescription: true, description: 'Antibiótico betalactámico' },
  { code: 'CHU-010', name: 'Agua destilada 5 ml', genericName: 'Agua destilada', strength: '5ml', dosageForm: 'injection', category: MedicationCategory.OTHER, description: 'Agua para inyección' },
  { code: 'CHU-013', name: 'Lidocaína 2% 10 ml', genericName: 'Lidocaína', strength: '2%', dosageForm: 'injection', category: MedicationCategory.ANALGESIC, requiresPrescription: true, description: 'Anestésico local' },
  { code: 'CHU-016', name: 'Ácido Fólico', genericName: 'Ácido Fólico', strength: '5mg', dosageForm: 'tablet', category: MedicationCategory.SUPPLEMENT, description: 'Suplemento vitamínico' },
  { code: 'CHU-017', name: 'Alcafen (Ibuprofeno)', genericName: 'Ibuprofeno', strength: '400mg', dosageForm: 'tablet', category: MedicationCategory.ANALGESIC, description: 'Antiinflamatorio no esteroideo' },
  { code: 'CHU-023', name: 'Alcofex (Ibuprofeno)', genericName: 'Ibuprofeno', strength: '400mg', dosageForm: 'tablet', category: MedicationCategory.ANALGESIC, description: 'Antiinflamatorio no esteroideo' },
  { code: 'CHU-024', name: 'Agua oxigenada 50ml', genericName: 'Peróxido de hidrógeno', strength: '3%', dosageForm: 'liquid', category: MedicationCategory.OTHER, description: 'Antiséptico' },
  { code: 'CHU-027', name: 'Algodón 10 g', genericName: 'Algodón hidrófilo', strength: '10g', dosageForm: 'insumo', category: MedicationCategory.OTHER, storageCondition: StorageCondition.DRY_PLACE, description: 'Material de curación' },
  { code: 'CHU-029', name: 'Ampicilina 500 mg', genericName: 'Ampicilina', strength: '500mg', dosageForm: 'tablet', category: MedicationCategory.ANTIBIOTIC, requiresPrescription: true, description: 'Antibiótico betalactámico' },
  { code: 'CHU-030', name: 'Atorvastatina 20 mg', genericName: 'Atorvastatina', strength: '20mg', dosageForm: 'tablet', category: MedicationCategory.CARDIOVASCULAR, requiresPrescription: true, description: 'Hipolipemiante' },
  { code: 'CHU-031', name: 'Atorvastatina 10 mg', genericName: 'Atorvastatina', strength: '10mg', dosageForm: 'tablet', category: MedicationCategory.CARDIOVASCULAR, requiresPrescription: true, description: 'Hipolipemiante' },
  { code: 'CHU-032', name: 'ASA 100 mg', genericName: 'Ácido Acetilsalicílico', strength: '100mg', dosageForm: 'tablet', category: MedicationCategory.CARDIOVASCULAR, description: 'Antiagregante plaquetario' },
  { code: 'CHU-038', name: 'ASA 500 mg', genericName: 'Ácido Acetilsalicílico', strength: '500mg', dosageForm: 'tablet', category: MedicationCategory.ANALGESIC, description: 'Analgésico antiinflamatorio' },
  { code: 'CHU-039', name: 'Aciclovir 200 mg', genericName: 'Aciclovir', strength: '200mg', dosageForm: 'tablet', category: MedicationCategory.ANTIVIRAL, requiresPrescription: true, description: 'Antiviral para herpes' },
  { code: 'CHU-042', name: 'Amlodipina 10 mg', genericName: 'Amlodipina', strength: '10mg', dosageForm: 'tablet', category: MedicationCategory.CARDIOVASCULAR, requiresPrescription: true, description: 'Antihipertensivo' },
  { code: 'CHU-044', name: 'Ajo', genericName: 'Ajo', strength: '500mg', dosageForm: 'tablet', category: MedicationCategory.SUPPLEMENT, description: 'Suplemento cardiovascular' },
  { code: 'CHU-052', name: 'Azitromicina 500 mg', genericName: 'Azitromicina', strength: '500mg', dosageForm: 'tablet', category: MedicationCategory.ANTIBIOTIC, requiresPrescription: true, description: 'Antibiótico macrólido' },
  { code: 'CHU-016b', name: 'Paracetamol 500 mg', genericName: 'Paracetamol', strength: '500mg', dosageForm: 'tablet', category: MedicationCategory.ANALGESIC, description: 'Analgésico y antipirético' },
];

const STOCK_CHULUMANI: StockDef[] = [
  { code: 'CHU-003',  batchSuffix: '001', quantity: 6,   unitCost: 50,  sellingPrice: 60,  expiryDate: '2026-12-31', location: 'Farmacia',     minimumStock: 5  },
  { code: 'CHU-004',  batchSuffix: '002', quantity: 15,  unitCost: 50,  sellingPrice: 60,  expiryDate: '2026-12-31', location: 'Farmacia',     minimumStock: 5  },
  { code: 'CHU-007',  batchSuffix: '003', quantity: 914, unitCost: 2,   sellingPrice: 2.5, expiryDate: '2026-06-30', location: 'Farmacia',     minimumStock: 100},
  { code: 'CHU-010',  batchSuffix: '004', quantity: 100, unitCost: 4,   sellingPrice: 5,   expiryDate: '2027-12-31', location: 'Farmacia',     minimumStock: 20 },
  { code: 'CHU-013',  batchSuffix: '005', quantity: 4,   unitCost: 12,  sellingPrice: 15,  expiryDate: '2026-12-31', location: 'Farmacia',     minimumStock: 5  },
  { code: 'CHU-016',  batchSuffix: '006', quantity: 180, unitCost: 4,   sellingPrice: 5,   expiryDate: '2027-06-30', location: 'Farmacia',     minimumStock: 30 },
  { code: 'CHU-017',  batchSuffix: '007', quantity: 120, unitCost: 2.4, sellingPrice: 3,   expiryDate: '2026-12-31', location: 'Farmacia',     minimumStock: 20 },
  { code: 'CHU-023',  batchSuffix: '008', quantity: 95,  unitCost: 2.8, sellingPrice: 3.5, expiryDate: '2026-12-31', location: 'Farmacia',     minimumStock: 20 },
  { code: 'CHU-024',  batchSuffix: '009', quantity: 9,   unitCost: 12,  sellingPrice: 15,  expiryDate: '2026-12-31', location: 'Farmacia',     minimumStock: 5  },
  { code: 'CHU-027',  batchSuffix: '010', quantity: 6,   unitCost: 4.8, sellingPrice: 6,   expiryDate: '2027-12-31', location: 'Almacén',      minimumStock: 10 },
  { code: 'CHU-029',  batchSuffix: '011', quantity: 22,  unitCost: 2.4, sellingPrice: 3,   expiryDate: '2026-06-30', location: 'Farmacia',     minimumStock: 10 },
  { code: 'CHU-030',  batchSuffix: '012', quantity: 690, unitCost: 8,   sellingPrice: 10,  expiryDate: '2027-12-31', location: 'Farmacia',     minimumStock: 50 },
  { code: 'CHU-031',  batchSuffix: '013', quantity: 75,  unitCost: 3.2, sellingPrice: 4,   expiryDate: '2027-12-31', location: 'Farmacia',     minimumStock: 20 },
  { code: 'CHU-032',  batchSuffix: '014', quantity: 94,  unitCost: 2.4, sellingPrice: 3,   expiryDate: '2027-06-30', location: 'Farmacia',     minimumStock: 20 },
  { code: 'CHU-038',  batchSuffix: '015', quantity: 6,   unitCost: 1.6, sellingPrice: 2,   expiryDate: '2027-06-30', location: 'Farmacia',     minimumStock: 10 },
  { code: 'CHU-039',  batchSuffix: '016', quantity: 30,  unitCost: 5,   sellingPrice: 7,   expiryDate: '2026-12-31', location: 'Farmacia',     minimumStock: 10 },
  { code: 'CHU-042',  batchSuffix: '017', quantity: 74,  unitCost: 3.2, sellingPrice: 4,   expiryDate: '2027-12-31', location: 'Farmacia',     minimumStock: 20 },
  { code: 'CHU-044',  batchSuffix: '018', quantity: 85,  unitCost: 2.4, sellingPrice: 3,   expiryDate: '2027-06-30', location: 'Farmacia',     minimumStock: 20 },
  { code: 'CHU-052',  batchSuffix: '019', quantity: 48,  unitCost: 6,   sellingPrice: 8,   expiryDate: '2026-12-31', location: 'Farmacia',     minimumStock: 15 },
  { code: 'CHU-016b', batchSuffix: '020', quantity: 200, unitCost: 1.5, sellingPrice: 2,   expiryDate: '2027-06-30', location: 'Farmacia',     minimumStock: 50 },
];

const MEDS_IRUPANA: MedDef[] = [
  { code: 'IRU-MED-005', name: 'Clorfeniramina 10mg ampolla', genericName: 'Clorfeniramina', strength: '10mg', dosageForm: 'injection', category: MedicationCategory.ANTIHISTAMINE, description: 'Antihistamínico inyectable' },
  { code: 'IRU-MED-006', name: 'Dexametasona 8mg ampolla', genericName: 'Dexametasona', strength: '8mg', dosageForm: 'injection', category: MedicationCategory.ENDOCRINE, requiresPrescription: true, description: 'Corticoide sistémico' },
  { code: 'IRU-MED-011', name: 'Agua Oxigenada 60ml', genericName: 'Peróxido de Hidrógeno', strength: '3%', dosageForm: 'liquid', category: MedicationCategory.DERMATOLOGICAL, description: 'Antiséptico tópico' },
  { code: 'IRU-MED-018', name: 'Paracetamol 125mg/5ml jarabe', genericName: 'Paracetamol', strength: '125mg/5ml', dosageForm: 'liquid', category: MedicationCategory.ANALGESIC, description: 'Analgésico pediátrico' },
  { code: 'IRU-MED-019', name: 'Test de Embarazo', genericName: 'Test de Embarazo', strength: 'unitario', dosageForm: 'other', category: MedicationCategory.OTHER, description: 'Diagnóstico de embarazo' },
  { code: 'IRU-MED-023', name: 'Loperamida 2mg', genericName: 'Loperamida', strength: '2mg', dosageForm: 'tablet', category: MedicationCategory.GASTROINTESTINAL, description: 'Antidiarreico' },
  { code: 'IRU-MED-028', name: 'Ketorolaco 30mg ampolla', genericName: 'Ketorolaco', strength: '30mg', dosageForm: 'injection', category: MedicationCategory.ANALGESIC, requiresPrescription: true, description: 'Analgésico antiinflamatorio inyectable' },
  { code: 'IRU-MED-032', name: 'Ceftriaxona 1g ampolla', genericName: 'Ceftriaxona', strength: '1g', dosageForm: 'injection', category: MedicationCategory.ANTIBIOTIC, requiresPrescription: true, description: 'Cefalosporina 3ra generación' },
  { code: 'IRU-MED-035', name: 'Fluconazol 200mg', genericName: 'Fluconazol', strength: '200mg', dosageForm: 'tablet', category: MedicationCategory.DERMATOLOGICAL, requiresPrescription: true, description: 'Antifúngico sistémico' },
  { code: 'IRU-MED-043', name: 'Mentizan crema', genericName: 'Mentizan', strength: 'tópico', dosageForm: 'cream', category: MedicationCategory.DERMATOLOGICAL, description: 'Crema dermatológica' },
  { code: 'IRU-MED-050', name: 'Hilo Nylon sutura', genericName: 'Hilo Nylon', strength: '3-0', dosageForm: 'other', category: MedicationCategory.OTHER, description: 'Material de sutura' },
  { code: 'IRU-MED-051', name: 'Dicloxacilina 500mg', genericName: 'Dicloxacilina', strength: '500mg', dosageForm: 'tablet', category: MedicationCategory.ANTIBIOTIC, requiresPrescription: true, description: 'Antibiótico betalactámico' },
  { code: 'IRU-MED-062', name: 'Cotrimoxazol 960mg', genericName: 'Cotrimoxazol', strength: '960mg', dosageForm: 'tablet', category: MedicationCategory.ANTIBIOTIC, requiresPrescription: true, description: 'Sulfonamida+trimetoprim' },
  { code: 'IRU-MED-066', name: 'Ibuprofeno 600mg', genericName: 'Ibuprofeno', strength: '600mg', dosageForm: 'tablet', category: MedicationCategory.ANALGESIC, description: 'Antiinflamatorio no esteroideo' },
  { code: 'IRU-MED-069', name: 'Paracetamol 500mg', genericName: 'Paracetamol', strength: '500mg', dosageForm: 'tablet', category: MedicationCategory.ANALGESIC, description: 'Analgésico y antipirético' },
  { code: 'IRU-MED-073', name: 'Diclofenaco 50mg', genericName: 'Diclofenaco', strength: '50mg', dosageForm: 'tablet', category: MedicationCategory.ANALGESIC, description: 'Antiinflamatorio no esteroideo' },
  { code: 'IRU-MED-076', name: 'Ciprofloxacina 500mg', genericName: 'Ciprofloxacina', strength: '500mg', dosageForm: 'tablet', category: MedicationCategory.ANTIBIOTIC, requiresPrescription: true, description: 'Antibiótico fluoroquinolona' },
  { code: 'IRU-MED-086', name: 'Terracolin Suspensión', genericName: 'Terracolin', strength: '250mg/5ml', dosageForm: 'suspension', category: MedicationCategory.ANTIBIOTIC, requiresPrescription: true, description: 'Antibiótico en suspensión' },
  { code: 'IRU-MED-088', name: 'Dolocadma crema', genericName: 'Dolocadma', strength: 'tópico', dosageForm: 'cream', category: MedicationCategory.ANALGESIC, description: 'Crema analgésica tópica' },
  { code: 'IRU-MED-089', name: 'Vitamina C blíster', genericName: 'Vitamina C', strength: '500mg', dosageForm: 'tablet', category: MedicationCategory.SUPPLEMENT, description: 'Suplemento vitamínico' },
];

const STOCK_IRUPANA: StockDef[] = [
  { code: 'IRU-MED-005', batchSuffix: '001', quantity: 20,  unitCost: 8,   sellingPrice: 12,  expiryDate: '2026-12-31', location: 'Farmacia',  minimumStock: 5  },
  { code: 'IRU-MED-006', batchSuffix: '002', quantity: 15,  unitCost: 12,  sellingPrice: 18,  expiryDate: '2026-12-31', location: 'Farmacia',  minimumStock: 5  },
  { code: 'IRU-MED-011', batchSuffix: '003', quantity: 3,   unitCost: 5,   sellingPrice: 8,   expiryDate: '2027-06-30', location: 'Farmacia',  minimumStock: 5  },
  { code: 'IRU-MED-018', batchSuffix: '004', quantity: 5,   unitCost: 18,  sellingPrice: 25,  expiryDate: '2026-12-31', location: 'Farmacia',  minimumStock: 5  },
  { code: 'IRU-MED-019', batchSuffix: '005', quantity: 30,  unitCost: 8,   sellingPrice: 12,  expiryDate: '2027-12-31', location: 'Farmacia',  minimumStock: 10 },
  { code: 'IRU-MED-023', batchSuffix: '006', quantity: 50,  unitCost: 2,   sellingPrice: 3,   expiryDate: '2027-06-30', location: 'Farmacia',  minimumStock: 20 },
  { code: 'IRU-MED-028', batchSuffix: '007', quantity: 20,  unitCost: 15,  sellingPrice: 22,  expiryDate: '2026-12-31', location: 'Farmacia',  minimumStock: 10 },
  { code: 'IRU-MED-032', batchSuffix: '008', quantity: 20,  unitCost: 35,  sellingPrice: 50,  expiryDate: '2026-06-30', location: 'Refrigerador', minimumStock: 5  },
  { code: 'IRU-MED-035', batchSuffix: '009', quantity: 30,  unitCost: 12,  sellingPrice: 18,  expiryDate: '2026-12-31', location: 'Farmacia',  minimumStock: 10 },
  { code: 'IRU-MED-043', batchSuffix: '010', quantity: 5,   unitCost: 10,  sellingPrice: 15,  expiryDate: '2027-06-30', location: 'Farmacia',  minimumStock: 5  },
  { code: 'IRU-MED-050', batchSuffix: '011', quantity: 5,   unitCost: 25,  sellingPrice: 40,  expiryDate: '2027-12-31', location: 'Almacén',   minimumStock: 3  },
  { code: 'IRU-MED-051', batchSuffix: '012', quantity: 100, unitCost: 3,   sellingPrice: 4.5, expiryDate: '2026-12-31', location: 'Farmacia',  minimumStock: 30 },
  { code: 'IRU-MED-062', batchSuffix: '013', quantity: 50,  unitCost: 4,   sellingPrice: 6,   expiryDate: '2027-06-30', location: 'Farmacia',  minimumStock: 15 },
  { code: 'IRU-MED-066', batchSuffix: '014', quantity: 100, unitCost: 2.5, sellingPrice: 4,   expiryDate: '2027-06-30', location: 'Farmacia',  minimumStock: 30 },
  { code: 'IRU-MED-069', batchSuffix: '015', quantity: 200, unitCost: 1.5, sellingPrice: 2.5, expiryDate: '2027-06-30', location: 'Farmacia',  minimumStock: 50 },
  { code: 'IRU-MED-073', batchSuffix: '016', quantity: 100, unitCost: 2,   sellingPrice: 3,   expiryDate: '2027-06-30', location: 'Farmacia',  minimumStock: 30 },
  { code: 'IRU-MED-076', batchSuffix: '017', quantity: 50,  unitCost: 5,   sellingPrice: 8,   expiryDate: '2026-12-31', location: 'Farmacia',  minimumStock: 15 },
  { code: 'IRU-MED-086', batchSuffix: '018', quantity: 4,   unitCost: 22,  sellingPrice: 32,  expiryDate: '2026-12-31', location: 'Farmacia',  minimumStock: 3  },
  { code: 'IRU-MED-088', batchSuffix: '019', quantity: 100, unitCost: 8,   sellingPrice: 12,  expiryDate: '2027-06-30', location: 'Farmacia',  minimumStock: 20 },
  { code: 'IRU-MED-089', batchSuffix: '020', quantity: 100, unitCost: 3,   sellingPrice: 5,   expiryDate: '2027-06-30', location: 'Farmacia',  minimumStock: 30 },
];

// ---------------------------------------------------------------------------
// SeedService
// ---------------------------------------------------------------------------

@Injectable()
export class SeedService implements OnModuleInit {
  private readonly logger = new Logger(SeedService.name);

  constructor(
    @InjectDataSource()
    private dataSource: DataSource,
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
    @InjectRepository(Medication)
    private medicationRepository: Repository<Medication>,
    @InjectRepository(MedicationStock)
    private medicationStockRepository: Repository<MedicationStock>,
  ) {}

  async onModuleInit() {
    await this.seedRoles();
  }

  // ---------------------------------------------------------------------------
  // Roles
  // ---------------------------------------------------------------------------

  private async seedRoles() {
    const roles = [
      { name: 'super-admin', description: 'Acceso completo y gestión de administradores', permissions: ['crear', 'editar', 'eliminar', 'ver', 'gestionar_roles', 'gestionar_usuarios'], isActive: true },
      { name: 'admin',       description: 'Control total del sistema',                    permissions: ['crear', 'editar', 'eliminar', 'ver', 'gestionar_usuarios'], isActive: true },
      { name: 'doctor',      description: 'Médico profesional',                            permissions: ['crear', 'editar', 'ver', 'crear_expediente', 'crear_receta'], isActive: true },
      { name: 'nurse',       description: 'Personal de enfermería',                        permissions: ['ver', 'editar', 'crear_expediente'], isActive: true },
      { name: 'pharmacist',  description: 'Especialista en farmacia',                      permissions: ['ver', 'editar', 'gestionar_inventario', 'dispensar'], isActive: true },
      { name: 'receptionist',description: 'Personal de recepción',                         permissions: ['ver', 'crear_cita', 'editar_cita', 'ver_pacientes'], isActive: true },
      { name: 'user',        description: 'Acceso estándar al sistema',                    permissions: ['ver'], isActive: true },
    ];

    for (const roleData of roles) {
      const exists = await this.rolesRepository.findOne({ where: { name: roleData.name } });
      if (!exists) {
        await this.rolesRepository.save(this.rolesRepository.create(roleData));
        this.logger.log(`Role creado: ${roleData.name}`);
      }
    }
  }

  // ---------------------------------------------------------------------------
  // seedDemo — punto de entrada público
  // ---------------------------------------------------------------------------

  async seedDemo(): Promise<{ ok: true }> {
    const admin = await this.usersRepository.findOne({ where: { email: 'admin@bartolomed.com' } });
    if (!admin) throw new Error('Usuario admin@bartolomed.com no existe. Ejecuta el bootstrap primero.');

    await this.cleanAll();

    // Crear clínicas
    const clinicChu = await this.createClinic(
      'San Bartolomé',
      'Av. Bolívar 12, Chulumani',
      '72345600',
      'sanbartolome@bartolomed.com',
      'Centro de salud municipal, Chulumani — Sud Yungas',
    );
    const clinicIru = await this.createClinic(
      'San Jorge',
      'Calle Sucre 45, Irupana',
      '72345700',
      'sanjorge@bartolomed.com',
      'Centro de salud municipal, Irupana — Sud Yungas',
    );

    // Crear personal
    const staffChu = await this.createStaff(clinicChu, 'chu');
    const staffIru = await this.createStaff(clinicIru, 'iru');

    // Asignar createdBy
    clinicChu.createdBy = staffChu.doctor;
    clinicIru.createdBy = staffIru.doctor;
    await this.clinicsRepository.save([clinicChu, clinicIru]);

    // Crear pacientes
    const patsChu = await this.createPatients(clinicChu, staffChu.doctor, 'CHU');
    const patsIru = await this.createPatients(clinicIru, staffIru.doctor, 'IRU');

    // Expedientes, citas, recetas
    await this.createDemoMedicalRecords(clinicChu, staffChu.doctor, patsChu);
    await this.createDemoMedicalRecords(clinicIru, staffIru.doctor, patsIru);
    await this.createDemoAppointments(clinicChu, staffChu.doctor, patsChu);
    await this.createDemoAppointments(clinicIru, staffIru.doctor, patsIru);

    // Medicamentos y stock
    const medMapChu = await this.createMedications(MEDS_CHULUMANI);
    const medMapIru = await this.createMedications(MEDS_IRUPANA);
    const stocksChu = await this.createStock(clinicChu, medMapChu, STOCK_CHULUMANI, 'CHU');
    const stocksIru = await this.createStock(clinicIru, medMapIru, STOCK_IRUPANA, 'IRU');

    // Recetas demo con medicamentos reales
    await this.createDemoPrescriptions(clinicChu, staffChu.doctor, patsChu);
    await this.createDemoPrescriptions(clinicIru, staffIru.doctor, patsIru);

    // Datos ricos de farmacia: proveedores, órdenes de compra, ventas, movimientos
    const suppliersChu = await this.createDemoSuppliers(clinicChu, staffChu.pharmacist);
    const suppliersIru = await this.createDemoSuppliers(clinicIru, staffIru.pharmacist);
    await this.createDemoPurchaseOrders(clinicChu, suppliersChu, stocksChu, staffChu.pharmacist);
    await this.createDemoPurchaseOrders(clinicIru, suppliersIru, stocksIru, staffIru.pharmacist);
    await this.createDemoPharmacySales(clinicChu, stocksChu, patsChu, staffChu.pharmacist, 'CHU');
    await this.createDemoPharmacySales(clinicIru, stocksIru, patsIru, staffIru.pharmacist, 'IRU');

    // Vincular admin a San Bartolomé
    await this.ensureAdminClinicAccess(clinicChu, admin);

    // -----------------------------------------------------------------------
    // Datos adicionales: pacientes, citas, facturas, pagos, activos, traslados
    // -----------------------------------------------------------------------

    // Pacientes adicionales
    let addPatsChu: { id: string; firstName: string; lastName: string; email: string; phone: string }[] = [];
    let addPatsIru: { id: string; firstName: string; lastName: string; email: string; phone: string }[] = [];
    try {
      addPatsChu = await this.createAdditionalPatients(clinicChu, staffChu.doctor, 'CHU');
      addPatsIru = await this.createAdditionalPatients(clinicIru, staffIru.doctor, 'IRU');
    } catch (e) {
      this.logger.warn('createAdditionalPatients falló: ' + e.message);
    }

    // Citas adicionales
    let addApptsChu: { id: string }[] = [];
    let addApptsIru: { id: string }[] = [];
    try {
      addApptsChu = await this.createAdditionalAppointments(clinicChu, staffChu.doctor, addPatsChu, 'CHU');
      addApptsIru = await this.createAdditionalAppointments(clinicIru, staffIru.doctor, addPatsIru, 'IRU');
    } catch (e) {
      this.logger.warn('createAdditionalAppointments falló: ' + e.message);
    }

    // Facturas de facturación
    try {
      await this.createDemoBillingInvoices(clinicChu, [...patsChu.map(p => ({ id: p.id })), ...addPatsChu], staffChu.doctor, addApptsChu, 'CHU');
      await this.createDemoBillingInvoices(clinicIru, [...patsIru.map(p => ({ id: p.id })), ...addPatsIru], staffIru.doctor, addApptsIru, 'IRU');
    } catch (e) {
      this.logger.warn('createDemoBillingInvoices falló: ' + e.message);
    }

    // Pagos para facturas pagadas
    try {
      await this.createDemoPayments(clinicChu, staffChu.receptionist, 'CHU');
      await this.createDemoPayments(clinicIru, staffIru.receptionist, 'IRU');
    } catch (e) {
      this.logger.warn('createDemoPayments falló: ' + e.message);
    }

    // Activos
    try {
      await this.createDemoAssets(clinicChu, staffChu.doctor, 'CHU');
      await this.createDemoAssets(clinicIru, staffIru.doctor, 'IRU');
    } catch (e) {
      this.logger.warn('createDemoAssets falló: ' + e.message);
    }

    // Traslados de stock entre clínicas
    try {
      await this.createDemoStockTransfers(clinicChu, clinicIru, stocksChu, stocksIru, staffChu.pharmacist, staffIru.pharmacist);
    } catch (e) {
      this.logger.warn('createDemoStockTransfers falló: ' + e.message);
    }

    this.logger.log('✅ Seed completado: San Bartolomé (Chulumani) + San Jorge (Irupana)');
    return { ok: true };
  }

  // ---------------------------------------------------------------------------
  // Reset público (limpia todo sin repoblar)
  // ---------------------------------------------------------------------------

  async resetAll(): Promise<{ message: string }> {
    await this.cleanAll();
    return { message: 'Todos los datos han sido eliminados. Use /api/seed para repoblar.' };
  }

  // ---------------------------------------------------------------------------
  // Limpieza completa (respeta al admin)
  // ---------------------------------------------------------------------------

  private async cleanAll() {
    // Orden respetando FK constraints
    const tables = [
      'transfer_audit_logs',
      'stock_transfer_items',
      'stock_transfers',
      'stock_movements',
      'pharmacy_sale_items',
      'pharmacy_sales',
      'pharmacy_invoices',
      'purchase_order_items',
      'purchase_orders',
      'prescription_items',
      'prescriptions',
      'payments',
      'invoices',
      'appointments',
      'medical_records',
      'medical_reports',
      'consent_forms',
      'patients',
      'user_clinics',
      'medication_stock',
      'medications',
      'assets',
    ];

    for (const table of tables) {
      await this.dataSource.query(`DELETE FROM "${table}"`);
    }

    // Romper referencias circulares antes de borrar users/clinics
    await this.dataSource.query('UPDATE clinics SET created_by_id = NULL');
    await this.dataSource.query('UPDATE users SET "clinicId" = NULL');
    await this.dataSource.query(`DELETE FROM users WHERE email != 'admin@bartolomed.com'`);
    await this.dataSource.query('DELETE FROM clinics');
    await this.dataSource.query('DELETE FROM personal_info WHERE id NOT IN (SELECT "personalInfoId" FROM users WHERE "personalInfoId" IS NOT NULL)');
    await this.dataSource.query('DELETE FROM professional_info WHERE id NOT IN (SELECT "professionalInfoId" FROM users WHERE "professionalInfoId" IS NOT NULL)');
  }

  // ---------------------------------------------------------------------------
  // Clínica
  // ---------------------------------------------------------------------------

  private async createClinic(name: string, address: string, phone: string, email: string, description: string): Promise<Clinic> {
    const clinic = this.clinicsRepository.create({ name, address, phone, email, description, isActive: true });
    return this.clinicsRepository.save(clinic);
  }

  // ---------------------------------------------------------------------------
  // Personal por clínica
  // ---------------------------------------------------------------------------

  private async createStaff(clinic: Clinic, prefix: 'chu' | 'iru'): Promise<{ doctor: User; nurse: User; pharmacist: User; receptionist: User }> {
    const staffDefs = prefix === 'chu'
      ? {
          doctor:       { email: 'dr.garcia@sanbartolome.local',    firstName: 'Juan Carlos', lastName: 'García Mamani',    title: 'Dr.',         role: ProfessionalRoles.DOCTOR,       specialization: 'Medicina General', license: 'CÓD-MED-CHU-001', phone: '72345601', roles: ['doctor', 'user'] },
          nurse:        { email: 'enf.condori@sanbartolome.local',  firstName: 'María Elena', lastName: 'Condori Flores',   title: 'Enf.',        role: ProfessionalRoles.NURSE,        specialization: 'Enfermería',       license: 'ENF-CHU-001',     phone: '72345602', roles: ['nurse', 'user'] },
          pharmacist:   { email: 'farm.quispe@sanbartolome.local',  firstName: 'Roberto',     lastName: 'Quispe Torrez',    title: 'Farm.',       role: ProfessionalRoles.PHARMACIST,   specialization: 'Farmacia',         license: 'FARM-CHU-001',    phone: '72345603', roles: ['pharmacist', 'user'] },
          receptionist: { email: 'rec.mamani@sanbartolome.local',   firstName: 'Ana Lucía',   lastName: 'Mamani Cruz',      title: 'Sra.',        role: ProfessionalRoles.RECEPTIONIST, specialization: 'Administración',   license: 'REC-CHU-001',     phone: '72345604', roles: ['receptionist', 'user'] },
        }
      : {
          doctor:       { email: 'dr.vargas@sanjorge.local',        firstName: 'Pedro Pablo', lastName: 'Vargas Choque',    title: 'Dr.',         role: ProfessionalRoles.DOCTOR,       specialization: 'Medicina General', license: 'CÓD-MED-IRU-001', phone: '72345701', roles: ['doctor', 'user'] },
          nurse:        { email: 'enf.limachi@sanjorge.local',      firstName: 'Carmen Rosa', lastName: 'Limachi Apaza',    title: 'Enf.',        role: ProfessionalRoles.NURSE,        specialization: 'Enfermería',       license: 'ENF-IRU-001',     phone: '72345702', roles: ['nurse', 'user'] },
          pharmacist:   { email: 'farm.flores@sanjorge.local',      firstName: 'Diego',       lastName: 'Flores Quispe',    title: 'Farm.',       role: ProfessionalRoles.PHARMACIST,   specialization: 'Farmacia',         license: 'FARM-IRU-001',    phone: '72345703', roles: ['pharmacist', 'user'] },
          receptionist: { email: 'rec.colque@sanjorge.local',       firstName: 'Patricia',    lastName: 'Colque Mamani',    title: 'Sra.',        role: ProfessionalRoles.RECEPTIONIST, specialization: 'Administración',   license: 'REC-IRU-001',     phone: '72345704', roles: ['receptionist', 'user'] },
        };

    const users: Record<string, User> = {};
    for (const [key, def] of Object.entries(staffDefs)) {
      users[key] = await this.createUser(clinic, def);
      await this.createUserClinic(users[key], clinic, def.roles);
    }
    return users as any;
  }

  private async createUser(
    clinic: Clinic,
    def: { email: string; firstName: string; lastName: string; title: string; role: ProfessionalRoles; specialization: string; license: string; phone: string; roles: string[] },
  ): Promise<User> {
    let user = await this.usersRepository.findOne({ where: { email: def.email } });
    if (user) return user;

    const personal = await this.personalInfoRepository.save(
      this.personalInfoRepository.create({
        firstName: def.firstName,
        lastName: def.lastName,
        phone: def.phone,
        address: 'Centro',
        birthDate: new Date('1985-03-15'),
      }),
    );

    const professional = await this.professionalInfoRepository.save(
      this.professionalInfoRepository.create({
        title: def.title,
        role: def.role,
        specialization: def.specialization,
        license: def.license,
        certifications: [],
        startDate: new Date('2018-01-01'),
      }),
    );

    user = await this.usersRepository.save(
      this.usersRepository.create({
        email: def.email,
        password: bcrypt.hashSync('Abc123', 10),
        roles: def.roles,
        isActive: true,
        personalInfo: personal,
        professionalInfo: professional,
        clinic,
      }),
    );
    return user;
  }

  private async createUserClinic(user: User, clinic: Clinic, roles: string[]) {
    const exists = await this.userClinicRepository.findOne({
      where: { user: { id: user.id }, clinic: { id: clinic.id } } as any,
    });
    if (!exists) {
      await this.userClinicRepository.save(
        this.userClinicRepository.create({ user, clinic, roles }),
      );
    }
  }

  // ---------------------------------------------------------------------------
  // Pacientes bolivianos — datos inventados con nombres reales del sur de Bolivia
  // ---------------------------------------------------------------------------

  private async createPatients(clinic: Clinic, createdBy: User, prefix: 'CHU' | 'IRU'): Promise<Patient[]> {
    const defs =
      prefix === 'CHU'
        ? [
            { firstName: 'Pedro',    lastName: 'Mamani Quispe',   doc: '7234891', phone: '72100101', gender: Gender.MALE,   city: 'Chulumani', birth: '1978-04-12' },
            { firstName: 'Rosa',     lastName: 'Condori Flores',  doc: '8341527', phone: '72100102', gender: Gender.FEMALE, city: 'Chulumani', birth: '1991-09-23' },
            { firstName: 'Jorge',    lastName: 'Mamani Cruz',     doc: '5673412', phone: '72100103', gender: Gender.MALE,   city: 'Chulumani', birth: '1965-01-07' },
            { firstName: 'Carmen',   lastName: 'Flores Apaza',    doc: '7891234', phone: '72100104', gender: Gender.FEMALE, city: 'Irupana',   birth: '1983-07-30' },
            { firstName: 'Antonio',  lastName: 'Choque Limachi',  doc: '6234789', phone: '72100105', gender: Gender.MALE,   city: 'Chulumani', birth: '1950-11-15' },
            { firstName: 'Lucía',    lastName: 'Torrez Condori',  doc: '7543210', phone: '72100106', gender: Gender.FEMALE, city: 'Chulumani', birth: '1997-02-28' },
            { firstName: 'Roberto',  lastName: 'Vargas Mamani',   doc: '8123401', phone: '72100107', gender: Gender.MALE,   city: 'Yanacachi', birth: '1988-06-14' },
            { firstName: 'Marta',    lastName: 'Apaza Quispe',    doc: '5892341', phone: '72100108', gender: Gender.FEMALE, city: 'Chulumani', birth: '1972-03-19' },
            { firstName: 'Ramón',    lastName: 'Cruz Flores',     doc: '7012398', phone: '72100109', gender: Gender.MALE,   city: 'Chulumani', birth: '1960-08-05' },
            { firstName: 'Beatriz',  lastName: 'Limachi Choque',  doc: '6789012', phone: '72100110', gender: Gender.FEMALE, city: 'Irupana',   birth: '2000-12-01' },
          ]
        : [
            { firstName: 'Felipe',   lastName: 'Colque Mamani',   doc: '7234812', phone: '72200201', gender: Gender.MALE,   city: 'Irupana',   birth: '1975-05-20' },
            { firstName: 'Isabel',   lastName: 'Quispe Condori',  doc: '8012356', phone: '72200202', gender: Gender.FEMALE, city: 'Irupana',   birth: '1993-10-11' },
            { firstName: 'Marco',    lastName: 'Mamani Torrez',   doc: '5634789', phone: '72200203', gender: Gender.MALE,   city: 'Irupana',   birth: '1968-02-14' },
            { firstName: 'Elena',    lastName: 'Condori Cruz',    doc: '7890321', phone: '72200204', gender: Gender.FEMALE, city: 'Chulumani', birth: '1985-07-07' },
            { firstName: 'Diego',    lastName: 'Torrez Apaza',    doc: '6234561', phone: '72200205', gender: Gender.MALE,   city: 'Irupana',   birth: '1953-04-30' },
            { firstName: 'Patricia', lastName: 'Choque Flores',   doc: '7543289', phone: '72200206', gender: Gender.FEMALE, city: 'Irupana',   birth: '1998-01-17' },
            { firstName: 'Víctor',   lastName: 'Flores Quispe',   doc: '8109345', phone: '72200207', gender: Gender.MALE,   city: 'Cajuata',   birth: '1987-09-25' },
            { firstName: 'Noemí',    lastName: 'Cruz Mamani',     doc: '5890123', phone: '72200208', gender: Gender.FEMALE, city: 'Irupana',   birth: '1970-06-03' },
            { firstName: 'Samuel',   lastName: 'Apaza Limachi',   doc: '7012567', phone: '72200209', gender: Gender.MALE,   city: 'Irupana',   birth: '1962-11-22' },
            { firstName: 'Gloria',   lastName: 'Limachi Torrez',  doc: '6789045', phone: '72200210', gender: Gender.FEMALE, city: 'Irupana',   birth: '2001-03-09' },
          ];

    const patients: Patient[] = [];
    let idx = 0;
    for (const d of defs) {
      let p = await this.patientsRepository.findOne({ where: { documentNumber: d.doc } });
      if (!p) {
        p = await this.patientsRepository.save(
          this.patientsRepository.create({
            firstName: d.firstName,
            lastName: d.lastName,
            documentNumber: d.doc,
            birthDate: new Date(d.birth),
            gender: d.gender,
            email: `${d.firstName.toLowerCase().replace(/ /g, '.')}.${prefix.toLowerCase()}${++idx}@demo.local`,
            phone: d.phone,
            address: 'Plaza Principal s/n',
            city: d.city,
            state: 'La Paz',
            country: 'BO',
            clinic,
            createdBy,
            isActive: true,
          }),
        );
      }
      patients.push(p);
    }
    return patients;
  }

  // ---------------------------------------------------------------------------
  // Medicamentos
  // ---------------------------------------------------------------------------

  private async createMedications(defs: MedDef[]): Promise<Map<string, Medication>> {
    const map = new Map<string, Medication>();
    for (const d of defs) {
      let med = await this.medicationRepository.findOne({ where: { code: d.code } });
      if (!med) {
        med = await this.medicationRepository.save(
          this.medicationRepository.create({
            code: d.code,
            name: d.name,
            genericName: d.genericName ?? d.name,
            brandName: d.name,
            strength: d.strength,
            dosageForm: d.dosageForm,
            category: d.category,
            storageCondition: d.storageCondition ?? StorageCondition.ROOM_TEMPERATURE,
            requiresPrescription: d.requiresPrescription ?? false,
            isControlledSubstance: d.isControlledSubstance ?? false,
            description: d.description ?? '',
            isActive: true,
          }),
        );
      }
      map.set(d.code, med);
    }
    return map;
  }

  // ---------------------------------------------------------------------------
  // Stock
  // ---------------------------------------------------------------------------

  private async createStock(clinic: Clinic, medMap: Map<string, Medication>, defs: StockDef[], clinicPrefix: string): Promise<MedicationStock[]> {
    const created: MedicationStock[] = [];
    for (const d of defs) {
      const med = medMap.get(d.code);
      if (!med) continue;

      const batchNumber = `LOTE-${clinicPrefix}-2024-${d.batchSuffix}`;
      const exists = await this.medicationStockRepository.findOne({ where: { batchNumber } });
      if (exists) { created.push(exists); continue; }

      const stock = this.medicationStockRepository.create({
        batchNumber,
        quantity: d.quantity,
        reservedQuantity: 0,
        unitCost: d.unitCost,
        sellingPrice: d.sellingPrice,
        expiryDate: new Date(d.expiryDate),
        receivedDate: new Date('2024-01-15'),
        location: d.location,
        minimumStock: d.minimumStock,
        isActive: true,
        medication: med,
        clinic,
      });
      const saved = await this.medicationStockRepository.save(stock);
      created.push(saved);
    }
    return created;
  }

  // ---------------------------------------------------------------------------
  // Expedientes médicos
  // ---------------------------------------------------------------------------

  private async createDemoMedicalRecords(clinic: Clinic, doctor: User, patients: Patient[]) {
    const records = [
      { chiefComplaint: 'Fiebre y dolor de garganta', diagnosis: 'Faringitis aguda', treatment: 'Amoxicilina 500mg c/8h × 7 días + reposo' },
      { chiefComplaint: 'Dolor lumbar crónico', diagnosis: 'Lumbalgia mecánica', treatment: 'Ibuprofeno 400mg c/8h + fisioterapia' },
      { chiefComplaint: 'Control de hipertensión arterial', diagnosis: 'HTA esencial grado I', treatment: 'Amlodipina 5mg/día + dieta hiposódica' },
      { chiefComplaint: 'Tos con expectoración', diagnosis: 'Bronquitis aguda', treatment: 'Ambroxol 30mg c/8h + hidratación' },
      { chiefComplaint: 'Diarrea acuosa sin sangre', diagnosis: 'Gastroenteritis aguda', treatment: 'Loperamida 2mg c/6h + suero oral' },
    ];

    for (let i = 0; i < Math.min(5, patients.length); i++) {
      const patient = patients[i];
      const numRecords = i < 2 ? 3 : 1;
      for (let j = 0; j < numRecords; j++) {
        const r = records[(i + j) % records.length];
        const record = this.medicalRecordRepository.create({
          type: RecordType.CONSULTATION,
          status: RecordStatus.COMPLETED,
          chiefComplaint: r.chiefComplaint,
          historyOfPresentIllness: `Paciente refiere ${r.chiefComplaint.toLowerCase()} de 3 días de evolución.`,
          diagnosis: r.diagnosis,
          treatmentPlan: r.treatment,
          temperature: 36.5 + Math.random() * 1.5,
          systolicBP: 110 + Math.floor(Math.random() * 30),
          diastolicBP: 70 + Math.floor(Math.random() * 20),
          heartRate: 65 + Math.floor(Math.random() * 25),
          respiratoryRate: 16,
          oxygenSaturation: 96 + Math.floor(Math.random() * 3),
          weight: 55 + Math.floor(Math.random() * 30),
          height: 155 + Math.floor(Math.random() * 25),
          bmi: 22 + Math.random() * 5,
          isEmergency: false,
          isActive: true,
          patient,
          doctor,
          createdBy: doctor,
          clinic,
        });
        await this.medicalRecordRepository.save(record);
      }
    }
  }

  // ---------------------------------------------------------------------------
  // Citas
  // ---------------------------------------------------------------------------

  private async createDemoAppointments(clinic: Clinic, doctor: User, patients: Patient[]) {
    const base = new Date();
    base.setHours(base.getHours() + 24);
    for (let i = 0; i < Math.min(10, patients.length); i++) {
      const date = new Date(base.getTime() + i * 60 * 60 * 1000);
      const patient = patients[i % patients.length];
      const appt = this.appointmentsRepository.create({
        appointmentDate: date,
        duration: 30,
        type: AppointmentType.CONSULTATION,
        status: i % 2 === 0 ? AppointmentStatus.CONFIRMED : AppointmentStatus.SCHEDULED,
        priority: AppointmentPriority.NORMAL,
        reason: 'Consulta general',
        notes: 'Cita demo',
        patient,
        doctor,
        clinic,
        patientEmail: patient.email,
        patientPhone: patient.phone,
      });
      await this.appointmentsRepository.save(appt);
    }
  }

  // ---------------------------------------------------------------------------
  // Recetas
  // ---------------------------------------------------------------------------

  private async createDemoPrescriptions(clinic: Clinic, doctor: User, patients: Patient[]) {
    const clinicTag = clinic.name === 'San Bartolomé' ? 'CHU' : 'IRU';
    for (let i = 1; i <= 4; i++) {
      const number = `RX-${clinicTag}-DEMO-${String(i).padStart(3, '0')}`;
      const exists = await this.prescriptionsRepository.findOne({ where: { prescriptionNumber: number } as any });
      if (exists) continue;

      const patient = patients[(i - 1) % patients.length];
      let rx = await this.prescriptionsRepository.save(
        this.prescriptionsRepository.create({
          prescriptionNumber: number,
          status: PrescriptionStatus.ACTIVE,
          prescriptionDate: new Date(),
          expiryDate: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000),
          diagnosis: 'Infección respiratoria aguda',
          notes: 'Tomar con abundante agua',
          isElectronic: true,
          refillsAllowed: 1,
          refillsUsed: 0,
          patient,
          doctor,
          clinic,
          items: [],
        }),
      );

      const items = [
        this.prescriptionItemsRepository.create({ prescription: rx, medicationName: 'Paracetamol', strength: '500mg', dosageForm: 'tablet', quantity: '10', dosage: '1 tableta', frequency: 'cada 8h', duration: 5, instructions: 'No exceder 3g/día', unitPrice: 2, totalPrice: 20 }),
        this.prescriptionItemsRepository.create({ prescription: rx, medicationName: 'Amoxicilina', strength: '500mg', dosageForm: 'capsule', quantity: '21', dosage: '1 cápsula', frequency: 'cada 8h', duration: 7, instructions: 'Completar tratamiento', unitPrice: 3, totalPrice: 63, isControlled: false }),
      ];
      await this.prescriptionItemsRepository.save(items);
    }
  }

  // ---------------------------------------------------------------------------
  // Proveedores demo
  // ---------------------------------------------------------------------------

  private async createDemoSuppliers(clinic: Clinic, createdBy: User): Promise<{ id: string }[]> {
    const supplierDefs = [
      { code: `PROV-${clinic.id.slice(0, 4)}-001`, name: 'Distribuidora Farmacéutica Andina S.R.L.',  contactPerson: 'Luis Mamani',    email: 'ventas@farmandina.bo',   phone: '22301234', city: 'La Paz',       country: 'BO' },
      { code: `PROV-${clinic.id.slice(0, 4)}-002`, name: 'Laboratorios Inti Bolivia',                 contactPerson: 'María Quispe',   email: 'pedidos@labinti.bo',     phone: '22305678', city: 'Cochabamba',   country: 'BO' },
      { code: `PROV-${clinic.id.slice(0, 4)}-003`, name: 'MedSupply Yungas',                          contactPerson: 'Pedro Condori',  email: 'info@medsupply.bo',      phone: '72399001', city: 'Chulumani',    country: 'BO' },
    ];

    const suppliers: { id: string }[] = [];
    for (const s of supplierDefs) {
      const existing = await this.dataSource.query(
        `SELECT id FROM suppliers WHERE code = $1 LIMIT 1`, [s.code],
      );
      if (existing.length > 0) { suppliers.push(existing[0]); continue; }

      const result = await this.dataSource.query(`
        INSERT INTO suppliers (code, name, "contactPerson", email, phone, city, country, status, "paymentTerms", "discountRate", clinic_id, created_by, "createdAt", "updatedAt")
        VALUES ($1,$2,$3,$4,$5,$6,$7,'active',30,0,$8,$9,NOW(),NOW())
        RETURNING id
      `, [s.code, s.name, s.contactPerson, s.email, s.phone, s.city, s.country, clinic.id, createdBy.id]);
      suppliers.push(result[0]);
    }
    return suppliers;
  }

  // ---------------------------------------------------------------------------
  // Órdenes de compra demo
  // ---------------------------------------------------------------------------

  private async createDemoPurchaseOrders(clinic: Clinic, suppliers: { id: string }[], stocks: MedicationStock[], createdBy: User) {
    if (!stocks.length) return;

    const randomDate = (maxDaysAgo: number) => {
      const d = new Date();
      d.setDate(d.getDate() - Math.floor(Math.random() * maxDaysAgo));
      return d.toISOString().slice(0, 10);
    };

    const statuses = ['received', 'received', 'received', 'approved', 'pending'];
    const clinicTag = clinic.name === 'San Bartolomé' ? 'CHU' : 'IRU';

    for (let i = 1; i <= 10; i++) {
      const orderNumber = `OC-${clinicTag}-DEMO-${String(i).padStart(3, '0')}`;
      const existing = await this.dataSource.query(
        `SELECT id FROM purchase_orders WHERE "orderNumber" = $1 LIMIT 1`, [orderNumber],
      );
      if (existing.length > 0) continue;

      const orderDate = randomDate(180);
      const status = statuses[i % statuses.length];
      const supplier = suppliers[i % suppliers.length];
      const numItems = 4 + (i % 4); // 4–7 items

      // Calcular ítems y total
      let subtotal = 0;
      const itemsData: { stockId: string; medName: string; medCode: string; qty: number; unitPrice: number; total: number }[] = [];

      for (let j = 0; j < numItems; j++) {
        const stock = stocks[(i + j) % stocks.length];
        const qty = 50 + Math.floor(Math.random() * 200);
        const unitPrice = parseFloat((+stock.unitCost * (0.85 + Math.random() * 0.10)).toFixed(2));
        const total = parseFloat((qty * unitPrice).toFixed(2));
        subtotal += total;
        itemsData.push({
          stockId: stock.id,
          medName: stock.medication?.name ?? 'Medicamento',
          medCode: stock.medication?.code ?? '',
          qty,
          unitPrice,
          total,
        });
      }

      subtotal = parseFloat(subtotal.toFixed(2));

      const orderResult = await this.dataSource.query(`
        INSERT INTO purchase_orders (
          "orderNumber", "supplierId", "clinicId", "orderDate", "expectedDeliveryDate",
          status, subtotal, "taxRate", "taxAmount", "discountAmount", "shippingCost",
          "totalAmount", tax, total, "createdById", "createdAt", "updatedAt"
        ) VALUES ($1,$2,$3,$4,$5,$6,$7,0,0,0,0,$8,$9,$10,$11,NOW(),NOW())
        RETURNING id
      `, [
        orderNumber, supplier.id, clinic.id, orderDate,
        new Date(new Date(orderDate).getTime() + 14 * 24 * 60 * 60 * 1000).toISOString().slice(0, 10),
        status, subtotal, subtotal, 0, subtotal, createdBy.id,
      ]);

      const orderId = orderResult[0].id;

      for (const item of itemsData) {
        await this.dataSource.query(`
          INSERT INTO purchase_order_items (
            "productName", "productCode", "medicationId", "medicationName",
            quantity, "receivedQuantity", "unitPrice", "totalPrice", subtotal, order_id, "createdAt", "updatedAt"
          ) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,NOW(),NOW())
        `, [
          item.medName, item.medCode, null, item.medName,
          item.qty, status === 'received' ? item.qty : 0,
          item.unitPrice, item.total, item.total, orderId,
        ]);
      }
    }
  }

  // ---------------------------------------------------------------------------
  // Ventas de farmacia demo (120 ventas por clínica)
  // ---------------------------------------------------------------------------

  private async createDemoPharmacySales(clinic: Clinic, stocks: MedicationStock[], patients: Patient[], soldBy: User, clinicTag: 'CHU' | 'IRU') {
    if (!stocks.length) return;

    const randomDaysAgo = (maxDays: number) => {
      const d = new Date();
      d.setDate(d.getDate() - Math.floor(Math.random() * maxDays));
      d.setHours(8 + Math.floor(Math.random() * 10), Math.floor(Math.random() * 60), 0, 0);
      return d;
    };

    const paymentMethods: string[] = ['cash', 'cash', 'cash', 'card', 'transfer', 'qr'];
    const statuses: string[] = ['completed', 'completed', 'completed', 'completed', 'completed', 'completed', 'completed', 'completed', 'completed', 'pending'];

    const TOTAL_SALES = 120;

    for (let i = 1; i <= TOTAL_SALES; i++) {
      const saleNumber = `VTA-${clinicTag}-DEMO-${String(i).padStart(4, '0')}`;
      const existing = await this.dataSource.query(
        `SELECT id FROM pharmacy_sales WHERE "saleNumber" = $1 LIMIT 1`, [saleNumber],
      );
      if (existing.length > 0) continue;

      const patient = patients[i % patients.length];
      const patientName = `${patient.firstName} ${patient.lastName}`;
      const saleDate = randomDaysAgo(180);
      const status = statuses[i % statuses.length];
      const paymentMethod = paymentMethods[i % paymentMethods.length];
      const numItems = 2 + (i % 4); // 2–5 items

      // Build sale items
      let subtotal = 0;
      const saleItemsData: { stockId: string; name: string; code: string; batchNumber: string; qty: number; unitPrice: number; lineTotal: number; expiryDate: string }[] = [];

      for (let j = 0; j < numItems; j++) {
        const stock = stocks[(i * 3 + j * 7) % stocks.length];
        const qty = 1 + Math.floor(Math.random() * 3);
        const unitPrice = parseFloat((+stock.sellingPrice).toFixed(2));
        const lineTotal = parseFloat((qty * unitPrice).toFixed(2));
        subtotal += lineTotal;
        saleItemsData.push({
          stockId: stock.id,
          name: stock.medication?.name ?? 'Medicamento',
          code: stock.medication?.code ?? '',
          batchNumber: stock.batchNumber,
          qty,
          unitPrice,
          lineTotal,
          expiryDate: stock.expiryDate ? new Date(stock.expiryDate).toISOString().slice(0, 10) : '2027-12-31',
        });
      }

      subtotal = parseFloat(subtotal.toFixed(2));
      // Round up amountPaid to nearest 5 or 10
      const amountPaid = parseFloat((Math.ceil(subtotal / 5) * 5).toFixed(2));
      const change = parseFloat((amountPaid - subtotal).toFixed(2));

      const saleResult = await this.dataSource.query(`
        INSERT INTO pharmacy_sales (
          "saleNumber", "patientName", "saleDate", status, "paymentMethod",
          subtotal, discount, tax, total, "amountPaid", change,
          clinic_id, patient_id, "soldById", "createdAt", "updatedAt"
        ) VALUES ($1,$2,$3,$4,$5,$6,0,0,$7,$8,$9,$10,$11,$12,NOW(),NOW())
        RETURNING id
      `, [
        saleNumber, patientName, saleDate, status, paymentMethod,
        subtotal, subtotal, amountPaid, change,
        clinic.id, patient.id, soldBy.id,
      ]);

      const saleId = saleResult[0].id;

      // Insert sale items
      for (const item of saleItemsData) {
        await this.dataSource.query(`
          INSERT INTO pharmacy_sale_items (
            sale_id, "saleId", medication_stock_id, "medicationStockId",
            "productName", "productCode", "batchNumber",
            quantity, "unitPrice", discount, subtotal, "expiryDate",
            "createdAt", "updatedAt"
          ) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,0,$10,$11,NOW(),NOW())
        `, [
          saleId, saleId, item.stockId, item.stockId,
          item.name, item.code, item.batchNumber,
          item.qty, item.unitPrice, item.lineTotal, item.expiryDate,
        ]);
      }

      // Create stock movement for each sale item
      for (const item of saleItemsData) {
        await this.dataSource.query(`
          INSERT INTO stock_movements (
            type, quantity, "unitPrice", "totalAmount", reference,
            reason, "movementDate", "isActive", stock_id, processed_by,
            "createdAt", "updatedAt"
          ) VALUES ('sale',$1,$2,$3,$4,'Venta farmacia',$5,true,$6,$7,NOW(),NOW())
        `, [
          item.qty, item.unitPrice, item.lineTotal, saleNumber,
          saleDate, item.stockId, soldBy.id,
        ]);
      }

      // Create invoice for completed sales
      if (status === 'completed') {
        const invoiceNumber = `FAC-${clinicTag}-DEMO-${String(i).padStart(4, '0')}`;
        const existingInv = await this.dataSource.query(
          `SELECT id FROM pharmacy_invoices WHERE "invoiceNumber" = $1 LIMIT 1`, [invoiceNumber],
        );
        if (existingInv.length === 0) {
          await this.dataSource.query(`
            INSERT INTO pharmacy_invoices (
              "invoiceNumber", "saleId", "patientName", "invoiceDate", "dueDate",
              status, subtotal, discount, tax, total, "amountPaid", balance,
              "paymentDate", "paymentMethod", "createdById", "createdAt", "updatedAt"
            ) VALUES ($1,$2,$3,$4,$5,'paid',$6,0,0,$7,$8,0,$9,$10,$11,NOW(),NOW())
          `, [
            invoiceNumber, saleId, patientName,
            saleDate.toISOString().slice(0, 10),
            saleDate.toISOString().slice(0, 10),
            subtotal, subtotal, amountPaid,
            saleDate.toISOString().slice(0, 10),
            paymentMethod, soldBy.id,
          ]);
        }
      }
    }
  }

  // ---------------------------------------------------------------------------
  // Pacientes adicionales (25 por clínica)
  // ---------------------------------------------------------------------------

  private async createAdditionalPatients(
    clinic: Clinic,
    createdBy: User,
    prefix: 'CHU' | 'IRU',
  ): Promise<{ id: string; firstName: string; lastName: string; email: string; phone: string }[]> {
    const bloodTypes = ['A+', 'B+', 'O+', 'AB+', 'O-', 'A-'];
    const insurers = ['COSSMIL', 'CNS', 'CAJA PETROLERA', null, null, null];
    const cities = prefix === 'CHU'
      ? ['Chulumani', 'Irupana', 'Yanacachi', 'Ocobaya', 'Coripata']
      : ['Irupana', 'Chulumani', 'Cajuata', 'Chicaloma', 'La Paz'];

    const nameDefs = [
      { fn: 'Sofía',       ln: 'Mamani Quispe',   g: 'female', b: '1990-03-12' },
      { fn: 'Alejandro',   ln: 'Torrez Condori',  g: 'male',   b: '1975-07-22' },
      { fn: 'Valentina',   ln: 'Flores Cruz',     g: 'female', b: '2018-11-05' },
      { fn: 'Luis',        ln: 'Quispe Mamani',   g: 'male',   b: '1955-01-30' },
      { fn: 'Andrea',      ln: 'Condori Apaza',   g: 'female', b: '2001-09-14' },
      { fn: 'Carlos',      ln: 'Choque Limachi',  g: 'male',   b: '1982-04-18' },
      { fn: 'Daniela',     ln: 'Apaza Torrez',    g: 'female', b: '1967-12-03' },
      { fn: 'Fernando',    ln: 'Cruz Flores',     g: 'male',   b: '1993-06-27' },
      { fn: 'Gabriela',    ln: 'Limachi Choque',  g: 'female', b: '1948-08-15' },
      { fn: 'Hugo',        ln: 'Vargas Quispe',   g: 'male',   b: '2010-02-09' },
      { fn: 'Isabela',     ln: 'Mamani Cruz',     g: 'female', b: '1985-10-21' },
      { fn: 'Joaquín',     ln: 'Condori Flores',  g: 'male',   b: '1972-05-16' },
      { fn: 'Karla',       ln: 'Torrez Mamani',   g: 'female', b: '1999-01-07' },
      { fn: 'Leonardo',    ln: 'Flores Apaza',    g: 'male',   b: '1964-11-25' },
      { fn: 'María',       ln: 'Choque Condori',  g: 'female', b: '2005-07-13' },
      { fn: 'Nicolás',     ln: 'Apaza Cruz',      g: 'male',   b: '1958-03-04' },
      { fn: 'Olivia',      ln: 'Cruz Torrez',     g: 'female', b: '1995-09-30' },
      { fn: 'Pablo',       ln: 'Limachi Flores',  g: 'male',   b: '1980-12-18' },
      { fn: 'Quintina',    ln: 'Vargas Mamani',   g: 'female', b: '1943-06-08' },
      { fn: 'Rodrigo',     ln: 'Quispe Torrez',   g: 'male',   b: '1988-04-22' },
      { fn: 'Sara',        ln: 'Mamani Apaza',    g: 'female', b: '2015-10-11' },
      { fn: 'Tomás',       ln: 'Condori Cruz',    g: 'male',   b: '1970-02-14' },
      { fn: 'Úrsula',      ln: 'Flores Limachi',  g: 'female', b: '1953-08-27' },
      { fn: 'Valentín',    ln: 'Choque Vargas',   g: 'male',   b: '2002-12-01' },
      { fn: 'Wendy',       ln: 'Apaza Quispe',    g: 'female', b: '1977-05-19' },
    ];

    const created: { id: string; firstName: string; lastName: string; email: string; phone: string }[] = [];
    for (let i = 0; i < nameDefs.length; i++) {
      const d = nameDefs[i];
      const docNum = `${prefix}-ADD-${String(i + 1).padStart(5, '0')}`;
      const phone = `7${prefix === 'CHU' ? '3' : '4'}${String(100200 + i)}`;
      const email = `${d.fn.toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '')}.${prefix.toLowerCase()}add${i + 1}@demo.local`;
      const insurer = insurers[i % insurers.length];

      const existing = await this.dataSource.query(
        `SELECT id FROM patients WHERE "documentNumber" = $1 LIMIT 1`, [docNum],
      );
      if (existing.length > 0) {
        created.push({ id: existing[0].id, firstName: d.fn, lastName: d.ln, email, phone });
        continue;
      }

      const result = await this.dataSource.query(`
        INSERT INTO patients (
          "firstName", "lastName", "documentNumber", "documentType", "birthDate", gender,
          email, phone, address, city, state, country,
          "bloodType", "insuranceProvider", "isActive",
          clinic_id, "createdBy", "createdAt", "updatedAt"
        ) VALUES ($1,$2,$3,'CI',$4,$5,$6,$7,'Plaza Principal s/n',$8,'La Paz','BO',
                  $9,$10,true,$11,$12,NOW(),NOW())
        RETURNING id
      `, [
        d.fn, d.ln, docNum, d.b, d.g === 'female' ? 'female' : 'male',
        email, phone,
        cities[i % cities.length],
        bloodTypes[i % bloodTypes.length],
        insurer,
        clinic.id, createdBy.id,
      ]);
      created.push({ id: result[0].id, firstName: d.fn, lastName: d.ln, email, phone });
    }
    return created;
  }

  // ---------------------------------------------------------------------------
  // Citas adicionales (80 por clínica)
  // ---------------------------------------------------------------------------

  private async createAdditionalAppointments(
    clinic: Clinic,
    doctor: User,
    patients: { id: string; firstName: string; lastName: string; email: string; phone: string }[],
    clinicTag: 'CHU' | 'IRU',
  ): Promise<{ id: string }[]> {
    if (!patients.length) return [];

    const statuses = [
      'completed', 'completed', 'completed', 'completed', 'completed',
      'scheduled', 'scheduled',
      'cancelled', 'cancelled', 'cancelled',
      'no_show', 'no_show',
      'rescheduled',
    ];
    const types = ['consultation', 'consultation', 'consultation', 'follow_up', 'follow_up', 'emergency', 'laboratory'];
    const created: { id: string }[] = [];

    for (let i = 1; i <= 80; i++) {
      const apptNumber = `APPT-${clinicTag}-ADD-${String(i).padStart(4, '0')}`;
      const existing = await this.dataSource.query(
        `SELECT id FROM appointments WHERE reason = $1 AND clinic_id = $2 LIMIT 1`,
        [`REF:${apptNumber}`, clinic.id],
      );
      if (existing.length > 0) {
        created.push({ id: existing[0].id });
        continue;
      }

      const daysAgo = Math.floor(Math.random() * 90);
      const apptDate = new Date();
      apptDate.setDate(apptDate.getDate() - daysAgo);
      apptDate.setHours(8 + Math.floor(Math.random() * 9), Math.floor(Math.random() * 4) * 15, 0, 0);

      const status = statuses[i % statuses.length];
      const type = types[i % types.length];
      const patient = patients[i % patients.length];
      const isCompleted = status === 'completed';
      const finalCost = isCompleted ? (50 + Math.floor(Math.random() * 350)) : null;

      const result = await this.dataSource.query(`
        INSERT INTO appointments (
          "appointmentDate", duration, type, status, priority, reason, notes,
          "isEmergency", "isRecurring", "isActive",
          "patientEmail", "patientPhone",
          "finalCost", "isPaid", "paymentMethod",
          "completedAt",
          patient_id, doctor_id, clinic_id, created_by,
          "createdAt", "updatedAt"
        ) VALUES (
          $1, 30, $2::appointments_type_enum, $3::appointments_status_enum,
          'normal', $4, 'Cita demo adicional',
          false, false, true,
          $5, $6,
          $7, $8, $9,
          $10,
          $11, $12, $13, $14,
          NOW(), NOW()
        ) RETURNING id
      `, [
        apptDate,
        type,
        status,
        `REF:${apptNumber}`,
        patient.email,
        patient.phone,
        finalCost,
        isCompleted,
        isCompleted ? 'cash' : null,
        isCompleted ? apptDate : null,
        patient.id,
        doctor.id,
        clinic.id,
        doctor.id,
      ]);
      created.push({ id: result[0].id });
    }
    return created;
  }

  // ---------------------------------------------------------------------------
  // Facturas de facturación (60 por clínica)
  // ---------------------------------------------------------------------------

  private async createDemoBillingInvoices(
    clinic: Clinic,
    patients: { id: string }[],
    createdBy: User,
    appointments: { id: string }[],
    clinicTag: 'CHU' | 'IRU',
  ): Promise<void> {
    if (!patients.length) return;

    const statuses = ['paid', 'paid', 'paid', 'pending', 'pending', 'overdue', 'partially_paid', 'cancelled'];
    const insurers = ['COSSMIL', 'CNS', 'CAJA PETROLERA', 'PRIVADO'];

    for (let i = 1; i <= 60; i++) {
      const invoiceNum = `BILL-${clinicTag}-${String(i).padStart(4, '0')}`;
      const existing = await this.dataSource.query(
        `SELECT id FROM invoices WHERE "invoiceNumber" = $1 LIMIT 1`, [invoiceNum],
      );
      if (existing.length > 0) continue;

      const daysAgo = Math.floor(Math.random() * 180);
      const issueDate = new Date();
      issueDate.setDate(issueDate.getDate() - daysAgo);
      const dueDate = new Date(issueDate);
      dueDate.setDate(dueDate.getDate() + 30);

      const subtotal = parseFloat((150 + Math.floor(Math.random() * 1851)).toFixed(2));
      const totalAmount = subtotal;
      const status = statuses[i % statuses.length];
      const paidAmount = status === 'paid' ? totalAmount
        : status === 'partially_paid' ? parseFloat((totalAmount * 0.5).toFixed(2))
        : 0;
      const remainingAmount = parseFloat((totalAmount - paidAmount).toFixed(2));
      const isInsuranceClaim = Math.random() < 0.2;
      const patient = patients[i % patients.length];
      const appt = appointments.length > 0 && i % 3 === 0
        ? appointments[i % appointments.length]
        : null;

      await this.dataSource.query(`
        INSERT INTO invoices (
          id, "invoiceNumber", status, "issueDate", "dueDate",
          subtotal, "taxAmount", "taxRate", "discountAmount", "discountRate",
          "totalAmount", "paidAmount", "remainingAmount",
          "isInsuranceClaim", "insuranceProvider", "isActive",
          "createdAt", "updatedAt", patient_id, clinic_id, appointment_id, created_by
        ) VALUES (
          gen_random_uuid(), $1, $2::invoices_status_enum, $3, $4,
          $5, 0, 0, 0, 0,
          $6, $7, $8,
          $9, $10, true,
          NOW(), NOW(), $11, $12, $13, $14
        )
      `, [
        invoiceNum,
        status,
        issueDate.toISOString().slice(0, 10),
        dueDate.toISOString().slice(0, 10),
        subtotal,
        totalAmount,
        paidAmount,
        remainingAmount,
        isInsuranceClaim,
        isInsuranceClaim ? insurers[i % insurers.length] : null,
        patient.id,
        clinic.id,
        appt ? appt.id : null,
        createdBy.id,
      ]);
    }
  }

  // ---------------------------------------------------------------------------
  // Pagos para facturas pagadas y parcialmente pagadas
  // ---------------------------------------------------------------------------

  private async createDemoPayments(
    clinic: Clinic,
    processedBy: User,
    clinicTag: 'CHU' | 'IRU',
  ): Promise<void> {
    const paidInvoices = await this.dataSource.query(`
      SELECT id, "totalAmount", "paidAmount", status, "issueDate"
      FROM invoices
      WHERE clinic_id = $1
        AND status IN ('paid', 'partially_paid')
        AND "isActive" = true
      ORDER BY "createdAt"
    `, [clinic.id]);

    const methods = ['cash', 'cash', 'cash', 'credit_card', 'debit_card', 'bank_transfer'];
    let payCounter = 1;

    for (const inv of paidInvoices) {
      const payNumber = `PAY-${clinicTag}-${String(payCounter++).padStart(4, '0')}`;
      const existing = await this.dataSource.query(
        `SELECT id FROM payments WHERE "paymentNumber" = $1 LIMIT 1`, [payNumber],
      );
      if (existing.length > 0) continue;

      const amount = parseFloat(inv.paidAmount);
      const payDate = new Date(inv.issueDate);
      payDate.setDate(payDate.getDate() + Math.floor(Math.random() * 5));
      const method = methods[payCounter % methods.length];

      await this.dataSource.query(`
        INSERT INTO payments (
          id, "paymentNumber", amount, method, status,
          "paymentDate", notes, "isActive",
          "createdAt", "updatedAt", invoice_id, processed_by
        ) VALUES (
          gen_random_uuid(), $1, $2, $3::payments_method_enum, 'completed'::payments_status_enum,
          $4, 'Pago demo', true,
          NOW(), NOW(), $5, $6
        )
      `, [
        payNumber,
        amount,
        method,
        payDate.toISOString().slice(0, 10),
        inv.id,
        processedBy.id,
      ]);
    }
  }

  // ---------------------------------------------------------------------------
  // Activos (20 por clínica)
  // ---------------------------------------------------------------------------

  private async createDemoAssets(
    clinic: Clinic,
    createdBy: User,
    clinicTag: 'CHU' | 'IRU',
  ): Promise<void> {
    const assetDefs = [
      { tag: `${clinicTag}-MED-001`, name: 'Tensiómetro digital', type: 'medical_equipment', category: 'Diagnóstico', manufacturer: 'Omron', model: 'M2', price: 350, life: 7, condition: 'good', status: 'active', location: 'Consultorio 1' },
      { tag: `${clinicTag}-MED-002`, name: 'Estetoscopio', type: 'medical_equipment', category: 'Diagnóstico', manufacturer: 'Littmann', model: 'Classic III', price: 280, life: 10, condition: 'good', status: 'active', location: 'Consultorio 1' },
      { tag: `${clinicTag}-MED-003`, name: 'Glucómetro', type: 'medical_equipment', category: 'Diagnóstico', manufacturer: 'Accu-Chek', model: 'Active', price: 180, life: 5, condition: 'excellent', status: 'active', location: 'Farmacia' },
      { tag: `${clinicTag}-MED-004`, name: 'Termómetro digital', type: 'medical_equipment', category: 'Diagnóstico', manufacturer: 'Microlife', model: 'MT 850', price: 80, life: 5, condition: 'good', status: 'active', location: 'Consultorio 1' },
      { tag: `${clinicTag}-MED-005`, name: 'Oxímetro de pulso', type: 'medical_equipment', category: 'Diagnóstico', manufacturer: 'Nonin', model: '9590', price: 250, life: 7, condition: 'excellent', status: 'active', location: 'Emergencias' },
      { tag: `${clinicTag}-MED-006`, name: 'Balanza médica', type: 'medical_equipment', category: 'Diagnóstico', manufacturer: 'Seca', model: '700', price: 650, life: 15, condition: 'good', status: 'active', location: 'Sala de espera' },
      { tag: `${clinicTag}-MED-007`, name: 'Refrigerador de medicamentos', type: 'medical_equipment', category: 'Almacenamiento', manufacturer: 'Haier', model: 'HYC-68', price: 2200, life: 10, condition: 'good', status: 'active', location: 'Farmacia' },
      { tag: `${clinicTag}-MED-008`, name: 'Nebulizador', type: 'medical_equipment', category: 'Tratamiento', manufacturer: 'Omron', model: 'NE-C28', price: 320, life: 7, condition: 'fair', status: 'active', location: 'Consultorio 2' },
      { tag: `${clinicTag}-MED-009`, name: 'Equipo de inyección', type: 'medical_equipment', category: 'Tratamiento', manufacturer: 'BD', model: 'Kit Básico', price: 150, life: 5, condition: 'good', status: 'active', location: 'Enfermería' },
      { tag: `${clinicTag}-MED-010`, name: 'Camilla médica', type: 'medical_equipment', category: 'Mobiliario médico', manufacturer: 'Local', model: 'Est-01', price: 800, life: 20, condition: 'good', status: 'active', location: 'Consultorio 1' },
      { tag: `${clinicTag}-MED-011`, name: 'Tensiómetro manual', type: 'medical_equipment', category: 'Diagnóstico', manufacturer: 'Welch Allyn', model: 'Tycos', price: 220, life: 10, condition: 'fair', status: 'maintenance', location: 'Consultorio 2' },
      { tag: `${clinicTag}-MED-012`, name: 'Lámpara de examinación', type: 'medical_equipment', category: 'Iluminación médica', manufacturer: 'Luxor', model: 'LED-500', price: 420, life: 10, condition: 'good', status: 'active', location: 'Consultorio 1' },
      { tag: `${clinicTag}-OFC-001`, name: 'Computadora de escritorio', type: 'computer', category: 'Tecnología', manufacturer: 'HP', model: 'ProDesk 400', price: 3500, life: 5, condition: 'good', status: 'active', location: 'Recepción' },
      { tag: `${clinicTag}-OFC-002`, name: 'Impresora multifuncional', type: 'computer', category: 'Tecnología', manufacturer: 'Epson', model: 'L3250', price: 1200, life: 5, condition: 'good', status: 'active', location: 'Recepción' },
      { tag: `${clinicTag}-OFC-003`, name: 'Computadora farmacia', type: 'computer', category: 'Tecnología', manufacturer: 'Lenovo', model: 'ThinkCentre', price: 3200, life: 5, condition: 'excellent', status: 'active', location: 'Farmacia' },
      { tag: `${clinicTag}-MOB-001`, name: 'Escritorio médico', type: 'furniture', category: 'Mobiliario', manufacturer: 'Local', model: 'Esc-01', price: 600, life: 15, condition: 'good', status: 'active', location: 'Consultorio 1' },
      { tag: `${clinicTag}-MOB-002`, name: 'Silla médica ergonómica', type: 'furniture', category: 'Mobiliario', manufacturer: 'Local', model: 'Sil-01', price: 350, life: 10, condition: 'good', status: 'active', location: 'Consultorio 1' },
      { tag: `${clinicTag}-MOB-003`, name: 'Archivador metálico', type: 'furniture', category: 'Mobiliario', manufacturer: 'Local', model: 'Arch-02', price: 450, life: 20, condition: 'good', status: 'active', location: 'Administración' },
      { tag: `${clinicTag}-MOB-004`, name: 'Sillas sala de espera (set 4)', type: 'furniture', category: 'Mobiliario', manufacturer: 'Local', model: 'Set-04', price: 800, life: 10, condition: 'fair', status: 'active', location: 'Sala de espera' },
      { tag: `${clinicTag}-MED-013`, name: 'Balanza pediátrica', type: 'medical_equipment', category: 'Diagnóstico', manufacturer: 'Seca', model: '354', price: 1200, life: 15, condition: 'good', status: 'active', location: 'Consultorio 2' },
    ];

    for (let i = 0; i < assetDefs.length; i++) {
      const d = assetDefs[i];
      const existingTag = await this.dataSource.query(
        `SELECT id FROM assets WHERE "assetTag" = $1 LIMIT 1`, [d.tag],
      );
      if (existingTag.length > 0) continue;

      const purchaseDaysAgo = 180 + Math.floor(Math.random() * 730);
      const purchaseDate = new Date();
      purchaseDate.setDate(purchaseDate.getDate() - purchaseDaysAgo);

      const warrantyExpiry = new Date(purchaseDate);
      warrantyExpiry.setFullYear(warrantyExpiry.getFullYear() + 1);

      const monthlyDep = parseFloat(((d.price * 0.9) / (d.life * 12)).toFixed(2));
      const monthsElapsed = Math.floor(purchaseDaysAgo / 30);
      const accumulated = parseFloat(Math.min(monthlyDep * monthsElapsed, d.price * 0.9).toFixed(2));
      const currentValue = parseFloat((d.price - accumulated).toFixed(2));

      const nextMaint = new Date();
      nextMaint.setMonth(nextMaint.getMonth() + 6);

      await this.dataSource.query(`
        INSERT INTO assets (
          id, "assetTag", name, type, category,
          manufacturer, model,
          status, condition,
          "purchasePrice", "purchaseDate",
          vendor, "warrantyExpiry",
          "depreciationMethod", "usefulLifeYears", "salvageValue",
          "currentValue", "accumulatedDepreciation", "monthlyDepreciation",
          location,
          "maintenanceIntervalMonths", "totalMaintenanceCost",
          "nextMaintenanceDate",
          "isActive", "createdAt", "updatedAt",
          clinic_id, created_by
        ) VALUES (
          gen_random_uuid(), $1, $2, $3::assets_type_enum, $4,
          $5, $6,
          $7::assets_status_enum, $8::assets_condition_enum,
          $9, $10,
          'Proveedor Demo', $11,
          'straight_line'::assets_depreciationmethod_enum, $12, 0,
          $13, $14, $15,
          $16,
          12, 0,
          $17,
          true, NOW(), NOW(),
          $18, $19
        )
      `, [
        d.tag, d.name, d.type, d.category,
        d.manufacturer, d.model,
        d.status, d.condition,
        d.price, purchaseDate.toISOString().slice(0, 10),
        warrantyExpiry.toISOString().slice(0, 10),
        d.life,
        currentValue, accumulated, monthlyDep,
        d.location,
        nextMaint.toISOString().slice(0, 10),
        clinic.id, createdBy.id,
      ]);
    }
  }

  // ---------------------------------------------------------------------------
  // Traslados de stock entre clínicas (15 traslados)
  // ---------------------------------------------------------------------------

  private async createDemoStockTransfers(
    clinicChu: Clinic,
    clinicIru: Clinic,
    stocksChu: MedicationStock[],
    stocksIru: MedicationStock[],
    pharmacistChu: User,
    pharmacistIru: User,
  ): Promise<void> {
    if (!stocksChu.length || !stocksIru.length) return;

    const transferDefs: {
      num: string;
      fromClinic: Clinic;
      toClinic: Clinic;
      fromStocks: MedicationStock[];
      toStocks: MedicationStock[];
      requestedBy: User;
      dispatchedBy: User | null;
      receivedBy: User | null;
      status: string;
      numItems: number;
    }[] = [];

    // 8 completed (CHU→IRU and IRU→CHU alternating)
    for (let i = 1; i <= 8; i++) {
      const chuToIru = i % 2 === 0;
      transferDefs.push({
        num: `TRF-2026-${String(i).padStart(4, '0')}`,
        fromClinic: chuToIru ? clinicChu : clinicIru,
        toClinic: chuToIru ? clinicIru : clinicChu,
        fromStocks: chuToIru ? stocksChu : stocksIru,
        toStocks: chuToIru ? stocksIru : stocksChu,
        requestedBy: chuToIru ? pharmacistChu : pharmacistIru,
        dispatchedBy: chuToIru ? pharmacistChu : pharmacistIru,
        receivedBy: chuToIru ? pharmacistIru : pharmacistChu,
        status: 'completed',
        numItems: 3 + (i % 4),
      });
    }
    // 4 in_transit
    for (let i = 9; i <= 12; i++) {
      const chuToIru = i % 2 === 0;
      transferDefs.push({
        num: `TRF-2026-${String(i).padStart(4, '0')}`,
        fromClinic: chuToIru ? clinicChu : clinicIru,
        toClinic: chuToIru ? clinicIru : clinicChu,
        fromStocks: chuToIru ? stocksChu : stocksIru,
        toStocks: [],
        requestedBy: chuToIru ? pharmacistChu : pharmacistIru,
        dispatchedBy: chuToIru ? pharmacistChu : pharmacistIru,
        receivedBy: null,
        status: 'in_transit',
        numItems: 3 + (i % 4),
      });
    }
    // 3 requested
    for (let i = 13; i <= 15; i++) {
      transferDefs.push({
        num: `TRF-2026-${String(i).padStart(4, '0')}`,
        fromClinic: clinicIru,
        toClinic: clinicChu,
        fromStocks: stocksIru,
        toStocks: [],
        requestedBy: pharmacistIru,
        dispatchedBy: null,
        receivedBy: null,
        status: 'requested',
        numItems: 3 + (i % 4),
      });
    }

    for (const td of transferDefs) {
      const existing = await this.dataSource.query(
        `SELECT id FROM stock_transfers WHERE "transferNumber" = $1 LIMIT 1`, [td.num],
      );
      if (existing.length > 0) continue;

      const daysAgo = 10 + Math.floor(Math.random() * 60);
      const createdAt = new Date();
      createdAt.setDate(createdAt.getDate() - daysAgo);

      const dispatchedAt = td.dispatchedBy
        ? new Date(createdAt.getTime() + 1 * 24 * 60 * 60 * 1000)
        : null;
      const receivedAt = td.receivedBy && dispatchedAt
        ? new Date(dispatchedAt.getTime() + 2 * 24 * 60 * 60 * 1000)
        : null;

      const result = await this.dataSource.query(`
        INSERT INTO stock_transfers (
          id, "transferNumber", source_clinic_id, target_clinic_id, status,
          notes, requested_by_id, dispatched_by_id, "dispatchedAt",
          received_by_id, "receivedAt",
          "createdAt", "updatedAt"
        ) VALUES (
          gen_random_uuid(), $1, $2, $3, $4::stock_transfers_status_enum,
          $5, $6, $7, $8,
          $9, $10,
          $11, $11
        ) RETURNING id
      `, [
        td.num,
        td.fromClinic.id,
        td.toClinic.id,
        td.status,
        `Traslado demo ${td.num}`,
        td.requestedBy.id,
        td.dispatchedBy ? td.dispatchedBy.id : null,
        dispatchedAt,
        td.receivedBy ? td.receivedBy.id : null,
        receivedAt,
        createdAt,
      ]);

      const transferId = result[0].id;

      // Insert transfer items
      for (let j = 0; j < td.numItems; j++) {
        const sourceStock = td.fromStocks[j % td.fromStocks.length];
        const targetStock = td.toStocks.length > 0
          ? td.toStocks[j % td.toStocks.length]
          : null;
        const reqQty = 5 + Math.floor(Math.random() * 20);
        const dispatchedQty = td.dispatchedBy ? reqQty : null;
        const receivedQty = td.receivedBy ? reqQty : null;

        await this.dataSource.query(`
          INSERT INTO stock_transfer_items (
            id, transfer_id, source_stock_id, target_stock_id,
            "requestedQuantity", "dispatchedQuantity", "receivedQuantity"
          ) VALUES (
            gen_random_uuid(), $1, $2, $3, $4, $5, $6
          )
        `, [
          transferId,
          sourceStock.id,
          targetStock ? targetStock.id : null,
          reqQty,
          dispatchedQty,
          receivedQty,
        ]);
      }
    }
  }

  // ---------------------------------------------------------------------------
  // Admin → clínica principal
  // ---------------------------------------------------------------------------

  private async ensureAdminClinicAccess(clinic: Clinic, admin: User) {
    admin.clinic = clinic;
    await this.usersRepository.save(admin);

    const existing = await this.userClinicRepository.findOne({
      where: { user: { id: admin.id }, clinic: { id: clinic.id } } as any,
    });
    if (!existing) {
      await this.userClinicRepository.save(
        this.userClinicRepository.create({ user: admin, clinic, roles: ['admin'] }),
      );
    } else if (!existing.roles?.includes('admin')) {
      existing.roles = Array.from(new Set([...(existing.roles ?? []), 'admin']));
      await this.userClinicRepository.save(existing);
    }
  }
}
