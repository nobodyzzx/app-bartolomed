import { Location } from '@angular/common'
import { TestBed } from '@angular/core/testing'
import { ActivatedRoute, Router } from '@angular/router'
import { AlertService } from '@core/services/alert.service'
import { of, throwError } from 'rxjs'
import { BillingPageComponent } from './billing.page.component'
import { BillingService } from './billing.service'
import { RecentInvoice } from './interfaces/billing-ui.interfaces'
import { createSpyObj, SpyObj } from '../../../../../testing/spy'

describe('BillingPageComponent', () => {
  let component: BillingPageComponent
  let billingService: SpyObj<BillingService>
  let alert: SpyObj<AlertService>
  let router: SpyObj<Router>
  let location: SpyObj<Location>

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
    billingService = createSpyObj('BillingService', [
      'getStatistics',
      'listInvoices',
      'downloadReceipt',
    ])
    alert = createSpyObj('AlertService', ['error', 'fire'])
    router = createSpyObj('Router', ['navigate'])
    location = createSpyObj('Location', ['back'])
  })

  describe('loadData / ngOnInit', () => {
    it('en éxito, guarda estadísticas y las primeras 5 facturas recientes', () => {
      billingService.getStatistics.mockReturnValue(
        of({ totalInvoices: 10, paid: 5, pending: 3, overdue: 2, totalRevenue: 1000, pendingRevenue: 300 }),
      )
      billingService.listInvoices.mockReturnValue(
        of({ items: Array.from({ length: 8 }, (_, i) => makeInvoice({ id: `inv-${i}` })) }),
      )

      component = createComponent()
      component.ngOnInit()

      expect(component.statistics?.totalInvoices).toBe(10)
      expect(component.isLoading).toBe(false)
      expect(component.invoices.length).toBe(8)
    })

    it('en error de estadísticas, muestra alerta e inicializa con ceros', () => {
      billingService.getStatistics.mockReturnValue(throwError(() => ({ message: 'caído' })))
      billingService.listInvoices.mockReturnValue(of({ items: [] }))

      component = createComponent()
      component.ngOnInit()

      expect(alert.error).toHaveBeenCalledWith('Error al cargar estadísticas', 'caído')
      expect(component.isLoading).toBe(false)
      expect(component.statistics).toEqual({
        totalInvoices: 0,
        paid: 0,
        pending: 0,
        overdue: 0,
        totalRevenue: 0,
        pendingRevenue: 0,
      })
    })

    it('en error de facturas, muestra alerta y deja el arreglo vacío', () => {
      billingService.getStatistics.mockReturnValue(of({} as any))
      billingService.listInvoices.mockReturnValue(throwError(() => ({})))

      component = createComponent()
      component.ngOnInit()

      expect(alert.error).toHaveBeenCalledWith('Error al cargar facturas', 'Inténtalo de nuevo')
      expect(component.invoices).toEqual([])
    })

    it('trata response.items ausente como arreglo vacío', () => {
      billingService.getStatistics.mockReturnValue(of({} as any))
      billingService.listInvoices.mockReturnValue(of({}))

      component = createComponent()
      component.ngOnInit()

      expect(component.invoices).toEqual([])
    })
  })

  describe('helpers de presentación', () => {
    beforeEach(() => {
      billingService.getStatistics.mockReturnValue(of({} as any))
      billingService.listInvoices.mockReturnValue(of({ items: [] }))
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
      billingService.getStatistics.mockReturnValue(of({} as any))
      billingService.listInvoices.mockReturnValue(of({ items: [] }))
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

    // Este test fijaba la ruta rota: afirmaba la navegación a
    // `/dashboard/billing/invoices/:id/edit`, que no existe en ningún módulo, así
    // que el comodín del router devolvía al usuario al dashboard y hacer clic en
    // una factura parecía cerrar la pantalla. Ahora se descarga el recibo, que es
    // lo que hace falta en ventanilla, y no se navega a ninguna parte.
    it('viewInvoice descarga el recibo y no navega', () => {
      billingService.downloadReceipt.mockReturnValue(of(new Blob(['pdf'])))
      component.viewInvoice(makeInvoice({ id: 'inv-9' }))
      expect(billingService.downloadReceipt).toHaveBeenCalledWith('inv-9')
      expect(router.navigate).not.toHaveBeenCalled()
    })

    it('goBack delega en Location.back()', () => {
      component.goBack()
      expect(location.back).toHaveBeenCalled()
    })
  })

  /**
   * El buscador estaba puesto y no filtraba nada: la plantilla solo escribía
   * `searchTerm`, y `performSearch()` —que ni siquiera estaba enlazado— abría
   * un aviso de "funcionalidad en desarrollo". Escribir no hacía nada.
   */
  describe('búsqueda', () => {
    beforeEach(() => {
      billingService.getStatistics.mockReturnValue(of({} as any))
      billingService.listInvoices.mockReturnValue(of({ items: [], total: 0 }))
      component = createComponent()
      component.ngOnInit()
      billingService.listInvoices.mockClear()
    })

    it('el término va a la consulta, no a un aviso', () => {
      vi.useFakeTimers()
      component.onSearch('  juan  ')
      vi.advanceTimersByTime(300)

      expect(billingService.listInvoices).toHaveBeenCalledWith(1, 25, { search: 'juan' })
      expect(alert.fire).not.toHaveBeenCalled()
      vi.useRealTimers()
    })

    it('vuelve a la primera página al buscar', () => {
      vi.useFakeTimers()
      component.onPageChange({ pageIndex: 3, pageSize: 25, length: 200 })
      billingService.listInvoices.mockClear()

      component.onSearch('ana')
      vi.advanceTimersByTime(300)

      expect(component.page).toBe(0)
      expect(billingService.listInvoices).toHaveBeenCalledWith(1, 25, { search: 'ana' })
      vi.useRealTimers()
    })
  })

  /**
   * El orden va al servidor: la pantalla recibe una página, y ordenar aquí
   * reordenaría el recorte haciéndolo pasar por la lista entera.
   */
  describe('orden', () => {
    beforeEach(() => {
      billingService.getStatistics.mockReturnValue(of({} as any))
      billingService.listInvoices.mockReturnValue(of({ items: [], total: 0 }))
      component = createComponent()
      component.ngOnInit()
      billingService.listInvoices.mockClear()
    })

    it('manda la columna y el sentido a la consulta', () => {
      component.onSort({ active: 'totalAmount', direction: 'asc' })

      expect(billingService.listInvoices).toHaveBeenCalledWith(1, 25, {
        sortBy: 'totalAmount',
        sortDir: 'ASC',
      })
    })

    it('sin sentido de orden no manda nada: decide el backend', () => {
      component.onSort({ active: 'totalAmount', direction: '' })

      expect(billingService.listInvoices).toHaveBeenCalledWith(1, 25, {})
    })
  })

  describe('filtro por paciente (llegando desde "Accesos Rápidos" en la ficha del paciente)', () => {
    beforeEach(() => {
      billingService.getStatistics.mockReturnValue(of({} as any))
    })

    it('sin patientId en la URL, pide la primera página sin filtro', () => {
      billingService.listInvoices.mockReturnValue(of({ items: [], total: 0 }))
      component = createComponent(null)

      component.ngOnInit()

      expect(billingService.listInvoices).toHaveBeenCalledWith(1, 25, {})
      expect(component.patientIdFilter).toBeNull()
    })

    it('con patientId en la URL, arrastra el filtro a la consulta', () => {
      billingService.listInvoices.mockReturnValue(
        of({ items: Array.from({ length: 8 }, (_, i) => makeInvoice({ id: `inv-${i}` })), total: 8 }),
      )
      component = createComponent('patient-1')

      component.ngOnInit()

      expect(billingService.listInvoices).toHaveBeenCalledWith(1, 25, { patientId: 'patient-1' })
      expect(component.invoices.length).toBe(8)
    })

    it('deriva el nombre del paciente filtrado de la primera factura recibida', () => {
      billingService.listInvoices.mockReturnValue(
        of({ items: [makeInvoice({ patient: { firstName: 'Ana', lastName: 'Gómez' } as any })] }),
      )
      component = createComponent('patient-1')

      component.ngOnInit()

      expect(component.patientNameFilter).toBe('Ana Gómez')
    })

    it('clearPatientFilter limpia el filtro y recarga sin patientId', () => {
      billingService.listInvoices.mockReturnValue(of({ items: [] }))
      component = createComponent('patient-1')
      component.ngOnInit()

      component.clearPatientFilter()

      expect(component.patientIdFilter).toBeNull()
      expect(component.patientNameFilter).toBeNull()
      expect(billingService.listInvoices).toHaveBeenCalledWith(1, 25, {})
      expect(router.navigate).toHaveBeenCalledWith([], { queryParams: {} })
    })
  })
})
