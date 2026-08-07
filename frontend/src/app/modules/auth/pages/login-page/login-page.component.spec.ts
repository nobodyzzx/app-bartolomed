import { TestBed } from '@angular/core/testing'
import { MatDialog } from '@angular/material/dialog'
import { NoopAnimationsModule } from '@angular/platform-browser/animations'
import { Router } from '@angular/router'
import { of, throwError } from 'rxjs'
import { NotificationService } from '../../../../shared/services/notification.service'
import { AuthModule } from '../../auth.module'
import { AuthService } from '../../services/auth.service'
import { LoginPageComponent } from './login-page.component'
import { createSpyObj, SpyObj } from '../../../../../testing/spy'

describe('LoginPageComponent', () => {
  let component: LoginPageComponent
  let authService: SpyObj<AuthService>
  let router: SpyObj<Router>
  let notification: SpyObj<NotificationService>
  let dialog: SpyObj<MatDialog>

  beforeEach(async () => {
    authService = createSpyObj('AuthService', ['login'])
    router = createSpyObj('Router', ['navigateByUrl'])
    notification = createSpyObj('NotificationService', ['success', 'error', 'warning'])
    dialog = createSpyObj('MatDialog', ['open'])

    await TestBed.configureTestingModule({
      // AuthModule es quien declara LoginPageComponent, así que el template
      // toma de ahí su scope real (Material, formularios). Re-declararlo aquí
      // deja el componente sin directivas conocidas.
      imports: [AuthModule, NoopAnimationsModule],
      providers: [
        { provide: AuthService, useValue: authService },
        { provide: Router, useValue: router },
        { provide: NotificationService, useValue: notification },
        { provide: MatDialog, useValue: dialog },
      ],
    }).compileComponents()

    const fixture = TestBed.createComponent(LoginPageComponent)
    component = fixture.componentInstance
    localStorage.clear()
  })

  afterEach(() => localStorage.clear())

  describe('ngOnInit', () => {
    it('restaura el email recordado y marca rememberMe si hay uno en localStorage', () => {
      localStorage.setItem('rememberedEmail', 'doc@example.com')

      component.ngOnInit()

      expect(component.myForm.value.email).toBe('doc@example.com')
      expect(component.myForm.value.rememberMe).toBe(true)
    })

    it('no toca el form si no hay email recordado', () => {
      component.ngOnInit()
      expect(component.myForm.value.email).toBe('')
    })
  })

  describe('onSubmit — form inválido', () => {
    it('marca todos los campos como touched y avisa sin llamar al servicio', () => {
      component.onSubmit()

      expect(component.myForm.get('email')?.touched).toBe(true)
      expect(notification.warning).toHaveBeenCalledWith('Por favor, completa todos los campos correctamente')
      expect(authService.login).not.toHaveBeenCalled()
    })
  })

  describe('onSubmit — éxito', () => {
    beforeEach(() => {
      component.myForm.setValue({ email: 'doc@example.com', password: 'secret1', rememberMe: true })
    })

    it('con rememberMe=true, recuerda el email y navega al dashboard', () => {
      authService.login.mockReturnValue(of(true))

      component.onSubmit()

      expect(authService.login).toHaveBeenCalledWith('doc@example.com', 'secret1', true)
      expect(localStorage.getItem('rememberedEmail')).toBe('doc@example.com')
      expect(notification.success).toHaveBeenCalledWith('¡Bienvenido! Inicio de sesión exitoso')
      expect(router.navigateByUrl).toHaveBeenCalledWith('/dashboard')
    })

    it('con rememberMe=false, olvida el email recordado', () => {
      localStorage.setItem('rememberedEmail', 'previo@example.com')
      component.myForm.patchValue({ rememberMe: false })
      authService.login.mockReturnValue(of(true))

      component.onSubmit()

      expect(localStorage.getItem('rememberedEmail')).toBeNull()
    })

    it('resetea isLoading=false en éxito antes de navegar', () => {
      // Necesario para que el botón no quede con el spinner trabado si un guard
      // más adelante rechaza la navegación y rebota de vuelta a /auth/login
      // reutilizando esta misma instancia del componente.
      authService.login.mockReturnValue(of(true))
      component.onSubmit()
      expect(component.isLoading).toBe(false)
    })
  })

  describe('onSubmit — error', () => {
    beforeEach(() => {
      component.myForm.setValue({ email: 'doc@example.com', password: 'secret1', rememberMe: true })
    })

    it('revierte isLoading y muestra error.error.message si está presente', () => {
      authService.login.mockReturnValue(throwError(() => ({ error: { message: 'Backend dice no' } })))

      component.onSubmit()

      expect(component.isLoading).toBe(false)
      expect(notification.error).toHaveBeenCalledWith('Backend dice no', 5000)
    })

    it('cae a error.message si no hay error.error.message', () => {
      authService.login.mockReturnValue(throwError(() => ({ message: 'Fallo de red' })))

      component.onSubmit()

      expect(notification.error).toHaveBeenCalledWith('Fallo de red', 5000)
    })

    it('usa el error tal cual si es un string', () => {
      authService.login.mockReturnValue(throwError(() => 'Error como string'))

      component.onSubmit()

      expect(notification.error).toHaveBeenCalledWith('Error como string', 5000)
    })

    it('usa el mensaje genérico si el error no trae ninguna forma reconocida', () => {
      authService.login.mockReturnValue(throwError(() => ({})))

      component.onSubmit()

      expect(notification.error).toHaveBeenCalledWith('Error al iniciar sesión. Por favor, intenta nuevamente.', 5000)
    })

    it('reescribe el mensaje de credenciales inválidas a uno amigable', () => {
      authService.login.mockReturnValue(throwError(() => 'Credenciales no Validas'))

      component.onSubmit()

      expect(notification.error).toHaveBeenCalledWith('❌ Email o contraseña incorrectos', 5000)
    })

    it('reescribe errores de red a un mensaje amigable', () => {
      authService.login.mockReturnValue(throwError(() => 'NetworkError al conectar'))

      component.onSubmit()

      expect(notification.error).toHaveBeenCalledWith(
        '🔌 No se pudo conectar con el servidor. Verifica tu conexión.',
        5000,
      )
    })
  })

  describe('getErrorMessage', () => {
    it('devuelve cadena vacía si el control no existe, no tiene errores o no fue tocado', () => {
      expect(component.getErrorMessage('noExiste')).toBe('')
      expect(component.getErrorMessage('email')).toBe('') // sin touch, aunque sea inválido
    })

    it('devuelve el mensaje de "required"', () => {
      const control = component.myForm.get('email')!
      control.markAsTouched()
      control.setValue('')
      expect(component.getErrorMessage('email')).toBe('Este campo es obligatorio')
    })

    it('devuelve el mensaje de "email" inválido', () => {
      const control = component.myForm.get('email')!
      control.markAsTouched()
      control.setValue('no-es-un-email')
      expect(component.getErrorMessage('email')).toBe('Email no válido')
    })

    it('devuelve el mensaje de "minlength" con el largo requerido', () => {
      const control = component.myForm.get('password')!
      control.markAsTouched()
      control.setValue('123')
      expect(component.getErrorMessage('password')).toBe('Mínimo 6 caracteres')
    })
  })

  it('openForgotPassword abre el diálogo con las opciones esperadas', () => {
    component.openForgotPassword()
    expect(dialog.open).toHaveBeenCalledWith(expect.any(Function), { width: '420px', disableClose: false })
  })
})
