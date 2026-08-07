import { HttpClientTestingModule, HttpTestingController } from '@angular/common/http/testing'
import { TestBed } from '@angular/core/testing'
import { Router } from '@angular/router'
import { ClinicContextService } from '../../clinics/services/clinic-context.service'
import { UserRoles } from '../../../core/enums/user-roles.enum'
import { RoleStateService } from '../../../core/services/role-state.service'
import { SessionService } from '../../../core/services/session.service'
import { environment } from '../../../environments/environments'
import { AuthStatus, User } from '../interfaces'
import { AuthService } from './auth.service'
import { createSpyObj, SpyObj } from '../../../../testing/spy'
import { itDone } from '../../../../testing/it-done'

const BASE = environment.baseUrl

const makeUser = (overrides: Partial<User> = {}): User =>
  ({
    id: 'user-1',
    email: 'doc@example.com',
    personalInfo: { firstName: 'Ana', lastName: 'Perez' },
    isActive: true,
    roles: [UserRoles.DOCTOR],
    ...overrides,
  }) as User

describe('AuthService', () => {
  let service: AuthService
  let httpMock: HttpTestingController
  let router: SpyObj<Router>
  let session: SpyObj<SessionService>
  let roleState: SpyObj<RoleStateService>
  let clinicCtx: SpyObj<ClinicContextService>

  beforeEach(() => {
    router = createSpyObj('Router', ['navigateByUrl'])
    session = createSpyObj('SessionService', ['scheduleFromToken', 'clearTimers'])
    roleState = createSpyObj('RoleStateService', ['syncRoles', 'normalizeRoles', 'clearRoles'])
    roleState.normalizeRoles.mockImplementation((input: any) => input)
    clinicCtx = createSpyObj('ClinicContextService', ['setClinic'])

    TestBed.configureTestingModule({
      imports: [HttpClientTestingModule],
      providers: [
        AuthService,
        { provide: Router, useValue: router },
        { provide: SessionService, useValue: session },
        { provide: RoleStateService, useValue: roleState },
        { provide: ClinicContextService, useValue: clinicCtx },
      ],
    })

    service = TestBed.inject(AuthService)
    httpMock = TestBed.inject(HttpTestingController)
    localStorage.clear()
    sessionStorage.clear()
  })

  afterEach(() => {
    httpMock.verify()
    localStorage.clear()
    sessionStorage.clear()
  })

  describe('login', () => {
    itDone('con rememberMe=true guarda el token en localStorage y limpia sessionStorage', done => {
      const user = makeUser()

      service.login('doc@example.com', 'secret', true).subscribe(result => {
        expect(result).toBe(true)
        expect(localStorage.getItem('token')).toBe('jwt-token')
        expect(sessionStorage.getItem('token')).toBeNull()
        expect(service.currentUser()).toEqual(user)
        expect(service.authStatus()).toBe(AuthStatus.authenticated)
        expect(roleState.syncRoles).toHaveBeenCalledWith([UserRoles.DOCTOR])
        expect(session.scheduleFromToken).toHaveBeenCalledWith('jwt-token')
        done()
      })

      const req = httpMock.expectOne(`${BASE}/auth/login`)
      expect(req.request.method).toBe('POST')
      expect(req.request.body).toEqual({ email: 'doc@example.com', password: 'secret', rememberMe: true })
      expect(req.request.withCredentials).toBe(true)
      req.flush({ user, token: 'jwt-token', rememberMe: true })
    })

    itDone('con rememberMe=false guarda el token en sessionStorage y limpia localStorage', done => {
      const user = makeUser()

      service.login('doc@example.com', 'secret', false).subscribe(() => {
        expect(sessionStorage.getItem('token')).toBe('jwt-token')
        expect(localStorage.getItem('token')).toBeNull()
        done()
      })

      const req = httpMock.expectOne(`${BASE}/auth/login`)
      req.flush({ user, token: 'jwt-token', rememberMe: false })
    })

    itDone('hidrata el contexto de clínica solo si el usuario trae clinic.id', done => {
      const user = makeUser({ clinic: { id: 'clinic-1', name: 'Norte' } })

      service.login('doc@example.com', 'secret').subscribe(() => {
        expect(clinicCtx.setClinic).toHaveBeenCalledWith('clinic-1')
        done()
      })

      httpMock.expectOne(`${BASE}/auth/login`).flush({ user, token: 'jwt-token' })
    })

    itDone('limpia el contexto de clínica si el usuario que entra no tiene clinic', done => {
      const user = makeUser({ clinic: undefined })

      service.login('doc@example.com', 'secret').subscribe(() => {
        // Dejarlo como estaba heredaría la clínica del usuario anterior.
        expect(clinicCtx.setClinic).toHaveBeenCalledWith(null)
        done()
      })

      httpMock.expectOne(`${BASE}/auth/login`).flush({ user, token: 'jwt-token' })
    })

    itDone('pisa la clínica que dejó el usuario anterior en localStorage', done => {
      // Bug real: el contexto de clínica sobrevivía al login de otro usuario si
      // el anterior no cerró sesión (token vencido, navegador cerrado). Quien
      // entraba quedaba en una clínica de la que no es miembro, con el
      // dashboard vacío y todas sus peticiones en 403.
      clinicCtx.clinicId = 'clinica-del-usuario-anterior'
      const user = makeUser({ clinic: { id: 'clinic-1', name: 'Norte' } })

      service.login('doc@example.com', 'secret').subscribe(() => {
        expect(clinicCtx.setClinic).toHaveBeenCalledWith('clinic-1')
        done()
      })

      httpMock.expectOne(`${BASE}/auth/login`).flush({ user, token: 'jwt-token' })
    })

    itDone('mapea el mensaje de error del backend', done => {
      service.login('doc@example.com', 'wrong').subscribe({
        error: message => {
          expect(message).toBe('Credenciales inválidas')
          done()
        },
      })

      httpMock
        .expectOne(`${BASE}/auth/login`)
        .flush({ message: 'Credenciales inválidas' }, { status: 401, statusText: 'Unauthorized' })
    })

    itDone('cae al mensaje de HttpErrorResponse si el body de error no trae "message"', done => {
      // err.error es null, así que err?.error?.message es undefined — el código usa
      // err?.message, que Angular siempre completa con un texto descriptivo del fallo HTTP
      // (el fallback final 'Error al iniciar sesión' solo se usaría si err.message también
      // faltara, lo cual no ocurre con HttpErrorResponse real).
      service.login('doc@example.com', 'wrong').subscribe({
        error: message => {
          expect(message).toContain('500')
          done()
        },
      })

      httpMock.expectOne(`${BASE}/auth/login`).flush(null, { status: 500, statusText: 'Server Error' })
    })
  })

  describe('checkAuthStatus', () => {
    itDone('sin token en storage, intenta refrescar con la cookie httpOnly', done => {
      const user = makeUser()

      service.checkAuthStatus().subscribe(result => {
        expect(result).toBe(true)
        expect(service.authStatus()).toBe(AuthStatus.authenticated)
        done()
      })

      const req = httpMock.expectOne(`${BASE}/auth/refresh`)
      expect(req.request.method).toBe('POST')
      req.flush({ user, token: 'refreshed-token' })
    })

    itDone('si el refresh también falla, marca notAuthenticated', done => {
      service.checkAuthStatus().subscribe(result => {
        expect(result).toBe(false)
        expect(service.authStatus()).toBe(AuthStatus.notAuthenticated)
        expect(service.currentUser()).toBeNull()
        done()
      })

      httpMock.expectOne(`${BASE}/auth/refresh`).flush(null, { status: 401, statusText: 'Unauthorized' })
    })

    itDone('con token guardado, llama a check-status con header Bearer', done => {
      localStorage.setItem('token', 'existing-token')
      const user = makeUser()

      service.checkAuthStatus().subscribe(result => {
        expect(result).toBe(true)
        done()
      })

      const req = httpMock.expectOne(`${BASE}/auth/check-status`)
      expect(req.request.headers.get('Authorization')).toBe('Bearer existing-token')
      req.flush({ user, token: 'existing-token' })
    })

    itDone('si check-status responde error, limpia storage y marca notAuthenticated', done => {
      localStorage.setItem('token', 'stale-token')

      service.checkAuthStatus().subscribe(result => {
        expect(result).toBe(false)
        expect(service.authStatus()).toBe(AuthStatus.notAuthenticated)
        expect(localStorage.getItem('token')).toBeNull()
        expect(sessionStorage.getItem('token')).toBeNull()
        done()
      })

      httpMock.expectOne(`${BASE}/auth/check-status`).flush(null, { status: 401, statusText: 'Unauthorized' })
    })

    itDone('no pisa una clínica ya seleccionada al restaurar sesión en una recarga de página', done => {
      // Bug real: checkAuthStatus() corre en cada recarga (DashboardLayoutComponent),
      // y antes del fix llamaba setClinic(user.clinic.id) sin condición — devolviendo
      // en silencio al usuario a su clínica "principal" aunque hubiera elegido otra
      // manualmente en el header. Con clinicId ya poblado, el hidratador debe no-opear.
      ;(clinicCtx as any).clinicId = 'clinica-elegida-por-el-usuario'
      localStorage.setItem('token', 'existing-token')
      const user = makeUser({ clinic: { id: 'clinica-principal-del-usuario', name: 'Principal' } })

      service.checkAuthStatus().subscribe(() => {
        expect(clinicCtx.setClinic).not.toHaveBeenCalled()
        done()
      })

      httpMock.expectOne(`${BASE}/auth/check-status`).flush({ user, token: 'existing-token' })
    })
  })

  describe('logout', () => {
    it('revoca el token en el backend si hay uno local, y limpia todo el estado', () => {
      localStorage.setItem('token', 'existing-token')
      localStorage.setItem('refreshToken', 'rt')

      service.logout()

      const req = httpMock.expectOne(`${BASE}/auth/logout`)
      expect(req.request.headers.get('Authorization')).toBe('Bearer existing-token')
      req.flush({})

      expect(session.clearTimers).toHaveBeenCalled()
      expect(roleState.clearRoles).toHaveBeenCalled()
      expect(clinicCtx.setClinic).toHaveBeenCalledWith(null)
      expect(localStorage.getItem('token')).toBeNull()
      expect(localStorage.getItem('refreshToken')).toBeNull()
      expect(service.authStatus()).toBe(AuthStatus.notAuthenticated)
      expect(router.navigateByUrl).toHaveBeenCalledWith('/auth/login')
    })

    it('no llama al backend si no hay token local, pero igual limpia el estado', () => {
      service.logout()

      httpMock.expectNone(`${BASE}/auth/logout`)
      expect(service.authStatus()).toBe(AuthStatus.notAuthenticated)
      expect(router.navigateByUrl).toHaveBeenCalledWith('/auth/login')
    })
  })

  describe('refreshAccessToken', () => {
    itDone('en éxito, autentica al usuario', done => {
      const user = makeUser()

      service.refreshAccessToken().subscribe(result => {
        expect(result).toBe(true)
        expect(service.authStatus()).toBe(AuthStatus.authenticated)
        done()
      })

      httpMock.expectOne(`${BASE}/auth/refresh`).flush({ user, token: 'jwt-token' })
    })

    itDone('en error, marca notAuthenticated sin lanzar', done => {
      service.refreshAccessToken().subscribe(result => {
        expect(result).toBe(false)
        expect(service.authStatus()).toBe(AuthStatus.notAuthenticated)
        expect(service.currentUser()).toBeNull()
        done()
      })

      httpMock.expectOne(`${BASE}/auth/refresh`).flush(null, { status: 401, statusText: 'Unauthorized' })
    })

    itDone('no pisa una clínica ya seleccionada en una renovación silenciosa de token', done => {
      // Mismo bug que en checkAuthStatus: refreshAccessToken() corre en segundo plano
      // (interceptor de 401, o el timer de SessionService) sin que el usuario lo note —
      // no debe resetear su clínica activa de vuelta a la "principal" del usuario.
      ;(clinicCtx as any).clinicId = 'clinica-elegida-por-el-usuario'
      const user = makeUser({ clinic: { id: 'clinica-principal-del-usuario', name: 'Principal' } })

      service.refreshAccessToken().subscribe(() => {
        expect(clinicCtx.setClinic).not.toHaveBeenCalled()
        done()
      })

      httpMock.expectOne(`${BASE}/auth/refresh`).flush({ user, token: 'jwt-token' })
    })
  })

  describe('forgotPassword', () => {
    itDone('envía el email y devuelve el mensaje del backend', done => {
      service.forgotPassword('doc@example.com').subscribe(res => {
        expect(res.message).toBe('Revisa tu correo')
        done()
      })

      const req = httpMock.expectOne(`${BASE}/auth/forgot-password`)
      expect(req.request.body).toEqual({ email: 'doc@example.com' })
      req.flush({ message: 'Revisa tu correo' })
    })

    itDone('mapea el mensaje de error del backend', done => {
      service.forgotPassword('doc@example.com').subscribe({
        error: message => {
          expect(message).toBe('No se pudo procesar')
          done()
        },
      })

      httpMock
        .expectOne(`${BASE}/auth/forgot-password`)
        .flush({ message: 'No se pudo procesar' }, { status: 400, statusText: 'Bad Request' })
    })
  })

  describe('resetPassword', () => {
    itDone('envía token y nueva contraseña', done => {
      service.resetPassword('reset-token', 'newpass123').subscribe(res => {
        expect(res.message).toBe('Contraseña actualizada')
        done()
      })

      const req = httpMock.expectOne(`${BASE}/auth/reset-password`)
      expect(req.request.body).toEqual({ token: 'reset-token', newPassword: 'newpass123' })
      req.flush({ message: 'Contraseña actualizada' })
    })

    itDone('mapea el mensaje de error del backend', done => {
      service.resetPassword('bad-token', 'newpass123').subscribe({
        error: message => {
          expect(message).toBe('Token inválido')
          done()
        },
      })

      httpMock
        .expectOne(`${BASE}/auth/reset-password`)
        .flush({ message: 'Token inválido' }, { status: 400, statusText: 'Bad Request' })
    })
  })
})
