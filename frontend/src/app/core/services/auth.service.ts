import { computed, Injectable, signal } from '@angular/core'
import { Router } from '@angular/router'
import { permissionsForRoles } from '../constants/role-permissions.map'
import { Permission } from '../enums/permission.enum'
import { UserRoles } from '../enums/user-roles.enum'

@Injectable({
  providedIn: 'root',
})
export class AuthService {
  private _currentUserRoles = signal<UserRoles[]>([])
  private _currentPermissions = signal<Permission[]>([])

  // Roles del usuario actual (signal pública)
  public currentUserRoles = computed(() => this._currentUserRoles())
  public currentPermissions = computed(() => this._currentPermissions())

  // El usuario está logueado si tiene al menos un rol
  public isAuthenticated = computed(() => this._currentUserRoles().length > 0)

  constructor(private router: Router) {
    // Cargar roles desde localStorage si existen al iniciar
    const storedRoles = localStorage.getItem('userRoles')
    if (storedRoles) {
      const roles = JSON.parse(storedRoles) as UserRoles[]
      this._currentUserRoles.set(roles)
      // IMPORTANTE: Recalcular permisos desde los roles al recargar
      this._currentPermissions.set(permissionsForRoles(roles))
      console.log('[AuthService] Restaurado desde localStorage:', {
        roles,
        permissions: this._currentPermissions().length,
      })
    }
  }

  // Método para simular login
  loginAs(roles: UserRoles[]) {
    this._currentUserRoles.set(roles)
    this._currentPermissions.set(permissionsForRoles(roles))
    localStorage.setItem('userRoles', JSON.stringify(roles))
    localStorage.setItem('userPerms', JSON.stringify(this._currentPermissions()))
    this.router.navigate(['/dashboard'])
  }

  logout() {
    this._currentUserRoles.set([])
    this._currentPermissions.set([])
    localStorage.removeItem('userRoles')
    localStorage.removeItem('userPerms')
    this.router.navigate(['/auth/login'])
  }

  // Helper para verificar si el usuario tiene un rol específico
  hasRole(role: UserRoles): boolean {
    return this.currentUserRoles().includes(role)
  }

  // Helper para verificar si tiene alguno de los roles permitidos
  hasAnyRole(allowedRoles: UserRoles[]): boolean {
    if (!allowedRoles || allowedRoles.length === 0) return true
    return this.currentUserRoles().some(role => allowedRoles.includes(role))
  }

  // Permisos
  hasPermission(p: Permission): boolean {
    return this.currentPermissions().includes(p)
  }

  hasAnyPermission(perms: Permission[]): boolean {
    if (!perms || perms.length === 0) return true
    return this.currentPermissions().some(p => perms.includes(p))
  }
}
