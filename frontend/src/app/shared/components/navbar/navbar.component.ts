import { Component, computed, inject, OnInit } from '@angular/core'
import { MatDialog } from '@angular/material/dialog'

import { UserRoles } from '@core/enums/user-roles.enum'
import { AuthService as RoleAuthService } from '@core/services/auth.service'
import { AuthService } from '../../../modules/auth/services/auth.service'
import { RoleSimulatorDialogComponent } from '../role-simulator-dialog/role-simulator-dialog.component'
import { SidenavService } from '../services/sidenav.services'

@Component({
  selector: 'share-navbar',
  templateUrl: './navbar.component.html',
  styles: ``,
})
export class NavbarComponent implements OnInit {
  private authService = inject(AuthService)
  private roleAuth = inject(RoleAuthService)
  private sidenavService = inject(SidenavService)
  private dialog = inject(MatDialog)
  public user = computed(() => this.authService.currentUser())
  public readonly UserRoles = UserRoles

  ngOnInit() {
    this.authService.checkAuthStatus().subscribe(this.user)
  }
  isExpanded = true

  toggleSidenav() {
    this.sidenavService.toggleSidenav()
  }

  onLogout() {
    this.authService.logout()
  }

  // Simular login con distintos roles
  setRole(role: UserRoles) {
    this.roleAuth.loginAs([role])
  }

  // Simular login con roles cruzados
  setRoles(roles: UserRoles[]) {
    this.roleAuth.loginAs(roles)
  }

  // Abrir diálogo de simulador de roles
  openRoleSimulator() {
    const dialogRef = this.dialog.open(RoleSimulatorDialogComponent, {
      width: '600px',
      disableClose: false,
    })

    dialogRef.afterClosed().subscribe((selectedRoles: UserRoles[] | undefined) => {
      if (selectedRoles && selectedRoles.length > 0) {
        this.roleAuth.loginAs(selectedRoles)
      }
    })
  }
}
