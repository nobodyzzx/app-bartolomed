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

  // Reportes — antes 3 genéricos (Medical/Financial/Stock) con el control real
  // hecho por listas de roles hardcodeadas (@Auth) en cada endpoint, no por
  // estos permisos: no se podía dar acceso a un reporte puntual sin tocar
  // código, y ni Laboratorio ni Estudios Especiales tenían ningún permiso de
  // reportes aunque el módulo existiera. Ahora hay uno por familia real de
  // reporte, aplicado en @RequirePermissions de cada endpoint —no solo a nivel
  // de clase—, así que el permiso mismo dice qué se puede ver, sin tener que
  // leer la lista de roles de cada método para saberlo.
  ReportsClinical = 'reports.clinical',
  ReportsFinancial = 'reports.financial',
  ReportsPharmacy = 'reports.pharmacy',
  ReportsLab = 'reports.lab',
  /** El corte de turno propio — separado de los demás porque lo necesita
   *  cualquiera que cobre algo (incluida recepción, que no tiene acceso a
   *  ningún otro reporte), y el endpoint ya se autolimita al propio usuario. */
  ReportsStaff = 'reports.staff',

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
