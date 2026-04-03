import { HttpClient, HttpErrorResponse, HttpHeaders } from '@angular/common/http'
import { computed, inject, Injectable, signal } from '@angular/core'
import { Router } from '@angular/router'

import { catchError, map, Observable, of, throwError } from 'rxjs'
import { ClinicContextService } from '../../clinics/services/clinic-context.service'
import { RoleStateService } from '../../../core/services/role-state.service'
import { SessionService } from '../../../core/services/session.service'
import { environment } from '../../../environments/environments'

import { AuthStatus, CheckTokenResponse, LoginResponse, User } from '../interfaces'

@Injectable({
  providedIn: 'root',
})
export class AuthService {
  private readonly baseUrl: string = environment.baseUrl
  private http = inject(HttpClient)
  private router = inject(Router)
  private session = inject(SessionService)
  private roleState = inject(RoleStateService)

  private clinicCtx = inject(ClinicContextService)

  private _currentUser = signal<User | null>(null)
  private _authStatus = signal<AuthStatus>(AuthStatus.checking)

  public currentUser = computed(() => this._currentUser())
  public authStatus = computed(() => this._authStatus())

  constructor() {
    // No hacer nada en el constructor para evitar dependencia circular con interceptores
  }

  initializeAuth(): Observable<boolean> {
    return this.checkAuthStatus()
  }

  private setAuthentication(user: User, token: string, rememberMe = true): boolean {
    this._currentUser.set(user)
    this._authStatus.set(AuthStatus.authenticated)
    // Sincronizar roles con RoleStateService (fuente de verdad de UI)
    this.roleState.syncRoles(this.roleState.normalizeRoles(user.roles))
    // Hidratar contexto de clínica con la clínica principal del usuario
    if (user.clinic?.id) {
      this.clinicCtx.setClinic(user.clinic.id)
    }
    if (rememberMe) {
      localStorage.setItem('token', token)
      sessionStorage.removeItem('token')
    } else {
      sessionStorage.setItem('token', token)
      localStorage.removeItem('token')
    }
    this.session.scheduleFromToken(token)
    return true
  }

  login(email: string, password: string, rememberMe = false): Observable<boolean> {
    const url = `${this.baseUrl}/auth/login`
    const body = { email, password, rememberMe }
    return this.http.post<LoginResponse>(url, body, { withCredentials: true }).pipe(
      map(({ user, token, rememberMe: remember }) =>
        this.setAuthentication(user, token, remember ?? rememberMe),
      ),
      catchError(err => {
        const errorMessage = err?.error?.message || err?.message || 'Error al iniciar sesión'
        return throwError(() => errorMessage)
      }),
    )
  }

  checkAuthStatus(): Observable<boolean> {
    const url = `${this.baseUrl}/auth/check-status`
    const token = localStorage.getItem('token') || sessionStorage.getItem('token')

    if (!token) {
      // Intentar refrescar usando cookie httpOnly
      return this.refreshAccessToken().pipe(
        catchError(() => {
          // Si falla el refresh, marcar como no autenticado
          this._authStatus.set(AuthStatus.notAuthenticated)
          this._currentUser.set(null)
          return of(false)
        }),
      )
    }

    const headers = new HttpHeaders().set('Authorization', `Bearer ${token}`)

    return this.http.get<CheckTokenResponse>(url, { headers, withCredentials: true }).pipe(
      map(({ user, token }) =>
        this.setAuthentication(user, token, !!localStorage.getItem('token')),
      ),
      catchError((_err: HttpErrorResponse) => {
        // Si el backend rechaza el token o no responde, forzar logout
        this._authStatus.set(AuthStatus.notAuthenticated)
        this._currentUser.set(null)
        localStorage.removeItem('token')
        sessionStorage.removeItem('token')
        return of(false)
      }),
    )
  }
  logout(): void {
    // Revocar refresh token en el servidor (best-effort)
    const token = localStorage.getItem('token')
    if (token) {
      const headers = new HttpHeaders().set('Authorization', `Bearer ${token}`)
      this.http
        .post(`${this.baseUrl}/auth/logout`, {}, { headers, withCredentials: true })
        .pipe(catchError(() => of(null)))
        .subscribe()
    }

    // Limpiar estado local y temporizadores de sesión
    this.session.clearTimers()
    this._currentUser.set(null)
    this._authStatus.set(AuthStatus.notAuthenticated)
    this.roleState.clearRoles()
    this.clinicCtx.setClinic(null)
    localStorage.removeItem('token')
    sessionStorage.removeItem('token')
    localStorage.removeItem('refreshToken')

    // Redirigir a login
    this.router.navigateByUrl('/auth/login')
  }

  forgotPassword(email: string): Observable<{ message: string }> {
    return this.http.post<{ message: string }>(`${this.baseUrl}/auth/forgot-password`, { email }).pipe(
      catchError(err => throwError(() => err?.error?.message || 'Error al procesar la solicitud')),
    )
  }

  resetPassword(token: string, newPassword: string): Observable<{ message: string }> {
    return this.http.post<{ message: string }>(`${this.baseUrl}/auth/reset-password`, { token, newPassword }).pipe(
      catchError(err => throwError(() => err?.error?.message || 'Error al restablecer la contraseña')),
    )
  }

  refreshAccessToken(): Observable<boolean> {
    const url = `${this.baseUrl}/auth/refresh`
    return this.http.post<LoginResponse>(url, {}, { withCredentials: true }).pipe(
      map(({ user, token, rememberMe }) => this.setAuthentication(user, token, rememberMe ?? true)),
      catchError(() => {
        // Si no hay refresh token válido, marcar como no autenticado
        this._authStatus.set(AuthStatus.notAuthenticated)
        this._currentUser.set(null)
        return of(false)
      }),
    )
  }
}
