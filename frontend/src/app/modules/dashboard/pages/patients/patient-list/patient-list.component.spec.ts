import { Location } from '@angular/common'
import { TestBed } from '@angular/core/testing'
import { ActivatedRoute, convertToParamMap, Router } from '@angular/router'
import { UserRoles } from '@core/enums/user-roles.enum'
import { AlertService } from '@core/services/alert.service'
import { RoleStateService } from '@core/services/role-state.service'
import { of, ReplaySubject, throwError } from 'rxjs'
import { Gender, Patient, PatientStatistics } from '../interfaces'
import { PatientsService } from '../services'
import { ListStateService } from '../../../../../shared/services/list-state.service'
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

  let listState: SpyObj<ListStateService>

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
        // Doble del recuerdo de la vista: aquí se prueba el listado, no el
        // servicio, que tiene su propio spec.
        { provide: ListStateService, useValue: listState },
      ],
    })
    return TestBed.inject(PatientListComponent)
  }

  beforeEach(() => {
    patientsService = createSpyObj('PatientsService', [
      'getPatientStatistics',
      'getAllPatients',
      'searchPatients',
      'removePatient',
    ])
    router = createSpyObj('Router', ['navigate'])
    location = createSpyObj('Location', ['back'])
    alert = createSpyObj('AlertService', ['error', 'success', 'fire'])
    listState = createSpyObj<ListStateService>('ListStateService', [
      'guardar', 'olvidar', 'recuperarSiVuelve', 'reflejarEnUrl', 'consumirEscrituraPropia',
    ])
    listState.recuperarSiVuelve.mockReturnValue(undefined)
    listState.consumirEscrituraPropia.mockReturnValue(false)
    queryParamMap$ = new ReplaySubject(1)
    queryParamMap$.next(convertToParamMap({}))
    roles = [UserRoles.ADMIN]

    patientsService.getPatientStatistics.mockReturnValue(of(makeStats()))
    patientsService.getAllPatients.mockReturnValue(of({ data: [makePatient()], total: 1, page: 1, limit: 100 }))
    patientsService.searchPatients.mockReturnValue(of([makePatient()]))
  })

  describe('ngOnInit', () => {
    it('carga estadísticas y pacientes vía el query param q', () => {
      component = createComponent()
      component.ngOnInit()

      expect(component.statistics?.totalPatients).toBe(10)
      expect(patientsService.getAllPatients).toHaveBeenCalled()
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

  /**
   * Al abrir una ficha Angular destruye el listado; al volver se construye otro
   * en blanco. Filtrar, avanzar de página, corregir un paciente y aparecer al
   * principio de la lista sin filtro era el síntoma.
   */
  describe('volver de una ficha', () => {
    it('restaura el filtro recordado en vez de lo que traiga la URL', () => {
      listState.recuperarSiVuelve.mockReturnValue({ q: 'mamani', sexo: Gender.FEMALE })

      component = createComponent()
      component.ngOnInit()

      expect(component.searchTerm).toBe('mamani')
      expect(component.activeGenderFilter).toBe(Gender.FEMALE)
    })

    it('sin nada recordado, lee la URL', () => {
      listState.recuperarSiVuelve.mockReturnValue(undefined)
      queryParamMap$.next(convertToParamMap({ q: 'juan', sexo: Gender.MALE }))

      component = createComponent()
      component.ngOnInit()

      expect(component.searchTerm).toBe('juan')
      expect(component.activeGenderFilter).toBe(Gender.MALE)
    })

    it('un sexo que no existe no deja el filtro en un valor inventado', () => {
      queryParamMap$.next(convertToParamMap({ sexo: 'lo-que-sea' }))

      component = createComponent()
      component.ngOnInit()

      expect(component.activeGenderFilter).toBeNull()
    })

    it('cambiar el filtro deja la vista recordada y en la URL', () => {
      component = createComponent()
      component.ngOnInit()

      component.setGenderFilter(Gender.FEMALE)

      expect(listState.guardar).toHaveBeenCalledWith(
        '/dashboard/patients',
        expect.objectContaining({ sexo: Gender.FEMALE }),
      )
      expect(listState.reflejarEnUrl).toHaveBeenCalled()
    })

    /**
     * Reflejar la vista cambia los parámetros y despierta la misma suscripción
     * que recarga: sin ignorarlo, avanzar de página se deshacía solo.
     */
    it('no recarga cuando el cambio de parámetros lo escribió la propia pantalla', () => {
      component = createComponent()
      component.ngOnInit()
      patientsService.getAllPatients.mockClear()

      listState.consumirEscrituraPropia.mockReturnValue(true)
      queryParamMap$.next(convertToParamMap({ page: '2' }))

      expect(patientsService.getAllPatients).not.toHaveBeenCalled()
    })

    /** Limpiar es explícito: no debe resucitar al volver de editar. */
    it('limpiar los filtros olvida también lo recordado', () => {
      component = createComponent()
      component.ngOnInit()

      component.clearFilters()

      expect(listState.olvidar).toHaveBeenCalledWith('/dashboard/patients')
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
      patientsService.getAllPatients.mockClear()
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

    it('dispara loadPatients tras 350ms', () => {
      component.applyFilter('juan')
      vi.advanceTimersByTime(350)

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

    /**
     * Todos y no una página: el orden lo hace el navegador —el backend no lo
     * admite— y ordenando solo la página cargada la lista parece ordenada sin
     * estarlo.
     */
    it('con searchTerm vacío, pide todos los pacientes con el filtro de sexo', () => {
      component.activeGenderFilter = Gender.FEMALE
      component.searchTerm = ''

      component.loadPatients()

      expect(patientsService.getAllPatients).toHaveBeenCalledWith(Gender.FEMALE)
      expect(component.totalRecords).toBe(1)
      expect(component.isLoading).toBe(false)
    })

    it('con searchTerm, usa searchPatients en vez del listado completo', () => {
      component.searchTerm = 'juan'
      component.loadPatients()

      expect(patientsService.searchPatients).toHaveBeenCalledWith('juan')
      expect(patientsService.getAllPatients).not.toHaveBeenCalled()
    })

    it('en error de carga, apaga isLoading (la alerta la muestra el servicio)', () => {
      patientsService.getAllPatients.mockReturnValue(throwError(() => ({ message: 'caído' })))
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
      patientsService.getAllPatients.mockClear()
    })

    // El paginador ya no recarga del servidor: recorta en cliente sobre el
    // conjunto entero, que es lo que permite ordenar de verdad.

    it('clearFilters resetea término y filtro de sexo', () => {
      component.searchTerm = 'juan'
      component.activeGenderFilter = Gender.MALE

      component.clearFilters()

      expect(component.searchTerm).toBe('')
      expect(component.activeGenderFilter).toBeNull()
    })

    it('setGenderFilter aplica el filtro y recarga', () => {
      component.setGenderFilter(Gender.FEMALE)

      expect(component.activeGenderFilter).toBe(Gender.FEMALE)
      expect(patientsService.getAllPatients).toHaveBeenCalledWith(Gender.FEMALE)
    })

    /** El tope de páginas del servicio puede dejar pacientes fuera; hay que decirlo. */
    it('avisa cuando el total del servidor supera lo cargado', () => {
      patientsService.getAllPatients.mockReturnValue(
        of({ data: [makePatient()], total: 300, page: 1, limit: 100 }),
      )

      component.loadPatients()

      expect(component.faltanPacientes).toBe(true)
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
