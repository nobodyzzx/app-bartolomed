import { TestBed } from '@angular/core/testing'
import { NavigationEnd, Router } from '@angular/router'
import { UserRoles } from '@core/enums/user-roles.enum'
import { RoleStateService } from '@core/services/role-state.service'
import { of, Subject } from 'rxjs'
import { AuthService } from '../../../modules/auth/services/auth.service'
import { ClinicContextService } from '../../../modules/clinics/services/clinic-context.service'
import { ClinicsService } from '../../../modules/dashboard/pages/admin/clinics/services/clinics.service'
import { DashboardService } from '../../../modules/dashboard/pages/main-dashboard/dashboard.service'
import { PatientsService } from '../../../modules/dashboard/pages/patients/services/patients.service'
import { NavbarComponent } from './navbar.component'
import { createSpyObj, SpyObj } from '../../../../testing/spy'
import type { Mock } from 'vitest'

describe('NavbarComponent', () => {
  let dashboardService: SpyObj<DashboardService>
  let clinicsService: SpyObj<ClinicsService>
  let patientsService: SpyObj<PatientsService>
  let router: { navigate: Mock; url: string; events: Subject<unknown> }
  let roles: UserRoles[]

  const fakeRoleState = {
    hasRole: (role: UserRoles) => roles.includes(role),
    hasAnyRole: (allowed: UserRoles[]) => (allowed.length === 0 ? true : allowed.some(r => roles.includes(r))),
    currentUserRoles: () => roles,
  }

  const createComponent = () => {
    TestBed.resetTestingModule()
    TestBed.configureTestingModule({
      providers: [
        NavbarComponent,
        { provide: DashboardService, useValue: dashboardService },
        { provide: ClinicsService, useValue: clinicsService },
        { provide: PatientsService, useValue: patientsService },
        { provide: RoleStateService, useValue: fakeRoleState },
        { provide: AuthService, useValue: { currentUser: () => null } },
        { provide: ClinicContextService, useValue: { clinicId: 'clinic-1', setClinic: vi.fn() } },
        { provide: Router, useValue: router },
      ],
    })
    return TestBed.inject(NavbarComponent)
  }

  beforeEach(() => {
    dashboardService = createSpyObj('DashboardService', ['getLowStockAlerts', 'getPendingAppointmentsCount', 'getBillingSummary'])
    dashboardService.getLowStockAlerts.mockReturnValue(of([]))
    dashboardService.getPendingAppointmentsCount.mockReturnValue(of(0))
    dashboardService.getBillingSummary.mockReturnValue(of({ pendingInvoices: 0, overdueInvoices: 0, pendingRevenue: 0 }))

    clinicsService = createSpyObj('ClinicsService', ['findAll'])
    clinicsService.findAll.mockReturnValue(of([]))

    patientsService = createSpyObj('PatientsService', ['searchPatients'])
    patientsService.searchPatients.mockReturnValue(of([]))

    router = { navigate: vi.fn(), url: '/dashboard/home', events: new Subject() }
  })

  // ─── Visibilidad por rol ────────────────────────────────────────────────

  describe('visibilidad por rol', () => {
    it('la búsqueda de pacientes es visible para roles clínicos', () => {
      roles = [UserRoles.DOCTOR]
      expect(createComponent().showPatientSearch()).toBe(true)
    })

    it('la búsqueda de pacientes no es visible para PHARMACIST (sin PatientsRead)', () => {
      roles = [UserRoles.PHARMACIST]
      expect(createComponent().showPatientSearch()).toBe(false)
    })

    it('la campana de alertas es visible para DOCTOR, PHARMACIST y RECEPTIONIST', () => {
      for (const role of [UserRoles.DOCTOR, UserRoles.PHARMACIST, UserRoles.RECEPTIONIST]) {
        roles = [role]
        expect(createComponent().showAlertsBell()).toBe(true)
      }
    })

    it('la fila de stock bajo solo se ofrece a roles de farmacia', () => {
      roles = [UserRoles.RECEPTIONIST]
      const component = createComponent()
      expect(component.showStockAlertRow()).toBe(false)

      roles = [UserRoles.PHARMACIST]
      expect(createComponent().showStockAlertRow()).toBe(true)
    })

    it('la fila de facturas vencidas no se ofrece a PHARMACIST (usa PharmacyBilling, no BillingRead)', () => {
      roles = [UserRoles.PHARMACIST]
      expect(createComponent().showBillingAlertRow()).toBe(false)

      roles = [UserRoles.RECEPTIONIST]
      expect(createComponent().showBillingAlertRow()).toBe(true)
    })
  })

  // ─── Carga de alertas — solo pide lo que el rol puede ver ──────────────────

  describe('ngOnInit — carga de alertas', () => {
    it('PHARMACIST solo pide stock bajo, no citas ni facturación', () => {
      roles = [UserRoles.PHARMACIST]
      createComponent().ngOnInit()

      expect(dashboardService.getLowStockAlerts).toHaveBeenCalled()
      expect(dashboardService.getPendingAppointmentsCount).not.toHaveBeenCalled()
      expect(dashboardService.getBillingSummary).not.toHaveBeenCalled()
    })

    it('RECEPTIONIST pide citas y facturación, no stock', () => {
      roles = [UserRoles.RECEPTIONIST]
      createComponent().ngOnInit()

      expect(dashboardService.getLowStockAlerts).not.toHaveBeenCalled()
      expect(dashboardService.getPendingAppointmentsCount).toHaveBeenCalled()
      expect(dashboardService.getBillingSummary).toHaveBeenCalled()
    })

    it('ADMIN pide las 3 categorías', () => {
      roles = [UserRoles.ADMIN]
      createComponent().ngOnInit()

      expect(dashboardService.getLowStockAlerts).toHaveBeenCalled()
      expect(dashboardService.getPendingAppointmentsCount).toHaveBeenCalled()
      expect(dashboardService.getBillingSummary).toHaveBeenCalled()
    })
  })

  // ─── Breadcrumb ─────────────────────────────────────────────────────────

  describe('breadcrumb', () => {
    it('se inicializa a partir de la URL actual del router', () => {
      roles = [UserRoles.ADMIN]
      router.url = '/dashboard/patients'
      const component = createComponent()

      expect(component.breadcrumb().map(c => c.label)).toEqual(['Gestión del Consultorio Médico', 'Pacientes'])
    })

    it('se actualiza cuando el router navega (NavigationEnd)', () => {
      roles = [UserRoles.ADMIN]
      router.url = '/dashboard/home'
      const component = createComponent()
      component.ngOnInit()
      expect(component.breadcrumb()).toEqual([])

      router.url = '/dashboard/pharmacy/inventory'
      router.events.next(new NavigationEnd(1, '/dashboard/pharmacy/inventory', '/dashboard/pharmacy/inventory'))

      expect(component.breadcrumb().map(c => c.label)).toEqual(['Control de Farmacia', 'Inventario'])
    })

    it('ignora otros eventos del router (no re-arma el breadcrumb en cada evento)', () => {
      roles = [UserRoles.ADMIN]
      router.url = '/dashboard/patients'
      const component = createComponent()
      component.ngOnInit()
      const initial = component.breadcrumb()

      router.url = '/dashboard/pharmacy/inventory'
      router.events.next({ id: 1 }) // evento que no es NavigationEnd

      expect(component.breadcrumb()).toBe(initial)
    })
  })
})
