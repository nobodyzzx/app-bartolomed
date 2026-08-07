import { Component, computed, DestroyRef, inject, OnInit, signal } from '@angular/core'
import { takeUntilDestroyed } from '@angular/core/rxjs-interop'
import { NavigationEnd, Router } from '@angular/router'
import { forkJoin, interval, of } from 'rxjs'
import { filter } from 'rxjs/operators'

import { BILLING_ROLES, CLINICAL_ROLES, PHARMACY_ROLES } from '@core/constants/role-groups'
import { Permission } from '@core/enums/permission.enum'
import { UserRoles } from '@core/enums/user-roles.enum'
import { RoleStateService } from '@core/services/role-state.service'
import { AuthService } from '../../../modules/auth/services/auth.service'
import { ClinicContextService } from '../../../modules/clinics/services/clinic-context.service'
import { Clinic } from '../../../modules/dashboard/pages/admin/clinics/interfaces/clinic.interface'
import { ClinicsService } from '../../../modules/dashboard/pages/admin/clinics/services/clinics.service'
// DashboardService vive bajo la página del dashboard, pero está providedIn:'root' y no depende de
// nada module-scoped — se reutiliza acá para no duplicar las mismas 3 llamadas de "alertas" que ya
// arma el dashboard (stock bajo / citas pendientes / facturas vencidas), ahora accesibles desde
// cualquier página vía la campanita del navbar.
import { DashboardService } from '../../../modules/dashboard/pages/main-dashboard/dashboard.service'
import { Patient } from '../../../modules/dashboard/pages/patients/interfaces'
import { PatientsService } from '../../../modules/dashboard/pages/patients/services/patients.service'
import { SidenavService } from '../services/sidenav.service'
import { BreadcrumbCrumb, buildBreadcrumb } from './breadcrumb.util'

const CLINIC_SEARCH_THRESHOLD = 5
const ALERTS_REFRESH_MS = 60_000
const PATIENT_SEARCH_MIN_LENGTH = 2
const PATIENT_SEARCH_DEBOUNCE_MS = 250

const ROLE_LABELS: Record<string, string> = {
  'super-admin': 'Super Admin',
  admin: 'Administrador',
  doctor: 'Médico',
  nurse: 'Enfermero/a',
  receptionist: 'Recepcionista',
  pharmacist: 'Farmacéutico',
  laboratory: 'Laboratorio',
}

const ROLE_PRIORITY: UserRoles[] = [
  UserRoles.SUPER_ADMIN,
  UserRoles.ADMIN,
  UserRoles.DOCTOR,
  UserRoles.PHARMACIST,
  UserRoles.NURSE,
  UserRoles.RECEPTIONIST,
  UserRoles.LABORATORY,
]

interface AlertCounts {
  lowStock: number
  pendingAppointments: number
  overdueInvoices: number
}

@Component({
    selector: 'share-navbar',
    templateUrl: './navbar.component.html',
    styles: ``,
    standalone: false
})
export class NavbarComponent implements OnInit {
  private authService = inject(AuthService)
  private roleState = inject(RoleStateService)
  private sidenavService = inject(SidenavService)
  private clinicCtx = inject(ClinicContextService)
  private clinicsService = inject(ClinicsService)
  private dashboardService = inject(DashboardService)
  private patientsService = inject(PatientsService)
  private router = inject(Router)
  private destroyRef = inject(DestroyRef)

  public isExpanded = this.sidenavService.isExpanded
  public isMobileOpen = this.sidenavService.isMobileOpen

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

  // ── Breadcrumb (reutiliza MENU_ITEMS, la misma fuente que el sidebar) ─────

  public breadcrumb = signal<BreadcrumbCrumb[]>(buildBreadcrumb(this.router.url))

  // ── Búsqueda global de pacientes (visible solo para roles clínicos) ───────

  public showPatientSearch = computed(() => this.roleState.hasAnyRole(CLINICAL_ROLES))
  public patientSearchTerm = signal('')
  public patientSearchResults = signal<Patient[]>([])
  public patientSearchLoading = signal(false)
  private patientSearchTimer?: ReturnType<typeof setTimeout>

  // ── Campana de alertas (stock bajo / citas pendientes / facturas vencidas) ─

  // CLINICAL_ROLES ya incluye ADMIN/SUPER_ADMIN, así que cubre a los 3 grupos con roles funcionales
  // (PHARMACIST y RECEPTIONIST no están en CLINICAL_ROLES, por eso se agregan explícitos).
  public showAlertsBell = computed(() =>
    this.roleState.hasAnyRole([...CLINICAL_ROLES, ...PHARMACY_ROLES, ...BILLING_ROLES]),
  )
  public showStockAlertRow = computed(() => this.roleState.hasAnyRole(PHARMACY_ROLES))
  public showAppointmentsAlertRow = computed(() => this.roleState.hasAnyRole(CLINICAL_ROLES))
  public showBillingAlertRow = computed(() => this.roleState.hasAnyRole(BILLING_ROLES))
  public alertCounts = signal<AlertCounts>({ lowStock: 0, pendingAppointments: 0, overdueInvoices: 0 })
  public totalAlerts = computed(() => {
    const c = this.alertCounts()
    return c.lowStock + c.pendingAppointments + c.overdueInvoices
  })

  ngOnInit() {
    this.loadClinics()
    this.selectedClinicId = this.clinicCtx.clinicId

    this.loadAlerts()
    interval(ALERTS_REFRESH_MS).pipe(takeUntilDestroyed(this.destroyRef)).subscribe(() => this.loadAlerts())

    this.router.events
      .pipe(filter(e => e instanceof NavigationEnd), takeUntilDestroyed(this.destroyRef))
      .subscribe(() => this.breadcrumb.set(buildBreadcrumb(this.router.url)))
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

  // ── Búsqueda global de pacientes ────────────────────────────────────────

  onPatientSearchInput(value: string): void {
    this.patientSearchTerm.set(value)
    if (this.patientSearchTimer) clearTimeout(this.patientSearchTimer)

    const term = value.trim()
    if (term.length < PATIENT_SEARCH_MIN_LENGTH) {
      this.patientSearchResults.set([])
      this.patientSearchLoading.set(false)
      return
    }

    this.patientSearchLoading.set(true)
    this.patientSearchTimer = setTimeout(() => {
      const clinicId = this.clinicCtx.clinicId || undefined
      this.patientsService.searchPatients(term, clinicId).pipe(takeUntilDestroyed(this.destroyRef)).subscribe({
        next: patients => {
          this.patientSearchResults.set(patients || [])
          this.patientSearchLoading.set(false)
        },
        error: () => {
          this.patientSearchResults.set([])
          this.patientSearchLoading.set(false)
        },
      })
    }, PATIENT_SEARCH_DEBOUNCE_MS)
  }

  goToPatient(patientId: string): void {
    this.resetPatientSearch()
    this.router.navigate(['/dashboard/patients/view', patientId])
  }

  resetPatientSearch(): void {
    if (this.patientSearchTimer) clearTimeout(this.patientSearchTimer)
    this.patientSearchTerm.set('')
    this.patientSearchResults.set([])
    this.patientSearchLoading.set(false)
  }

  // ── Campana de alertas ──────────────────────────────────────────────────

  private loadAlerts(): void {
    const needsStock = this.roleState.hasAnyRole(PHARMACY_ROLES)
    // Por permiso y no solo por rol: `/appointments` exige `AppointmentsRead`,
    // que DOCTOR no tiene a propósito, así que la campana pedía las citas igual
    // y se llevaba un 403 en cada página, en silencio.
    const needsAppointments =
      this.roleState.hasAnyRole(CLINICAL_ROLES) && this.roleState.hasPermission(Permission.AppointmentsRead)
    const needsBilling = this.roleState.hasAnyRole(BILLING_ROLES)
    if (!needsStock && !needsAppointments && !needsBilling) return

    forkJoin({
      stock: needsStock ? this.dashboardService.getLowStockAlerts() : of([]),
      pending: needsAppointments ? this.dashboardService.getPendingAppointmentsCount() : of(0),
      billing: needsBilling
        ? this.dashboardService.getBillingSummary()
        : of({ pendingInvoices: 0, overdueInvoices: 0, pendingRevenue: 0 }),
    }).pipe(takeUntilDestroyed(this.destroyRef)).subscribe(({ stock, pending, billing }) => {
      this.alertCounts.set({
        lowStock: stock.length,
        pendingAppointments: pending,
        overdueInvoices: billing.overdueInvoices,
      })
    })
  }
}
