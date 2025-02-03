import { Component, inject } from '@angular/core';
import { FormBuilder, FormGroup, Validators } from '@angular/forms';
import { AuthService } from '../../services/auth.service';
import { Router } from '@angular/router';

import Swal from 'sweetalert2';

@Component({
  templateUrl: './login-page.component.html',
  styleUrl: './login-page.component.css',
})
export class LoginPageComponent {
  hidePassword = true;
  private fb = inject(FormBuilder);
  private authService = inject(AuthService);
  private router = inject(Router);

  public myForm: FormGroup = this.fb.group({
    email: ['doctor@example.com', [Validators.required, Validators.email]],
    password: ['Abc123', [Validators.required, Validators.minLength(6)]],
  });

  onSubmit() {
    const { email, password } = this.myForm.value;
    this.authService.login(email, password).subscribe({
      next: () => this.router.navigateByUrl('/dashboard'),
      error: (error) => {
        Swal.fire({
          position: 'top-end',
          icon: 'error',
          text: error,
          showConfirmButton: false,
          timer: 2000,
          toast: true,
          backdrop: true,
        });
      },
    });
  }
}
