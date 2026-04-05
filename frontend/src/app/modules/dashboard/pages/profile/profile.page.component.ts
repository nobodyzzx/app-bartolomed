import { Component, OnInit, inject } from '@angular/core'
import { FormBuilder, FormGroup, Validators } from '@angular/forms'
import { HttpClient } from '@angular/common/http'
import { AlertService } from '../../../../core/services/alert.service'
import { environment } from '../../../../environments/environments'

@Component({
  selector: 'app-profile-page',
  templateUrl: './profile.page.component.html',
  standalone: false,
})
export class ProfilePageComponent implements OnInit {
  private fb = inject(FormBuilder)
  private http = inject(HttpClient)
  private alert = inject(AlertService)

  profileForm!: FormGroup
  passwordForm!: FormGroup
  loading = false
  savingProfile = false
  savingPassword = false
  hideCurrentPwd = true
  hideNewPwd = true
  hideConfirmPwd = true
  profile: any = null

  ngOnInit() {
    this.profileForm = this.buildProfileForm()
    this.passwordForm = this.buildPasswordForm()
    this.loadProfile()
  }

  private buildProfileForm(): FormGroup {
    return this.fb.group({
      firstName: ['', [Validators.required, Validators.minLength(2)]],
      lastName:  ['', [Validators.required, Validators.minLength(2)]],
      phone:     [''],
      address:   [''],
      birthDate: [''],
    })
  }

  private buildPasswordForm(): FormGroup {
    return this.fb.group({
      currentPassword: ['', Validators.required],
      newPassword:     ['', [Validators.required, Validators.minLength(6)]],
      confirmPassword: ['', Validators.required],
    }, { validators: this.passwordsMatch })
  }

  private passwordsMatch(g: FormGroup) {
    const a = g.get('newPassword')?.value
    const b = g.get('confirmPassword')?.value
    return a && b && a !== b ? { mismatch: true } : null
  }

  loadProfile() {
    this.loading = true
    this.http.get<any>(`${environment.baseUrl}/auth/profile`).subscribe({
      next: (data) => {
        this.profile = data
        this.profileForm.patchValue({
          firstName: data.personalInfo?.firstName ?? '',
          lastName:  data.personalInfo?.lastName ?? '',
          phone:     data.personalInfo?.phone ?? '',
          address:   data.personalInfo?.address ?? '',
          birthDate: data.personalInfo?.birthDate ?? '',
        })
        this.loading = false
      },
      error: () => { this.loading = false }
    })
  }

  saveProfile() {
    if (this.profileForm.invalid) {
      this.profileForm.markAllAsTouched()
      return
    }
    this.savingProfile = true
    this.http.patch(`${environment.baseUrl}/auth/profile`, this.profileForm.value).subscribe({
      next: () => {
        this.savingProfile = false
        this.alert.fire({ icon: 'success', title: 'Perfil actualizado', timer: 2000, showConfirmButton: false })
      },
      error: () => {
        this.savingProfile = false
        this.alert.fire({ icon: 'error', title: 'Error', text: 'No se pudo actualizar el perfil.' })
      }
    })
  }

  savePassword() {
    if (this.passwordForm.invalid) {
      this.passwordForm.markAllAsTouched()
      return
    }
    this.savingPassword = true
    const { currentPassword, newPassword } = this.passwordForm.value
    this.http.patch(`${environment.baseUrl}/auth/change-password`, { currentPassword, newPassword }).subscribe({
      next: () => {
        this.savingPassword = false
        // Reconstruir el formulario desde cero para evitar estados residuales
        this.passwordForm = this.buildPasswordForm()
        this.alert.fire({ icon: 'success', title: 'Contraseña actualizada', timer: 2000, showConfirmButton: false })
      },
      error: (err) => {
        this.savingPassword = false
        const msg = err?.error?.message ?? 'No se pudo cambiar la contraseña.'
        this.alert.fire({ icon: 'error', title: 'Error', text: msg })
      }
    })
  }

  goBack() { history.back() }
}
