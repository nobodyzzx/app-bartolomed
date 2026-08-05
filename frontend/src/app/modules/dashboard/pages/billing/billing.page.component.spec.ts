import { Location } from '@angular/common'
import { TestBed } from '@angular/core/testing'
import { ActivatedRoute, Router } from '@angular/router'
import { AlertService } from '@core/services/alert.service'
import { of, throwError } from 'rxjs'
import { BillingPageComponent } from './billing.page.component'
import { BillingService } from './billing.service'
import { RecentInvoice } from './interfaces/billing-ui.interfaces'

describe('BillingPageComponent', () => {
  let component: BillingPageComponent
  let billingService: jasmine.SpyObj<BillingService>
  let alert: jasmine.SpyObj<AlertService>
  let router: jasmine.SpyObj<Router>
  let location: jasmine.SpyObj<Location>

  const makeInvoice = (overrides: Partial<RecentInvoice> = {}): RecentInvoice =>
    ({
      id: 'inv-1',
      invoiceNumber: 'INV-0001',
      patient: { firstName: 'Juan', lastName: 'Perez' },
      issueDate: '2026-01-01',
      totalAmount: 100,
      status: 'paid',
      ...overrides,
    }) as RecentInvoice

  const createComponent = (patientIdParam: string | null = null) => {
    TestBed.resetTestingModule()
    TestBed.configureTestingModule({
      providers: [
        BillingPageComponent,
        { provide: Router, useValue: router },
        { provide: AlertService, useValue: alert },
        { provide: BillingService, useValue: billingService },
        { provide: Location, useValue: location },
        {
          provide: ActivatedRoute,
          useValue: { snapshot: { queryParamMap: { get: (k: string) => (k === 'patientId' ? patientIdParam : null) } } },
        },
      ],
    })
    return TestBed.inject(BillingPageComponent)
  }

  beforeEach(() => {
    billingService = jasmine.createSpyObj('BillingService', ['getStatistics', 'listInvoices'])
    alert = jasmine.createSpyObj('AlertService', ['error', 'fire'])
    router = jasmine.createSpyObj('Router', ['navigate'])
    location = jasmine.createSpyObj('Location', ['back'])
  })

  describe('loadData / ngOnInit', () => {
    it('en éxito, guarda estadísticas y las primeras 5 facturas recientes', () => {
      billingService.getStatistics.and.returnValue(
        of({ totalInvoices: 10, paid: 5, pending: 3, overdue: 2, totalRevenue: 1000, pendingRevenue: 300 }),
      )
      billingService.listInvoices.and.returnValue(
        of({ items: Array.from({ length: 8 }, (_, i) => makeInvoice({ id: `inv-${i}` })) }),
      )

      component = createComponent()
      component.ngOnInit()

      expect(component.statistics?.totalInvoices).toBe(10)
      expect(component.isLoading).toBeFalse()
      expect(component.recentInvoices.length).toBe(5)
    })

    it('en error de estadísticas, muestra alerta e inicializa con ceros', () => {
      billingService.getStatistics.and.returnValue(throwError(() => ({ message: 'caído' })))
      billingService.listInvoices.and.returnValue(of({ items: [] }))

      component = createComponent()
      component.ngOnInit()

      expect(alert.error).toHaveBeenCalledWith('Error al cargar estadísticas', 'caído')
      expect(component.isLoading).toBeFalse()
      expect(component.statistics).toEqual({
        totalInvoices: 0,
        paid: 0,
        pending: 0,
        overdue: 0,
        totalRevenue: 0,
        pendingRevenue: 0,
      })
    })

    it('en error de facturas recientes, muestra alerta y deja el arreglo vacío', () => {
      billingService.getStatistics.and.returnValue(of({} as any))
      billingService.listInvoices.and.returnValue(throwError(() => ({})))

      component = createComponent()
      component.ngOnInit()

      expect(alert.error).toHaveBeenCalledWith('Error al cargar facturas recientes', 'Inténtalo de nuevo')
      expect(component.recentInvoices).toEqual([])
    })

    it('trata response.items ausente como arreglo vacío', () => {
      billingService.getStatistics.and.returnValue(of({} as any))
      billingService.listInvoices.and.returnValue(of({}))

      component = createComponent()
      component.ngOnInit()

      expect(component.recentInvoices).toEqual([])
    })
  })

  describe('helpers de presentación', () => {
    beforeEach(() => {
      billingService.getStatistics.and.returnValue(of({} as any))
      billingService.listInvoices.and.returnValue(of({ items: [] }))
      component = createComponent()
    })

    it('getPatientName concatena nombre y apellido', () => {
      expect(component.getPatientName(makeInvoice())).toBe('Juan Perez')
    })

    it('getStatusLabel traduce estados conocidos y deja el resto tal cual', () => {
      expect(component.getStatusLabel('paid')).toBe('Pagada')
      expect(component.getStatusLabel('overdue')).toBe('Vencida')
      expect(component.getStatusLabel('unknown_status')).toBe('unknown_status')
    })

    it('getStatusClass devuelve clases conocidas y un default gris para desconocidos', () => {
      expect(component.getStatusClass('paid')).toContain('green')
      expect(component.getStatusClass('unknown_status')).toBe('bg-gray-100 text-gray-700')
    })

    it('formatDate formatea a es-ES', () => {
      expect(component.formatDate('2026-03-15')).toMatch(/\d{2}\/\d{2}\/2026/)
    })

    it('formatCurrency formatea a Bs (BOB) — app de alcance boliviano, no EUR', () => {
      expect(component.formatCurrency(1234.5)).toContain('Bs')
    })
  })

  describe('navegación', () => {
    beforeEach(() => {
      billingService.getStatistics.and.returnValue(of({} as any))
      billingService.listInvoices.and.returnValue(of({ items: [] }))
      component = createComponent()
    })

    it('goToCheckout lleva al punto de cobro: las facturas nacen de cargos', () => {
      component.goToCheckout()
      expect(router.navigate).toHaveBeenCalledWith(['/dashboard/checkout'])
    })

    it('navigateToInvoicesList navega al listado', () => {
      component.navigateToInvoicesList()
      expect(router.navigate).toHaveBeenCalledWith(['/dashboard/billing'])
    })

    it('viewInvoice navega al detalle de la factura', () => {
      component.viewInvoice(makeInvoice({ id: 'inv-9' }))
      expect(router.navigate).toHaveBeenCalledWith(['/dashboard/billing/invoices', 'inv-9', 'edit'])
    })

    it('goBack delega en Location.back()', () => {
      component.goBack()
      expect(location.back).toHaveBeenCalled()
    })
  })

  describe('performSearch', () => {
    beforeEach(() => {
      billingService.getStatistics.and.returnValue(of({} as any))
      billingService.listInvoices.and.returnValue(of({ items: [] }))
      component = createComponent()
    })

    it('no dispara alerta si el término está vacío o son solo espacios', () => {
      component.searchTerm = '   '
      component.performSearch()
      expect(alert.fire).not.toHaveBeenCalled()
    })

    it('dispara la alerta informativa con el término recortado', () => {
      component.searchTerm = '  juan  '
      component.performSearch()
      expect(alert.fire).toHaveBeenCalledWith({
        icon: 'info',
        title: 'Búsqueda',
        text: 'Buscando: "juan". Funcionalidad en desarrollo.',
      })
    })
  })

  describe('filtro por paciente (llegando desde "Accesos Rápidos" en la ficha del paciente)', () => {
    beforeEach(() => {
      billingService.getStatistics.and.returnValue(of({} as any))
    })

    it('sin patientId en la URL, pide solo las 5 recientes sin filtro', () => {
      billingService.listInvoices.and.returnValue(of({ items: [] }))
      component = createComponent(null)

      component.ngOnInit()

      expect(billingService.listInvoices).toHaveBeenCalledWith(1, 5, {})
      expect(component.patientIdFilter).toBeNull()
    })

    it('con patientId en la URL, pide TODAS las facturas de ese paciente (no solo 5)', () => {
      billingService.listInvoices.and.returnValue(
        of({ items: Array.from({ length: 8 }, (_, i) => makeInvoice({ id: `inv-${i}` })) }),
      )
      component = createComponent('patient-1')

      component.ngOnInit()

      expect(billingService.listInvoices).toHaveBeenCalledWith(1, 100, { patientId: 'patient-1' })
      expect(component.recentInvoices.length).toBe(8)
    })

    it('deriva el nombre del paciente filtrado de la primera factura recibida', () => {
      billingService.listInvoices.and.returnValue(
        of({ items: [makeInvoice({ patient: { firstName: 'Ana', lastName: 'Gómez' } as any })] }),
      )
      component = createComponent('patient-1')

      component.ngOnInit()

      expect(component.patientNameFilter).toBe('Ana Gómez')
    })

    it('clearPatientFilter limpia el filtro y recarga sin patientId', () => {
      billingService.listInvoices.and.returnValue(of({ items: [] }))
      component = createComponent('patient-1')
      component.ngOnInit()

      component.clearPatientFilter()

      expect(component.patientIdFilter).toBeNull()
      expect(component.patientNameFilter).toBeNull()
      expect(billingService.listInvoices).toHaveBeenCalledWith(1, 5, {})
      expect(router.navigate).toHaveBeenCalledWith([], { queryParams: {} })
    })
  })
})
