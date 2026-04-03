import { Component, inject, OnInit } from '@angular/core'
import { FormBuilder, FormGroup, Validators } from '@angular/forms'
import { ActivatedRoute, Router } from '@angular/router'
import { AuthService } from '../../services/auth.service'

@Component({
  templateUrl: './reset-password-page.component.html',
})
export class ResetPasswordPageComponent implements OnInit {
  private fb = inject(FormBuilder)
  private authService = inject(AuthService)
  private route = inject(ActivatedRoute)
  private router = inject(Router)

  token = ''
  isLoading = false
  success = false
  errorMessage = ''
  hidePassword = true

  form: FormGroup = this.fb.group({
    newPassword: ['', [Validators.required, Validators.minLength(6)]],
    confirmPassword: ['', [Validators.required]],
  }, { validators: this.passwordMatchValidator })

  ngOnInit(): void {
    this.token = this.route.snapshot.queryParamMap.get('token') ?? ''
    if (!this.token) {
      this.errorMessage = 'Token de recuperación no encontrado. Solicita un nuevo enlace.'
    }
  }

  private passwordMatchValidator(group: FormGroup): { mismatch: true } | null {
    const pass = group.get('newPassword')?.value
    const confirm = group.get('confirmPassword')?.value
    return pass === confirm ? null : { mismatch: true }
  }

  onSubmit(): void {
    if (this.form.invalid || !this.token) return
    this.isLoading = true
    this.errorMessage = ''
    this.authService.resetPassword(this.token, this.form.value.newPassword).subscribe({
      next: () => {
        this.isLoading = false
        this.success = true
        setTimeout(() => this.router.navigateByUrl('/auth/login'), 3000)
      },
      error: (msg: string) => {
        this.isLoading = false
        this.errorMessage = msg
      },
    })
  }
}
