import { UserRoles } from '../enums/user-roles.enum'

export interface AssignableRole {
  value: UserRoles
  label: string
}

/**
 * Roles fijos del sistema ofrecidos al crear/editar un usuario. Reemplaza el
 * antiguo CRUD dinámico de "Gestión de Roles" (tabla `roles`, desconectada
 * del RBAC real) — la única fuente de verdad de autorización es el enum
 * ValidRoles/UserRoles + role-permissions.map.ts, así que la UI ofrece
 * directamente esos roles en vez de consultarlos a un backend.
 */
export const ASSIGNABLE_ROLES: AssignableRole[] = [
  { value: UserRoles.SUPER_ADMIN, label: 'Super Admin' },
  { value: UserRoles.ADMIN, label: 'Administrador' },
  { value: UserRoles.DOCTOR, label: 'Médico' },
  { value: UserRoles.NURSE, label: 'Enfermero/a' },
  { value: UserRoles.RECEPTIONIST, label: 'Recepcionista' },
  { value: UserRoles.PHARMACIST, label: 'Farmacéutico' },
  { value: UserRoles.LABORATORY, label: 'Laboratorio' },
]
