import { Component, inject } from '@angular/core'
import { FormBuilder, FormGroup, Validators } from '@angular/forms'
import { MatDialog } from '@angular/material/dialog'
import { Router } from '@angular/router'
import { NotificationService } from '../../../../shared/services/notification.service'
import { ForgotPasswordDialogComponent } from '../forgot-password-dialog/forgot-password-dialog.component'
import { AuthService } from '../../services/auth.service'

@Component({
    templateUrl: './login-page.component.html',
    styleUrl: './login-page.component.css',
    standalone: false
})
export class LoginPageComponent {
  hidePassword = true
  isLoading = false
  readonly currentYear = new Date().getFullYear()
  private fb = inject(FormBuilder)
  private authService = inject(AuthService)
  private router = inject(Router)
  private notificationService = inject(NotificationService)
  private dialog = inject(MatDialog)

  public myForm: FormGroup = this.fb.group({
    email: ['', [Validators.required, Validators.email]],
    password: ['', [Validators.required, Validators.minLength(6)]],
    rememberMe: [true],
  })

  ngOnInit(): void {
    const rememberedEmail = localStorage.getItem('rememberedEmail')
    if (rememberedEmail) {
      this.myForm.patchValue({ email: rememberedEmail, rememberMe: true })
    }
  }

  onSubmit() {
    if (this.myForm.invalid) {
      this.myForm.markAllAsTouched()
      this.notificationService.warning('Por favor, completa todos los campos correctamente')
      return
    }

    this.isLoading = true
    const { email, password, rememberMe } = this.myForm.value

    this.authService.login(email, password, rememberMe).subscribe({
      next: () => {
        if (rememberMe) {
          localStorage.setItem('rememberedEmail', email)
        } else {
          localStorage.removeItem('rememberedEmail')
        }
        this.notificationService.success('¡Bienvenido! Inicio de sesión exitoso')
        this.router.navigateByUrl('/dashboard')
      },
      error: error => {
        this.isLoading = false
        let errorMessage = 'Error al iniciar sesión. Por favor, intenta nuevamente.'

        if (error?.error?.message) {
          errorMessage = error.error.message
        } else if (error?.message) {
          errorMessage = error.message
        } else if (typeof error === 'string') {
          errorMessage = error
        }

        // Mensajes más amigables
        if (errorMessage.includes('Credenciales no Validas')) {
          errorMessage = '❌ Email o contraseña incorrectos'
        } else if (errorMessage.includes('NetworkError') || errorMessage.includes('ERR_FAILED')) {
          errorMessage = '🔌 No se pudo conectar con el servidor. Verifica tu conexión.'
        }

        this.notificationService.error(errorMessage, 5000)
      },
    })
  }

  getErrorMessage(field: string): string {
    const control = this.myForm.get(field)
    if (!control || !control.errors || !control.touched) return ''

    if (control.hasError('required')) return 'Este campo es obligatorio'
    if (control.hasError('email')) return 'Email no válido'
    if (control.hasError('minlength')) {
      return `Mínimo ${control.errors['minlength'].requiredLength} caracteres`
    }
    return ''
  }

  openForgotPassword(): void {
    this.dialog.open(ForgotPasswordDialogComponent, { width: '420px', disableClose: false })
  }

}
