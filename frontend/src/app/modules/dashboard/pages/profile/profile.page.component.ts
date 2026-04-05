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
    this.profileForm = this.fb.group({
      firstName: ['', [Validators.required, Validators.minLength(2)]],
      lastName:  ['', [Validators.required, Validators.minLength(2)]],
      phone:     [''],
      address:   [''],
      birthDate: [''],
    })

    this.passwordForm = this.fb.group({
      currentPassword: ['', Validators.required],
      newPassword:     ['', [Validators.required, Validators.minLength(6)]],
      confirmPassword: ['', Validators.required],
    }, { validators: this.passwordsMatch })

    this.loadProfile()
  }

  private passwordsMatch(g: FormGroup) {
    return g.get('newPassword')?.value === g.get('confirmPassword')?.value
      ? null : { mismatch: true }
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

  async saveProfile() {
    if (this.profileForm.invalid) return
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

  async savePassword() {
    if (this.passwordForm.invalid) return
    this.savingPassword = true
    const { currentPassword, newPassword } = this.passwordForm.value
    this.http.patch(`${environment.baseUrl}/auth/change-password`, { currentPassword, newPassword }).subscribe({
      next: () => {
        this.savingPassword = false
        this.passwordForm.reset()
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
