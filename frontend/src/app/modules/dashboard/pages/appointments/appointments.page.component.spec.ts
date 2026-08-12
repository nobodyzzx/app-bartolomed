import { TestBed } from '@angular/core/testing'
import { ActivatedRoute, Router } from '@angular/router'
import { AlertService } from '@core/services/alert.service'
import { of } from 'rxjs'
import { ListStateService } from '../../../../shared/services/list-state.service'
import { AppointmentsPageComponent } from './appointments.page.component'
import { Appointment, AppointmentsService, AppointmentStatus } from './services/appointments.service'
import { createSpyObj, SpyObj } from '../../../../../testing/spy'

describe('AppointmentsPageComponent', () => {
  let component: AppointmentsPageComponent
  let appointmentsService: SpyObj<AppointmentsService>
  let listState: SpyObj<ListStateService>
  let router: SpyObj<Router>
  let alert: SpyObj<AlertService>

  const makeAppointment = (overrides: Partial<Appointment> = {}): Appointment =>
    ({
      id: 'apt-1',
      appointmentDate: '2026-05-01T10:00:00.000Z',
      status: AppointmentStatus.SCHEDULED,
      reason: 'Chequeo',
      patient: { id: 'p1', firstName: 'Juan', lastName: 'Perez' },
      doctor: { id: 'd1', firstName: 'Ana', lastName: 'Gómez' },
      ...overrides,
    }) as Appointment

  const createComponent = (patientIdParam: string | null = null) => {
    TestBed.resetTestingModule()
    TestBed.configureTestingModule({
      providers: [
        // Doble del recuerdo de la vista: aquí se prueba la pantalla, no el
        // servicio, que tiene su propio spec.
        { provide: ListStateService, useValue: listState },
        AppointmentsPageComponent,
        { provide: Router, useValue: router },
        { provide: AppointmentsService, useValue: appointmentsService },
        { provide: AlertService, useValue: alert },
        {
          provide: ActivatedRoute,
          useValue: { snapshot: { queryParamMap: { get: (k: string) => (k === 'patientId' ? patientIdParam : null) } } },
        },
      ],
    })
    return TestBed.inject(AppointmentsPageComponent)
  }

  beforeEach(() => {
    appointmentsService = createSpyObj('AppointmentsService', [
      'getAppointments',
      'confirmAppointment',
      'cancelAppointment',
    ])
    router = createSpyObj('Router', ['navigate'])
    alert = createSpyObj('AlertService', ['fire'])
    listState = createSpyObj<ListStateService>('ListStateService', [
      'guardar', 'olvidar', 'recuperarSiVuelve', 'reflejarEnUrl', 'consumirEscrituraPropia',
    ])
    listState.recuperarSiVuelve.mockReturnValue(undefined)
    listState.consumirEscrituraPropia.mockReturnValue(false)
  })

  describe('filtro por paciente (llegando desde "Accesos Rápidos" en la ficha del paciente)', () => {
    it('sin patientId, filtra desde hoy en vez de por paciente', () => {
      appointmentsService.getAppointments.mockReturnValue(of([]))
      component = createComponent(null)

      component.ngOnInit()

      const filtersUsed = appointmentsService.getAppointments.mock.lastCall![0]!
      expect(filtersUsed.patientId).toBeUndefined()
      expect(filtersUsed.startDate).toBeDefined()
      expect(component.patientIdFilter).toBeNull()
    })

    it('con patientId, pide TODO el historial del paciente (sin límite de fecha)', () => {
      appointmentsService.getAppointments.mockReturnValue(of([]))
      component = createComponent('patient-1')

      component.ngOnInit()

      expect(appointmentsService.getAppointments).toHaveBeenCalledWith({ patientId: 'patient-1' })
    })

    it('deriva el nombre del paciente filtrado de la primera cita recibida', () => {
      appointmentsService.getAppointments.mockReturnValue(
        of([makeAppointment({ patient: { id: 'p1', firstName: 'Ana', lastName: 'Gómez' } as any })]),
      )
      component = createComponent('patient-1')

      component.ngOnInit()

      expect(component.patientNameFilter).toBe('Ana Gómez')
    })

    it('sin resultados, no arma un nombre de paciente filtrado', () => {
      appointmentsService.getAppointments.mockReturnValue(of([]))
      component = createComponent('patient-1')

      component.ngOnInit()

      expect(component.patientNameFilter).toBeNull()
    })

    it('clearPatientFilter limpia el filtro, navega sin queryParams y recarga', () => {
      appointmentsService.getAppointments.mockReturnValue(of([]))
      component = createComponent('patient-1')
      component.ngOnInit()

      component.clearPatientFilter()

      expect(component.patientIdFilter).toBeNull()
      expect(component.patientNameFilter).toBeNull()
      expect(router.navigate).toHaveBeenCalledWith([], { queryParams: {} })
      expect(appointmentsService.getAppointments).toHaveBeenCalledTimes(2)
    })
  })

  describe('applyFilters', () => {
    beforeEach(() => {
      appointmentsService.getAppointments.mockReturnValue(
        of([
          makeAppointment({
            id: 'a',
            status: AppointmentStatus.SCHEDULED,
            patient: { firstName: 'Juan', lastName: 'Perez' } as any,
            doctor: { firstName: 'Carlos', lastName: 'Rios' } as any,
          }),
          makeAppointment({
            id: 'b',
            status: AppointmentStatus.CANCELLED,
            patient: { firstName: 'Ana', lastName: 'Diaz' } as any,
            doctor: { firstName: 'Carlos', lastName: 'Rios' } as any,
          }),
        ]),
      )
      component = createComponent()
      component.ngOnInit()
    })

    it('sin filtros, muestra todas las citas cargadas', () => {
      expect(component.filteredAppointments.length).toBe(2)
    })

    it('setStatus filtra por estado', () => {
      component.setStatus(AppointmentStatus.CANCELLED)
      expect(component.filteredAppointments.map(a => a.id)).toEqual(['b'])
    })

    it('onSearch filtra por nombre de paciente (case-insensitive)', () => {
      component.searchTerm = 'ana'
      component.onSearch()
      expect(component.filteredAppointments.map(a => a.id)).toEqual(['b'])
    })
  })

  describe('canConfirm / canCancel', () => {
    beforeEach(() => {
      appointmentsService.getAppointments.mockReturnValue(of([]))
      component = createComponent()
    })

    it('canConfirm solo es true para citas SCHEDULED', () => {
      expect(component.canConfirm(makeAppointment({ status: AppointmentStatus.SCHEDULED }))).toBe(true)
      expect(component.canConfirm(makeAppointment({ status: AppointmentStatus.COMPLETED }))).toBe(false)
    })

    it('canCancel es true para SCHEDULED y CONFIRMED, no para estados terminales', () => {
      expect(component.canCancel(makeAppointment({ status: AppointmentStatus.SCHEDULED }))).toBe(true)
      expect(component.canCancel(makeAppointment({ status: AppointmentStatus.CONFIRMED }))).toBe(true)
      expect(component.canCancel(makeAppointment({ status: AppointmentStatus.CANCELLED }))).toBe(false)
    })
  })

  describe('navegación', () => {
    beforeEach(() => {
      appointmentsService.getAppointments.mockReturnValue(of([]))
      component = createComponent()
    })

    it('viewCalendar navega al calendario', () => {
      component.viewCalendar()
      expect(router.navigate).toHaveBeenCalledWith(['/dashboard/appointments/calendar'])
    })

    it('createAppointment navega al formulario de creación', () => {
      component.createAppointment()
      expect(router.navigate).toHaveBeenCalledWith(['/dashboard/appointments/new'])
    })

    it('editAppointment navega al formulario de edición con el id', () => {
      component.editAppointment(makeAppointment({ id: 'apt-9' }))
      expect(router.navigate).toHaveBeenCalledWith(['/dashboard/appointments/edit', 'apt-9'])
    })
  })
})
