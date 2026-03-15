import { inject } from '@angular/core'
import { ActivatedRouteSnapshot, CanActivateFn, Router } from '@angular/router'
import { UserRoles } from '../enums/user-roles.enum'
import { RoleStateService } from '../services/role-state.service'

export const roleGuard: CanActivateFn = (route: ActivatedRouteSnapshot) => {
  const authService = inject(RoleStateService)
  const router = inject(Router)

  const allowedRoles = route.data['allowedRoles'] as UserRoles[]

  // Si la ruta no define roles, se asume pública (dentro del dashboard)
  if (!allowedRoles || allowedRoles.length === 0) {
    return true
  }

  // Verificar si el usuario tiene alguno de los roles permitidos
  if (authService.hasAnyRole(allowedRoles)) {
    return true
  }

  // Si no tiene permisos, redirigir
  router.navigate(['/dashboard']) // Redirigir al home del dashboard
  return false
}
