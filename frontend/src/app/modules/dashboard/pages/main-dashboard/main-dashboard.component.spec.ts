import { TestBed } from '@angular/core/testing'
import { ActivatedRoute, Router } from '@angular/router'
import { Permission } from '@core/enums/permission.enum'
import { permissionsForRoles } from '@core/constants/role-permissions.map'
import { UserRoles } from '@core/enums/user-roles.enum'
import { RoleStateService } from '@core/services/role-state.service'
import { of, ReplaySubject } from 'rxjs'
import { AuthService } from '../../../auth/services/auth.service'
import { ClinicContextService } from '../../../clinics/services/clinic-context.service'
import { DashboardService } from './dashboard.service'
import { MainDashboardComponent } from './main-dashboard.component'
import { createSpyObj, SpyObj } from '../../../../../testing/spy'

describe('MainDashboardComponent', () => {
  let dashboardService: SpyObj<DashboardService>
  let roles: UserRoles[]

  // `hasPermission` deriva de los roles con el mismo mapa que usa la app, en vez
  // de devolver `true` a secas: así el doble respeta que DOCTOR no tiene
  // `AppointmentsRead`, que es justo lo que decide si se piden las citas.
  const fakeRoleState = {
    hasRole: (role: UserRoles) => roles.includes(role),
    hasAnyRole: (allowed: UserRoles[]) => (allowed.length === 0 ? true : allowed.some(r => roles.includes(r))),
      hasPermission: (p: Permission) => permissionsForRoles(roles).includes(p),
  }

  const createComponent = () => {
    TestBed.configureTestingModule({
      providers: [
        MainDashboardComponent,
        { provide: DashboardService, useValue: dashboardService },
        { provide: RoleStateService, useValue: fakeRoleState },
        { provide: AuthService, useValue: { currentUser: () => ({ id: 'doctor-1' }) } },
        { provide: ClinicContextService, useValue: { clinicId: 'clinic-1' } },
        { provide: Router, useValue: createSpyObj('Router', ['navigate']) },
        { provide: ActivatedRoute, useValue: { queryParams: new ReplaySubject() } },
      ],
    })
    return TestBed.inject(MainDashboardComponent)
  }

  beforeEach(() => {
    dashboardService = createSpyObj('DashboardService', [
      'getPatientStats', 'getTodayAppointments', 'getPendingAppointmentsCount',
      'getLowStockAlerts', 'getRecentPatients', 'getStaffStatistics', 'getBillingSummary',
      'getWeeklySales', 'getMonthlySales', 'getOpenLabOrdersCount',
    ])
    dashboardService.getPatientStats.mockReturnValue(of({ total: 0 }))
    dashboardService.getOpenLabOrdersCount.mockReturnValue(of(0))
    dashboardService.getTodayAppointments.mockReturnValue(of([]))
    dashboardService.getPendingAppointmentsCount.mockReturnValue(of(0))
    dashboardService.getLowStockAlerts.mockReturnValue(of([]))
    dashboardService.getRecentPatients.mockReturnValue(of([]))
    dashboardService.getStaffStatistics.mockReturnValue(
      of({ totalDoctors: 3, totalNurses: 2, totalReceptionists: 1, totalPharmacists: 1, totalLaboratory: 0 }),
    )
    dashboardService.getBillingSummary.mockReturnValue(of({ pendingInvoices: 5, overdueInvoices: 2, pendingRevenue: 1200 }))
    dashboardService.getWeeklySales.mockReturnValue(of({ labels: [], values: [] }))
    dashboardService.getMonthlySales.mockReturnValue(of({ labels: [], values: [] }))
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

    /**
     * Un usuario solo-laboratorio no estaba entre los allowedRoles del home, y
     * el roleGuard —al no tener a dónde mandarlo— le cerraba la sesión: podía
     * autenticarse pero no entrar. Ahora entra al mismo dashboard que el resto
     * y ve lo suyo.
     */
    it('LABORATORY ve su tarjeta de órdenes y ninguna ajena', () => {
      roles = [UserRoles.LABORATORY]
      const component = createComponent()
      const labels = component.visibleStatCards.map(c => c.label)

      expect(labels).toContain('Órdenes de Laboratorio')
      expect(labels).not.toContain('Total Pacientes')
      expect(labels).not.toContain('Stock Bajo')
      expect(labels).not.toContain('Facturas Pendientes')
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

  // ─── visibleQuickActions ────────────────────────────────────────────────

  describe('visibleQuickActions', () => {
    /**
     * Regresión: bug real corregido en la auditoría de interrelación de
     * módulos (2026-08-04). LABORATORY no aparecía en ningún grupo de roles
     * del dashboard principal (CLINICAL_ROLES/PHARMACY_ROLES/BILLING_ROLES/
     * ADMIN_ONLY_ROLES) — un usuario solo-laboratorio veía la home
     * completamente vacía pese a tener acceso pleno al módulo Laboratorio.
     * 3ra recurrencia del mismo patrón que role-state.service.ts y
     * sidebar/navbar ROLE_LABELS.
     */
    it('LABORATORY ve al menos el acceso rápido "Laboratorio" (no queda con la home vacía)', () => {
      roles = [UserRoles.LABORATORY]
      const component = createComponent()
      const labels = component.visibleQuickActions.map(a => a.label)

      expect(labels).toContain('Laboratorio')
      expect(component.visibleQuickActions.length).toBeGreaterThan(0)
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
    it('no pide citas para un DOCTOR, que no tiene AppointmentsRead', () => {
      // El permiso se le quitó a DOCTOR a propósito. Pedirlas igual —decidiéndolo
      // por rol -- se llevaba un 403 en cada carga del dashboard, en silencio, y
      // dejaba las tarjetas de citas en cero para siempre.
      roles = [UserRoles.DOCTOR]
      createComponent().loadDashboardData()

      expect(dashboardService.getTodayAppointments).not.toHaveBeenCalled()
      expect(dashboardService.getPendingAppointmentsCount).not.toHaveBeenCalled()
    })

    it('no pide las órdenes de laboratorio a quien no tiene LabRead', () => {
      roles = [UserRoles.RECEPTIONIST]
      createComponent().loadDashboardData()
      expect(dashboardService.getOpenLabOrdersCount).not.toHaveBeenCalled()
    })

    it('pide las órdenes de laboratorio a quien sí lo tiene', () => {
      roles = [UserRoles.LABORATORY]
      createComponent().loadDashboardData()
      expect(dashboardService.getOpenLabOrdersCount).toHaveBeenCalled()
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
