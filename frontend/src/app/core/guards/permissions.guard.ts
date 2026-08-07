import { inject } from '@angular/core'
import { ActivatedRouteSnapshot, CanActivateFn, Router } from '@angular/router'
import { Permission } from '../enums/permission.enum'
import { RoleStateService } from '../services/role-state.service'

export const permissionsGuard: CanActivateFn = (route: ActivatedRouteSnapshot) => {
  const authService = inject(RoleStateService)
  const router = inject(Router)

  const required = (route.data['requiredPermissions'] as Permission[]) || []
  if (!required || required.length === 0) return true

  const ok = authService.hasAnyPermission(required)
  if (ok) return true

  // Navegar a home en lugar de dashboard para evitar loop
  router.navigate(['/dashboard/home'], {
    queryParams: {
      error: 'insufficient_permissions',
      required: required.join(','),
    },
  })
  return false
}
