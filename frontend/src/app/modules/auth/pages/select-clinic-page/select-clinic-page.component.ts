import { Component, inject, OnInit } from '@angular/core'
import { Router } from '@angular/router'
import { HttpClient } from '@angular/common/http'
import { catchError, of } from 'rxjs'
import { ClinicContextService } from '../../../clinics/services/clinic-context.service'
import { AuthService } from '../../services/auth.service'
import { environment } from '../../../../environments/environments'

interface ClinicOption {
  id: string
  name: string
  address: string
}

@Component({
    templateUrl: './select-clinic-page.component.html',
    standalone: false
})
export class SelectClinicPageComponent implements OnInit {
  private http = inject(HttpClient)
  private clinicCtx = inject(ClinicContextService)
  private authService = inject(AuthService)
  private router = inject(Router)

  clinics: ClinicOption[] = []
  loading = true
  error = false

  ngOnInit(): void {
    this.http
      .get<ClinicOption[]>(`${environment.baseUrl}/auth/my-clinics`)
      .pipe(catchError(() => { this.error = true; return of([]) }))
      .subscribe(clinics => {
        this.loading = false
        this.clinics = clinics

        if (clinics.length === 1) {
          // Auto-seleccionar si solo hay una clínica
          this.selectClinic(clinics[0])
          return
        }

        // Si ya hay una clínica guardada que sigue siendo válida, ir directo al dashboard
        const stored = this.clinicCtx.clinicId
        if (stored && clinics.some(c => c.id === stored)) {
          this.router.navigateByUrl('/dashboard')
        }
      })
  }

  selectClinic(clinic: ClinicOption): void {
    this.clinicCtx.setClinic(clinic.id)
    this.router.navigateByUrl('/dashboard')
  }

  logout(): void {
    this.authService.logout()
  }
}
