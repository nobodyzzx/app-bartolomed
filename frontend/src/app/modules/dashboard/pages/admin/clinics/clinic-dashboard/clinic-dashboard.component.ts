import { Component, DestroyRef, inject, OnInit } from '@angular/core'
import { takeUntilDestroyed } from '@angular/core/rxjs-interop'
import { Router } from '@angular/router'
import { ErrorService } from '../../../../../../shared/components/services/error.service'
import { Clinic, ClinicStatistics } from '../interfaces'
import { ClinicsService } from '../services'

@Component({
  selector: 'app-clinic-dashboard',
  templateUrl: './clinic-dashboard.component.html',
  styleUrl: './clinic-dashboard.component.css',
})
export class ClinicDashboardComponent implements OnInit {
  private readonly destroyRef = inject(DestroyRef)

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
    this.clinicsService.getClinicStatistics().pipe(takeUntilDestroyed(this.destroyRef)).subscribe({
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
    this.clinicsService.findAll(true).pipe(takeUntilDestroyed(this.destroyRef)).subscribe({
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

  getTotalAssignedUsers(): number {
    return (this.statistics?.clinicsWithUsers ?? []).reduce((sum, c) => sum + c.userCount, 0)
  }
}
