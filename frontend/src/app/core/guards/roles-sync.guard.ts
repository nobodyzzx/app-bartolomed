import { inject } from '@angular/core'
import { CanActivateFn } from '@angular/router'
import { AuthService as BackendAuthService } from '../../modules/auth/services/auth.service'
import { RoleStateService } from '../services/role-state.service'

/**
 * Sincroniza los roles del JWT con el estado de la UI.
 * Se ejecuta en cada activación del dashboard para mantener los roles actualizados
 * tras refresh de token o recarga de página.
 */
export const rolesSyncGuard: CanActivateFn = () => {
  const backendAuth = inject(BackendAuthService)
  const roleAuth = inject(RoleStateService)

  if (roleAuth.currentUserRoles().length > 0) return true

  const backendRoles: string[] = backendAuth.currentUser()?.roles ?? []
  const mapped = roleAuth.normalizeRoles(backendRoles)
  if (mapped.length > 0) {
    roleAuth.syncRoles(mapped)
  }
  return true
}
