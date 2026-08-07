import { TestBed } from '@angular/core/testing'
import { ActivatedRoute, Router } from '@angular/router'
import { AlertService } from '@core/services/alert.service'
import { of } from 'rxjs'
import { Prescription } from './interfaces/prescription-ui.interface'
import { PrescriptionListComponent } from './prescription-list.component'
import { PrescriptionsService } from './prescriptions.service'
import { createSpyObj, SpyObj } from '../../../../../testing/spy'

describe('PrescriptionListComponent', () => {
  let component: PrescriptionListComponent
  let prescriptionsService: SpyObj<PrescriptionsService>
  let router: SpyObj<Router>
  let alert: SpyObj<AlertService>

  const daysFromNow = (days: number): string => {
    const d = new Date()
    d.setDate(d.getDate() + days)
    return d.toISOString()
  }

  const makePrescription = (overrides: Partial<Prescription> = {}): Prescription =>
    ({
      id: 'rx-1',
      prescriptionNumber: 'RX-1',
      prescriptionDate: daysFromNow(-10),
      expiryDate: daysFromNow(10),
      status: 'active',
      diagnosis: 'Dx',
      patient: { id: 'p1', firstName: 'Juan', lastName: 'Perez', documentNumber: '123' },
      doctor: { id: 'd1', email: 'doc@example.com' },
      items: [],
      refillsAllowed: 2,
      refillsUsed: 0,
      ...overrides,
    }) as Prescription

  const createComponent = (patientIdParam: string | null = null) => {
    TestBed.resetTestingModule()
    TestBed.configureTestingModule({
      providers: [
        PrescriptionListComponent,
        { provide: PrescriptionsService, useValue: prescriptionsService },
        { provide: Router, useValue: router },
        { provide: AlertService, useValue: alert },
        {
          provide: ActivatedRoute,
          useValue: { snapshot: { queryParamMap: { get: (k: string) => (k === 'patientId' ? patientIdParam : null) } } },
        },
      ],
    })
    return TestBed.inject(PrescriptionListComponent)
  }

  beforeEach(() => {
    prescriptionsService = createSpyObj('PrescriptionsService', ['list', 'setStatus', 'refill', 'getPdf'])
    router = createSpyObj('Router', ['navigate'])
    alert = createSpyObj('AlertService', ['fire', 'success'])
    alert.fire.mockReturnValue(Promise.resolve({ isConfirmed: false } as any))
  })

  describe('bug real: badge de estado ignoraba el vencimiento', () => {
    it('getEffectiveStatus devuelve "expired" para una receta "active" con expiryDate en el pasado', () => {
      prescriptionsService.list.mockReturnValue(of({ items: [] }))
      component = createComponent()

      const vencida = makePrescription({ status: 'active', expiryDate: daysFromNow(-1) })

      expect(component.getEffectiveStatus(vencida)).toBe('expired')
      expect(component.getStatusLabel(component.getEffectiveStatus(vencida))).toBe('Vencida')
    })

    it('getEffectiveStatus respeta el status real cuando la receta sigue vigente', () => {
      prescriptionsService.list.mockReturnValue(of({ items: [] }))
      component = createComponent()

      const vigente = makePrescription({ status: 'active', expiryDate: daysFromNow(5) })

      expect(component.getEffectiveStatus(vigente)).toBe('active')
    })

    it('getEffectiveStatus no reclasifica estados terminales (dispensada) aunque la fecha ya haya pasado', () => {
      prescriptionsService.list.mockReturnValue(of({ items: [] }))
      component = createComponent()

      const dispensada = makePrescription({ status: 'dispensed', expiryDate: daysFromNow(-30) })

      expect(component.getEffectiveStatus(dispensada)).toBe('dispensed')
    })

    it('getActiveCount excluye las "active" ya vencidas (antes se contaban como Activas)', () => {
      prescriptionsService.list.mockReturnValue(
        of({
          items: [
            makePrescription({ id: 'a', status: 'active', expiryDate: daysFromNow(5) }),
            makePrescription({ id: 'b', status: 'active', expiryDate: daysFromNow(-1) }),
          ],
        }),
      )
      component = createComponent()
      component.loadPrescriptions()

      expect(component.getActiveCount()).toBe(1)
      expect(component.getExpiredCount()).toBe(1)
    })
  })

  describe('bug real: filtro "Vencidas" no traía resultados', () => {
    it('setStatusFilter("expired") no envía status=expired al backend (no existe ese valor en BD)', () => {
      prescriptionsService.list.mockReturnValue(of({ items: [] }))
      component = createComponent()

      component.setStatusFilter('expired')

      expect(prescriptionsService.list).toHaveBeenCalledWith(1, 100, {})
    })

    it('setStatusFilter("expired") filtra client-side las recetas "active" vencidas', () => {
      const vigente = makePrescription({ id: 'a', status: 'active', expiryDate: daysFromNow(5) })
      const vencida = makePrescription({ id: 'b', status: 'active', expiryDate: daysFromNow(-2) })
      prescriptionsService.list.mockReturnValue(of({ items: [vigente, vencida] }))
      component = createComponent()

      component.setStatusFilter('expired')

      expect(component.filteredPrescriptions).toEqual([vencida])
    })

    it('otros filtros de status sí se envían al backend normalmente', () => {
      prescriptionsService.list.mockReturnValue(of({ items: [] }))
      component = createComponent()

      component.setStatusFilter('dispensed')

      expect(prescriptionsService.list).toHaveBeenCalledWith(1, 100, { status: 'dispensed' })
    })
  })

  describe('filtro por paciente (llegando desde "Accesos Rápidos" en la ficha del paciente)', () => {
    it('sin patientId en la URL, no filtra por paciente', () => {
      prescriptionsService.list.mockReturnValue(of({ items: [] }))
      component = createComponent(null)

      component.ngOnInit()

      expect(prescriptionsService.list).toHaveBeenCalledWith(1, 100, {})
      expect(component.patientIdFilter).toBeNull()
    })

    it('con patientId en la URL, lo agrega al filtro server-side', () => {
      prescriptionsService.list.mockReturnValue(of({ items: [] }))
      component = createComponent('patient-1')

      component.ngOnInit()

      expect(prescriptionsService.list).toHaveBeenCalledWith(1, 100, { patientId: 'patient-1' })
      expect(component.patientIdFilter).toBe('patient-1')
    })

    it('deriva el nombre del paciente filtrado de la primera receta recibida', () => {
      prescriptionsService.list.mockReturnValue(
        of({ items: [makePrescription({ patient: { id: 'p1', firstName: 'Ana', lastName: 'Gómez', documentNumber: '1' } })] }),
      )
      component = createComponent('patient-1')

      component.ngOnInit()

      expect(component.patientNameFilter).toBe('Ana Gómez')
    })

    it('clearPatientFilter limpia el filtro y recarga sin patientId', () => {
      prescriptionsService.list.mockReturnValue(of({ items: [] }))
      component = createComponent('patient-1')
      component.ngOnInit()

      component.clearPatientFilter()

      expect(component.patientIdFilter).toBeNull()
      expect(component.patientNameFilter).toBeNull()
      expect(prescriptionsService.list).toHaveBeenCalledWith(1, 100, {})
      expect(router.navigate).toHaveBeenCalledWith([], { queryParams: {} })
    })
  })
})
