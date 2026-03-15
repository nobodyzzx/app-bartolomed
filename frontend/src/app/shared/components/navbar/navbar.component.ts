import { Component, computed, inject, OnInit } from '@angular/core'
import { MatDialog } from '@angular/material/dialog'

import { UserRoles } from '@core/enums/user-roles.enum'
import { RoleStateService } from '@core/services/role-state.service'
import { AuthService } from '../../../modules/auth/services/auth.service'
import { ClinicContextService } from '../../../modules/clinics/services/clinic-context.service'
import { Clinic } from '../../../modules/dashboard/pages/clinics/interfaces/clinic.interface'
import { ClinicsService } from '../../../modules/dashboard/pages/clinics/services/clinics.service'
import { RoleSimulatorDialogComponent } from '../role-simulator-dialog/role-simulator-dialog.component'
import { SidenavService } from '../services/sidenav.services'

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

  public user = computed(() => this.authService.currentUser())
  public readonly UserRoles = UserRoles

  // Clinic selector state
  public clinics: Clinic[] = []
  public filteredClinics: Clinic[] = []
  public isClinicsLoading = false
  public selectedClinicId: string | null = null
  public clinicSearchTerm = ''

  ngOnInit() {
    this.authService.checkAuthStatus().subscribe(this.user)
    this.loadClinics()
    this.selectedClinicId = this.clinicCtx.clinicId
  }
  isExpanded = true

  toggleSidenav() {
    this.sidenavService.toggleSidenav()
  }

  onLogout() {
    this.authService.logout()
  }

  // Simular login con distintos roles
  setRole(role: UserRoles) {
    this.roleAuth.loginAs([role])
  }

  // Simular login con roles cruzados
  setRoles(roles: UserRoles[]) {
    this.roleAuth.loginAs(roles)
  }

  // Abrir diálogo de simulador de roles
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

        // Si no hay clínicas y el usuario no es SUPER_ADMIN, mostrar mensaje
        // 🔄 AUTOSELECCIÓN: Si el usuario solo tiene UNA clínica y no ha seleccionado ninguna
        if (!this.selectedClinicId && this.clinics.length === 1) {
          const singleClinic = this.clinics[0]
          this.selectedClinicId = singleClinic.id
          this.clinicCtx.setClinic(singleClinic.id)
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
    // Recargar página para aplicar nuevo contexto en toda la app
    window.location.reload()
  }

  onClinicSearchChange(searchTerm: string) {
    this.clinicSearchTerm = searchTerm.toLowerCase()
    if (!searchTerm.trim()) {
      this.filteredClinics = [...this.clinics]
    } else {
      this.filteredClinics = this.clinics.filter(
        c =>
          c.name.toLowerCase().includes(this.clinicSearchTerm) ||
          c.address?.toLowerCase().includes(this.clinicSearchTerm),
      )
    }
  }

  getSelectedClinicName(): string {
    if (!this.selectedClinicId) {
      // Si es SUPER_ADMIN y no hay clínica, mostrar "Todas las clínicas"
      return this.isSuperAdmin() ? 'Todas las clínicas' : 'Seleccionar clínica'
    }
    const clinic = this.clinics.find(c => c.id === this.selectedClinicId)
    return clinic ? clinic.name : this.selectedClinicId
  }

  isSuperAdmin(): boolean {
    return this.user()?.roles?.includes('super-admin') || false
  }

  hasNoClinics(): boolean {
    return !this.isClinicsLoading && this.clinics.length === 0
  }
}
