import { computed, Injectable, signal } from '@angular/core'
import { Router } from '@angular/router'
import { permissionsForRoles } from '../constants/role-permissions.map'
import { Permission } from '../enums/permission.enum'
import { UserRoles } from '../enums/user-roles.enum'

/**
 * Gestiona el estado reactivo de roles y permisos del usuario en la UI.
 * No maneja tokens JWT — eso es responsabilidad de AuthService (modules/auth).
 */
@Injectable({
  providedIn: 'root',
})
export class RoleStateService {
  private _currentUserRoles = signal<UserRoles[]>([])
  private _currentPermissions = signal<Permission[]>([])

  public currentUserRoles = computed(() => this._currentUserRoles())
  public currentPermissions = computed(() => this._currentPermissions())
  public isAuthenticated = computed(() => this._currentUserRoles().length > 0)

  constructor(private router: Router) {
    const storedRoles = localStorage.getItem('userRoles')
    if (storedRoles) {
      const roles = JSON.parse(storedRoles) as UserRoles[]
      this._currentUserRoles.set(roles)
      this._currentPermissions.set(permissionsForRoles(roles))
    }
  }

  /** Sincroniza roles sin navegar. Usar desde guards y flujo de login real. */
  syncRoles(roles: UserRoles[]): void {
    this._currentUserRoles.set(roles)
    this._currentPermissions.set(permissionsForRoles(roles))
    localStorage.setItem('userRoles', JSON.stringify(roles))
    localStorage.setItem('userPerms', JSON.stringify(this._currentPermissions()))
  }

  /** Simula un login con roles específicos y navega al dashboard. Solo para el simulador de roles. */
  loginAs(roles: UserRoles[]): void {
    this.syncRoles(roles)
    this.router.navigate(['/dashboard'])
  }

  logout(): void {
    this._currentUserRoles.set([])
    this._currentPermissions.set([])
    localStorage.removeItem('userRoles')
    localStorage.removeItem('userPerms')
    this.router.navigate(['/auth/login'])
  }

  hasRole(role: UserRoles): boolean {
    return this.currentUserRoles().includes(role)
  }

  hasAnyRole(allowedRoles: UserRoles[]): boolean {
    if (!allowedRoles || allowedRoles.length === 0) return true
    return this.currentUserRoles().some(role => allowedRoles.includes(role))
  }

  hasPermission(p: Permission): boolean {
    return this.currentPermissions().includes(p)
  }

  hasAnyPermission(perms: Permission[]): boolean {
    if (!perms || perms.length === 0) return true
    return this.currentPermissions().some(p => perms.includes(p))
  }
}
