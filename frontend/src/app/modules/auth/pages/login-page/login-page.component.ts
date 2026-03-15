import { Component, inject } from '@angular/core'
import { FormBuilder, FormGroup, Validators } from '@angular/forms'
import { MatDialog } from '@angular/material/dialog'
import { Router } from '@angular/router'
import { UserRoles } from '@core/enums/user-roles.enum'
import { RoleStateService } from '@core/services/role-state.service'
import { RoleSimulatorDialogComponent } from '../../../../shared/components/role-simulator-dialog/role-simulator-dialog.component'
import { NotificationService } from '../../../../shared/services/notification.service'
import { AuthService } from '../../services/auth.service'

@Component({
  templateUrl: './login-page.component.html',
  styleUrl: './login-page.component.css',
})
export class LoginPageComponent {
  hidePassword = true
  isLoading = false
  private fb = inject(FormBuilder)
  private authService = inject(AuthService)
  private roleAuth = inject(RoleStateService)
  private router = inject(Router)
  private notificationService = inject(NotificationService)
  private dialog = inject(MatDialog)
  public readonly UserRoles = UserRoles

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
      next: response => {
        if (rememberMe) {
          localStorage.setItem('rememberedEmail', email)
        } else {
          localStorage.removeItem('rememberedEmail')
        }
        // Sincronizar roles con el sistema de roles (core) para el Sidebar
        const backendRoles: string[] = this.authService.currentUser()?.roles ?? []
        const mapped: UserRoles[] = this.mapBackendRolesToUserRoles(backendRoles)
        if (mapped.length > 0) {
          this.roleAuth.syncRoles(mapped)
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

  // Simulación de roles (desarrollo)
  simulateRole(role: UserRoles) {
    this.roleAuth.loginAs([role])
  }

  simulateRoleCombo(roles: UserRoles[]) {
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

  // Mapea roles del backend a los nuevos UserRoles, aceptando coincidencias exactas y alias legacy
  private mapBackendRolesToUserRoles(roles: string[]): UserRoles[] {
    const result = new Set<UserRoles>()
    const values = Object.values(UserRoles)

    for (const raw of roles) {
      if (!raw) continue
      const r = String(raw).toLowerCase().trim()

      // 1) Coincidencia exacta con nuestros enums
      if ((values as string[]).includes(r)) {
        result.add(r as UserRoles)
        continue
      }

      // 2) Aliases/variantes legacy comunes
      switch (r) {
        case 'super_user':
        case 'superadmin':
        case 'superadmin_user':
          result.add(UserRoles.SUPER_ADMIN)
          break
        case 'administrator':
          result.add(UserRoles.ADMIN)
          break
        case 'medic':
          result.add(UserRoles.DOCTOR)
          break
        case 'nurse_role':
          result.add(UserRoles.NURSE)
          break
        case 'reception':
          result.add(UserRoles.RECEPTIONIST)
          break
        case 'pharma':
          result.add(UserRoles.PHARMACIST)
          break
        case 'user':
          // Por defecto, mapear 'user' a DOCTOR para acceso médico básico
          result.add(UserRoles.DOCTOR)
          break
        default:
          // Ignorar roles desconocidos
          break
      }
    }

    return Array.from(result)
  }
}
