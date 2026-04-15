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

    Permission.UsersManage,
    Permission.RolesManage,
    Permission.SettingsManage,
    Permission.AuditRead,
    Permission.BackupManage,
  ],
  [ValidRoles.DOCTOR]: [
    Permission.PatientsRead,
    Permission.RecordsRead,
    Permission.RecordsWrite,
    Permission.PrescriptionsRead,
    Permission.PrescriptionsSign,
    Permission.ReportsMedical,
  ],
  [ValidRoles.NURSE]: [
    Permission.PatientsRead,
    Permission.RecordsRead,
    Permission.RecordsWriteVitals,
    Permission.AppointmentsRead,
    Permission.AppointmentsWrite,
  ],
  [ValidRoles.RECEPTIONIST]: [
    Permission.PatientsRead,
    Permission.PatientsWrite,
    Permission.AppointmentsRead,
    Permission.AppointmentsWrite,
    Permission.BillingRead,
  ],
  [ValidRoles.PHARMACIST]: [
    Permission.PrescriptionsRead,
    Permission.PharmacyInventoryManage,
    Permission.PharmacyDispense,
    Permission.PharmacyBilling,
    Permission.ReportsStock,
  ],
  [ValidRoles.USER]: [
    // Acceso mínimo, configurable
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
