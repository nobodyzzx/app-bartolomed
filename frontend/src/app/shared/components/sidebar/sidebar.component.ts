import { Component, computed, inject } from '@angular/core'

import { Permission } from '@core/enums/permission.enum'
import { UserRoles } from '@core/enums/user-roles.enum'
import { MenuItem } from '@core/interfaces/menu-item.interface'
import { AuthService } from '@core/services/auth.service'
import { SidebarService } from '@core/services/sidebar.service'
import Swal from 'sweetalert2'
import { AuthStatus } from '../../../../app/modules/auth/interfaces/auth-status.enum'
import { AuthService as AppAuthService } from '../../../../app/modules/auth/services/auth.service'

@Component({
  selector: 'shared-sidebar',
  templateUrl: './sidebar.component.html',
  styleUrls: ['./sidebar.component.scss'],
})
export class SidebarComponent {
  private sidebarService = inject(SidebarService)
  private authService = inject(AuthService)
  private appAuth = inject(AppAuthService)

  public isExpanded = this.sidebarService.isExpanded
  private allMenuItems = this.sidebarService.menuItems

  // Signal computada para el menú filtrado
  public filteredMenuItems = computed(() => {
    const userRoles = this.authService.currentUserRoles()
    if (userRoles.length === 0) {
      return [] // Si no hay roles (no logueado), no mostrar nada
    }
    return this.filterMenuByRoles(this.allMenuItems(), userRoles)
  })

  // Función recursiva para filtrar el menú
  private filterMenuByRoles(items: MenuItem[], roles: UserRoles[]): MenuItem[] {
    if (!items) return []

    return items
      .filter(item => this.hasVisibility(item, roles)) // 1. Filtrar el item padre (roles o permisos)
      .map(item => {
        // 2. Si el item tiene hijos, filtrarlos recursivamente
        if (item.children && item.children.length > 0) {
          const filteredChildren = this.filterMenuByRoles(item.children, roles)
          // Clonar el item y asignar los hijos filtrados
          return { ...item, children: filteredChildren }
        }
        // Si no tiene hijos, devolver el item tal cual
        return { ...item }
      })
      .filter(item => {
        // 3. Ocultar padres si se quedaron sin hijos visibles
        // Si un item TIENE hijos definidos (originalmente) pero AHORA no tiene hijos visibles
        // Y TAMPOCO tiene una ruta propia, entonces no debe mostrarse.
        if (item.children && item.children.length === 0 && !item.route) {
          return false
        }
        // Tu caso: Los padres SÍ tienen ruta (ej: /medical), así que este filtro
        // no los ocultará, lo cual es correcto.
        return true
      })
  }

  // Helper para verificar permisos
  private hasVisibility(item: MenuItem, userRoles: UserRoles[]): boolean {
    // Preferir permisos si se definen
    const perms = item.requiredPermissions as Permission[] | undefined
    if (perms && perms.length > 0) {
      return this.authService.hasAnyPermission(perms)
    }
    // Fallback a roles
    const allowedRoles = item.allowedRoles || []
    if (allowedRoles.length === 0) return true
    return userRoles.some(role => allowedRoles.includes(role))
  }

  onLogout(): void {
    this.authService.logout()
  }

  // Modo DEMO: si no hay autenticación real, evitamos navegaciones que disparen llamadas 401
  get isDemo(): boolean {
    try {
      return this.appAuth.authStatus() !== AuthStatus.authenticated
    } catch {
      return true
    }
  }

  onDemoClick(): void {
    Swal.fire({
      icon: 'info',
      title: 'Modo demo',
      text: 'Para acceder a esta sección inicia sesión con un usuario válido.',
      confirmButtonColor: '#2563eb',
    })
  }
}
