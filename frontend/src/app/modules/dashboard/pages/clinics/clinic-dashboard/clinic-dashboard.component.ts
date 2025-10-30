import { Component, OnInit } from '@angular/core'
import { Router } from '@angular/router'
import { ErrorService } from '../../../../../shared/components/services/error.service'
import { Clinic, ClinicStatistics } from '../interfaces'
import { ClinicsService } from '../services'

@Component({
  selector: 'app-clinic-dashboard',
  templateUrl: './clinic-dashboard.component.html',
  styleUrl: './clinic-dashboard.component.css',
})
export class ClinicDashboardComponent implements OnInit {
  statistics: ClinicStatistics | null = null
  recentClinics: Clinic[] = []
  isLoading = false

  constructor(
    private clinicsService: ClinicsService,
    private router: Router,
    private errorService: ErrorService,
  ) {}

  ngOnInit(): void {
    this.loadStatistics()
    this.loadRecentClinics()
  }

  loadStatistics() {
    this.isLoading = true
    this.clinicsService.getClinicStatistics().subscribe({
      next: stats => {
        this.statistics = stats
        this.isLoading = false
      },
      error: error => {
        this.errorService.handleError(error)
        this.isLoading = false
      },
    })
  }

  loadRecentClinics() {
    this.clinicsService.findAll(true).subscribe({
      next: clinics => {
        // Obtener las 5 clínicas más recientes
        this.recentClinics = clinics
          .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime())
          .slice(0, 5)
      },
      error: error => {
        this.errorService.handleError(error)
      },
    })
  }

  navigateToClinics() {
    this.router.navigate(['/dashboard/clinics/list'])
  }

  navigateToNewClinic() {
    this.router.navigate(['/dashboard/clinics/new'])
  }

  viewClinic(clinic: Clinic) {
    this.router.navigate(['/dashboard/clinics/view', clinic.id])
  }

  showAllClinics() {
    this.router.navigate(['/dashboard/clinics/list'])
  }

  showActiveClinics() {
    this.router.navigate(['/dashboard/clinics/list'], { queryParams: { status: 'active' } })
  }

  showInactiveClinics() {
    this.router.navigate(['/dashboard/clinics/list'], { queryParams: { status: 'inactive' } })
  }

  showAssignedUsers() {
    this.router.navigate(['/dashboard/users/list'])
  }
}
