import { Component, computed, inject, isDevMode, OnInit } from '@angular/core'
import { Router } from '@angular/router'
import { MatDialog } from '@angular/material/dialog'

import { UserRoles } from '@core/enums/user-roles.enum'
import { RoleStateService } from '@core/services/role-state.service'
import { AuthService } from '../../../modules/auth/services/auth.service'
import { ClinicContextService } from '../../../modules/clinics/services/clinic-context.service'
import { Clinic } from '../../../modules/dashboard/pages/clinics/interfaces/clinic.interface'
import { ClinicsService } from '../../../modules/dashboard/pages/clinics/services/clinics.service'
import { RoleSimulatorDialogComponent } from '../role-simulator-dialog/role-simulator-dialog.component'
import { SidenavService } from '../services/sidenav.service'

// Número mínimo de clínicas para mostrar el campo de búsqueda
const CLINIC_SEARCH_THRESHOLD = 5

@Component({
  selector: 'share-navbar',
  templateUrl: './navbar.component.html',
  styles: ``,
})
export class NavbarComponent implements OnInit {
  private authService = inject(AuthService)
  private roleAuth = inject(RoleStateService)
  private sidenavService = inject(SidenavService)
  private dialog = inject(MatDialog)
  private clinicCtx = inject(ClinicContextService)
  private clinicsService = inject(ClinicsService)
  private router = inject(Router)

  public user = computed(() => this.authService.currentUser())
  public readonly UserRoles = UserRoles
  public readonly isDevMode = isDevMode()

  public userInitials = computed(() => {
    const u = this.authService.currentUser()
    const first = u?.personalInfo?.firstName?.[0] ?? ''
    const last = u?.personalInfo?.lastName?.[0] ?? ''
    return (first + last).toUpperCase() || '?'
  })

  public isExpanded = this.sidenavService.isExpanded

  // Clinic selector state
  public clinics: Clinic[] = []
  public filteredClinics: Clinic[] = []
  public isClinicsLoading = false
  public selectedClinicId: string | null = null
  public clinicSearchTerm = ''
  public showClinicSearch = false

  // Término de búsqueda interno (en minúsculas para comparar)
  private _searchLower = ''

  ngOnInit() {
    this.authService.checkAuthStatus().subscribe()
    this.loadClinics()
    this.selectedClinicId = this.clinicCtx.clinicId
  }

  toggleSidenav() {
    this.sidenavService.toggleSidenav()
  }

  onLogout() {
    this.authService.logout()
  }

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

  // Clinic selector methods
  loadClinics() {
    this.isClinicsLoading = true
    this.clinicsService.findAll(true).subscribe({
      next: clinics => {
        this.clinics = clinics || []
        this.filteredClinics = [...this.clinics]
        this.isClinicsLoading = false
        this.showClinicSearch = this.clinics.length > CLINIC_SEARCH_THRESHOLD

        if (!this.selectedClinicId && this.clinics.length === 1) {
          this.selectedClinicId = this.clinics[0].id
          this.clinicCtx.setClinic(this.clinics[0].id)
        }
      },
      error: () => {
        this.clinics = []
        this.filteredClinics = []
        this.isClinicsLoading = false
      },
    })
  }

  onClinicChange(clinicId: string | null) {
    this.selectedClinicId = clinicId
    this.clinicCtx.setClinic(clinicId)
    const currentUrl = this.router.url
    this.router.navigateByUrl('/', { skipLocationChange: true }).then(() => {
      this.router.navigate([currentUrl])
    })
  }

  onClinicSearchChange(searchTerm: string) {
    // Bug fix: usar variable interna para no sobreescribir el ngModel con minúsculas
    this._searchLower = searchTerm.toLowerCase().trim()
    if (!this._searchLower) {
      this.filteredClinics = [...this.clinics]
    } else {
      this.filteredClinics = this.clinics.filter(
        c =>
          c.name.toLowerCase().includes(this._searchLower) ||
          c.address?.toLowerCase().includes(this._searchLower),
      )
    }
  }

  resetClinicSearch() {
    this.clinicSearchTerm = ''
    this._searchLower = ''
    this.filteredClinics = [...this.clinics]
  }

  getSelectedClinicName(): string {
    if (!this.selectedClinicId) {
      return this.isSuperAdmin() ? 'Todas las clínicas' : 'Seleccionar clínica'
    }
    const clinic = this.clinics.find(c => c.id === this.selectedClinicId)
    return clinic?.name ?? 'Seleccionar clínica'
  }

  isSuperAdmin(): boolean {
    return this.user()?.roles?.includes(UserRoles.SUPER_ADMIN) ?? false
  }

  hasNoClinics(): boolean {
    return !this.isClinicsLoading && this.clinics.length === 0
  }

  trackClinicById(_index: number, clinic: Clinic): string {
    return clinic.id
  }
}
