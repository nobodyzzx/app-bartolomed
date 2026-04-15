import { inject } from '@angular/core'
import { ActivatedRouteSnapshot, CanActivateFn, Router } from '@angular/router'
import { UserRoles } from '../enums/user-roles.enum'
import { AlertService } from '../services/alert.service'
import { RoleStateService } from '../services/role-state.service'

export const roleGuard: CanActivateFn = (route: ActivatedRouteSnapshot) => {
  const roleService = inject(RoleStateService)
  const router = inject(Router)
  const alert = inject(AlertService)

  const allowedRoles = route.data['allowedRoles'] as UserRoles[]

  if (!allowedRoles || allowedRoles.length === 0) return true

  if (roleService.hasAnyRole(allowedRoles)) return true

  alert.fire({
    icon: 'warning',
    title: 'Acceso restringido',
    text: 'No tienes permisos para acceder a esta sección.',
    timer: 3000,
    showConfirmButton: false,
  })

  router.navigate(['/dashboard/home'])
  return false
}
