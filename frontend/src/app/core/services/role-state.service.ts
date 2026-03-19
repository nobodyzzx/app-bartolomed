import { computed, inject, Injectable, isDevMode, signal } from '@angular/core'
import { Router } from '@angular/router'
import { permissionsForRoles } from '../constants/role-permissions.map'
import { Permission } from '../enums/permission.enum'
import { UserRoles } from '../enums/user-roles.enum'

/**
 * Gestiona el estado reactivo de roles y permisos del usuario en la UI.
 * No maneja tokens JWT — eso es responsabilidad de AuthService (modules/auth).
 *
 * MODELO DE CONFIANZA:
 * - Los roles en localStorage son un caché temporal para renderizado rápido.
 * - La fuente de verdad siempre es el JWT devuelto por el backend.
 * - syncRoles() se llama desde rolesSyncGuard tras cada checkAuthStatus(), sobreescribiendo el caché.
 * - El backend valida roles en cada petición; la manipulación del caché solo afecta la UI.
 */
@Injectable({
  providedIn: 'root',
})
export class RoleStateService {
  private router = inject(Router)

  private _currentUserRoles = signal<UserRoles[]>([])
  private _currentPermissions = signal<Permission[]>([])

  public currentUserRoles = computed(() => this._currentUserRoles())
  public currentPermissions = computed(() => this._currentPermissions())
  public isAuthenticated = computed(() => this._currentUserRoles().length > 0)

  constructor() {
    // Restaurar caché local para renderizado rápido antes del checkAuthStatus()
    const storedRoles = localStorage.getItem('userRoles')
    if (storedRoles) {
      try {
        const roles = this.normalizeRoles(JSON.parse(storedRoles))
        this._currentUserRoles.set(roles)
        this._currentPermissions.set(permissionsForRoles(roles))
      } catch {
        // Caché corrupta — limpiar
        localStorage.removeItem('userRoles')
        localStorage.removeItem('userPerms')
      }
    }
  }

  /** Sincroniza roles desde el JWT (fuente de verdad). Usar desde guards y flujo de login real. */
  syncRoles(roles: UserRoles[]): void {
    const normalizedRoles = this.normalizeRoles(roles)
    this._currentUserRoles.set(normalizedRoles)
    this._currentPermissions.set(permissionsForRoles(normalizedRoles))
    localStorage.setItem('userRoles', JSON.stringify(normalizedRoles))
    localStorage.setItem('userPerms', JSON.stringify(this._currentPermissions()))
  }

  /** Normaliza roles — público para reutilizar desde guards sin duplicar lógica. */
  normalizeRoles(input: unknown): UserRoles[] {
    const roles = Array.isArray(input) ? input : []
    const normalized = new Set<UserRoles>()

    for (const rawRole of roles) {
      const value = String(rawRole || '')
        .toLowerCase()
        .trim()
      switch (value) {
        case UserRoles.RECEPTIONIST:
        case UserRoles.PHARMACIST:
        case UserRoles.NURSE:
        case UserRoles.DOCTOR:
        case UserRoles.ADMIN:
        case UserRoles.SUPER_ADMIN:
          normalized.add(value as UserRoles)
          break
        case 'super_user':
        case 'superadmin':
        case 'super_admin':
          normalized.add(UserRoles.SUPER_ADMIN)
          break
        case 'administrator':
          normalized.add(UserRoles.ADMIN)
          break
        case 'medic':
          normalized.add(UserRoles.DOCTOR)
          break
        case 'nurse_role':
          normalized.add(UserRoles.NURSE)
          break
        case 'reception':
          normalized.add(UserRoles.RECEPTIONIST)
          break
        case 'pharma':
          normalized.add(UserRoles.PHARMACIST)
          break
        default:
          break
      }
    }

    return Array.from(normalized)
  }

  /**
   * Simula un login con roles específicos. SOLO DISPONIBLE EN DESARROLLO.
   * En producción este método no hace nada.
   */
  loginAs(roles: UserRoles[]): void {
    if (!isDevMode()) return
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
