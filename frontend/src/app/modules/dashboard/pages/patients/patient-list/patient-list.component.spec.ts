import { Location } from '@angular/common'
import { TestBed } from '@angular/core/testing'
import { ActivatedRoute, convertToParamMap, Router } from '@angular/router'
import { UserRoles } from '@core/enums/user-roles.enum'
import { AlertService } from '@core/services/alert.service'
import { RoleStateService } from '@core/services/role-state.service'
import { of, ReplaySubject, throwError } from 'rxjs'
import { Gender, Patient, PatientStatistics } from '../interfaces'
import { PatientsService } from '../services'
import { PatientListComponent } from './patient-list.component'
import { createSpyObj, SpyObj } from '../../../../../../testing/spy'

describe('PatientListComponent', () => {
  let component: PatientListComponent
  let patientsService: SpyObj<PatientsService>
  let router: SpyObj<Router>
  let location: SpyObj<Location>
  let alert: SpyObj<AlertService>
  let queryParamMap$: ReplaySubject<any>
  let roles: UserRoles[]

  const fakeRoleState = {
    hasAnyRole: (allowed: UserRoles[]) => (allowed.length === 0 ? true : allowed.some(r => roles.includes(r))),
  }

  const makePatient = (overrides: Partial<Patient> = {}): Patient =>
    ({
      id: 'patient-1',
      firstName: 'Juan',
      lastName: 'Perez',
      documentNumber: '123',
      birthDate: new Date('2000-01-01'),
      gender: Gender.MALE,
      isActive: true,
      clinicId: 'clinic-1',
      ...overrides,
    }) as Patient

  const makeStats = (overrides: Partial<PatientStatistics> = {}): PatientStatistics =>
    ({
      totalPatients: 10,
      newThisMonth: 3,
      genderStats: [
        { gender: Gender.MALE, count: 6 },
        { gender: Gender.FEMALE, count: 4 },
      ],
      ageRanges: [],
      ...overrides,
    }) as PatientStatistics

  const createComponent = () => {
    TestBed.resetTestingModule()
    TestBed.configureTestingModule({
      providers: [
        PatientListComponent,
        { provide: PatientsService, useValue: patientsService },
        { provide: Router, useValue: router },
        { provide: Location, useValue: location },
        { provide: AlertService, useValue: alert },
        { provide: ActivatedRoute, useValue: { queryParamMap: queryParamMap$ } },
        { provide: RoleStateService, useValue: fakeRoleState },
      ],
    })
    return TestBed.inject(PatientListComponent)
  }

  beforeEach(() => {
    patientsService = createSpyObj('PatientsService', [
      'getPatientStatistics',
      'findAll',
      'searchPatients',
      'removePatient',
    ])
    router = createSpyObj('Router', ['navigate'])
    location = createSpyObj('Location', ['back'])
    alert = createSpyObj('AlertService', ['error', 'success', 'fire'])
    queryParamMap$ = new ReplaySubject(1)
    queryParamMap$.next(convertToParamMap({}))
    roles = [UserRoles.ADMIN]

    patientsService.getPatientStatistics.mockReturnValue(of(makeStats()))
    patientsService.findAll.mockReturnValue(of({ data: [makePatient()], total: 1, page: 1, limit: 25 }))
    patientsService.searchPatients.mockReturnValue(of([makePatient()]))
  })

  describe('ngOnInit', () => {
    it('carga estadísticas y pacientes vía el query param q', () => {
      component = createComponent()
      component.ngOnInit()

      expect(component.statistics?.totalPatients).toBe(10)
      expect(patientsService.findAll).toHaveBeenCalled()
    })

    it('usa el término del query param q como searchTerm inicial', () => {
      queryParamMap$.next(convertToParamMap({ q: 'juan' }))

      component = createComponent()
      component.ngOnInit()

      expect(component.searchTerm).toBe('juan')
      expect(patientsService.searchPatients).toHaveBeenCalledWith('juan')
    })

    it('si falla loadStatistics, no rompe (error no crítico)', () => {
      patientsService.getPatientStatistics.mockReturnValue(throwError(() => ({})))

      component = createComponent()
      expect(() => component.ngOnInit()).not.toThrow()
    })
  })

  describe('applyFilter (debounce de búsqueda)', () => {
    // `fakeAsync`/`tick` de Angular dependen de que zone.js parchee el `it` del
    // runner, cosa que no ocurre con Vitest. Los temporizadores falsos de
    // Vitest cubren igual el `debounceTime` de RxJS.
    beforeEach(() => {
      vi.useFakeTimers()
      component = createComponent()
      component.ngOnInit()
      patientsService.findAll.mockClear()
      patientsService.searchPatients.mockClear()
    })

    afterEach(() => {
      vi.useRealTimers()
    })

    it('no dispara loadPatients antes de los 350ms de debounce', () => {
      component.applyFilter('juan')
      vi.advanceTimersByTime(200)
      expect(patientsService.searchPatients).not.toHaveBeenCalled()
      vi.advanceTimersByTime(150)
    })

    it('dispara loadPatients y resetea a la primera página tras 350ms', () => {
      component.currentPage = 2
      component.applyFilter('juan')
      vi.advanceTimersByTime(350)

      expect(component.currentPage).toBe(0)
      expect(patientsService.searchPatients).toHaveBeenCalledWith('juan')
    })

    it('distinctUntilChanged evita relanzar la misma búsqueda dos veces seguidas', () => {
      component.applyFilter('juan')
      vi.advanceTimersByTime(350)
      patientsService.searchPatients.mockClear()

      component.applyFilter('juan')
      vi.advanceTimersByTime(350)

      expect(patientsService.searchPatients).not.toHaveBeenCalled()
    })
  })

  describe('loadPatients', () => {
    beforeEach(() => {
      component = createComponent()
    })

    it('con searchTerm vacío, usa findAll con paginación y filtro de género', () => {
      component.currentPage = 1
      component.pageSize = 10
      component.activeGenderFilter = Gender.FEMALE
      component.searchTerm = ''

      component.loadPatients()

      expect(patientsService.findAll).toHaveBeenCalledWith({ page: 2, limit: 10, gender: Gender.FEMALE })
      expect(component.totalRecords).toBe(1)
      expect(component.isLoading).toBe(false)
    })

    it('con searchTerm, usa searchPatients en vez de findAll', () => {
      component.searchTerm = 'juan'
      component.loadPatients()

      expect(patientsService.searchPatients).toHaveBeenCalledWith('juan')
      expect(patientsService.findAll).not.toHaveBeenCalled()
    })

    it('en error de findAll, apaga isLoading (la alerta la muestra el servicio)', () => {
      patientsService.findAll.mockReturnValue(throwError(() => ({ message: 'caído' })))
      component.searchTerm = ''

      component.loadPatients()

      expect(component.isLoading).toBe(false)
    })

    it('en error de searchPatients, apaga isLoading (la alerta la muestra el servicio)', () => {
      patientsService.searchPatients.mockReturnValue(throwError(() => ({})))
      component.searchTerm = 'juan'

      component.loadPatients()

      expect(component.isLoading).toBe(false)
    })
  })

  describe('paginación y filtros', () => {
    beforeEach(() => {
      component = createComponent()
      patientsService.findAll.mockClear()
    })

    it('onPageChange actualiza página/tamaño y recarga', () => {
      component.onPageChange({ pageIndex: 2, pageSize: 50, length: 100 })
      expect(component.currentPage).toBe(2)
      expect(component.pageSize).toBe(50)
      expect(patientsService.findAll).toHaveBeenCalled()
    })

    it('clearFilters resetea término, filtro de género y página', () => {
      component.searchTerm = 'juan'
      component.activeGenderFilter = Gender.MALE
      component.currentPage = 3

      component.clearFilters()

      expect(component.searchTerm).toBe('')
      expect(component.activeGenderFilter).toBeNull()
      expect(component.currentPage).toBe(0)
    })

    it('setGenderFilter aplica el filtro y resetea la página', () => {
      component.currentPage = 3
      component.setGenderFilter(Gender.FEMALE)
      expect(component.activeGenderFilter).toBe(Gender.FEMALE)
      expect(component.currentPage).toBe(0)
    })
  })

  describe('estadísticas derivadas', () => {
    beforeEach(() => {
      component = createComponent()
    })

    it('getMaleCount/getFemaleCount leen del genderStats cargado', () => {
      component.statistics = makeStats()
      expect(component.getMaleCount()).toBe(6)
      expect(component.getFemaleCount()).toBe(4)
    })

    it('getMaleCount/getFemaleCount devuelven 0 si no hay estadísticas', () => {
      component.statistics = null
      expect(component.getMaleCount()).toBe(0)
    })

    it('getNewThisMonthCount lee newThisMonth o 0 si no hay estadísticas', () => {
      component.statistics = makeStats({ newThisMonth: 7 })
      expect(component.getNewThisMonthCount()).toBe(7)
      component.statistics = null
      expect(component.getNewThisMonthCount()).toBe(0)
    })
  })

  describe('helpers de paciente', () => {
    beforeEach(() => {
      component = createComponent()
    })

    it('getPatientFullName concatena nombre y apellido', () => {
      expect(component.getPatientFullName(makePatient())).toBe('Juan Perez')
    })

    it('getPatientAge calcula la edad correctamente', () => {
      const today = new Date()
      const twentyYearsAgo = new Date(today.getFullYear() - 20, today.getMonth(), today.getDate())
      const patient = makePatient({ birthDate: twentyYearsAgo })
      expect(component.getPatientAge(patient)).toBe(20)
    })

    it('getPatientAge resta 1 si el cumpleaños de este año todavía no llegó', () => {
      const today = new Date()
      const futureBirthdayThisYear = new Date(today.getFullYear() - 20, today.getMonth() + 1, today.getDate())
      const patient = makePatient({ birthDate: futureBirthdayThisYear })
      expect(component.getPatientAge(patient)).toBe(19)
    })
  })

  describe('navegación', () => {
    beforeEach(() => {
      component = createComponent()
    })

    it('createPatient navega al formulario de creación', () => {
      component.createPatient()
      expect(router.navigate).toHaveBeenCalledWith(['/dashboard/patients/new'])
    })

    it('goBack delega en Location.back()', () => {
      component.goBack()
      expect(location.back).toHaveBeenCalled()
    })

    it('viewPatient navega a la vista del paciente', () => {
      component.viewPatient(makePatient({ id: 'p9' }))
      expect(router.navigate).toHaveBeenCalledWith(['/dashboard/patients/view', 'p9'])
    })

    it('editPatient navega a la edición del paciente', () => {
      component.editPatient(makePatient({ id: 'p9' }))
      expect(router.navigate).toHaveBeenCalledWith(['/dashboard/patients/edit', 'p9'])
    })

    it('createMedicalRecord navega con patientId como query param', () => {
      component.createMedicalRecord(makePatient({ id: 'p9' }))
      expect(router.navigate).toHaveBeenCalledWith(['/dashboard/medical-records/new'], {
        queryParams: { patientId: 'p9' },
      })
    })

    it('viewMedicalHistory navega al historial del paciente', () => {
      component.viewMedicalHistory(makePatient({ id: 'p9' }))
      expect(router.navigate).toHaveBeenCalledWith(['/dashboard/medical-records/patient', 'p9', 'history'])
    })
  })

  describe('deletePatient', () => {
    beforeEach(() => {
      component = createComponent()
      component.dataSource.data = [makePatient({ id: 'p1' }), makePatient({ id: 'p2' })]
      component.totalRecords = 2
    })

    // deletePatient() es void — internamente encadena alert.fire().then(...), no retorna
    // la promesa. Se dispara sin await y se espera un microtask para que el .then() corra.
    it('si el usuario cancela, no elimina nada', async () => {
      alert.fire.mockReturnValue(Promise.resolve({ isConfirmed: false } as any))

      component.deletePatient(makePatient({ id: 'p1' }))
      await Promise.resolve()

      expect(patientsService.removePatient).not.toHaveBeenCalled()
    })

    it('si el usuario confirma, elimina, actualiza la tabla y recarga estadísticas', async () => {
      alert.fire.mockReturnValue(Promise.resolve({ isConfirmed: true } as any))
      patientsService.removePatient.mockReturnValue(of(undefined))

      component.deletePatient(makePatient({ id: 'p1' }))
      await Promise.resolve()

      expect(patientsService.removePatient).toHaveBeenCalledWith('p1')
      expect(component.dataSource.data.map(p => p.id)).toEqual(['p2'])
      expect(component.totalRecords).toBe(1)
    })

    it('si falla la eliminación, no rompe el componente (la alerta la muestra el servicio)', async () => {
      alert.fire.mockReturnValue(Promise.resolve({ isConfirmed: true } as any))
      patientsService.removePatient.mockReturnValue(throwError(() => ({ message: 'no se pudo' })))

      expect(() => component.deletePatient(makePatient({ id: 'p1' }))).not.toThrow()
      await Promise.resolve()
    })
  })

  // ─── canDeletePatient — debe coincidir con @Auth(SUPER_ADMIN, ADMIN, DOCTOR) en el backend ─

  describe('canDeletePatient', () => {
    it('true para ADMIN, DOCTOR y SUPER_ADMIN', () => {
      for (const role of [UserRoles.ADMIN, UserRoles.DOCTOR, UserRoles.SUPER_ADMIN]) {
        roles = [role]
        expect(createComponent().canDeletePatient()).toBe(true)
      }
    })

    it('false para RECEPTIONIST y NURSE — el botón no debe mentir sobre lo que el backend permite', () => {
      for (const role of [UserRoles.RECEPTIONIST, UserRoles.NURSE]) {
        roles = [role]
        expect(createComponent().canDeletePatient()).toBe(false)
      }
    })
  })
})
