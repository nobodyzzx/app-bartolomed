import { Component, inject } from '@angular/core'
import { FormBuilder, FormGroup, Validators } from '@angular/forms'
import { MatDialogRef } from '@angular/material/dialog'
import { AuthService } from '../../services/auth.service'

@Component({
  templateUrl: './forgot-password-dialog.component.html',
})
export class ForgotPasswordDialogComponent {
  private fb = inject(FormBuilder)
  private authService = inject(AuthService)
  dialogRef = inject(MatDialogRef<ForgotPasswordDialogComponent>)

  isLoading = false
  submitted = false

  form: FormGroup = this.fb.group({
    email: ['', [Validators.required, Validators.email]],
  })

  onSubmit(): void {
    if (this.form.invalid) {
      this.form.markAllAsTouched()
      return
    }
    this.isLoading = true
    this.authService.forgotPassword(this.form.value.email).subscribe({
      next: () => {
        this.isLoading = false
        this.submitted = true
      },
      error: () => {
        // Mostrar mensaje genérico igualmente para no revelar si el email existe
        this.isLoading = false
        this.submitted = true
      },
    })
  }
}
