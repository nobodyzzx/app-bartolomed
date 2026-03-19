import { Component, computed, inject } from '@angular/core'

import { MENU_ITEMS } from '@core/constants/menu-items'
import { Permission } from '@core/enums/permission.enum'
import { UserRoles } from '@core/enums/user-roles.enum'
import { MenuItem } from '@core/interfaces/menu-item.interface'
import { AlertService } from '@core/services/alert.service'
import { RoleStateService } from '@core/services/role-state.service'
import { AuthStatus } from '../../../../app/modules/auth/interfaces/auth-status.enum'
import { AuthService as AppAuthService } from '../../../../app/modules/auth/services/auth.service'
import { SidenavService } from '../services/sidenav.service'

@Component({
  selector: 'shared-sidebar',
  templateUrl: './sidebar.component.html',
  styleUrls: ['./sidebar.component.scss'],
})
export class SidebarComponent {
  private sidenavService = inject(SidenavService)
  private authService = inject(RoleStateService)
  private appAuth = inject(AppAuthService)
  private alert = inject(AlertService)

  public isExpanded = this.sidenavService.isExpanded

  public filteredMenuItems = computed(() => {
    const userRoles = this.authService.currentUserRoles()
    if (userRoles.length === 0) return []
    return this.filterMenuByRoles(MENU_ITEMS, userRoles)
  })

  private filterMenuByRoles(items: MenuItem[], roles: UserRoles[]): MenuItem[] {
    if (!items) return []
    return items
      .filter(item => this.hasVisibility(item, roles))
      .map(item => {
        if (item.children && item.children.length > 0) {
          return { ...item, children: this.filterMenuByRoles(item.children, roles) }
        }
        return { ...item }
      })
      .filter(item => !(item.children && item.children.length === 0 && !item.route))
  }

  private hasVisibility(item: MenuItem, userRoles: UserRoles[]): boolean {
    const perms = item.requiredPermissions as Permission[] | undefined
    if (perms && perms.length > 0) return this.authService.hasAnyPermission(perms)
    const allowedRoles = item.allowedRoles || []
    if (allowedRoles.length === 0) return true
    return userRoles.some(role => allowedRoles.includes(role))
  }

  get isDemo(): boolean {
    try {
      return this.appAuth.authStatus() !== AuthStatus.authenticated
    } catch {
      return true
    }
  }

  trackByLabel(_index: number, item: MenuItem): string {
    return item.label
  }

  onDemoClick(): void {
    this.alert.fire({
      icon: 'info',
      title: 'Modo demo',
      text: 'Para acceder a esta sección inicia sesión con un usuario válido.',
    })
  }
}
