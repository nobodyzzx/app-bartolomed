import { Location } from '@angular/common'
import { Component, DestroyRef, OnInit, ViewChild, inject } from '@angular/core'
import { takeUntilDestroyed } from '@angular/core/rxjs-interop'
import { MatPaginator } from '@angular/material/paginator'
import { MatSort } from '@angular/material/sort'
import { MatTableDataSource } from '@angular/material/table'
import { ordenarComoLasDemas } from '../../../../shared/utils/table-sort.util'
import { ListStateService } from '../../../../shared/services/list-state.service'
import { ActivatedRoute, Router } from '@angular/router'
import { Permission } from '@core/enums/permission.enum'
import { AlertService } from '@core/services/alert.service'
import { RoleStateService } from '@core/services/role-state.service'
import { MedicalRecord, MedicalRecordFilters, RecordStatus, RecordType } from './interfaces'
import { MedicalRecordsService } from './services/medical-records.service'
import { recordTypeIcon, recordTypeLabel } from './utils/record-type.util'

@Component({
    selector: 'app-medical-records-dashboard',
    templateUrl: './medical-records-dashboard.component.html',
    styleUrls: ['./medical-records-dashboard.component.css'],
    standalone: false
})
export class MedicalRecordsDashboardComponent implements OnInit {
  private readonly destroyRef = inject(DestroyRef)
  private alert = inject(AlertService)
  private roleState = inject(RoleStateService)
  private readonly listState = inject(ListStateService)
  private readonly route = inject(ActivatedRoute)

  /** Clave con la que se recuerda la vista de este listado. */
  private static readonly RUTA = '/dashboard/medical-records'

  /** NURSE tiene RecordsRead (entra al módulo) pero el backend solo permite escribir a DOCTOR/ADMIN. */
  get canWriteRecords(): boolean {
    return this.roleState.hasPermission(Permission.RecordsWrite)
  }

  displayedColumns: string[] = ['date', 'patient', 'type', 'chiefComplaint', 'doctor', 'status', 'actions']

  dataSource = new MatTableDataSource<MedicalRecord>([])
  totalRecords = 0

  /**
   * Por `set` y no por propiedad: la tabla vive dentro de un `@if` que solo
   * aparece cuando ya hay filas, así que en `ngAfterViewInit` el paginador y el
   * ordenador todavía no existen. Asignándolos allí quedaban en `undefined`
   * para siempre y las cabeceras no ordenaban nada.
   */
  @ViewChild(MatPaginator)
  set paginator(paginator: MatPaginator | undefined) {
    if (paginator) this.dataSource.paginator = paginator
  }

  @ViewChild(MatSort)
  set sort(sort: MatSort | undefined) {
    if (sort) this.dataSource.sort = sort
  }

  filters: MedicalRecordFilters = {}
  searchTerm = ''

  stats = { total: 0, drafts: 0, completed: 0, emergencies: 0 }
  loading = false

  readonly RecordStatus = RecordStatus

  private readonly statusColors: Record<string, string> = {
    [RecordStatus.DRAFT]:      'bg-amber-100 text-amber-800',
    [RecordStatus.COMPLETED]:  'bg-green-100 text-green-800',
    [RecordStatus.REVIEWED]:   'bg-blue-100 text-blue-800',
    [RecordStatus.ARCHIVED]:   'bg-slate-100 text-slate-700',
  }

  constructor(
    private medicalRecordsService: MedicalRecordsService,
    private router: Router,
    private location: Location,
  ) {
    ordenarComoLasDemas(this.dataSource)

    /**
     * Sin esto las cabeceras pintan la flecha y no ordenan nada. Por defecto
     * `MatTableDataSource` busca un campo con el nombre de la columna, y aquí
     * no coinciden: la columna "date" se pinta desde `createdAt`, y "patient" y
     * "doctor" son objetos —comparar objetos no da un orden—.
     */
    this.dataSource.sortingDataAccessor = (record, columna) => {
      switch (columna) {
        case 'date': return new Date(record.createdAt ?? 0).getTime()
        // Por apellido, que es como se busca a alguien en una lista.
        case 'patient': return `${record.patient?.lastName ?? ''} ${record.patient?.firstName ?? ''}`.trim().toLowerCase()
        // El nombre del médico cuelga de `personalInfo`, no de la raíz: es de
        // donde lo saca la celda.
        case 'doctor': return `${record.doctor?.personalInfo?.lastName ?? ''} ${record.doctor?.personalInfo?.firstName ?? ''}`.trim().toLowerCase()
        // La etiqueta y no el valor del enum: la columna se lee "Seguimiento",
        // no "follow_up", y ordenar por lo que no se ve desconcierta.
        case 'type': return this.getTypeText(record.type).toLowerCase()
        case 'status': return this.getStatusText(record.status).toLowerCase()
        case 'chiefComplaint': return (record.chiefComplaint ?? '').toLowerCase()
        default: return ''
      }
    }
  }

  ngOnInit(): void {
    // Volviendo de un expediente manda lo recordado: con 350 en la lista,
    // corregir uno devolvía al principio y sin filtro.
    const guardado = this.listState.recuperarSiVuelve(MedicalRecordsDashboardComponent.RUTA)
    const params = this.route.snapshot.queryParamMap
    this.searchTerm = String(guardado?.['q'] ?? params.get('q') ?? '')
    const estado = String(guardado?.['estado'] ?? params.get('estado') ?? '')
    if (estado) this.filters = { ...this.filters, status: estado as RecordStatus }
    if (String(guardado?.['urgencia'] ?? params.get('urgencia') ?? '') === '1') {
      this.filters = { ...this.filters, isEmergency: true }
    }

    this.loadMedicalRecords()
    // Las estadísticas están reservadas a médico/admin (el endpoint es
    // @Auth(DOCTOR, ADMIN)). Enfermería ve la lista de expedientes pero no las
    // tarjetas de resumen: no se piden, para no provocar un 403 que la pantalla
    // mostraba como error. Ver `canWriteRecords`.
    if (this.canWriteRecords) this.loadStats()
  }

  /**
   * `getAllMedicalRecords` y no `getMedicalRecords`: este último trae la
   * primera página que decida el backend —diez— y esta pantalla busca, ordena
   * y pagina en cliente sobre lo que reciba. El resto del historial quedaba
   * inalcanzable mientras el contador anunciaba el total de verdad.
   */
  loadMedicalRecords(): void {
    this.loading = true
    this.medicalRecordsService.getAllMedicalRecords(this.filters).pipe(takeUntilDestroyed(this.destroyRef)).subscribe({
      next: response => {
        this.dataSource.data = response.data
        this.totalRecords = response.total
        this.loading = false
      },
      error: () => {
        this.loading = false
      },
    })
  }

  loadStats(): void {
    this.medicalRecordsService.getMedicalRecordsStats().pipe(takeUntilDestroyed(this.destroyRef)).subscribe({
      next: (res: any) => {
        this.stats = {
          total:       res.total       ?? 0,
          drafts:      res.byStatus?.draft    ?? 0,
          completed:   res.byStatus?.completed ?? 0,
          emergencies: res.emergencies ?? 0,
        }
      },
      error: () => {},
    })
  }

  /**
   * El tope de páginas del servicio dejó expedientes fuera. Hay que decirlo:
   * una lista recortada que no avisa se lee como la lista entera, y en un
   * historial clínico eso es peor que no mostrarla.
   */
  get faltanRegistros(): boolean {
    return this.totalRecords > this.dataSource.data.length
  }

  applyFilter(value: string): void {
    this.searchTerm = value
    this.dataSource.filter = value.trim().toLowerCase()
    if (this.dataSource.paginator) this.dataSource.paginator.firstPage()
    this.recordarVista()
  }

  /** Deja la vista en la URL y la recuerda para cuando se vuelva de un expediente. */
  private recordarVista(): void {
    const estado = {
      q: this.searchTerm.trim() || undefined,
      estado: this.filters.status || undefined,
      urgencia: this.filters.isEmergency ? '1' : undefined,
      page: (this.dataSource.paginator?.pageIndex ?? 0) + 1,
    }
    this.listState.guardar(MedicalRecordsDashboardComponent.RUTA, estado)
    this.listState.reflejarEnUrl(this.route, estado)
  }

  showAllRecords(): void {
    this.filters = {}
    this.recordarVista()
    this.loadMedicalRecords()
  }

  showDrafts(): void {
    this.filters = { ...this.filters, status: RecordStatus.DRAFT }
    this.recordarVista()
    this.loadMedicalRecords()
  }

  showCompleted(): void {
    this.filters = { ...this.filters, status: RecordStatus.COMPLETED }
    this.recordarVista()
    this.loadMedicalRecords()
  }

  showEmergencies(): void {
    this.filters = { ...this.filters, isEmergency: true }
    this.recordarVista()
    this.loadMedicalRecords()
  }

  clearFilters(): void {
    this.filters = {}
    this.searchTerm = ''
    this.dataSource.filter = ''
    // Limpiar es explícito: no debe resucitar al volver de un expediente.
    this.listState.olvidar(MedicalRecordsDashboardComponent.RUTA)
    this.loadMedicalRecords()
  }

  createNewRecord(): void {
    this.router.navigate(['/dashboard/medical-records/new'])
  }

  viewRecord(record: MedicalRecord): void {
    this.router.navigate(['/dashboard/medical-records', record.id])
  }

  editRecord(record: MedicalRecord): void {
    this.router.navigate(['/dashboard/medical-records', record.id, 'edit'])
  }

  viewPatientHistory(patientId: string): void {
    this.router.navigate(['/dashboard/medical-records/patient', patientId, 'history'])
  }

  deleteRecord(record: MedicalRecord): void {
    this.alert
      .fire({
        title: '¿Eliminar expediente?',
        html: `¿Está seguro de eliminar este expediente?<br><br>
               <strong>Paciente:</strong> ${record.patient?.firstName} ${record.patient?.lastName}<br>
               <strong>Tipo:</strong> ${this.getTypeText(record.type)}`,
        icon: 'warning',
        showCancelButton: true,
        confirmButtonText: 'Sí, eliminar',
        cancelButtonText: 'Cancelar',
      })
      .then(result => {
        if (result.isConfirmed) {
          this.medicalRecordsService.deleteMedicalRecord(record.id!).pipe(takeUntilDestroyed(this.destroyRef)).subscribe({
            next: () => {
              this.loadMedicalRecords()
              this.loadStats()
            },
            error: () => {},
          })
        }
      })
  }

  goBack(): void {
    this.location.back()
  }

  getStatusColor(status: string): string {
    return this.statusColors[status] ?? 'bg-slate-100 text-slate-700'
  }

  getStatusText(status: RecordStatus): string {
    const labels: Record<string, string> = {
      [RecordStatus.DRAFT]:     'Borrador',
      [RecordStatus.COMPLETED]: 'Completado',
      [RecordStatus.REVIEWED]:  'Revisado',
      [RecordStatus.ARCHIVED]:  'Archivado',
    }
    return labels[status] ?? status
  }

  /** Etiqueta e icono salen del mapa compartido, para que no diverjan por pantalla. */
  getTypeText(type: RecordType): string {
    return recordTypeLabel(type)
  }

  getPatientInitials(record: MedicalRecord): string {
    const first = record.patient?.firstName?.charAt(0) ?? ''
    const last  = record.patient?.lastName?.charAt(0) ?? ''
    return (first + last).toUpperCase() || '?'
  }

  getRecordIcon(type: RecordType): string {
    return recordTypeIcon(type)
  }

}
