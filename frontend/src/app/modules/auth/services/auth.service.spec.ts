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
  let router: jasmine.SpyObj<Router>
  let session: jasmine.SpyObj<SessionService>
  let roleState: jasmine.SpyObj<RoleStateService>
  let clinicCtx: jasmine.SpyObj<ClinicContextService>

  beforeEach(() => {
    router = jasmine.createSpyObj('Router', ['navigateByUrl'])
    session = jasmine.createSpyObj('SessionService', ['scheduleFromToken', 'clearTimers'])
    roleState = jasmine.createSpyObj('RoleStateService', ['syncRoles', 'normalizeRoles', 'clearRoles'])
    roleState.normalizeRoles.and.callFake((input: any) => input)
    clinicCtx = jasmine.createSpyObj('ClinicContextService', ['setClinic'])

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
    it('con rememberMe=true guarda el token en localStorage y limpia sessionStorage', done => {
      const user = makeUser()

      service.login('doc@example.com', 'secret', true).subscribe(result => {
        expect(result).toBeTrue()
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
      expect(req.request.withCredentials).toBeTrue()
      req.flush({ user, token: 'jwt-token', rememberMe: true })
    })

    it('con rememberMe=false guarda el token en sessionStorage y limpia localStorage', done => {
      const user = makeUser()

      service.login('doc@example.com', 'secret', false).subscribe(() => {
        expect(sessionStorage.getItem('token')).toBe('jwt-token')
        expect(localStorage.getItem('token')).toBeNull()
        done()
      })

      const req = httpMock.expectOne(`${BASE}/auth/login`)
      req.flush({ user, token: 'jwt-token', rememberMe: false })
    })

    it('hidrata el contexto de clínica solo si el usuario trae clinic.id', done => {
      const user = makeUser({ clinic: { id: 'clinic-1', name: 'Norte' } })

      service.login('doc@example.com', 'secret').subscribe(() => {
        expect(clinicCtx.setClinic).toHaveBeenCalledWith('clinic-1')
        done()
      })

      httpMock.expectOne(`${BASE}/auth/login`).flush({ user, token: 'jwt-token' })
    })

    it('no toca el contexto de clínica si el usuario no tiene clinic', done => {
      const user = makeUser({ clinic: undefined })

      service.login('doc@example.com', 'secret').subscribe(() => {
        expect(clinicCtx.setClinic).not.toHaveBeenCalled()
        done()
      })

      httpMock.expectOne(`${BASE}/auth/login`).flush({ user, token: 'jwt-token' })
    })

    it('mapea el mensaje de error del backend', done => {
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

    it('cae al mensaje de HttpErrorResponse si el body de error no trae "message"', done => {
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
    it('sin token en storage, intenta refrescar con la cookie httpOnly', done => {
      const user = makeUser()

      service.checkAuthStatus().subscribe(result => {
        expect(result).toBeTrue()
        expect(service.authStatus()).toBe(AuthStatus.authenticated)
        done()
      })

      const req = httpMock.expectOne(`${BASE}/auth/refresh`)
      expect(req.request.method).toBe('POST')
      req.flush({ user, token: 'refreshed-token' })
    })

    it('si el refresh también falla, marca notAuthenticated', done => {
      service.checkAuthStatus().subscribe(result => {
        expect(result).toBeFalse()
        expect(service.authStatus()).toBe(AuthStatus.notAuthenticated)
        expect(service.currentUser()).toBeNull()
        done()
      })

      httpMock.expectOne(`${BASE}/auth/refresh`).flush(null, { status: 401, statusText: 'Unauthorized' })
    })

    it('con token guardado, llama a check-status con header Bearer', done => {
      localStorage.setItem('token', 'existing-token')
      const user = makeUser()

      service.checkAuthStatus().subscribe(result => {
        expect(result).toBeTrue()
        done()
      })

      const req = httpMock.expectOne(`${BASE}/auth/check-status`)
      expect(req.request.headers.get('Authorization')).toBe('Bearer existing-token')
      req.flush({ user, token: 'existing-token' })
    })

    it('si check-status responde error, limpia storage y marca notAuthenticated', done => {
      localStorage.setItem('token', 'stale-token')

      service.checkAuthStatus().subscribe(result => {
        expect(result).toBeFalse()
        expect(service.authStatus()).toBe(AuthStatus.notAuthenticated)
        expect(localStorage.getItem('token')).toBeNull()
        expect(sessionStorage.getItem('token')).toBeNull()
        done()
      })

      httpMock.expectOne(`${BASE}/auth/check-status`).flush(null, { status: 401, statusText: 'Unauthorized' })
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
    it('en éxito, autentica al usuario', done => {
      const user = makeUser()

      service.refreshAccessToken().subscribe(result => {
        expect(result).toBeTrue()
        expect(service.authStatus()).toBe(AuthStatus.authenticated)
        done()
      })

      httpMock.expectOne(`${BASE}/auth/refresh`).flush({ user, token: 'jwt-token' })
    })

    it('en error, marca notAuthenticated sin lanzar', done => {
      service.refreshAccessToken().subscribe(result => {
        expect(result).toBeFalse()
        expect(service.authStatus()).toBe(AuthStatus.notAuthenticated)
        expect(service.currentUser()).toBeNull()
        done()
      })

      httpMock.expectOne(`${BASE}/auth/refresh`).flush(null, { status: 401, statusText: 'Unauthorized' })
    })
  })

  describe('forgotPassword', () => {
    it('envía el email y devuelve el mensaje del backend', done => {
      service.forgotPassword('doc@example.com').subscribe(res => {
        expect(res.message).toBe('Revisa tu correo')
        done()
      })

      const req = httpMock.expectOne(`${BASE}/auth/forgot-password`)
      expect(req.request.body).toEqual({ email: 'doc@example.com' })
      req.flush({ message: 'Revisa tu correo' })
    })

    it('mapea el mensaje de error del backend', done => {
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
    it('envía token y nueva contraseña', done => {
      service.resetPassword('reset-token', 'newpass123').subscribe(res => {
        expect(res.message).toBe('Contraseña actualizada')
        done()
      })

      const req = httpMock.expectOne(`${BASE}/auth/reset-password`)
      expect(req.request.body).toEqual({ token: 'reset-token', newPassword: 'newpass123' })
      req.flush({ message: 'Contraseña actualizada' })
    })

    it('mapea el mensaje de error del backend', done => {
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
