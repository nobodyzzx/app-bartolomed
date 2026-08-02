import { Component, DestroyRef, ElementRef, inject, OnInit } from '@angular/core'
import { takeUntilDestroyed } from '@angular/core/rxjs-interop'
import { FormBuilder, FormGroup, Validators } from '@angular/forms'
import { ActivatedRoute, Router } from '@angular/router'
import { forkJoin, of } from 'rxjs'
import { catchError, switchMap } from 'rxjs/operators'
import { Permission } from '@core/enums/permission.enum'
import { RoleStateService } from '@core/services/role-state.service'
import { AlertService } from '../../../../../core/services/alert.service'
import { CanComponentDeactivate, confirmDiscardChanges } from '../../../../../core/guards/can-deactivate.guard'
import { countInvalidFields, scrollToFirstInvalidField } from '../../../../../shared/utils/form-errors.util'
import { VALIDATION_PATTERNS } from '../../../../../shared/validators/validation-patterns'
import { ClinicContextService } from '../../../../clinics/services/clinic-context.service'
import { Clinic } from '../../admin/clinics/interfaces/clinic.interface'
import { ClinicsService } from '../../admin/clinics/services'
import { AppointmentsService } from '../../appointments/services/appointments.service'
import { BillingService } from '../../billing/billing.service'
import { MedicalRecordsService } from '../../medical-records/services/medical-records.service'
import { PrescriptionsService } from '../../prescriptions/prescriptions.service'
import { BloodType, CreatePatientDto, Gender, MaritalStatus, Patient } from '../interfaces'
import { PatientsService } from '../services'

interface RelatedCounts {
  appointments: number
  medicalRecords: number
  prescriptions: number
  invoices: number
}

@Component({
    selector: 'app-patient-form',
    templateUrl: './patient-form.component.html',
    standalone: false
})
export class PatientFormComponent implements OnInit, CanComponentDeactivate {
  private readonly destroyRef = inject(DestroyRef)
  private readonly elRef = inject(ElementRef)

  // Stepper form groups
  personalInfoForm!: FormGroup
  contactInfoForm!: FormGroup
  emergencyContactForm!: FormGroup
  insuranceForm!: FormGroup

  // Loading states
  isLoading = false
  isSaving = false

  // Edit mode
  isEditMode = false
  isViewMode = false
  patientId: string | null = null

  // Accesos rápidos (solo en modo vista) — conteos de datos relacionados del paciente
  relatedCounts: RelatedCounts = { appointments: 0, medicalRecords: 0, prescriptions: 0, invoices: 0 }
  isLoadingRelated = false

  // Marca puesta antes de cualquier navegación intencional para que el
  // canDeactivate guard no vuelva a preguntar (el usuario ya decidió en su
  // propio diálogo o terminó de guardar). Ver método `canDeactivate()`.
  private allowNavigationOnce = false

  // Clinics for select
  clinics: Clinic[] = []
  isClinicsLoading = false

  // Fase 2 rediseño: Grupo Sanguíneo/Estado Civil/Ocupación arrancan ocultos para
  // reducir la densidad visual de "Información Personal" — se auto-expande en
  // populateForms() si el paciente ya tiene alguno de estos datos cargados.
  showMorePersonalFields = false

  // Contexto de clínica (si existe, bloquea selector)
  public readonly ctxClinicId: string | null = null

  // Límites del datepicker de fecha de nacimiento: sin fechas futuras ni edades irreales (>150 años)
  protected readonly today = new Date()
  protected readonly minBirthDate = new Date(
    this.today.getFullYear() - 150,
    this.today.getMonth(),
    this.today.getDate(),
  )

  // Options for dropdowns
  protected readonly genderOptions = [
    { value: Gender.MALE, label: 'Masculino' },
    { value: Gender.FEMALE, label: 'Femenino' },
  ]

  protected readonly maritalStatusOptions = [
    { value: MaritalStatus.SINGLE, label: 'Soltero/a' },
    { value: MaritalStatus.MARRIED, label: 'Casado/a' },
    { value: MaritalStatus.DIVORCED, label: 'Divorciado/a' },
    { value: MaritalStatus.WIDOWED, label: 'Viudo/a' },
    { value: MaritalStatus.OTHER, label: 'Otro' },
  ]

  protected readonly bloodTypeOptions = [
    { value: BloodType.A_POSITIVE, label: 'A+' },
    { value: BloodType.A_NEGATIVE, label: 'A-' },
    { value: BloodType.B_POSITIVE, label: 'B+' },
    { value: BloodType.B_NEGATIVE, label: 'B-' },
    { value: BloodType.AB_POSITIVE, label: 'AB+' },
    { value: BloodType.AB_NEGATIVE, label: 'AB-' },
    { value: BloodType.O_POSITIVE, label: 'O+' },
    { value: BloodType.O_NEGATIVE, label: 'O-' },
  ]

  // País, departamento y ciudad — app de alcance nacional (Bolivia), por defecto La Paz/Yungas
  protected readonly departmentOptions = [
    'La Paz', 'Cochabamba', 'Santa Cruz', 'Oruro', 'Potosí', 'Chuquisaca', 'Tarija', 'Beni', 'Pando',
  ]
  protected readonly countryOptions = [
    'Bolivia', 'Perú', 'Chile', 'Argentina', 'Brasil', 'Paraguay', 'Colombia', 'Ecuador',
  ]
  // Ciudades principales de La Paz + municipios de Sud Yungas (zona de cobertura de las clínicas seed)
  protected readonly cityOptions = [
    'La Paz', 'El Alto', 'Viacha', 'Achocalla', 'Coroico', 'Caranavi', 'Copacabana', 'Sorata', 'Guanay',
    'Palos Blancos', 'Chulumani', 'Irupana', 'Yanacachi', 'Cajuata',
  ]

  filteredCountries(): string[] {
    return this.filterOptions(this.countryOptions, this.contactInfoForm?.get('country')?.value)
  }

  filteredCities(): string[] {
    return this.filterOptions(this.cityOptions, this.contactInfoForm?.get('city')?.value)
  }

  /**
   * Si el valor actual ya coincide exacto con una opción (recién seleccionada, o el
   * default sin tocar), devuelve la lista completa — así el usuario ve todas las
   * opciones al abrir el panel sin tener que borrar lo que ya está escrito. Solo
   * filtra por coincidencia parcial mientras está escribiendo texto nuevo.
   */
  private filterOptions(options: string[], rawValue: unknown): string[] {
    const v = String(rawValue ?? '').toLowerCase()
    if (!v || options.some(o => o.toLowerCase() === v)) return options
    return options.filter(o => o.toLowerCase().includes(v))
  }

  // El select de Departamento y el autocomplete de Ciudad solo tienen sentido para
  // Bolivia (y, para Ciudad, solo dentro de La Paz) — fuera de ahí no hay lista curada,
  // así que se muestran como texto libre para no sugerir opciones erróneas.
  isBoliviaSelected(): boolean {
    return this.contactInfoForm?.get('country')?.value === 'Bolivia'
  }

  isLaPazSelected(): boolean {
    return this.contactInfoForm?.get('state')?.value === 'La Paz'
  }

  constructor(
    private fb: FormBuilder,
    public router: Router,
    private route: ActivatedRoute,
    private patientsService: PatientsService,
    private clinicsService: ClinicsService,
    private clinicCtx: ClinicContextService,
    private alert: AlertService,
    private roleState: RoleStateService,
    private appointmentsService: AppointmentsService,
    private medicalRecordsService: MedicalRecordsService,
    private prescriptionsService: PrescriptionsService,
    private billingService: BillingService,
  ) {
    // fijar contexto si existe
    this.ctxClinicId = this.clinicCtx?.clinicId ?? null
    this.initializeForms()
  }

  ngOnInit(): void {
    this.loadClinics()
    this.checkEditMode()
    this.watchLocationChanges()
  }

  /**
   * Limpia Departamento/Ciudad cuando dejan de aplicar (país ya no es Bolivia, o
   * departamento ya no es La Paz) — evita dejar un valor "huérfano" visible como
   * texto libre que no corresponde a la nueva selección. No dispara durante
   * populateForms() porque ese patchValue usa { emitEvent: false }.
   */
  private watchLocationChanges(): void {
    this.contactInfoForm.get('country')!.valueChanges
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe(country => {
        if (country !== 'Bolivia') {
          this.contactInfoForm.patchValue({ state: '', city: '' }, { emitEvent: false })
        }
      })

    this.contactInfoForm.get('state')!.valueChanges
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe(state => {
        if (state !== 'La Paz') {
          this.contactInfoForm.get('city')!.setValue('', { emitEvent: false })
        }
      })
  }

  private initializeForms(): void {
    // Paso 1: Información Personal
    this.personalInfoForm = this.fb.group({
      firstName: ['', [Validators.required, Validators.minLength(2)]],
      lastName: ['', [Validators.required, Validators.minLength(2)]],
      documentNumber: [
        '',
        [
          Validators.required,
          Validators.minLength(5),
          Validators.pattern(VALIDATION_PATTERNS.documentNumber),
        ],
      ],
      documentType: ['CI'],
      birthDate: [null, Validators.required],
      gender: [null, Validators.required],
      bloodType: [null],
      maritalStatus: [null],
      occupation: [''],
    })

    // Paso 2: Información de Contacto
    // Teléfono: app de alcance nacional (Bolivia) — 8 dígitos, sin prefijo +591.
    this.contactInfoForm = this.fb.group({
      email: ['', [Validators.email]],
      phone: ['', [Validators.pattern(VALIDATION_PATTERNS.phoneBolivia)]],
      address: [''],
      city: [''],
      state: ['La Paz'],
      country: ['Bolivia'],
    })

    // Información médica se gestionará en Expedientes Médicos (no en el alta del paciente)

    // Paso 4: Contacto de Emergencia
    this.emergencyContactForm = this.fb.group({
      emergencyContactName: [''],
      emergencyContactPhone: ['', [Validators.pattern(VALIDATION_PATTERNS.phoneBolivia)]],
      emergencyContactRelationship: [''],
    })

    // Paso 5: Información de Seguro
    this.insuranceForm = this.fb.group({
      insuranceProvider: [''],
      insuranceNumber: [''],
      // disabled se fija acá (estado inicial del FormControl), no vía [disabled] en la
      // plantilla — mezclar ambos hace que Angular ignore el binding de plantilla y deja
      // el FormControl real desincronizado del DOM.
      clinicId: [{ value: this.clinicCtx.clinicId, disabled: !!this.ctxClinicId }, Validators.required],
    })
  }

  private loadClinics(): void {
    // Cargar solo clínicas activas para el selector
    this.clinicsService
      .findAll(true)
      .pipe(
        takeUntilDestroyed(this.destroyRef),
        catchError(err => {
          this.alert
            .fire({
              title: 'Error al Cargar Clínicas',
              html: `
              <div style="text-align: center; padding: 10px;">
                <p>No se pudieron cargar las clínicas disponibles.</p>
                <p style="color: #64748b; font-size: 0.9em; margin-top: 10px;">
                  ${err.status === 401 ? 'Su sesión ha expirado. Por favor, inicie sesión nuevamente.' : 'Por favor, intente recargar la página.'}
                </p>
              </div>
            `,
              icon: 'error',
              confirmButtonText: 'Reintentar',
              showCancelButton: true,
              cancelButtonText: 'Continuar sin clínicas',
            })
            .then((result: any) => {
              if (result.isConfirmed) {
                this.loadClinics()
              }
            })
          return of([] as Clinic[])
        }),
      )
      .subscribe(clinics => {
        this.clinics = clinics || []
        this.isClinicsLoading = false

        // Mostrar advertencia si no hay clínicas
        if (this.clinics.length === 0 && !this.isEditMode) {
          this.alert.fire({
            title: 'Sin Clínicas Activas',
            text: 'No hay clínicas activas disponibles. Por favor, contacte al administrador.',
            icon: 'warning',
            confirmButtonText: 'Entendido',
          })
        }

        // Prefijar clínica del contexto solo en modo creación
        const ctxId = this.clinicCtx.clinicId
        if (!this.isEditMode && ctxId && this.clinics.some(c => c.id === ctxId)) {
          this.insuranceForm.patchValue({ clinicId: ctxId })
        } else if (!this.isEditMode && ctxId && !this.clinics.some(c => c.id === ctxId)) {
          // Si el contexto apunta a una clínica que aún no está cargada (o filtrada), cargarla y agregarla
          this.clinicsService
            .findOne(ctxId)
            .pipe(takeUntilDestroyed(this.destroyRef), catchError(() => of(null as Clinic | null)))
            .subscribe(c => {
              if (c) {
                this.clinics = [...this.clinics, c]
                this.insuranceForm.patchValue({ clinicId: ctxId })
              }
            })
        }
      })
  }

  private checkEditMode(): void {
    // Verificar si estamos en modo edición o vista
    this.route.paramMap
      .pipe(
        takeUntilDestroyed(this.destroyRef),
        switchMap(params => {
          this.patientId = params.get('id')
          this.isEditMode = !!this.patientId && !this.route.snapshot.data['viewMode']
          this.isViewMode = !!this.patientId && !!this.route.snapshot.data['viewMode']

          if ((this.isEditMode || this.isViewMode) && this.patientId) {
            this.isLoading = true
            return this.patientsService.findOne(this.patientId)
          }
          return of(null)
        }),
        catchError(error => {
          this.isLoading = false

          if (error.status === 404) {
            this.alert
              .fire({
                title: 'Paciente No Encontrado',
                text: 'El paciente que intenta editar no existe o ha sido eliminado.',
                icon: 'error',
                confirmButtonText: 'Ir a Lista',
              })
              .then(() => {
                this.router.navigate(['/dashboard/patients'])
              })
          } else {
            this.alert
              .fire({
                title: 'Error al Cargar Paciente',
                text: 'No se pudo cargar la información del paciente. Por favor, intente nuevamente.',
                icon: 'error',
                confirmButtonText: 'Volver',
              })
              .then(() => {
                this.router.navigate(['/dashboard/patients'])
              })
          }
          return of(null)
        }),
      )
      .subscribe(patient => {
        if (patient) {
          this.populateForms(patient)
          if (this.isViewMode) this.loadRelatedCounts(patient.id)
        }
        this.isLoading = false
      })
  }

  // ── Accesos rápidos (solo modo vista) ──────────────────────────────────

  showAppointmentsQuickAccess(): boolean {
    return this.roleState.hasPermission(Permission.AppointmentsRead)
  }

  showRecordsQuickAccess(): boolean {
    return this.roleState.hasPermission(Permission.RecordsRead)
  }

  showPrescriptionsQuickAccess(): boolean {
    return this.roleState.hasPermission(Permission.PrescriptionsRead)
  }

  showBillingQuickAccess(): boolean {
    return this.roleState.hasPermission(Permission.BillingRead)
  }

  get hasAnyQuickAccess(): boolean {
    return (
      this.showAppointmentsQuickAccess() ||
      this.showRecordsQuickAccess() ||
      this.showPrescriptionsQuickAccess() ||
      this.showBillingQuickAccess()
    )
  }

  private loadRelatedCounts(patientId: string): void {
    this.isLoadingRelated = true
    forkJoin({
      appointments: this.showAppointmentsQuickAccess()
        ? this.appointmentsService.getAppointments({ patientId })
        : of([]),
      medicalRecords: this.showRecordsQuickAccess()
        ? this.medicalRecordsService.getMedicalRecordsByPatient(patientId)
        : of([]),
      prescriptions: this.showPrescriptionsQuickAccess()
        ? this.prescriptionsService.list(1, 1, { patientId })
        : of({ total: 0 }),
      invoices: this.showBillingQuickAccess()
        ? this.billingService.listInvoices(1, 1, { patientId })
        : of({ total: 0 }),
    })
      .pipe(
        takeUntilDestroyed(this.destroyRef),
        catchError(() =>
          of({
            appointments: [] as unknown[],
            medicalRecords: [] as unknown[],
            prescriptions: { total: 0 },
            invoices: { total: 0 },
          }),
        ),
      )
      .subscribe(({ appointments, medicalRecords, prescriptions, invoices }) => {
        this.relatedCounts = {
          appointments: appointments.length,
          medicalRecords: medicalRecords.length,
          prescriptions: prescriptions?.total ?? 0,
          invoices: invoices?.total ?? 0,
        }
        this.isLoadingRelated = false
      })
  }

  goToAppointments(): void {
    this.router.navigate(['/dashboard/appointments'], { queryParams: { patientId: this.patientId } })
  }

  goToMedicalHistory(): void {
    this.router.navigate(['/dashboard/medical-records/patient', this.patientId, 'history'])
  }

  goToPrescriptions(): void {
    this.router.navigate(['/dashboard/prescriptions'], { queryParams: { patientId: this.patientId } })
  }

  goToBilling(): void {
    this.router.navigate(['/dashboard/billing'], { queryParams: { patientId: this.patientId } })
  }

  private populateForms(patient: Patient): void {
    this.personalInfoForm.patchValue({
      firstName: patient.firstName,
      lastName: patient.lastName,
      documentNumber: patient.documentNumber,
      documentType: patient.documentType,
      birthDate: patient.birthDate ? new Date(patient.birthDate) : null,
      gender: patient.gender,
      bloodType: patient.bloodType,
      maritalStatus: patient.maritalStatus,
      occupation: patient.occupation,
    })

    // Si el paciente ya tiene alguno de estos datos, mostrarlos de entrada en vez
    // de esconderlos detrás de "Mostrar más campos".
    this.showMorePersonalFields = !!(patient.bloodType || patient.maritalStatus || patient.occupation)

    // emitEvent: false — no debe disparar watchLocationChanges() (limpiaría
    // state/city recién asignados si el paciente no es de Bolivia/La Paz).
    this.contactInfoForm.patchValue({
      email: patient.email,
      phone: patient.phone,
      address: patient.address,
      city: patient.city,
      state: patient.state,
      country: patient.country,
    }, { emitEvent: false })

    // Información médica se completará en el expediente (omitida en alta)

    this.emergencyContactForm.patchValue({
      emergencyContactName: patient.emergencyContactName,
      emergencyContactPhone: patient.emergencyContactPhone,
      emergencyContactRelationship: patient.emergencyContactRelationship,
    })

    const patientClinicId = patient.clinic?.id ?? patient.clinicId
    this.insuranceForm.patchValue({
      insuranceProvider: patient.insuranceProvider,
      insuranceNumber: patient.insuranceNumber,
      clinicId: patientClinicId,
    })

    // Si la clínica del paciente no está en la lista (p.ej. está inactiva), agregarla
    if (patientClinicId && !this.clinics.some(c => c.id === patientClinicId)) {
      this.clinicsService
        .findOne(patientClinicId)
        .pipe(takeUntilDestroyed(this.destroyRef), catchError(() => of(null as Clinic | null)))
        .subscribe(c => {
          if (c) {
            this.clinics = [...this.clinics, c]
          }
        })
    }

    if (this.isViewMode) {
      this.personalInfoForm.disable()
      this.contactInfoForm.disable()
      this.emergencyContactForm.disable()
      this.insuranceForm.disable()
    }
  }

  onSubmit(): void {
    if (this.isAllFormsValid()) {
      this.isSaving = true

      const patientData = this.createPatientDto()

      if (this.isEditMode && this.patientId) {
        this.updatePatient(patientData)
      } else {
        this.createPatient(patientData)
      }
    } else {
      this.personalInfoForm.markAllAsTouched()
      this.contactInfoForm.markAllAsTouched()
      this.emergencyContactForm.markAllAsTouched()
      this.insuranceForm.markAllAsTouched()
      this.scrollToFirstError()
      this.showValidationErrors()
    }
  }

  private showValidationErrors(): void {
    const p = this.personalInfoForm.controls
    const c = this.contactInfoForm.controls
    const i = this.insuranceForm.controls

    const missing: string[] = []

    if (p['firstName']?.invalid)      missing.push('Nombres')
    if (p['lastName']?.invalid)       missing.push('Apellidos')
    if (p['documentNumber']?.invalid) missing.push('Número de documento (CI)')
    if (p['birthDate']?.invalid)      missing.push('Fecha de nacimiento')
    if (p['gender']?.invalid)         missing.push('Sexo')
    if (c['email']?.invalid)          missing.push('Correo electrónico (formato inválido)')
    if (c['phone']?.invalid)          missing.push('Teléfono (formato inválido)')
    if (i['clinicId']?.invalid)       missing.push('Clínica asignada')

    this.alert.fire({
      icon: 'warning',
      title: 'Campos requeridos',
      html: `
        <p style="margin-bottom:10px;color:#374151">Corrija los siguientes campos antes de continuar:</p>
        <ul style="text-align:left;color:#dc2626;line-height:1.8">
          ${missing.map(m => `<li>• ${m}</li>`).join('')}
        </ul>
      `,
      confirmButtonText: 'Entendido',
    })
  }

  private scrollToFirstError(): void {
    scrollToFirstInvalidField(this.elRef.nativeElement as HTMLElement)
  }

  // Badges de error por sección — cuentan controles inválidos+touched de cada
  // sub-formulario, visibles recién después de un intento de envío fallido
  // (markAllAsTouched en onSubmit() es lo que los "touched" de golpe).
  personalInfoErrorCount(): number {
    return countInvalidFields(this.personalInfoForm)
  }

  contactInfoErrorCount(): number {
    return countInvalidFields(this.contactInfoForm)
  }

  emergencyContactErrorCount(): number {
    return countInvalidFields(this.emergencyContactForm)
  }

  insuranceErrorCount(): number {
    return countInvalidFields(this.insuranceForm)
  }

  // Utilidad: calcular edad para mostrar junto a la fecha de nacimiento
  getAge(): number | null {
    const bd = this.personalInfoForm.get('birthDate')?.value
    if (!bd) return null
    const birthDate = new Date(bd)
    const today = new Date()
    let age = today.getFullYear() - birthDate.getFullYear()
    const m = today.getMonth() - birthDate.getMonth()
    if (m < 0 || (m === 0 && today.getDate() < birthDate.getDate())) age--
    return age
  }

  searchByDocument(): void {
    const doc = this.personalInfoForm.get('documentNumber')?.value
    if (!doc || String(doc).length < 5) {
      this.alert.fire({
        title: 'Documento insuficiente',
        text: 'Ingrese al menos 5 caracteres para buscar.',
        icon: 'warning',
        confirmButtonText: 'Entendido',
      })
      return
    }

    this.patientsService
      .findByDocument(doc)
      .pipe(takeUntilDestroyed(this.destroyRef), catchError(() => of(null as Patient | null)))
      .subscribe(p => {
        if (p && p.id) {
          this.alert
            .fire({
              title: 'Paciente ya existe',
              html: `<div style="text-align:left">Se encontró un paciente con ese documento:<br><strong>${p.firstName} ${p.lastName}</strong></div>`,
              icon: 'info',
              confirmButtonText: 'Abrir para editar',
              showCancelButton: true,
              cancelButtonText: 'Seguir creando',
            })
            .then((res: any) => {
              if (res.isConfirmed) {
                this.allowNavigationOnce = true
                this.router.navigate(['/dashboard/patients/edit', p.id])
              }
            })
        } else {
          this.alert.fire({
            title: 'No encontrado',
            text: 'No existe un paciente con ese documento. Puede continuar con el registro.',
            icon: 'success',
            confirmButtonText: 'Continuar',
          })
        }
      })
  }

  getSelectedClinicName(): string | null {
    const id = this.insuranceForm.get('clinicId')?.value
    if (!id) return null
    const c = this.clinics.find(x => x.id === id)
    return c ? c.name : null
  }

  isAllFormsValid(): boolean {
    return (
      this.personalInfoForm.valid &&
      this.contactInfoForm.valid &&
      this.emergencyContactForm.valid &&
      this.insuranceForm.valid
    )
  }

  private createPatientDto(): CreatePatientDto {
    const personalData = this.personalInfoForm.value
    const contactData = this.contactInfoForm.value
    // Sin información médica en este flujo; se completará en Expedientes Médicos
    const emergencyData = this.emergencyContactForm.value
    // getRawValue(): clinicId puede estar disabled (bloqueado al contexto de clínica);
    // .value excluiría controles disabled y se perdería el dato al guardar.
    const insuranceData = this.insuranceForm.getRawValue()

    const raw = {
      ...personalData,
      ...contactData,
      ...emergencyData,
      ...insuranceData,
    }

    // Convertir strings vacíos a undefined para que el backend respete @IsOptional()
    return Object.fromEntries(
      Object.entries(raw).map(([k, v]) => [k, v === '' ? undefined : v]),
    ) as unknown as CreatePatientDto
  }

  private createPatient(patientData: CreatePatientDto): void {
    this.patientsService.createPatient(patientData).pipe(takeUntilDestroyed(this.destroyRef)).subscribe({
      next: patient => {
        this.isSaving = false
        this.allowNavigationOnce = true
        this.alert
          .fire({
            title: '¡Paciente Creado!',
            html: `
            <div style="text-align: left; padding: 10px;">
              <p><strong>Nombre:</strong> ${patient.firstName} ${patient.lastName}</p>
              <p><strong>Documento:</strong> ${patient.documentNumber}</p>
              <div style="background:#eff6ff; color:#1d4ed8; padding:12px; border-radius:10px; margin-top:12px; border:1px solid #bfdbfe;">
                <span style="font-weight:600;">Siguiente paso:</span> Completa el <strong>Expediente Médico</strong> del paciente.
              </div>
            </div>
          `,
            icon: 'success',
            confirmButtonText: 'Crear Expediente Médico',
            showDenyButton: true,
            denyButtonText: 'Ir a Lista',
            showCancelButton: true,
            cancelButtonText: 'Crear Otro',
            reverseButtons: true,
          })
          .then((result: any) => {
            if (result.isConfirmed) {
              this.router.navigate(['/dashboard/medical-records/new'], {
                queryParams: { patientId: patient.id },
              })
            } else if (result.isDenied) {
              this.router.navigate(['/dashboard/patients'])
            } else {
              // Resetear formulario para crear otro paciente
              this.initializeForms()
            }
          })
      },
      error: error => {
        this.isSaving = false
        this.handlePatientError(error, patientData)
      },
    })
  }

  private updatePatient(patientData: CreatePatientDto): void {
    this.patientsService.updatePatient(this.patientId!, patientData).pipe(takeUntilDestroyed(this.destroyRef)).subscribe({
      next: patient => {
        this.isSaving = false
        this.allowNavigationOnce = true
        this.alert
          .fire({
            title: '¡Paciente Actualizado!',
            text: 'Los datos del paciente han sido actualizados correctamente',
            icon: 'success',
            confirmButtonText: 'Aceptar',
            timer: 3000,
            timerProgressBar: true,
          })
          .then(() => {
            this.router.navigate(['/dashboard/patients'])
          })
      },
      error: error => {
        this.isSaving = false
        this.handlePatientError(error, patientData)
      },
    })
  }

  private handlePatientError(error: any, patientData: CreatePatientDto): void {
    // Error de paciente duplicado (409 Conflict)
    if (error.status === 409 || error.error?.message?.includes('already exists')) {
      this.alert
        .fire({
          title: '⚠️ Paciente Ya Registrado',
          html: `
          <div style="text-align: left; padding: 15px;">
            <p style="margin-bottom: 15px;">Ya existe un paciente registrado con el documento:</p>
            <div style="background: #fef3c7; padding: 12px; border-radius: 8px; border-left: 4px solid #f59e0b; margin-bottom: 15px;">
              <strong style="font-size: 1.1em; color: #92400e;">${patientData.documentType || 'CI'}: ${patientData.documentNumber}</strong>
            </div>
            <p style="color: #64748b; font-size: 0.9em;">Por favor, verifique el número de documento o busque al paciente existente.</p>
          </div>
        `,
          icon: 'warning',
          confirmButtonText: 'Buscar Paciente',
          showCancelButton: true,
          cancelButtonText: 'Revisar Documento',
          reverseButtons: true,
        })
        .then(result => {
          if (result.isConfirmed) {
            // Navegar a la lista con búsqueda del documento
            this.allowNavigationOnce = true
            this.router.navigate(['/dashboard/patients'], {
              queryParams: { q: patientData.documentNumber },
            })
          }
        })
      return
    }

    // Error de clínica no encontrada (404)
    if (error.status === 404 && error.error?.message?.includes('Clinic not found')) {
      this.alert.fire({
        title: 'Clínica No Encontrada',
        text: 'La clínica seleccionada no existe. Por favor, seleccione otra clínica.',
        icon: 'error',
        confirmButtonText: 'Entendido',
      })
      return
    }

    // Error de validación (400 Bad Request)
    if (error.status === 400) {
      const validationErrors = this.extractValidationErrors(error)
      this.alert.fire({
        title: 'Datos Inválidos',
        html: `
          <div style="text-align: left; padding: 10px;">
            <p style="margin-bottom: 10px;">Por favor, corrija los siguientes errores:</p>
            <ul style="color: #dc2626; text-align: left;">
              ${validationErrors.map(err => `<li>${err}</li>`).join('')}
            </ul>
          </div>
        `,
        icon: 'error',
        confirmButtonText: 'Corregir',
      })
      return
    }

    // Error de autorización (401/403)
    if (error.status === 401 || error.status === 403) {
      this.alert.fire({
        title: 'Sin Autorización',
        text: 'No tiene permisos para realizar esta acción.',
        icon: 'error',
        confirmButtonText: 'Entendido',
      })
      return
    }

    // Error de servidor (500)
    if (error.status >= 500) {
      this.alert
        .fire({
          title: 'Error del Servidor',
          html: `
          <div style="text-align: center; padding: 10px;">
            <p>Ocurrió un error en el servidor. Por favor, intente nuevamente.</p>
            <p style="color: #64748b; font-size: 0.9em; margin-top: 10px;">Si el problema persiste, contacte al administrador.</p>
          </div>
        `,
          icon: 'error',
          confirmButtonText: 'Reintentar',
          showCancelButton: true,
          cancelButtonText: 'Cancelar',
        })
        .then((result: any) => {
          if (result.isConfirmed) {
            this.isSaving = true
            if (this.isEditMode) {
              this.updatePatient(patientData)
            } else {
              this.createPatient(patientData)
            }
          }
        })
      return
    }

    // Error genérico
    this.alert.fire({
      title: 'Error al Guardar',
      text:
        error.error?.message ||
        'Ocurrió un error al guardar el paciente. Por favor, intente nuevamente.',
      icon: 'error',
      confirmButtonText: 'Entendido',
    })
  }

  private extractValidationErrors(error: any): string[] {
    const errors: string[] = []

    if (error.error?.message) {
      if (Array.isArray(error.error.message)) {
        errors.push(...error.error.message)
      } else {
        errors.push(error.error.message)
      }
    }

    if (errors.length === 0) {
      errors.push('Datos inválidos. Por favor, revise el formulario.')
    }

    return errors
  }

  saveDraft(): void {
    if (this.personalInfoForm.valid) {
      this.alert
        .fire({
          title: 'Guardar Borrador',
          text: 'Se guardará el paciente solo con la información personal básica. ¿Desea continuar?',
          icon: 'question',
          showCancelButton: true,
          confirmButtonText: 'Sí, guardar',
          cancelButtonText: 'Cancelar',
          reverseButtons: true,
        })
        .then((result: any) => {
          if (result.isConfirmed) {
            this.isSaving = true
            const patientData = this.createPatientDto()
            this.createPatient(patientData)
          }
        })
    } else {
      this.alert.fire({
        title: 'Información Incompleta',
        html: `
          <div style="text-align: left; padding: 10px;">
            <p>Debe completar al menos la información personal básica:</p>
            <ul style="color: #dc2626; margin-top: 10px;">
              ${!this.personalInfoForm.get('firstName')?.valid ? '<li>Nombres</li>' : ''}
              ${!this.personalInfoForm.get('lastName')?.valid ? '<li>Apellidos</li>' : ''}
              ${!this.personalInfoForm.get('documentNumber')?.valid ? '<li>Número de documento</li>' : ''}
              ${!this.personalInfoForm.get('birthDate')?.valid ? '<li>Fecha de nacimiento</li>' : ''}
              ${!this.personalInfoForm.get('gender')?.valid ? '<li>Género</li>' : ''}
            </ul>
          </div>
        `,
        icon: 'warning',
        confirmButtonText: 'Completar Datos',
      })
    }
  }

  cancel(): void {
    this.alert
      .fire({
        title: '¿Estás seguro?',
        text: 'Los cambios no guardados se perderán',
        icon: 'warning',
        showCancelButton: true,
        confirmButtonText: 'Sí, salir',
        cancelButtonText: 'Cancelar',
        reverseButtons: true,
      })
      .then((result: any) => {
        if (result.isConfirmed) {
          this.allowNavigationOnce = true
          this.router.navigate(['/dashboard/patients'])
        }
      })
  }

  /**
   * canDeactivate (`CanComponentDeactivate`):
   * permite salir si el usuario está en modo lectura, si ya confirmó la
   * intención de salir vía nuestro propio diálogo (`allowNavigationOnce`),
   * o si los 4 sub-formularios siguen pristine. En otro caso, lanza el
   * diálogo compartido y devuelve la decisión del usuario.
   */
  async canDeactivate(): Promise<boolean> {
    if (this.isViewMode) return true
    if (this.allowNavigationOnce) {
      this.allowNavigationOnce = false
      return true
    }
    const dirty =
      this.personalInfoForm?.dirty ||
      this.contactInfoForm?.dirty ||
      this.emergencyContactForm?.dirty ||
      this.insuranceForm?.dirty
    if (!dirty) return true
    return confirmDiscardChanges(this.alert)
  }

  private showError(message: string): void {
    this.alert.fire({
      title: 'Error',
      text: message,
      icon: 'error',
      confirmButtonText: 'Entendido',
    })
  }

}
