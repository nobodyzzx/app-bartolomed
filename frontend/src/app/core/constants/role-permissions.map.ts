import { Permission } from '../enums/permission.enum'
import { UserRoles } from '../enums/user-roles.enum'

export const ROLE_PERMISSIONS: Record<UserRoles, Permission[]> = {
  [UserRoles.SUPER_ADMIN]: [...Object.values(Permission)],
  [UserRoles.ADMIN]: [
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

    Permission.ReportsClinical,
    Permission.ReportsFinancial,
    Permission.ReportsPharmacy,
    Permission.ReportsLab,
    Permission.ReportsStaff,

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
  [UserRoles.DOCTOR]: [
    Permission.PatientsRead,
    // Espejo del backend: el médico registra y edita pacientes (decisión del
    // 2026-08-08). Antes el mapa lo negaba mientras el backend sí lo permitía
    // por rol.
    Permission.PatientsWrite,
    Permission.RecordsRead,
    Permission.RecordsWrite,
    Permission.PrescriptionsRead,
    Permission.PrescriptionsSign,
    Permission.ReportsClinical,
    Permission.ReportsLab,
    Permission.ReportsStaff,
    Permission.LabRead,
    Permission.LabOrder,
    // El médico también indica estudios especiales y lee su resultado.
    Permission.SpecialRead,
    Permission.SpecialOrder,
  ],
  [UserRoles.NURSE]: [
    Permission.PatientsRead,
    // Espejo del backend: enfermería registra y edita pacientes (decisión del
    // 2026-08-08). El borrado sigue reservado a admin/médico en el backend.
    Permission.PatientsWrite,
    Permission.RecordsRead,
    Permission.AppointmentsRead,
    Permission.AppointmentsWrite,
    // Espejo de backend/src/auth/permissions/role-permissions.map.ts — habilita
    // ver el timeline clínico de un paciente (GET /reports/patients/:id/timeline).
    // Ruta 'reports' de dashboard-routing.module.ts y menu-items.ts ya incluyen
    // NURSE en allowedRoles (bug real cerrado en la auditoría de interrelación
    // de módulos, 2026-08-04 — el permiso no habilitaba nada real antes de eso).
    Permission.ReportsClinical,
    Permission.ReportsStaff,
    Permission.LabRead,
    Permission.SpecialRead,
    Permission.ReportsLab,
  ],
  [UserRoles.RECEPTIONIST]: [
    Permission.PatientsRead,
    Permission.PatientsWrite,
    Permission.AppointmentsRead,
    Permission.AppointmentsWrite,
    Permission.BillingRead,
    Permission.BillingManage,
    // Espejo del backend: el particular que se paga un examen entra por
    // ventanilla. Ve el laboratorio y registra la solicitud externa, pero no
    // indica exámenes ni carga resultados.
    Permission.LabRead,
    Permission.LabOrderExternal,
    // No tiene acceso al resto de "Reportes", pero sí a su propio corte de
    // turno: es quien más seguido cobra en el punto de cobro.
    Permission.ReportsStaff,
  ],
  [UserRoles.PHARMACIST]: [
    Permission.PrescriptionsRead,
    Permission.PharmacyInventoryManage,
    Permission.PharmacyDispense,
    Permission.PharmacyBilling,
    Permission.ReportsPharmacy,
    Permission.ReportsStaff,
  ],
  [UserRoles.SPECIAL_STUDIES]: [
    // Espejo del backend: realiza los estudios y carga sus resultados. No ve
    // los análisis clínicos del laboratorio — son módulos distintos.
    Permission.SpecialRead,
    Permission.SpecialResultEnter,
    Permission.PatientsRead,
    Permission.LabOrderExternal,
    Permission.ReportsLab,
    Permission.ReportsStaff,
  ],
  [UserRoles.LABORATORY]: [
    Permission.LabRead,
    Permission.LabResultEnter,
    // Espejo del backend: identificar al paciente al registrar una solicitud
    // externa y al rotular la muestra. Solo lectura.
    Permission.PatientsRead,
    Permission.LabOrderExternal,
    Permission.ReportsLab,
    Permission.ReportsStaff,
  ],
}

export function permissionsForRoles(roles: UserRoles[]): Permission[] {
  const result = new Set<Permission>()
  for (const r of roles || []) {
    const perms = ROLE_PERMISSIONS[r]
    if (perms) perms.forEach(p => result.add(p))
  }
  return Array.from(result)
}
