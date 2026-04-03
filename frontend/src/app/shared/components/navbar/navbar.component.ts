import { Component, computed, inject, OnInit } from '@angular/core'
import { Router } from '@angular/router'

import { UserRoles } from '@core/enums/user-roles.enum'
import { RoleStateService } from '@core/services/role-state.service'
import { AuthService } from '../../../modules/auth/services/auth.service'
import { ClinicContextService } from '../../../modules/clinics/services/clinic-context.service'
import { Clinic } from '../../../modules/dashboard/pages/admin/clinics/interfaces/clinic.interface'
import { ClinicsService } from '../../../modules/dashboard/pages/admin/clinics/services/clinics.service'
import { SidenavService } from '../services/sidenav.service'

const CLINIC_SEARCH_THRESHOLD = 5

const ROLE_LABELS: Record<string, string> = {
  'super-admin': 'Super Admin',
  admin: 'Administrador',
  doctor: 'Médico',
  nurse: 'Enfermero/a',
  receptionist: 'Recepcionista',
  pharmacist: 'Farmacéutico',
}

const ROLE_PRIORITY: UserRoles[] = [
  UserRoles.SUPER_ADMIN,
  UserRoles.ADMIN,
  UserRoles.DOCTOR,
  UserRoles.PHARMACIST,
  UserRoles.NURSE,
  UserRoles.RECEPTIONIST,
]

@Component({
  selector: 'share-navbar',
  templateUrl: './navbar.component.html',
  styles: ``,
})
export class NavbarComponent implements OnInit {
  private authService = inject(AuthService)
  private roleState = inject(RoleStateService)
  private sidenavService = inject(SidenavService)
  private clinicCtx = inject(ClinicContextService)
  private clinicsService = inject(ClinicsService)
  private router = inject(Router)

  public isExpanded = this.sidenavService.isExpanded

  public userInitials = computed(() => {
    const u = this.authService.currentUser()
    const first = u?.personalInfo?.firstName?.[0] ?? ''
    const last = u?.personalInfo?.lastName?.[0] ?? ''
    if (first || last) return (first + last).toUpperCase()
    // Fallback para modo simulador (sin usuario real)
    const role = ROLE_PRIORITY.find(r => this.roleState.currentUserRoles().includes(r))
    return role ? role[0].toUpperCase() : '?'
  })

  public displayName = computed(() => {
    const u = this.authService.currentUser()
    if (u?.personalInfo?.firstName) {
      return `${u.personalInfo.firstName} ${u.personalInfo.lastName ?? ''}`.trim()
    }
    return this.userRoleLabel()
  })

  public userRoleLabel = computed(() => {
    const roles = this.roleState.currentUserRoles()
    const role = ROLE_PRIORITY.find(r => roles.includes(r))
    return role ? (ROLE_LABELS[role] ?? role) : 'Usuario'
  })

  public allRoleLabels = computed(() => {
    return this.roleState.currentUserRoles()
      .map(r => ROLE_LABELS[r] ?? r)
      .join(' · ')
  })

  // Clinic selector state
  public clinics: Clinic[] = []
  public filteredClinics: Clinic[] = []
  public isClinicsLoading = false
  public selectedClinicId: string | null = null
  public clinicSearchTerm = ''
  public showClinicSearch = false

  private _searchLower = ''

  ngOnInit() {
    this.loadClinics()
    this.selectedClinicId = this.clinicCtx.clinicId
  }

  toggleSidenav() {
    this.sidenavService.toggleSidenav()
  }

  onLogout() {
    this.authService.logout()
  }

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
    this._searchLower = searchTerm.toLowerCase().trim()
    this.filteredClinics = !this._searchLower
      ? [...this.clinics]
      : this.clinics.filter(
          c =>
            c.name.toLowerCase().includes(this._searchLower) ||
            c.address?.toLowerCase().includes(this._searchLower),
        )
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
    return this.clinics.find(c => c.id === this.selectedClinicId)?.name ?? 'Seleccionar clínica'
  }

  isSuperAdmin(): boolean {
    return this.roleState.hasRole(UserRoles.SUPER_ADMIN)
  }

  hasNoClinics(): boolean {
    return !this.isClinicsLoading && this.clinics.length === 0
  }

  trackClinicById(_index: number, clinic: Clinic): string {
    return clinic.id
  }
}
