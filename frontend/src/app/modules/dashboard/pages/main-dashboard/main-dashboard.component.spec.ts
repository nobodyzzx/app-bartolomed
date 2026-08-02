import { TestBed } from '@angular/core/testing'
import { ActivatedRoute, Router } from '@angular/router'
import { UserRoles } from '@core/enums/user-roles.enum'
import { RoleStateService } from '@core/services/role-state.service'
import { of, ReplaySubject } from 'rxjs'
import { AuthService } from '../../../auth/services/auth.service'
import { ClinicContextService } from '../../../clinics/services/clinic-context.service'
import { DashboardService } from './dashboard.service'
import { MainDashboardComponent } from './main-dashboard.component'

describe('MainDashboardComponent', () => {
  let dashboardService: jasmine.SpyObj<DashboardService>
  let roles: UserRoles[]

  const fakeRoleState = {
    hasRole: (role: UserRoles) => roles.includes(role),
    hasAnyRole: (allowed: UserRoles[]) => (allowed.length === 0 ? true : allowed.some(r => roles.includes(r))),
  }

  const createComponent = () => {
    TestBed.configureTestingModule({
      providers: [
        MainDashboardComponent,
        { provide: DashboardService, useValue: dashboardService },
        { provide: RoleStateService, useValue: fakeRoleState },
        { provide: AuthService, useValue: { currentUser: () => ({ id: 'doctor-1' }) } },
        { provide: ClinicContextService, useValue: { clinicId: 'clinic-1' } },
        { provide: Router, useValue: jasmine.createSpyObj('Router', ['navigate']) },
        { provide: ActivatedRoute, useValue: { queryParams: new ReplaySubject() } },
      ],
    })
    return TestBed.inject(MainDashboardComponent)
  }

  beforeEach(() => {
    dashboardService = jasmine.createSpyObj('DashboardService', [
      'getPatientStats', 'getTodayAppointments', 'getPendingAppointmentsCount',
      'getLowStockAlerts', 'getRecentPatients', 'getStaffStatistics', 'getBillingSummary',
      'getWeeklySales', 'getMonthlySales',
    ])
    dashboardService.getPatientStats.and.returnValue(of({ total: 0 }))
    dashboardService.getTodayAppointments.and.returnValue(of([]))
    dashboardService.getPendingAppointmentsCount.and.returnValue(of(0))
    dashboardService.getLowStockAlerts.and.returnValue(of([]))
    dashboardService.getRecentPatients.and.returnValue(of([]))
    dashboardService.getStaffStatistics.and.returnValue(
      of({ totalDoctors: 3, totalNurses: 2, totalReceptionists: 1, totalPharmacists: 1 }),
    )
    dashboardService.getBillingSummary.and.returnValue(of({ pendingInvoices: 5, overdueInvoices: 2, pendingRevenue: 1200 }))
    dashboardService.getWeeklySales.and.returnValue(of({ labels: [], values: [] }))
    dashboardService.getMonthlySales.and.returnValue(of({ labels: [], values: [] }))
  })

  // ─── visibleStatCards — granularidad por rol ───────────────────────────────

  describe('visibleStatCards', () => {
    it('DOCTOR solo ve tarjetas clínicas, no Personal Activo ni facturación', () => {
      roles = [UserRoles.DOCTOR]
      const component = createComponent()
      const labels = component.visibleStatCards.map(c => c.label)

      expect(labels).toContain('Total Pacientes')
      expect(labels).toContain('Mis Citas Hoy')
      expect(labels).not.toContain('Personal Activo')
      expect(labels).not.toContain('Stock Bajo')
      expect(labels).not.toContain('Facturas Pendientes')
      expect(labels).not.toContain('Por Cobrar')
    })

    it('RECEPTIONIST ve tarjetas de facturación pese a no ser PHARMACY', () => {
      roles = [UserRoles.RECEPTIONIST]
      const component = createComponent()
      const labels = component.visibleStatCards.map(c => c.label)

      expect(labels).toContain('Facturas Pendientes')
      expect(labels).toContain('Por Cobrar')
      expect(labels).not.toContain('Personal Activo')
      expect(labels).not.toContain('Stock Bajo')
    })

    it('PHARMACIST ve farmacia pero no facturación general ni citas', () => {
      roles = [UserRoles.PHARMACIST]
      const component = createComponent()
      const labels = component.visibleStatCards.map(c => c.label)

      expect(labels).toContain('Stock Bajo')
      expect(labels).toContain('Ventas Farmacia')
      expect(labels).not.toContain('Facturas Pendientes')
      expect(labels).not.toContain('Citas Hoy')
      expect(labels).not.toContain('Mis Citas Hoy')
    })

    it('ADMIN ve todo: personal, farmacia y facturación', () => {
      roles = [UserRoles.ADMIN]
      const component = createComponent()
      const labels = component.visibleStatCards.map(c => c.label)

      expect(labels).toContain('Personal Activo')
      expect(labels).toContain('Stock Bajo')
      expect(labels).toContain('Facturas Pendientes')
    })

    it('el sublabel de Personal Activo desglosa por rol', () => {
      roles = [UserRoles.ADMIN]
      const component = createComponent()
      component.stats = {
        ...component.stats,
        totalDoctors: 3, totalNurses: 2, totalReceptionists: 1, totalPharmacists: 1,
      }
      const card = component.visibleStatCards.find(c => c.label === 'Personal Activo')

      expect(card?.value).toBe(7)
      expect(card?.sublabel).toBe('3 doctor(es) · 2 enfermero(s) · 1 recepción · 1 farmacia')
    })
  })

  // ─── isDoctorOnlyView — no reducir alcance de usuarios híbridos ────────────

  describe('isDoctorOnlyView', () => {
    it('es true para un DOCTOR sin otros roles', () => {
      roles = [UserRoles.DOCTOR]
      expect(createComponent().isDoctorOnlyView).toBe(true)
    })

    it('es false para un híbrido DOCTOR+ADMIN (mantiene vista completa)', () => {
      roles = [UserRoles.DOCTOR, UserRoles.ADMIN]
      expect(createComponent().isDoctorOnlyView).toBe(false)
    })

    it('es false para un híbrido DOCTOR+NURSE', () => {
      roles = [UserRoles.DOCTOR, UserRoles.NURSE]
      expect(createComponent().isDoctorOnlyView).toBe(false)
    })

    it('es false para NURSE (no es DOCTOR)', () => {
      roles = [UserRoles.NURSE]
      expect(createComponent().isDoctorOnlyView).toBe(false)
    })
  })

  // ─── loadDashboardData — scoping real de las llamadas HTTP ─────────────────

  describe('loadDashboardData', () => {
    it('pasa el id del usuario como doctorId cuando es DOCTOR sin otros roles', () => {
      roles = [UserRoles.DOCTOR]
      createComponent().loadDashboardData()

      expect(dashboardService.getTodayAppointments).toHaveBeenCalledWith('doctor-1')
      expect(dashboardService.getPendingAppointmentsCount).toHaveBeenCalledWith('doctor-1')
    })

    it('no acota por doctorId para un ADMIN', () => {
      roles = [UserRoles.ADMIN]
      createComponent().loadDashboardData()

      expect(dashboardService.getTodayAppointments).toHaveBeenCalledWith(undefined)
    })

    it('solo pide facturación si el rol tiene BillingRead (RECEPTIONIST/ADMIN)', () => {
      roles = [UserRoles.PHARMACIST]
      createComponent().loadDashboardData()

      expect(dashboardService.getBillingSummary).not.toHaveBeenCalled()
    })
  })
})
