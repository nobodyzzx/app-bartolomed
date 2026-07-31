import { inject } from '@angular/core'
import { ActivatedRouteSnapshot, CanActivateFn, Router, RouterStateSnapshot } from '@angular/router'
import { AuthService } from '../../modules/auth/services/auth.service'
import { UserRoles } from '../enums/user-roles.enum'
import { AlertService } from '../services/alert.service'
import { RoleStateService } from '../services/role-state.service'

export const roleGuard: CanActivateFn = (route: ActivatedRouteSnapshot, state: RouterStateSnapshot) => {
  const roleService = inject(RoleStateService)
  const router = inject(Router)
  const alert = inject(AlertService)
  const authService = inject(AuthService)

  const allowedRoles = route.data['allowedRoles'] as UserRoles[]

  if (!allowedRoles || allowedRoles.length === 0) return true

  if (roleService.hasAnyRole(allowedRoles)) return true

  // Si la ruta rechazada ya es /dashboard/home, redirigir ahí de nuevo causaría un loop
  // infinito (ningún rol del usuario tiene acceso ni siquiera al home). En ese caso no hay
  // a dónde mandarlo dentro del dashboard — cerrar sesión en vez de reintentar.
  if (state.url.startsWith('/dashboard/home')) {
    alert.fire({
      icon: 'error',
      title: 'Sin acceso al sistema',
      text: 'Tu cuenta no tiene un rol asignado con acceso al dashboard. Contacta al administrador.',
    })
    authService.logout()
    return false
  }

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
