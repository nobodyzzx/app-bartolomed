import { Permission } from '../enums/permission.enum'

/**
 * Nombre de cada permiso en lenguaje de clínica.
 *
 * Al usuario no le dice nada leer `patients.read` cuando se le niega el acceso
 * a una pantalla; sí le dice qué pedirle a quien administra el sistema.
 */
export const PERMISSION_LABELS: Record<Permission, string> = {
  [Permission.PatientsRead]: 'ver pacientes',
  [Permission.PatientsWrite]: 'registrar y editar pacientes',

  [Permission.RecordsRead]: 'ver expedientes clínicos',
  [Permission.RecordsWrite]: 'registrar en expedientes clínicos',

  [Permission.AppointmentsRead]: 'ver citas',
  [Permission.AppointmentsWrite]: 'agendar citas',

  [Permission.PrescriptionsRead]: 'ver recetas',
  [Permission.PrescriptionsSign]: 'emitir y firmar recetas',

  [Permission.PharmacyInventoryManage]: 'gestionar el inventario de farmacia',
  [Permission.PharmacyDispense]: 'dispensar medicamentos',
  [Permission.PharmacyBilling]: 'facturar en farmacia',

  [Permission.BillingRead]: 'ver caja y facturación',
  [Permission.BillingManage]: 'cobrar y emitir facturas',

  [Permission.ReportsMedical]: 'ver reportes clínicos',
  [Permission.ReportsFinancial]: 'ver reportes financieros',
  [Permission.ReportsStock]: 'ver reportes de inventario',

  [Permission.AssetsManage]: 'gestionar activos',

  [Permission.LabRead]: 'ver laboratorio',
  [Permission.LabOrder]: 'solicitar exámenes de laboratorio',
  [Permission.LabOrderExternal]: 'registrar solicitudes externas de laboratorio',
  [Permission.LabResultEnter]: 'cargar resultados de laboratorio',

  [Permission.SpecialRead]: 'ver estudios especiales',
  [Permission.SpecialOrder]: 'solicitar estudios especiales',
  [Permission.SpecialResultEnter]: 'cargar resultados de estudios especiales',

  [Permission.UsersManage]: 'gestionar usuarios',
  [Permission.RolesManage]: 'gestionar roles',
  [Permission.ClinicsManage]: 'gestionar clínicas',
  [Permission.SettingsManage]: 'cambiar la configuración',
  [Permission.AuditRead]: 'ver la auditoría',
  [Permission.BackupManage]: 'gestionar respaldos',
}

/** Etiqueta legible de un permiso; si no está mapeado, devuelve su código. */
export function permissionLabel(permission: string): string {
  return PERMISSION_LABELS[permission as Permission] ?? permission
}
