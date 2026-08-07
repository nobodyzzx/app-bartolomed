import { inject } from '@angular/core'
import { ActivatedRouteSnapshot, CanActivateFn, Router, RouterStateSnapshot } from '@angular/router'
import { AuthService } from '../../modules/auth/services/auth.service'
import { MENU_ITEMS } from '../constants/menu-items'
import { Permission } from '../enums/permission.enum'
import { UserRoles } from '../enums/user-roles.enum'
import { AlertService } from '../services/alert.service'
import { RoleStateService } from '../services/role-state.service'


/**
 * Primera ruta del menú a la que el usuario tiene acceso, o `null` si ninguna.
 * Se apoya en `MENU_ITEMS` para no mantener una segunda lista de qué ve cada
 * rol: si mañana un rol nuevo solo puede entrar a un módulo, esto lo lleva ahí
 * sin tocar el guard.
 */
function firstAccessibleRoute(roleService: RoleStateService): string | null {
  const accesible = (item: { allowedRoles?: UserRoles[]; requiredPermissions?: Permission[] }) => {
    const roles = item.allowedRoles ?? []
    if (roles.length > 0 && !roleService.hasAnyRole(roles)) return false
    const permisos = item.requiredPermissions ?? []
    if (permisos.length > 0 && !roleService.hasAnyPermission(permisos)) return false
    return true
  }

  for (const item of MENU_ITEMS) {
    if (!accesible(item)) continue
    if (item.children?.length) {
      const hijo = item.children.find(accesible)
      if (hijo?.route) return hijo.route
      continue
    }
    // El home es justo la ruta que se acaba de rechazar; no reintentarla.
    if (item.route && !item.route.startsWith('/dashboard/home')) return item.route
  }
  return null
}

export const roleGuard: CanActivateFn = (route: ActivatedRouteSnapshot, state: RouterStateSnapshot) => {
  const roleService = inject(RoleStateService)
  const router = inject(Router)
  const alert = inject(AlertService)
  const authService = inject(AuthService)

  const allowedRoles = route.data['allowedRoles'] as UserRoles[]

  if (!allowedRoles || allowedRoles.length === 0) return true

  if (roleService.hasAnyRole(allowedRoles)) return true

  // Si la ruta rechazada ya es /dashboard/home, redirigir ahí de nuevo causaría un
  // loop infinito. Pero cerrar sesión sin más expulsaba a roles que sí tienen
  // dónde trabajar: un usuario de LABORATORY entraba, el home le rechazaba —no
  // está entre sus allowedRoles— y la app lo devolvía al login. Podía
  // autenticarse pero no usar el sistema.
  //
  // Antes de rendirse se busca la primera sección del menú a la que sí tenga
  // acceso. Solo se cierra sesión si de verdad no hay ninguna.
  if (state.url.startsWith('/dashboard/home')) {
    const destino = firstAccessibleRoute(roleService)
    if (destino) return router.createUrlTree([destino])

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
