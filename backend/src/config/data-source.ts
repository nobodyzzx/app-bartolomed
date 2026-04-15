import * as dotenv from 'dotenv';
import * as path from 'path';

// Carga el .env raíz primero (credenciales reales de Podman/Docker)
dotenv.config({ path: path.resolve(__dirname, '../../..', '.env') });
// Luego el .env del backend (puede sobreescribir si hace falta)
dotenv.config({ path: path.resolve(__dirname, '../..', '.env') });

import { DataSource } from 'typeorm';

import { Appointment } from '../appointments/entities/appointment.entity';
import { AssetInventory } from '../assets/entities/asset-inventory.entity';
import { AssetMaintenance } from '../assets/entities/asset-maintenance.entity';
import { AssetReport } from '../assets/entities/asset-report.entity';
import {
  AssetTransfer,
  AssetTransferAuditLog,
  AssetTransferItem,
} from '../assets/entities/asset-transfer.entity';
import { Asset } from '../assets/entities/asset.entity';
import { Invoice, InvoiceItem, Payment } from '../billing/entities/billing.entity';
import { Clinic } from '../clinics/entities';
import { ConsentForm, MedicalRecord, MedicalReport } from '../medical-records/entities';
import { Patient } from '../patients/entities';
import { PharmacyInvoice } from '../pharmacy/entities/pharmacy-invoice.entity';
import { PharmacySale, PharmacySaleItem } from '../pharmacy/entities/pharmacy-sale.entity';
import { Medication, MedicationStock, StockMovement } from '../pharmacy/entities/pharmacy.entity';
import { PurchaseOrder, PurchaseOrderItem } from '../pharmacy/entities/purchase-order.entity';
import { Supplier } from '../pharmacy/entities/supplier.entity';
import { Prescription, PrescriptionItem } from '../prescriptions/entities/prescription.entity';
import { Role } from '../roles/entities/role.entity';
import {
  StockTransfer,
  StockTransferItem,
  TransferAuditLog,
} from '../transfers/entities/stock-transfer.entity';
import { PersonalInfo, ProfessionalInfo, User } from '../users/entities';
import { UserClinic } from '../users/entities/user-clinic.entity';

export const AppDataSource = new DataSource({
  type: 'postgres',
  host: process.env.DB_HOST ?? 'localhost',
  port: +(process.env.DB_PORT ?? 5432),
  // Soporta tanto DB_NAME (backend .env) como POSTGRES_DB (root .env)
  database: process.env.DB_NAME ?? process.env.POSTGRES_DB,
  username: process.env.DB_USER ?? process.env.POSTGRES_USER,
  password: process.env.DB_PASS ?? process.env.POSTGRES_PASSWORD,
  entities: [
    User,
    PersonalInfo,
    ProfessionalInfo,
    UserClinic,
    Clinic,
    Patient,
    Appointment,
    MedicalRecord,
    ConsentForm,
    MedicalReport,
    Prescription,
    PrescriptionItem,
    Invoice,
    InvoiceItem,
    Payment,
    Asset,
    AssetMaintenance,
    AssetInventory,
    AssetReport,
    AssetTransfer,
    AssetTransferItem,
    AssetTransferAuditLog,
    Medication,
    MedicationStock,
    StockMovement,
    Supplier,
    PurchaseOrder,
    PurchaseOrderItem,
    PharmacySale,
    PharmacySaleItem,
    PharmacyInvoice,
    Role,
    StockTransfer,
    StockTransferItem,
    TransferAuditLog,
  ],
  // Funciona en dev (ts-node → src/migrations/*.ts) y en prod (node → dist/migrations/*.js)
  migrations: [path.join(__dirname, '..', 'migrations', '*.{ts,js}')],
  synchronize: false,
});
