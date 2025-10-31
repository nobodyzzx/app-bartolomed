import { inject } from '@angular/core'
import { ActivatedRouteSnapshot, CanActivateFn, Router } from '@angular/router'
import { Permission } from '../enums/permission.enum'
import { AuthService } from '../services/auth.service'

export const permissionsGuard: CanActivateFn = (route: ActivatedRouteSnapshot) => {
  const authService = inject(AuthService)
  const router = inject(Router)

  const required = (route.data['requiredPermissions'] as Permission[]) || []
  if (!required || required.length === 0) return true

  const ok = authService.hasAnyPermission(required)
  if (ok) return true

  console.warn('Acceso denegado. Permisos requeridos:', required)
  router.navigate(['/dashboard'])
  return false
}
