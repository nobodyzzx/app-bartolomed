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
  ],
  [UserRoles.NURSE]: [
    Permission.PatientsRead,
    Permission.RecordsRead,
    Permission.RecordsWriteVitals,
    Permission.AppointmentsRead,
    Permission.AppointmentsWrite,
  ],
  [UserRoles.RECEPTIONIST]: [
    Permission.PatientsRead,
    Permission.PatientsWrite,
    Permission.AppointmentsRead,
    Permission.AppointmentsWrite,
    Permission.BillingRead,
  ],
  [UserRoles.PHARMACIST]: [
    Permission.PrescriptionsRead,
    Permission.PharmacyInventoryManage,
    Permission.PharmacyDispense,
    Permission.PharmacyBilling,
    Permission.ReportsStock,
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
