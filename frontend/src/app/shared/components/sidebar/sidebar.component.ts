import { Component, computed, inject, OnInit, Signal, effect } from '@angular/core'
import { SidenavService } from '../services/sidenav.services'
import { UserRoles } from '../../../modules/dashboard/interfaces/userRoles.enum'
import { AuthService } from '../../../modules/auth/services/auth.service'
import { MenuItem, MENU_ITEMS } from '../../../core/config/menu.config'

@Component({
  selector: 'shared-sidebar',
  templateUrl: './sidebar.component.html',
})
export class SidebarComponent implements OnInit {
  private authService = inject(AuthService)
  private sidenavService = inject(SidenavService)
  public isExpanded = true

  public user: Signal<any> = computed(() => this.authService.currentUser())

  public userRole: Signal<UserRoles> = computed(() => {
    const roles = this.user()?.roles || []

    // Lógica para determinar el rol principal
    if (roles.includes('super_user')) return UserRoles.SUPER_USER
    if (roles.includes('admin')) return UserRoles.ADMIN
    if (roles.includes('user')) return UserRoles.USER

    return UserRoles.GUEST // Rol por defecto si no hay coincidencias
  })

  public menuItems: Signal<MenuItem[]> = computed(() => {
    const currentUser = this.user()
    const currentRole = this.userRole()

    // Forzar la re-evaluación si el usuario o el rol cambian
    if (currentUser && currentRole) {
      return this.filterMenuItemsByRole(MENU_ITEMS, currentRole)
    }

    return [] // Devolver un array vacío mientras se inicializa
  })

  constructor() {
    // Efecto para observar cambios en el usuario y forzar re-renderizado
    effect(() => {
      const user = this.user()
      const role = this.userRole()
    })
  }

  ngOnInit() {
    this.sidenavService.isExpanded$.subscribe(isExpanded => {
      this.isExpanded = isExpanded
    })

    // Forzar verificación inicial del estado de autenticación
    this.authService.checkAuthStatus().subscribe()
  }

  private filterMenuItemsByRole(items: MenuItem[], role: UserRoles): MenuItem[] {
    return items.filter(item => {
      // Verificar si el ítem padre tiene acceso o si algún hijo lo tiene
      const hasDirectAccess = item.allowedRoles.includes(role)
      let hasChildAccess = false

      if (item.children) {
        item.children = this.filterMenuItemsByRole(item.children, role)
        hasChildAccess = item.children.length > 0
      }

      return hasDirectAccess || hasChildAccess
    })
  }

  onLogout() {
    this.authService.logout()
  }
}
