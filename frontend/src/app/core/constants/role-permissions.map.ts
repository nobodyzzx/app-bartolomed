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

    Permission.ReportsMedical,
    Permission.ReportsFinancial,
    Permission.ReportsStock,

    Permission.AssetsManage,

    Permission.LabRead,
    Permission.LabOrder,
    Permission.LabResultEnter,

    Permission.UsersManage,
    Permission.RolesManage,
    Permission.SettingsManage,
    Permission.AuditRead,
    Permission.BackupManage,
  ],
  [UserRoles.DOCTOR]: [
    Permission.PatientsRead,
    Permission.RecordsRead,
    Permission.RecordsWrite,
    Permission.PrescriptionsRead,
    Permission.PrescriptionsSign,
    Permission.ReportsMedical,
    Permission.LabRead,
    Permission.LabOrder,
  ],
  [UserRoles.NURSE]: [
    Permission.PatientsRead,
    Permission.RecordsRead,
    Permission.RecordsWriteVitals,
    Permission.AppointmentsRead,
    Permission.AppointmentsWrite,
    // Espejo de backend/src/auth/permissions/role-permissions.map.ts — habilita
    // ver el timeline clínico de un paciente (GET /reports/patients/:id/timeline).
    Permission.ReportsMedical,
    Permission.LabRead,
  ],
  [UserRoles.RECEPTIONIST]: [
    Permission.PatientsRead,
    Permission.PatientsWrite,
    Permission.AppointmentsRead,
    Permission.AppointmentsWrite,
    Permission.BillingRead,
    Permission.BillingManage,
  ],
  [UserRoles.PHARMACIST]: [
    Permission.PrescriptionsRead,
    Permission.PharmacyInventoryManage,
    Permission.PharmacyDispense,
    Permission.PharmacyBilling,
    Permission.ReportsStock,
  ],
  [UserRoles.LABORATORY]: [
    Permission.LabRead,
    Permission.LabResultEnter,
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
