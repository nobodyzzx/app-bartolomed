import { ValidRoles } from '../interfaces';
import { Permission } from './permissions.enum';

// Mapeo base de roles -> permisos
export const ROLE_PERMISSIONS: Record<ValidRoles, Permission[]> = {
  [ValidRoles.SUPER_ADMIN]: [
    // Todo
    ...Object.values(Permission),
  ],
  [ValidRoles.ADMIN]: [
    Permission.PatientsRead,
    Permission.PatientsWrite,
    Permission.RecordsRead,
    Permission.RecordsWrite,
    Permission.AppointmentsRead,
    Permission.AppointmentsWrite,
    Permission.PrescriptionsRead,

    Permission.PharmacyInventoryManage,
    Permission.PharmacyDispense,
    Permission.PharmacyBilling,

    Permission.BillingRead,
    Permission.BillingManage,

    Permission.ReportsMedical,
    Permission.ReportsFinancial,
    Permission.ReportsStock,

    Permission.AssetsManage,

    Permission.LabRead,
    Permission.LabOrder,
    Permission.LabOrderExternal,
    Permission.LabResultEnter,

    Permission.SpecialRead,
    Permission.SpecialOrder,
    Permission.SpecialResultEnter,

    Permission.UsersManage,
    Permission.RolesManage,
    Permission.SettingsManage,
    Permission.AuditRead,
    Permission.BackupManage,
  ],
  [ValidRoles.DOCTOR]: [
    Permission.PatientsRead,
    // El médico registra y edita pacientes en la práctica —y el backend ya se lo
    // permite por rol en POST/PATCH/DELETE de `patients`—, pero el permiso no
    // estaba en el mapa: decía que no podía y sí podía. Explícito desde el
    // 2026-08-08, misma decisión que se tomó con enfermería.
    Permission.PatientsWrite,
    Permission.RecordsRead,
    Permission.RecordsWrite,
    Permission.PrescriptionsRead,
    Permission.PrescriptionsSign,
    Permission.ReportsMedical,
    Permission.LabRead,
    Permission.LabOrder,
    // Un estudio especial también lo indica el médico, y necesita leer su
    // resultado igual que el de un análisis.
    Permission.SpecialRead,
    Permission.SpecialOrder,
  ],
  [ValidRoles.NURSE]: [
    Permission.PatientsRead,
    // Enfermería registra y edita pacientes (atiende el mostrador cuando no hay
    // recepción) — decisión del 2026-08-08. Antes funcionaba de casualidad por
    // el OR del guard sobre (PatientsRead, PatientsWrite); ahora es explícito.
    // El borrado sigue reservado a admin/médico por `@Auth`, no por permiso.
    Permission.PatientsWrite,
    Permission.RecordsRead,
    Permission.AppointmentsRead,
    Permission.AppointmentsWrite,
    // Habilita GET /reports/patients/:id/timeline (R-10) — el endpoint ya
    // tenía @Auth(ADMIN, DOCTOR, NURSE), pero sin este permiso PermissionsGuard
    // (chequeo a nivel de clase en ReportsController) bloqueaba a NURSE con
    // 403 antes de llegar al chequeo de rol. Coherente con RecordsRead: ver
    // el timeline clínico de un paciente es parte de la atención de enfermería.
    Permission.ReportsMedical,
    // Igual criterio que RecordsRead: ver resultados de laboratorio es parte
    // de la atención de enfermería, sin poder solicitar ni cargar resultados.
    Permission.LabRead,
    Permission.SpecialRead,
  ],
  [ValidRoles.RECEPTIONIST]: [
    Permission.PatientsRead,
    Permission.PatientsWrite,
    Permission.AppointmentsRead,
    Permission.AppointmentsWrite,
    Permission.BillingRead,
    Permission.BillingManage,
    // El paciente que se paga un examen sin consulta previa entra por
    // ventanilla: recepción lo registra y cobra en el mismo acto. Ve el
    // laboratorio y registra la solicitud externa, pero no indica exámenes
    // (`LabOrder`) ni carga resultados.
    Permission.LabRead,
    Permission.LabOrderExternal,
  ],
  [ValidRoles.PHARMACIST]: [
    Permission.PrescriptionsRead,
    Permission.PharmacyInventoryManage,
    Permission.PharmacyDispense,
    Permission.PharmacyBilling,
    Permission.ReportsStock,
  ],
  [ValidRoles.SPECIAL_STUDIES]: [
    Permission.SpecialRead,
    Permission.SpecialResultEnter,
    // Como el laboratorio: necesita identificar al paciente al registrar y al
    // rotular el estudio, y puede recibir solicitudes que llegan de fuera.
    Permission.PatientsRead,
    Permission.LabOrderExternal,
  ],
  [ValidRoles.LABORATORY]: [
    Permission.LabRead,
    Permission.LabResultEnter,
    // Necesario para identificar al paciente al registrar una solicitud
    // externa y al rotular la muestra: sin esto `GET /patients` responde 403
    // y el buscador del formulario devuelve "Sin resultados" en silencio.
    // Solo lectura — el laboratorio no crea ni edita fichas.
    Permission.PatientsRead,
    Permission.LabOrderExternal,
  ],
};

export function permissionsForRoles(roles: string[] | undefined | null): Permission[] {
  const result = new Set<Permission>();
  if (!roles || roles.length === 0) return [];
  for (const r of roles) {
    const role = String(r).toLowerCase() as ValidRoles;
    const perms = ROLE_PERMISSIONS[role];
    if (perms) perms.forEach(p => result.add(p));
  }
  return Array.from(result);
}
