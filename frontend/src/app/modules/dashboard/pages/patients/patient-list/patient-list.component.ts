import { Location } from '@angular/common'
import { Component, DestroyRef, inject, OnInit, ViewChild } from '@angular/core'
import { takeUntilDestroyed } from '@angular/core/rxjs-interop'
import { MatPaginator } from '@angular/material/paginator'
import { MatSort } from '@angular/material/sort'
import { MatTableDataSource } from '@angular/material/table'
import { ordenarComoLasDemas } from '../../../../../shared/utils/table-sort.util'
import { deParams, ListStateService } from '../../../../../shared/services/list-state.service'
import { ActivatedRoute, Router } from '@angular/router'
import { Subject } from 'rxjs'
import { debounceTime, distinctUntilChanged } from 'rxjs/operators'
import { UserRoles } from '@core/enums/user-roles.enum'
import { AlertService } from '@core/services/alert.service'
import { RoleStateService } from '@core/services/role-state.service'
import { Gender, Patient, PatientStatistics } from '../interfaces'
import { PatientsService } from '../services'

/** Debe coincidir con @Auth(SUPER_ADMIN, ADMIN, DOCTOR) en DELETE /patients/:id */
const DELETE_ROLES: UserRoles[] = [UserRoles.SUPER_ADMIN, UserRoles.ADMIN, UserRoles.DOCTOR]

@Component({
    selector: 'app-patient-list',
    templateUrl: './patient-list.component.html',
    styleUrl: './patient-list.component.css',
    standalone: false
})
export class PatientListComponent implements OnInit {
  private readonly destroyRef = inject(DestroyRef)
  private readonly roleState = inject(RoleStateService)
  private readonly listState = inject(ListStateService)

  /** Clave con la que se recuerda la vista de este listado. */
  private static readonly RUTA = '/dashboard/patients'

  displayedColumns: string[] = ['documentNumber', 'name', 'age', 'gender', 'phone', 'actions']
  dataSource: MatTableDataSource<Patient>
  isLoading = false
  searchTerm = ''

  /**
   * Por `set` y no por propiedad: la tabla vive dentro de un `@if` que solo
   * aparece cuando ya hay filas, así que en `ngAfterViewInit` el paginador y el
   * ordenador todavía no existen. Asignándolos allí quedaban en `undefined`
   * para siempre y las cabeceras no ordenaban nada.
   */
  @ViewChild(MatPaginator)
  set paginatorRef(paginator: MatPaginator | undefined) {
    this.paginator = paginator
    if (!paginator) return
    this.dataSource.paginator = paginator
    if (this.paginaPedida > 1) {
      paginator.pageIndex = this.paginaPedida - 1
      this.paginaPedida = 1
    }
    paginator.page.pipe(takeUntilDestroyed(this.destroyRef)).subscribe(() => this.recordarVista())
  }

  private paginaPedida = 1

  paginator?: MatPaginator

  @ViewChild(MatSort)
  set sort(sort: MatSort | undefined) {
    if (!sort) return
    this.dataSource.sort = sort
    if (this.ordenPedido) {
      sort.active = this.ordenPedido.key
      sort.direction = this.ordenPedido.dir
      sort.sortChange.emit({ active: sort.active, direction: sort.direction })
      this.ordenPedido = null
    }
    sort.sortChange.pipe(takeUntilDestroyed(this.destroyRef)).subscribe(() => this.recordarVista())
  }

  readonly Gender = Gender
  totalRecords = 0
  activeGenderFilter: Gender | null = null
  statistics: PatientStatistics | null = null

  private searchSubject = new Subject<string>()

  constructor(
    private patientsService: PatientsService,
    private router: Router,
    private location: Location,
    private route: ActivatedRoute,
    private alert: AlertService,
  ) {
    this.dataSource = new MatTableDataSource<Patient>([])
    ordenarComoLasDemas(this.dataSource)

    /**
     * "Nombre" y "Edad" no son campos del paciente: uno se arma juntando
     * `firstName` y `lastName`, la otra se calcula de `birthDate`. Sin esto
     * `MatTableDataSource` buscaba `patient.name` y `patient.age`, no
     * encontraba nada, y las dos cabeceras pintaban la flecha sin mover una
     * sola fila.
     */
    this.dataSource.sortingDataAccessor = (patient, columna) => {
      switch (columna) {
        // Por apellido, que es como se busca a alguien en una lista.
        case 'name': return `${patient.lastName ?? ''} ${patient.firstName ?? ''}`.trim()
        // Por fecha de nacimiento y no por la edad ya calculada: es el mismo
        // orden invertido y evita recalcularla en cada comparación.
        case 'age': return patient.birthDate ? -new Date(patient.birthDate).getTime() : ''
        case 'gender': return patient.gender === Gender.MALE ? 'Masculino' : 'Femenino'
        default: return (patient as unknown as Record<string, string>)[columna] ?? ''
      }
    }
  }

  ngOnInit(): void {
    this.loadStatistics()

    this.searchSubject.pipe(
      debounceTime(350),
      distinctUntilChanged(),
      takeUntilDestroyed(this.destroyRef),
    ).subscribe(() => {
      if (this.paginator) this.paginator.firstPage()
      this.recordarVista()
      this.loadPatients()
    })

    this.route.queryParamMap.pipe(takeUntilDestroyed(this.destroyRef)).subscribe(params => {
      // Reflejar la vista cambia los parámetros y despierta esta misma
      // suscripción; recargar entonces reasigna los datos y devuelve el
      // paginador a la primera página. Se veía como que avanzar de página no
      // hacía nada: la URL decía `page=2` y la tabla seguía en «1 – 10 de 18».
      if (this.listState.consumirEscrituraPropia()) return

      // Volviendo de una ficha manda lo recordado: los 37 sitios que navegan al
      // listado por su ruta pelada llegan sin ningún parámetro, y sin esto la
      // vuelta de editar dejaba la lista al principio y sin filtro.
      const guardado = this.listState.recuperarSiVuelve(PatientListComponent.RUTA)
      const estado = guardado ?? deParams({
        q: params.get('q') ?? undefined,
        sort: params.get('sort') ?? undefined,
        dir: params.get('dir') ?? undefined,
        sexo: params.get('sexo') ?? undefined,
      })

      this.searchTerm = (estado.q ?? '').trim()
      this.ordenPedido = estado.sort && estado.dir ? { key: estado.sort, dir: estado.dir } : null
      this.paginaPedida = Number(guardado?.['page'] ?? params.get('page') ?? 1) || 1
      const sexo = (guardado?.['sexo'] ?? params.get('sexo')) as Gender | undefined
      this.activeGenderFilter = sexo === Gender.MALE || sexo === Gender.FEMALE ? sexo : null

      this.loadPatients()
    })
  }

  /**
   * Orden llegado de la URL o de la vuelta de una ficha. Se aplica cuando el
   * ordenador existe —vive dentro de un `@if`—, no antes.
   */
  private ordenPedido: { key: string; dir: 'asc' | 'desc' } | null = null

  /** Deja la vista en la URL y la recuerda para cuando se vuelva de una ficha. */
  private recordarVista(): void {
    const estado = {
      q: this.searchTerm.trim() || undefined,
      sexo: this.activeGenderFilter ?? undefined,
      sort: this.dataSource.sort?.active || undefined,
      dir: (this.dataSource.sort?.direction || undefined) as 'asc' | 'desc' | undefined,
      page: (this.paginator?.pageIndex ?? 0) + 1,
    }
    this.listState.guardar(PatientListComponent.RUTA, estado)
    this.listState.reflejarEnUrl(this.route, estado)
  }

  loadStatistics(): void {
    this.patientsService.getPatientStatistics().pipe(takeUntilDestroyed(this.destroyRef)).subscribe({
      next: stats => { this.statistics = stats },
      error: () => { /* non-critical */ },
    })
  }

  /**
   * Se traen todos los pacientes y la tabla ordena y pagina en el navegador.
   *
   * Antes se pedía una página al servidor y el orden era de este lado, así que
   * ordenar por una cabecera solo reordenaba los 25 cargados: los demás
   * quedaban fuera del orden y la lista parecía ordenada sin estarlo. El
   * backend no admite ordenar, de modo que o el orden ve el conjunto entero o
   * engaña.
   */
  loadPatients(): void {
    this.isLoading = true

    if (this.searchTerm.trim()) {
      this.patientsService.searchPatients(this.searchTerm).pipe(takeUntilDestroyed(this.destroyRef)).subscribe({
        next: patients => {
          this.dataSource.data = patients
          this.totalRecords = patients.length
          this.isLoading = false
        },
        error: () => {
          this.isLoading = false
        },
      })
    } else {
      this.patientsService.getAllPatients(this.activeGenderFilter ?? undefined)
        .pipe(takeUntilDestroyed(this.destroyRef)).subscribe({
          next: result => {
            this.dataSource.data = result.data
            this.totalRecords = result.total
            this.isLoading = false
          },
          error: () => {
            this.isLoading = false
          },
        })
    }
  }

  /**
   * El tope de páginas del servicio dejó pacientes fuera. Se avisa: una lista
   * recortada que no lo dice se lee como la lista entera.
   */
  get faltanPacientes(): boolean {
    return this.totalRecords > this.dataSource.data.length
  }

  applyFilter(value: string): void {
    this.searchTerm = value
    this.searchSubject.next(value)
  }

  clearFilters(): void {
    this.searchTerm = ''
    this.activeGenderFilter = null
    if (this.paginator) this.paginator.firstPage()
    // Limpiar es una decisión explícita: se olvida también para la vuelta.
    this.listState.olvidar(PatientListComponent.RUTA)
    this.listState.reflejarEnUrl(this.route, { q: undefined, sexo: undefined, sort: undefined, dir: undefined, page: 1 })
    this.loadPatients()
  }

  setGenderFilter(gender: Gender | null): void {
    this.activeGenderFilter = gender
    if (this.paginator) this.paginator.firstPage()
    this.recordarVista()
    this.loadPatients()
  }

  getMaleCount(): number {
    return this.getGenderCount(Gender.MALE)
  }

  getFemaleCount(): number {
    return this.getGenderCount(Gender.FEMALE)
  }

  private getGenderCount(gender: Gender): number {
    const stat = this.statistics?.genderStats.find(s => s.gender === gender)
    return stat ? Number(stat.count) : 0
  }

  getNewThisMonthCount(): number {
    return this.statistics?.newThisMonth ?? 0
  }

  getPatientFullName(patient: Patient): string {
    return `${patient.firstName} ${patient.lastName}`
  }

  getPatientAge(patient: Patient): number {
    const today = new Date()
    const birthDate = new Date(patient.birthDate)
    let age = today.getFullYear() - birthDate.getFullYear()
    const monthDiff = today.getMonth() - birthDate.getMonth()
    if (monthDiff < 0 || (monthDiff === 0 && today.getDate() < birthDate.getDate())) {
      age--
    }
    return age
  }

  createPatient(): void {
    this.router.navigate(['/dashboard/patients/new'])
  }

  goBack(): void {
    this.location.back()
  }

  viewPatient(patient: Patient): void {
    this.router.navigate(['/dashboard/patients/view', patient.id])
  }

  editPatient(patient: Patient): void {
    this.router.navigate(['/dashboard/patients/edit', patient.id])
  }

  canDeletePatient(): boolean {
    return this.roleState.hasAnyRole(DELETE_ROLES)
  }

  deletePatient(patient: Patient): void {
    this.alert
      .fire({
        title: '¿Eliminar paciente?',
        text: `¿Está seguro de eliminar a ${this.getPatientFullName(patient)}? Esta acción no se puede deshacer.`,
        icon: 'warning',
        showCancelButton: true,
        confirmButtonText: 'Sí, eliminar',
        cancelButtonText: 'Cancelar',
      })
      .then(result => {
        if (result.isConfirmed) {
          this.patientsService.removePatient(patient.id).pipe(takeUntilDestroyed(this.destroyRef)).subscribe({
            next: () => {
              this.dataSource.data = this.dataSource.data.filter(p => p.id !== patient.id)
              this.totalRecords--
              this.loadStatistics()
            },
            error: () => {},
          })
        }
      })
  }

  createMedicalRecord(patient: Patient): void {
    this.router.navigate(['/dashboard/medical-records/new'], {
      queryParams: { patientId: patient.id },
    })
  }

  viewMedicalHistory(patient: Patient): void {
    this.router.navigate(['/dashboard/medical-records/patient', patient.id, 'history'])
  }
}
