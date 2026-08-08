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
  ReportsMedical = 'reports.medical',
  ReportsFinancial = 'reports.financial',
  ReportsStock = 'reports.stock',

  // Activos
  AssetsManage = 'assets.manage',

  // Laboratorio
  LabRead = 'lab.read',
  LabOrder = 'lab.order',
  /**
   * Registrar una solicitud que NO nace de una indicación médica de la casa:
   * el paciente llega con una orden en papel de un médico externo, o se paga
   * el examen sin consulta previa. Deliberadamente separado de `LabOrder`
   * para que quien registra no aparezca nunca como quien indicó el examen.
   */
  LabOrderExternal = 'lab.order.external',
  LabResultEnter = 'lab.result.enter',

  // Estudios especiales (ecografía, colonoscopia, electrocardiograma).
  // Permisos propios y no los de laboratorio: son módulos distintos con
  // personal distinto, y compartirlos daría al gabinete acceso a los análisis
  // clínicos del paciente, que no le corresponden.
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
