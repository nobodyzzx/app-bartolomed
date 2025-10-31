import { inject } from '@angular/core'
import { CanActivateFn } from '@angular/router'
import { AuthService as BackendAuthService } from '../../modules/auth/services/auth.service'
import { UserRoles } from '../enums/user-roles.enum'
import { AuthService as RoleAuthService } from '../services/auth.service'

// Sincroniza los roles del usuario autenticado (backend) con el sistema de roles (core)
// Útil tras refresh de token o recargas, para que el Sidebar/guards tenga roles sin depender del login explícito
export const rolesSyncGuard: CanActivateFn = () => {
  const backendAuth = inject(BackendAuthService)
  const roleAuth = inject(RoleAuthService)

  const currentCore = roleAuth.currentUserRoles()
  if (currentCore.length > 0) return true

  const backendRoles: string[] = backendAuth.currentUser()?.roles ?? []
  const mapped = mapBackendRolesToUserRoles(backendRoles)
  if (mapped.length > 0) {
    // No navegar aquí; solo sincroniza el estado de roles para el resto de la navegación
    roleAuth.loginAs(mapped)
  }
  return true
}

function mapBackendRolesToUserRoles(roles: string[]): UserRoles[] {
  const result = new Set<UserRoles>()
  const values = Object.values(UserRoles)

  for (const raw of roles) {
    if (!raw) continue
    const r = String(raw).toLowerCase().trim()
    if ((values as string[]).includes(r)) {
      result.add(r as UserRoles)
      continue
    }
    switch (r) {
      case 'super_user':
      case 'superadmin':
      case 'superadmin_user':
        result.add(UserRoles.SUPER_ADMIN)
        break
      case 'administrator':
        result.add(UserRoles.ADMIN)
        break
      case 'medic':
        result.add(UserRoles.DOCTOR)
        break
      case 'nurse_role':
        result.add(UserRoles.NURSE)
        break
      case 'reception':
        result.add(UserRoles.RECEPTIONIST)
        break
      case 'pharma':
        result.add(UserRoles.PHARMACIST)
        break
      case 'user':
        result.add(UserRoles.DOCTOR)
        break
      default:
        break
    }
  }
  return Array.from(result)
}
