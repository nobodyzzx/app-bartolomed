export enum Permission {
  // Pacientes
  PatientsRead = 'patients.read',
  PatientsWrite = 'patients.write',

  // Expedientes
  RecordsRead = 'records.read',
  RecordsWrite = 'records.write',

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
  ReportsClinical = 'reports.clinical',
  ReportsFinancial = 'reports.financial',
  ReportsPharmacy = 'reports.pharmacy',
  ReportsLab = 'reports.lab',
  ReportsStaff = 'reports.staff',

  // Activos
  AssetsManage = 'assets.manage',

  // Laboratorio
  LabRead = 'lab.read',
  LabOrder = 'lab.order',
  /** Registrar una solicitud traída de fuera, sin indicación médica de la casa. */
  LabOrderExternal = 'lab.order.external',
  LabResultEnter = 'lab.result.enter',

  // Estudios especiales: permisos propios, no los de laboratorio — es otro
  // módulo con otro personal, y compartirlos daría al gabinete acceso a los
  // análisis clínicos del paciente.
  SpecialRead = 'special.read',
  SpecialOrder = 'special.order',
  SpecialResultEnter = 'special.result.enter',

  // Administración
  UsersManage = 'users.manage',
  RolesManage = 'roles.manage',
  ClinicsManage = 'clinics.manage',
  SettingsManage = 'settings.manage',
  AuditRead = 'audit.read',
  BackupManage = 'backup.manage',
}
