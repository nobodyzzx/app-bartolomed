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

const ROLE_LABELS: Record<string, string> = {
  'super-admin': 'Super Admin',
  admin: 'Administrador',
  doctor: 'Médico',
  nurse: 'Enfermero/a',
  receptionist: 'Recepcionista',
  pharmacist: 'Farmacéutico',
}
const ROLE_PRIORITY: UserRoles[] = [
  UserRoles.SUPER_ADMIN,
  UserRoles.ADMIN,
  UserRoles.DOCTOR,
  UserRoles.PHARMACIST,
  UserRoles.NURSE,
  UserRoles.RECEPTIONIST,
]

@Component({
  selector: 'shared-sidebar',
  templateUrl: './sidebar.component.html',
  styleUrls: ['./sidebar.component.scss'],
})
export class SidebarComponent {
  private sidenavService = inject(SidenavService)
  private roleState = inject(RoleStateService)
  private appAuth = inject(AppAuthService)
  private alert = inject(AlertService)

  public isExpanded = this.sidenavService.isExpanded

  public filteredMenuItems = computed(() => {
    const userRoles = this.roleState.currentUserRoles()
    if (userRoles.length === 0) return []
    return this.filterMenuByRoles(MENU_ITEMS, userRoles)
  })

  public userName = computed(() => {
    const u = this.appAuth.currentUser()
    if (!u?.personalInfo) return 'Usuario'
    return `${u.personalInfo.firstName || ''} ${u.personalInfo.lastName || ''}`.trim() || 'Usuario'
  })

  public userInitials = computed(() => {
    const u = this.appAuth.currentUser()
    const first = u?.personalInfo?.firstName?.[0] ?? ''
    const last = u?.personalInfo?.lastName?.[0] ?? ''
    return (first + last).toUpperCase() || '?'
  })

  public userRoleLabel = computed(() => {
    const roles = this.roleState.currentUserRoles()
    const role = ROLE_PRIORITY.find(r => roles.includes(r))
    return role ? (ROLE_LABELS[role] ?? role) : 'Usuario'
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
    const allowedRoles = item.allowedRoles || []
    if (allowedRoles.length === 0) return true
    return userRoles.some(role => allowedRoles.includes(role))
  }

  get isDemo(): boolean {
    return this.appAuth.authStatus() !== AuthStatus.authenticated
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
