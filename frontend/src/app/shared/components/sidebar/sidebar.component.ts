import { Component, computed, inject, OnInit, OnDestroy, Signal, effect } from '@angular/core'
import { SidenavService } from '../services/sidenav.services'
import { UserRoles } from '../../../modules/dashboard/interfaces/userRoles.enum'
import { AuthService } from '../../../modules/auth/services/auth.service'
import { MenuItem, MENU_ITEMS } from '../../../core/config/menu.config'
import { Subscription } from 'rxjs'

@Component({
  selector: 'shared-sidebar',
  templateUrl: './sidebar.component.html',
  styles: [
    `
      ::ng-deep .sidebar-menu .mat-mdc-menu-panel {
        margin-left: 8px;
        border-radius: 12px;
        box-shadow: 0 4px 12px rgba(0, 0, 0, 0.15);
        min-width: 280px !important; /* Cambiado a 280px */
        width: 280px !important; /* Forzar el ancho específico */
        max-width: 280px !important; /* Asegurar que no se reduzca */
        background-color: #dbeafe !important; /* bg-blue-50 - mismo que el sidebar */
        border: 1px solid rgba(147, 197, 253, 0.3);
        overflow: hidden !important; /* Ocultar cualquier overflow */
        box-sizing: border-box !important; /* Incluir padding y border en el ancho */
      }

      ::ng-deep .sidebar-menu .mat-mdc-menu-item {
        height: 48px;
        line-height: 48px;
        padding: 8px 16px;
        border-radius: 12px;
        margin: 2px 8px;
        color: #1e3a8a; /* text-blue-900 */
        text-decoration: none;
        background-color: transparent; /* Mantener el fondo transparente para evitar conflictos */
        box-sizing: border-box !important; /* Incluir padding y margin en el ancho */
        overflow: hidden !important; /* Ocultar cualquier overflow */
        white-space: nowrap !important; /* Evitar que el texto se divida en líneas */
        text-overflow: ellipsis !important; /* Mostrar ... si el texto es muy largo */
      }

      ::ng-deep .sidebar-menu .mat-mdc-menu-item:hover {
        background-color: #bfdbfe !important; /* hover:bg-blue-100 - mismo que el sidebar */
        color: #1e3a8a !important; /* text-blue-900 */
      }

      ::ng-deep .sidebar-menu .mat-mdc-menu-item.bg-blue-200,
      ::ng-deep .sidebar-menu .mat-mdc-menu-item.active,
      ::ng-deep .sidebar-menu .mat-mdc-menu-item[aria-current='page'] {
        background-color: #bfdbfe !important; /* bg-blue-200 */
        color: #1e3a8a !important; /* text-blue-900 */
        font-weight: normal;
      }

      ::ng-deep .sidebar-menu .mat-mdc-menu-item .mat-icon {
        margin-right: 16px;
        width: 24px;
        height: 24px;
        font-size: 24px;
        /* Mantener el color="primary" de Angular Material */
      }

      ::ng-deep .sidebar-menu .mat-mdc-menu-item span {
        font-size: 14px;
        font-weight: normal;
        color: #1e3a8a; /* text-blue-900 */
      }

      /* Asegurar que los links mantengan el estilo */
      ::ng-deep .sidebar-menu a.mat-mdc-menu-item {
        text-decoration: none;
        display: flex;
        align-items: center;
      }

      /* Evitar que el hover cambie el color del texto */
      ::ng-deep .sidebar-menu .mat-mdc-menu-item:hover span {
        color: #1e3a8a !important; /* text-blue-900 */
      }
      
      /* Asegurar que no haya fondos grises por defecto */
      ::ng-deep .sidebar-menu .mat-mdc-menu-content {
        background-color: #dbeafe !important; /* bg-blue-50 - mismo que el sidebar */
        width: 100% !important;
        min-width: 280px !important;
        overflow-x: hidden !important; /* Ocultar scroll horizontal */
        overflow-y: auto !important; /* Permitir scroll vertical si es necesario */
      }
      
      ::ng-deep .sidebar-menu .cdk-overlay-pane {
        background-color: transparent !important;
        min-width: 280px !important;
        overflow: hidden !important; /* Ocultar cualquier overflow */
      }
      
      /* Forzar el ancho en todos los niveles */
      ::ng-deep .sidebar-menu {
        min-width: 280px !important;
        overflow-x: hidden !important; /* Ocultar scroll horizontal */
      }
    `,
  ],
})
export class SidebarComponent implements OnInit, OnDestroy {
  private authService = inject(AuthService)
  private sidenavService = inject(SidenavService)
  public isExpanded = true
  private subscription = new Subscription()

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
    // Suscripción al estado del sidenav
    this.subscription.add(
      this.sidenavService.isExpanded$.subscribe(isExpanded => {
        this.isExpanded = isExpanded
      }),
    )

    // Forzar verificación inicial del estado de autenticación
    this.authService.checkAuthStatus().subscribe()
  }

  ngOnDestroy() {
    // Limpiar suscripciones para evitar memory leaks
    this.subscription.unsubscribe()
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
