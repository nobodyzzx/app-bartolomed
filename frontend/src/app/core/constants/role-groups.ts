import { UserRoles } from '../enums/user-roles.enum'

/** Roles con acceso a datos clínicos (citas, pacientes). */
export const CLINICAL_ROLES: UserRoles[] = [
  UserRoles.DOCTOR, UserRoles.NURSE, UserRoles.RECEPTIONIST, UserRoles.ADMIN, UserRoles.SUPER_ADMIN,
]

/** Quien trabaja con órdenes de laboratorio: las pide, o las procesa. */
export const LAB_ROLES: UserRoles[] = [
  UserRoles.DOCTOR, UserRoles.NURSE, UserRoles.LABORATORY, UserRoles.ADMIN, UserRoles.SUPER_ADMIN,
]

export const ADMIN_ONLY_ROLES: UserRoles[] = [UserRoles.ADMIN, UserRoles.SUPER_ADMIN]

export const PHARMACY_ROLES: UserRoles[] = [UserRoles.PHARMACIST, UserRoles.ADMIN, UserRoles.SUPER_ADMIN]

/**
 * Mismos roles que tienen Permission.BillingRead/BillingManage (role-permissions.map.ts) —
 * PHARMACIST queda afuera a propósito: su facturación es PharmacyBilling, un permiso distinto.
 */
export const BILLING_ROLES: UserRoles[] = [UserRoles.RECEPTIONIST, UserRoles.ADMIN, UserRoles.SUPER_ADMIN]
