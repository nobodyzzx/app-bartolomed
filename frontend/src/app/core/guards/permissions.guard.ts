import { inject } from '@angular/core'
import { ActivatedRouteSnapshot, CanActivateFn, Router } from '@angular/router'
import { Permission } from '../enums/permission.enum'
import { AuthService } from '../services/auth.service'

export const permissionsGuard: CanActivateFn = (route: ActivatedRouteSnapshot) => {
  const authService = inject(AuthService)
  const router = inject(Router)

  const required = (route.data['requiredPermissions'] as Permission[]) || []
  if (!required || required.length === 0) return true

  const userPermissions = authService.currentPermissions()
  const userRoles = authService.currentUserRoles()

  console.log('[PermissionsGuard] Verificando acceso:', {
    path: route.routeConfig?.path,
    requiredPermissions: required,
    userRoles,
    userPermissions,
    hasPermission: userPermissions.some(p => required.includes(p)),
  })

  const ok = authService.hasAnyPermission(required)
  if (ok) return true

  console.warn('[PermissionsGuard] ❌ Acceso denegado:', {
    required,
    userRoles,
    userPermissions,
  })

  // Navegar a home en lugar de dashboard para evitar loop
  router.navigate(['/dashboard/home'], {
    queryParams: {
      error: 'insufficient_permissions',
      required: required.join(','),
    },
  })
  return false
}
