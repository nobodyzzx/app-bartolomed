export enum Permission {
  // Pacientes
  PatientsRead = 'patients.read',
  PatientsWrite = 'patients.write',

  // Expedientes
  RecordsRead = 'records.read',
  RecordsWrite = 'records.write',
  RecordsWriteVitals = 'records.write.vitals',

  // Citas
  AppointmentsRead = 'appointments.read',
  AppointmentsWrite = 'appointments.write',

  // Recetas
  PrescriptionsRead = 'prescriptions.read',
  PrescriptionsSign = 'prescriptions.sign',

  // Farmacia
  PharmacyInventoryManage = 'pharmacy.inventory.manage',
  PharmacyDispense = 'pharmacy.dispense',
  PharmacyBilling = 'pharmacy.billing',

  // Facturación
  BillingRead = 'billing.read',
  BillingManage = 'billing.manage',

  // Reportes
  ReportsMedical = 'reports.medical',
  ReportsFinancial = 'reports.financial',
  ReportsStock = 'reports.stock',

  // Activos
  AssetsManage = 'assets.manage',

  // Administración
  UsersManage = 'users.manage',
  RolesManage = 'roles.manage',
  ClinicsManage = 'clinics.manage',
  SettingsManage = 'settings.manage',
  AuditRead = 'audit.read',
  BackupManage = 'backup.manage',
}
