import { Component, computed, DestroyRef, ElementRef, inject, signal } from '@angular/core'
import { takeUntilDestroyed } from '@angular/core/rxjs-interop'
import { AbstractControl, FormArray, FormControl, FormGroup, Validators } from '@angular/forms'
import { ActivatedRoute, Router } from '@angular/router'
import { AlertService } from '@core/services/alert.service'
import { of } from 'rxjs'
import {
  catchError,
  debounceTime,
  distinctUntilChanged,
  filter,
  map,
  switchMap,
  tap,
} from 'rxjs/operators'
import { toLocalISODate } from '../../../../shared/utils/date-format.util'
import { countInvalidFields, scrollToFirstInvalidField } from '../../../../shared/utils/form-errors.util'
import { Patient } from '../patients/interfaces'
import { PatientsService } from '../patients/services/patients.service'
import { UsersService } from '../admin/users/users.service'
import { ClinicContextService } from '../../../clinics/services/clinic-context.service'
import { CanComponentDeactivate, confirmDiscardChanges } from '../../../../core/guards/can-deactivate.guard'
import { LAB_MODULE_CONFIG } from './lab-module.config'
import { inferSpecimen } from './lab-specimen.util'
import { LabOrdersService } from './lab-orders.service'
import {
  labCategoryLabel,
  labCategoryRank,
  ServicePriceCatalogItem,
  ServicePricesService,
  turnaroundLabel,
} from '../service-prices/service-prices.service'

@Component({
    selector: 'app-lab-order-form',
    templateUrl: './lab-order-form.component.html',
    standalone: false
})
export class LabOrderFormComponent implements CanComponentDeactivate {
  private allowNavigationOnce = false
  route = inject(ActivatedRoute)
  router = inject(Router)
  private svc = inject(LabOrdersService)
  private alert = inject(AlertService)
  private patientsService = inject(PatientsService)
  private usersService = inject(UsersService)
  private clinicCtx = inject(ClinicContextService)
  private servicePricesService = inject(ServicePricesService)
  private elRef = inject(ElementRef)
  private destroyRef = inject(DestroyRef)
  readonly config = inject(LAB_MODULE_CONFIG)
  readonly texts = this.config.texts

  form = new FormGroup({
    orderNumber: new FormControl('', { nonNullable: true, validators: [Validators.required] }),
    // Lo rellena el buscador (`patientSearch`), no el usuario: aquí solo viaja
    // el id. La obligatoriedad la valida `patientSearch`, que es el visible.
    patientId: new FormControl('', { nonNullable: true }),
    doctorId: new FormControl({ value: '', disabled: true }, { nonNullable: true, validators: [Validators.required] }),
    clinicId: new FormControl('', { nonNullable: true, validators: [Validators.required] }),
    orderDate: new FormControl(new Date(), { nonNullable: true, validators: [Validators.required] }),
    isUrgent: new FormControl(false, { nonNullable: true }),
    clinicalNotes: new FormControl(''),
    // Solo se usan en la solicitud externa (ver `applyExternalMode`), pero se
    // declaran aquí porque el FormGroup está tipado y `addControl` no admite
    // nombres que no estén en su tipo.
    referringDoctorName: new FormControl('', { nonNullable: true }),
    patientName: new FormControl('', { nonNullable: true }),
    items: new FormArray<FormGroup<any>>([]),
  })

  loading = false
  isEdit = signal(false)
  isExternal = signal(false)

  /**
   * El paciente se busca contra el servidor, no se elige de una lista cargada
   * entera: `findAll()` traía solo la primera página (25) y el resto de fichas
   * eran invisibles.
   *
   * `patientSearch` es el control visible (texto o paciente elegido) y
   * `form.patientId` sigue siendo el valor que viaja al backend.
   */
  patientSearch = new FormControl<string | Patient>('', { nonNullable: true })
  patientResults = signal<Patient[]>([])
  patientSearching = signal(false)
  selectedPatient = signal<Patient | null>(null)

  doctors: any[] = []
  labCatalog: ServicePriceCatalogItem[] = []

  // ── Catálogo de estudios ────────────────────────────────────────────────
  // Con 110 estudios en 10 categorías, el selector necesita grupos y búsqueda.

  catalogQuery = signal('')
  private catalogSignal = signal<ServicePriceCatalogItem[]>([])

  filteredCatalog = computed(() => {
    const q = this.catalogQuery().trim().toLowerCase()
    const items = this.catalogSignal().filter(
      p => !q || p.name.toLowerCase().includes(q) || p.code.toLowerCase().includes(q),
    )

    const grupos = new Map<string, { key: string; label: string; items: ServicePriceCatalogItem[] }>()
    for (const item of items) {
      const key = item.labCategory ?? ''
      // Sin categoría clínica (los estudios de gabinete no la tienen) el grupo
      // se rotula con el nombre del módulo, no con un genérico "Otros estudios".
      const label = item.labCategory ? labCategoryLabel(key) : this.texts.listTitle
      if (!grupos.has(key)) grupos.set(key, { key, label, items: [] })
      grupos.get(key)!.items.push(item)
    }
    return [...grupos.values()].sort((a, b) => labCategoryRank(a.key) - labCategoryRank(b.key))
  })

  /** El filtro no debe sobrevivir al cierre: al reabrir se ve todo otra vez. */
  onCatalogOpened(abierto: boolean): void {
    if (!abierto) this.catalogQuery.set('')
  }

  turnaround(price: ServicePriceCatalogItem): string {
    return turnaroundLabel(price)
  }

  /** Categoría clínica del estudio elegido, tal como la nombra el tarifario. */
  selectedLabCategory(group: AbstractControl): string {
    const id = group.get('servicePriceId')?.value
    const elegido = this.labCatalog.find(p => p.id === id)
    return elegido?.labCategory ? labCategoryLabel(elegido.labCategory) : ''
  }

  /** Cuándo estará listo el estudio ya elegido, para poder decírselo al paciente. */
  selectedTurnaround(group: AbstractControl): string {
    const id = group.get('servicePriceId')?.value
    const elegido = this.labCatalog.find(p => p.id === id)
    return elegido ? turnaroundLabel(elegido) : ''
  }

  /** Texto que se muestra en el campo una vez elegido el paciente. */
  displayPatient = (value: Patient | string | null): string => {
    if (!value || typeof value === 'string') return (value as string) ?? ''
    return `${value.firstName} ${value.lastName} – ${value.documentNumber}`
  }

  private watchPatientSearch(): void {
    this.patientSearch.valueChanges
      .pipe(
        // Al elegir una opción el control emite el objeto: eso no es una
        // búsqueda nueva, ya lo trata `onPatientSelected`.
        filter((v): v is string => typeof v === 'string'),
        map(term => term.trim()),
        tap(term => {
          // Si borra lo escrito, el paciente elegido deja de estar elegido —
          // si no, quedaría un `patientId` que ya no se corresponde con lo
          // que muestra la pantalla.
          if (this.selectedPatient() && !term) this.clearPatient()
        }),
        filter(term => term.length >= 2),
        debounceTime(300),
        distinctUntilChanged(),
        tap(() => this.patientSearching.set(true)),
        switchMap(term =>
          this.patientsService.searchPatients(term).pipe(catchError(() => of([] as Patient[]))),
        ),
        takeUntilDestroyed(this.destroyRef),
      )
      .subscribe(results => {
        this.patientResults.set(results ?? [])
        this.patientSearching.set(false)
      })
  }

  onPatientSelected(patient: Patient): void {
    this.selectedPatient.set(patient)
    this.form.get('patientId')?.setValue(patient.id!)
    this.syncPatientNameRequirement()
  }

  clearPatient(): void {
    this.selectedPatient.set(null)
    this.patientResults.set([])
    this.patientSearch.setValue('', { emitEvent: false })
    this.form.get('patientId')?.setValue('')
    this.syncPatientNameRequirement()
  }

  goBack(): void {
    this.router.navigate([this.config.routeBase])
  }

  async canDeactivate(): Promise<boolean> {
    if (this.allowNavigationOnce) {
      this.allowNavigationOnce = false
      return true
    }
    if (!this.form?.dirty) return true
    return confirmDiscardChanges(this.alert)
  }

  ngOnInit(): void {
    // Modo externo: el paciente llega con una orden en papel de otro
    // consultorio, o sin ninguna. No hay médico de la casa que la firme, así
    // que se pide el solicitante como texto y el paciente puede quedar en
    // nombre libre si no tiene ficha.
    this.isExternal.set(this.route.snapshot.queryParamMap.get('external') === '1')
    // En una orden interna el paciente es obligatorio; en la externa puede no
    // tener ficha y basta con su nombre.
    if (this.isExternal()) this.applyExternalMode()
    else this.patientSearch.setValidators([Validators.required])

    this.watchPatientSearch()
    this.loadOptions()
    this.autoGenerateNumber()
    // Sin modo edición: una vez creada, la orden solo se modifica vía estado/resultado
    // (ver LabOrdersService.update — no permite editar órdenes completadas/canceladas,
    // y los ítems no se reemplazan tras la creación).
    if (this.items.length === 0) this.addItem()
  }

  /**
   * En modo externo `doctorId` deja de existir como requisito y aparecen dos
   * campos nuevos: quién solicitó (obligatorio) y el nombre libre del paciente,
   * que solo se exige cuando no se eligió ficha.
   */
  private applyExternalMode(): void {
    const doctorCtrl = this.form.get('doctorId')
    doctorCtrl?.clearValidators()
    doctorCtrl?.disable({ emitEvent: false })
    doctorCtrl?.updateValueAndValidity({ emitEvent: false })

    this.patientSearch.clearValidators()
    this.patientSearch.updateValueAndValidity({ emitEvent: false })

    const referringCtrl = this.form.get('referringDoctorName')
    referringCtrl?.setValidators([Validators.required, Validators.minLength(3)])
    referringCtrl?.updateValueAndValidity({ emitEvent: false })

    this.syncPatientNameRequirement()
  }

  /** Sin ficha elegida, el nombre libre pasa a ser obligatorio, y al revés. */
  syncPatientNameRequirement(): void {
    if (!this.isExternal()) return
    const nameCtrl = this.form.get('patientName')
    if (!nameCtrl) return
    if (this.form.get('patientId')?.value) {
      nameCtrl.clearValidators()
    } else {
      nameCtrl.setValidators([Validators.required, Validators.minLength(3)])
    }
    nameCtrl.updateValueAndValidity({ emitEvent: false })
  }

  autoGenerateNumber() {
    const now = new Date()
    const pad = (n: number) => n.toString().padStart(2, '0')
    const value = `${this.config.orderPrefix}-${now.getFullYear()}${pad(now.getMonth() + 1)}${pad(now.getDate())}-${pad(now.getHours())}${pad(now.getMinutes())}${pad(now.getSeconds())}`
    this.form.get('orderNumber')?.setValue(value)
  }

  get items() {
    return this.form.get('items') as FormArray
  }

  addItem() {
    const group = new FormGroup({
      // El estudio se elige del tarifario en vez de escribirse: con texto libre,
      // cualquier nombre que no calzara exactamente con el catálogo dejaba la
      // orden sin precio y, por tanto, sin cargo — en silencio.
      servicePriceId: new FormControl('', { nonNullable: true, validators: [Validators.required] }),
      testName: new FormControl('', { nonNullable: true }),
      // Sin muestra que tomar, el estudio es de gabinete: se rotula como
      // imagenología y no se le adivina ninguna muestra.
      category: new FormControl(this.config.hasSpecimen ? 'blood' : 'imaging', {
        nonNullable: true,
        validators: [Validators.required],
      }),
      specimenType: new FormControl(''),
    })
    this.items.push(group)
  }

  /**
   * Copia el nombre del catálogo al ítem: la orden guarda con qué se pidió.
   * Y ajusta la muestra, que antes se quedaba siempre en "Sangre" por ser el
   * valor por defecto — un examen de orina salía rotulado como sangre en la
   * pantalla y en el informe impreso. Ambos campos siguen siendo editables:
   * esto solo evita el error por omisión.
   */
  onTestSelected(group: AbstractControl, servicePriceId: string) {
    const chosen = this.labCatalog.find(item => item.id === servicePriceId)
    group.get('testName')?.setValue(chosen?.name ?? '')

    if (!chosen || !this.config.hasSpecimen) return
    const muestra = inferSpecimen(chosen.name, chosen.labCategory)
    group.get('category')?.setValue(muestra.category)
    group.get('specimenType')?.setValue(muestra.specimenType)
  }

  removeItem(i: number) {
    this.items.removeAt(i)
  }

  private loadOptions() {
    // Los pacientes ya no se cargan de golpe: se buscan contra el servidor
    // desde `watchPatientSearch`.
    this.usersService.getClinicalStaff().subscribe({
      next: staff => {
        this.doctors = (staff || []).filter(u => (u.roles || []).includes('doctor'))
        this.updateSelectControlDisabled('doctorId', this.doctors.length)
      },
      error: () => {
        this.doctors = []
        this.updateSelectControlDisabled('doctorId', 0)
      },
    })
    this.servicePricesService.catalog(this.config.serviceCategory).subscribe({
      next: catalog => {
        this.labCatalog = catalog || []
        this.catalogSignal.set(this.labCatalog)
      },
      error: () => {
        this.labCatalog = []
        this.catalogSignal.set([])
      },
    })
    // La clínica sale del contexto (el selector del header), no de un campo
    // del formulario: el backend rechaza cualquier otra con 400.
    const ctxId = this.clinicCtx.clinicId
    if (ctxId) {
      this.form.get('clinicId')?.setValue(ctxId)
      return
    }
    // Sin contexto no se puede emitir la orden; se avisa en vez de dejar que
    // el backend responda un 400 que la pantalla no sabría explicar.
    this.alert.error(
      'Sin clínica seleccionada',
      'Elige una clínica en la barra superior antes de registrar la orden.',
    )
  }

  private updateSelectControlDisabled(controlName: string, optionsLength: number): void {
    const control = this.form.get(controlName)
    if (!control) return
    if (optionsLength > 0) {
      control.enable({ emitEvent: false })
    } else {
      control.disable({ emitEvent: false })
    }
  }

  getDoctorName(doctor: any): string {
    const firstName = doctor.personalInfo?.firstName || ''
    const lastName = doctor.personalInfo?.lastName || ''
    return `${firstName} ${lastName}`.trim() || doctor.email
  }

  submit() {
    // `patientSearch` no está en el FormGroup, así que hay que comprobarlo
    // aparte o una orden interna se enviaría sin paciente.
    if (this.form.invalid || this.patientSearch.invalid) {
      this.form.markAllAsTouched()
      this.patientSearch.markAsTouched()
      scrollToFirstInvalidField(this.elRef.nativeElement as HTMLElement)
      return
    }

    const v = this.form.getRawValue()
    // Componentes locales, no ISO: el datepicker arrastra la hora actual y
    // pasado el mediodía UTC la orden se guardaba fechada al día siguiente.
    const orderDate = toLocalISODate(v.orderDate)

    const payload: any = {
      orderNumber: v.orderNumber,
      orderDate,
      patientId: v.patientId || undefined,
      clinicId: v.clinicId,
      isUrgent: v.isUrgent,
      clinicalNotes: v.clinicalNotes || undefined,
      items: (v.items || []).map((it: any) => ({
        servicePriceId: it.servicePriceId,
        testName: it.testName,
        category: it.category,
        specimenType: it.specimenType || undefined,
      })),
    }

    if (this.isExternal()) {
      payload.referringDoctorName = v.referringDoctorName?.trim()
      // Solo se manda el nombre libre si no hay ficha: con las dos cosas, el
      // backend se queda con la ficha y el texto quedaría muerto.
      if (!payload.patientId) payload.patientName = v.patientName?.trim()
    } else {
      payload.doctorId = v.doctorId
    }

    this.loading = true
    const request$ = this.isExternal() ? this.svc.createExternal(payload) : this.svc.create(payload)
    request$.subscribe({
      next: (res: any) => {
        this.loading = false
        this.allowNavigationOnce = true
        // El aviso de éxito lo emite el servicio, como en el resto del proyecto.
        // Duplicarlo aquí sacaba dos toasts por la misma acción, y el `.then()`
        // no aportaba nada: `AlertService.success()` devuelve una promesa ya
        // resuelta, así que la navegación ocurría igual de inmediata.
        this.router.navigate([this.config.routeBase, res.id])
      },
      error: () => (this.loading = false),
    })
  }

  infoErrorCount(): number {
    const campos = this.isExternal()
      ? ['clinicId', 'orderNumber', 'patientName', 'referringDoctorName', 'orderDate']
      : ['clinicId', 'orderNumber', 'doctorId', 'orderDate']
    // `patientSearch` vive fuera del FormGroup, así que se cuenta aparte.
    return countInvalidFields(this.form, campos) + (this.patientSearch.invalid ? 1 : 0)
  }

  itemsErrorCount(): number {
    return this.items.controls.reduce((total, item) => total + countInvalidFields(item as FormGroup), 0)
  }
}
