import { ElementRef } from '@angular/core'
import { TestBed } from '@angular/core/testing'
import { FormBuilder } from '@angular/forms'
import { ActivatedRoute, Router } from '@angular/router'
import { Permission } from '@core/enums/permission.enum'
import { RoleStateService } from '@core/services/role-state.service'
import { of, throwError } from 'rxjs'
import { AlertService } from '../../../../../core/services/alert.service'
import { ClinicContextService } from '../../../../clinics/services/clinic-context.service'
import { Clinic } from '../../admin/clinics/interfaces/clinic.interface'
import { ClinicsService } from '../../admin/clinics/services'
import { AppointmentsService } from '../../appointments/services/appointments.service'
import { BillingService } from '../../billing/billing.service'
import { MedicalRecordsService } from '../../medical-records/services/medical-records.service'
import { PrescriptionsService } from '../../prescriptions/prescriptions.service'
import { Gender, Patient } from '../interfaces'
import { PatientsService } from '../services'
import { PatientFormComponent } from './patient-form.component'
import { createSpyObj, SpyObj } from '../../../../../../testing/spy'

describe('PatientFormComponent', () => {
  let component: PatientFormComponent
  let patientsService: SpyObj<PatientsService>
  let clinicsService: SpyObj<ClinicsService>
  let clinicCtx: { clinicId: string | null }
  let alert: SpyObj<AlertService>
  let router: SpyObj<Router>
  let route: { paramMap: any; snapshot: { data: Record<string, any> } }
  let permissions: Permission[]
  let appointmentsService: SpyObj<AppointmentsService>
  let medicalRecordsService: SpyObj<MedicalRecordsService>
  let prescriptionsService: SpyObj<PrescriptionsService>
  let billingService: SpyObj<BillingService>

  const fakeRoleState = { hasPermission: (p: Permission) => permissions.includes(p) }

  const makeClinic = (overrides: Partial<Clinic> = {}): Clinic =>
    ({ id: 'clinic-1', name: 'Norte', address: 'x', phone: 'x', isActive: true, ...overrides }) as Clinic

  const makePatient = (overrides: Partial<Patient> = {}): Patient =>
    ({
      id: 'patient-1',
      firstName: 'Juan',
      lastName: 'Perez',
      documentNumber: '1234567',
      documentType: 'CI',
      birthDate: new Date('1990-01-01'),
      gender: Gender.MALE,
      isActive: true,
      clinicId: 'clinic-1',
      ...overrides,
    }) as Patient

  const createComponent = (paramMapValue: Record<string, string | null> = {}, snapshotData: Record<string, any> = {}) => {
    route = {
      paramMap: of({ get: (key: string) => paramMapValue[key] ?? null }),
      snapshot: { data: snapshotData },
    }

    TestBed.configureTestingModule({
      providers: [
        PatientFormComponent,
        FormBuilder,
        { provide: ElementRef, useValue: new ElementRef(document.createElement('div')) },
        { provide: Router, useValue: router },
        { provide: ActivatedRoute, useValue: route },
        { provide: PatientsService, useValue: patientsService },
        { provide: ClinicsService, useValue: clinicsService },
        { provide: ClinicContextService, useValue: clinicCtx },
        { provide: AlertService, useValue: alert },
        { provide: RoleStateService, useValue: fakeRoleState },
        { provide: AppointmentsService, useValue: appointmentsService },
        { provide: MedicalRecordsService, useValue: medicalRecordsService },
        { provide: PrescriptionsService, useValue: prescriptionsService },
        { provide: BillingService, useValue: billingService },
      ],
    })
    return TestBed.inject(PatientFormComponent)
  }

  beforeEach(() => {
    patientsService = createSpyObj('PatientsService', [
      'createPatient',
      'updatePatient',
      'findOne',
      'findByDocument',
    ])
    clinicsService = createSpyObj('ClinicsService', ['findAll', 'findOne'])
    clinicsService.findAll.mockReturnValue(of([makeClinic()]))
    clinicCtx = { clinicId: null }
    alert = createSpyObj('AlertService', ['fire'])
    alert.fire.mockReturnValue(Promise.resolve({ isConfirmed: false } as any))
    router = createSpyObj('Router', ['navigate'])

    permissions = [
      Permission.AppointmentsRead,
      Permission.RecordsRead,
      Permission.PrescriptionsRead,
      Permission.BillingRead,
    ]
    appointmentsService = createSpyObj('AppointmentsService', ['getAppointments'])
    appointmentsService.getAppointments.mockReturnValue(of([]))
    medicalRecordsService = createSpyObj('MedicalRecordsService', ['getMedicalRecordsByPatient'])
    medicalRecordsService.getMedicalRecordsByPatient.mockReturnValue(of([]))
    prescriptionsService = createSpyObj('PrescriptionsService', ['list'])
    prescriptionsService.list.mockReturnValue(of({ total: 0 }))
    billingService = createSpyObj('BillingService', ['listInvoices'])
    billingService.listInvoices.mockReturnValue(of({ total: 0 }))
  })

  describe('constructor / initializeForms', () => {
    it('prefija insuranceForm.clinicId con el contexto de clínica activo', () => {
      clinicCtx.clinicId = 'clinic-9'
      component = createComponent()
      // clinicId queda disabled cuando hay contexto de clínica — .value lo excluye a
      // propósito (comportamiento estándar de Angular); getRawValue() sí lo incluye.
      expect(component.insuranceForm.getRawValue().clinicId).toBe('clinic-9')
      expect(component.ctxClinicId).toBe('clinic-9')
    })

    it('los 4 sub-formularios existen e inician inválidos sin datos', () => {
      component = createComponent()
      expect(component.personalInfoForm.valid).toBe(false)
      expect(component.contactInfoForm.valid).toBe(true) // todos opcionales
      expect(component.emergencyContactForm.valid).toBe(true)
      expect(component.insuranceForm.valid).toBe(false) // clinicId requerido
    })
  })

  describe('loadClinics (vía ngOnInit)', () => {
    it('en éxito, guarda las clínicas', () => {
      component = createComponent()
      component.ngOnInit()
      expect(component.clinics.length).toBe(1)
      expect(component.isClinicsLoading).toBe(false)
    })

    it('avisa si no hay clínicas activas y no está en modo edición', () => {
      clinicsService.findAll.mockReturnValue(of([]))
      component = createComponent()
      component.ngOnInit()
      expect(alert.fire).toHaveBeenCalledWith(expect.objectContaining({ title: 'Sin Clínicas Activas' }))
    })

    it('prefija clinicId si el contexto coincide con una clínica cargada', () => {
      clinicCtx.clinicId = 'clinic-1'
      component = createComponent()
      component.ngOnInit()
      expect(component.insuranceForm.getRawValue().clinicId).toBe('clinic-1')
    })

    it('si el contexto no está en la lista cargada, busca y agrega esa clínica', () => {
      clinicCtx.clinicId = 'clinic-9'
      clinicsService.findOne.mockReturnValue(of(makeClinic({ id: 'clinic-9', name: 'Sur' })))
      component = createComponent()
      component.ngOnInit()
      expect(clinicsService.findOne).toHaveBeenCalledWith('clinic-9')
      expect(component.clinics.some(c => c.id === 'clinic-9')).toBe(true)
    })

    it('en error, ofrece reintentar y reintenta si el usuario confirma', async () => {
      clinicsService.findAll
        .mockReturnValueOnce(throwError(() => ({ status: 500 })))
        .mockReturnValueOnce(of([makeClinic()]))
      alert.fire.mockReturnValue(Promise.resolve({ isConfirmed: true } as any))

      component = createComponent()
      component.ngOnInit()
      await Promise.resolve()

      expect(clinicsService.findAll).toHaveBeenCalledTimes(2)
    })
  })

  describe('checkEditMode (vía ngOnInit)', () => {
    it('sin id en la ruta, no entra en modo edición ni llama a findOne', () => {
      component = createComponent({ id: null })
      component.ngOnInit()
      expect(component.isEditMode).toBe(false)
      expect(patientsService.findOne).not.toHaveBeenCalled()
    })

    it('con id y sin viewMode, entra en modo edición y puebla el formulario', () => {
      patientsService.findOne.mockReturnValue(of(makePatient()))
      component = createComponent({ id: 'patient-1' })

      component.ngOnInit()

      expect(component.isEditMode).toBe(true)
      expect(component.isViewMode).toBe(false)
      expect(component.personalInfoForm.value.firstName).toBe('Juan')
      expect(component.isLoading).toBe(false)
    })

    it('con id y viewMode=true, entra en modo vista y deshabilita los formularios', () => {
      patientsService.findOne.mockReturnValue(of(makePatient()))
      component = createComponent({ id: 'patient-1' }, { viewMode: true })

      component.ngOnInit()

      expect(component.isViewMode).toBe(true)
      expect(component.isEditMode).toBe(false)
      expect(component.personalInfoForm.disabled).toBe(true)
    })

    it('si el paciente no existe (404), avisa y navega a la lista', async () => {
      patientsService.findOne.mockReturnValue(throwError(() => ({ status: 404 })))
      alert.fire.mockReturnValue(Promise.resolve({} as any))
      component = createComponent({ id: 'patient-1' })

      component.ngOnInit()
      await Promise.resolve()

      expect(alert.fire).toHaveBeenCalledWith(expect.objectContaining({ title: 'Paciente No Encontrado' }))
      expect(router.navigate).toHaveBeenCalledWith(['/dashboard/patients'])
    })

    it('en cualquier otro error, avisa genéricamente y navega a la lista', async () => {
      patientsService.findOne.mockReturnValue(throwError(() => ({ status: 500 })))
      alert.fire.mockReturnValue(Promise.resolve({} as any))
      component = createComponent({ id: 'patient-1' })

      component.ngOnInit()
      await Promise.resolve()

      expect(alert.fire).toHaveBeenCalledWith(expect.objectContaining({ title: 'Error al Cargar Paciente' }))
      expect(router.navigate).toHaveBeenCalledWith(['/dashboard/patients'])
    })
  })

  describe('Accesos rápidos (modo vista)', () => {
    beforeEach(() => {
      patientsService.findOne.mockReturnValue(of(makePatient({ id: 'patient-1' })))
    })

    it('pide conteos solo de los módulos que el rol tiene permiso de ver', () => {
      permissions = [Permission.RecordsRead]
      component = createComponent({ id: 'patient-1' }, { viewMode: true })

      component.ngOnInit()

      expect(medicalRecordsService.getMedicalRecordsByPatient).toHaveBeenCalledWith('patient-1')
      expect(appointmentsService.getAppointments).not.toHaveBeenCalled()
      expect(prescriptionsService.list).not.toHaveBeenCalled()
      expect(billingService.listInvoices).not.toHaveBeenCalled()
    })

    it('muestra los conteos reales una vez cargados', () => {
      appointmentsService.getAppointments.mockReturnValue(of([{}, {}] as any))
      medicalRecordsService.getMedicalRecordsByPatient.mockReturnValue(of([{}] as any))
      prescriptionsService.list.mockReturnValue(of({ total: 3 }))
      billingService.listInvoices.mockReturnValue(of({ total: 5 }))
      component = createComponent({ id: 'patient-1' }, { viewMode: true })

      component.ngOnInit()

      expect(component.relatedCounts).toEqual({
        appointments: 2,
        medicalRecords: 1,
        prescriptions: 3,
        invoices: 5,
      })
    })

    it('no pide ningún conteo relacionado fuera del modo vista (edición/creación)', () => {
      component = createComponent({ id: 'patient-1' })

      component.ngOnInit()

      expect(medicalRecordsService.getMedicalRecordsByPatient).not.toHaveBeenCalled()
      expect(appointmentsService.getAppointments).not.toHaveBeenCalled()
    })

    it('hasAnyQuickAccess es false si el rol no tiene ningún permiso relevante', () => {
      permissions = []
      component = createComponent({ id: 'patient-1' }, { viewMode: true })

      expect(component.hasAnyQuickAccess).toBe(false)
    })
  })

  describe('navegación de accesos rápidos', () => {
    beforeEach(() => {
      patientsService.findOne.mockReturnValue(of(makePatient({ id: 'patient-1' })))
      component = createComponent({ id: 'patient-1' }, { viewMode: true })
      component.ngOnInit()
    })

    it('goToAppointments navega con patientId como query param', () => {
      component.goToAppointments()
      expect(router.navigate).toHaveBeenCalledWith(['/dashboard/appointments'], {
        queryParams: { patientId: 'patient-1' },
      })
    })

    it('goToMedicalHistory navega a la ruta dedicada de historial del paciente', () => {
      component.goToMedicalHistory()
      expect(router.navigate).toHaveBeenCalledWith([
        '/dashboard/medical-records/patient',
        'patient-1',
        'history',
      ])
    })

    it('goToPrescriptions navega con patientId como query param', () => {
      component.goToPrescriptions()
      expect(router.navigate).toHaveBeenCalledWith(['/dashboard/prescriptions'], {
        queryParams: { patientId: 'patient-1' },
      })
    })

    it('goToBilling navega con patientId como query param', () => {
      component.goToBilling()
      expect(router.navigate).toHaveBeenCalledWith(['/dashboard/billing'], {
        queryParams: { patientId: 'patient-1' },
      })
    })
  })

  describe('getAge', () => {
    beforeEach(() => (component = createComponent()))

    it('devuelve null sin fecha de nacimiento', () => {
      expect(component.getAge()).toBeNull()
    })

    it('calcula la edad correctamente', () => {
      const today = new Date()
      const twenty = new Date(today.getFullYear() - 20, today.getMonth(), today.getDate())
      component.personalInfoForm.patchValue({ birthDate: twenty })
      expect(component.getAge()).toBe(20)
    })

    it('resta 1 si el cumpleaños de este año todavía no llegó', () => {
      const today = new Date()
      const future = new Date(today.getFullYear() - 20, today.getMonth() + 1, today.getDate())
      component.personalInfoForm.patchValue({ birthDate: future })
      expect(component.getAge()).toBe(19)
    })
  })

  describe('searchByDocument', () => {
    beforeEach(() => (component = createComponent()))

    it('avisa si el documento tiene menos de 5 caracteres, sin llamar al servicio', () => {
      component.personalInfoForm.patchValue({ documentNumber: '123' })
      component.searchByDocument()
      expect(alert.fire).toHaveBeenCalledWith(expect.objectContaining({ title: 'Documento insuficiente' }))
      expect(patientsService.findByDocument).not.toHaveBeenCalled()
    })

    it('si encuentra un paciente y el usuario confirma, navega a editarlo', async () => {
      component.personalInfoForm.patchValue({ documentNumber: '1234567' })
      patientsService.findByDocument.mockReturnValue(of(makePatient()))
      alert.fire.mockReturnValue(Promise.resolve({ isConfirmed: true } as any))

      component.searchByDocument()
      await Promise.resolve()

      expect(router.navigate).toHaveBeenCalledWith(['/dashboard/patients/edit', 'patient-1'])
    })

    it('si no encuentra ningún paciente, avisa que puede continuar', () => {
      component.personalInfoForm.patchValue({ documentNumber: '1234567' })
      patientsService.findByDocument.mockReturnValue(of(null as unknown as Patient))

      component.searchByDocument()

      expect(alert.fire).toHaveBeenCalledWith(expect.objectContaining({ title: 'No encontrado' }))
    })
  })

  describe('getSelectedClinicName / isAllFormsValid', () => {
    beforeEach(() => {
      clinicCtx.clinicId = 'clinic-1'
      component = createComponent()
      component.ngOnInit()
    })

    it('getSelectedClinicName devuelve null sin clínica seleccionada', () => {
      component.insuranceForm.patchValue({ clinicId: null })
      expect(component.getSelectedClinicName()).toBeNull()
    })

    it('getSelectedClinicName devuelve el nombre si la clínica está cargada', () => {
      expect(component.getSelectedClinicName()).toBe('Norte')
    })

    it('isAllFormsValid es false si falta algún campo requerido', () => {
      expect(component.isAllFormsValid()).toBe(false)
    })

    it('isAllFormsValid es true con los 4 formularios completos', () => {
      component.personalInfoForm.patchValue({
        firstName: 'Juan',
        lastName: 'Perez',
        documentNumber: '1234567',
        birthDate: new Date('1990-01-01'),
        gender: Gender.MALE,
      })
      expect(component.isAllFormsValid()).toBe(true)
    })
  })

  describe('onSubmit', () => {
    beforeEach(() => {
      clinicCtx.clinicId = 'clinic-1'
      component = createComponent()
      component.ngOnInit()
    })

    it('si el formulario es inválido, marca todo como touched y muestra los campos faltantes', () => {
      component.onSubmit()

      expect(component.personalInfoForm.get('firstName')?.touched).toBe(true)
      expect(alert.fire).toHaveBeenCalledWith(expect.objectContaining({ title: 'Campos requeridos' }))
      expect(patientsService.createPatient).not.toHaveBeenCalled()
    })

    it('con formulario válido en modo creación, llama a createPatient', () => {
      component.personalInfoForm.patchValue({
        firstName: 'Juan',
        lastName: 'Perez',
        documentNumber: '1234567',
        birthDate: new Date('1990-01-01'),
        gender: Gender.MALE,
      })
      patientsService.createPatient.mockReturnValue(of(makePatient()))

      component.onSubmit()

      expect(patientsService.createPatient).toHaveBeenCalled()
    })

  })

  describe('onSubmit — modo edición', () => {
    it('con formulario válido, llama a updatePatient', () => {
      patientsService.findOne.mockReturnValue(of(makePatient()))
      component = createComponent({ id: 'patient-1' })
      component.ngOnInit()
      patientsService.updatePatient.mockReturnValue(of(makePatient()))

      component.onSubmit()

      expect(patientsService.updatePatient).toHaveBeenCalledWith('patient-1', expect.any(Object))
    })
  })

  describe('createPatient (flujo de éxito, vía onSubmit)', () => {
    beforeEach(() => {
      clinicCtx.clinicId = 'clinic-1'
      component = createComponent()
      component.ngOnInit()
      component.personalInfoForm.patchValue({
        firstName: 'Juan',
        lastName: 'Perez',
        documentNumber: '1234567',
        birthDate: new Date('1990-01-01'),
        gender: Gender.MALE,
      })
    })

    it('navega a crear expediente médico si el usuario confirma', async () => {
      patientsService.createPatient.mockReturnValue(of(makePatient()))
      alert.fire.mockReturnValue(Promise.resolve({ isConfirmed: true } as any))

      component.onSubmit()
      await Promise.resolve()

      expect(router.navigate).toHaveBeenCalledWith(['/dashboard/medical-records/new'], {
        queryParams: { patientId: 'patient-1' },
      })
      expect(component.isSaving).toBe(false)
    })

    it('navega a la lista si el usuario elige "Ir a Lista" (isDenied)', async () => {
      patientsService.createPatient.mockReturnValue(of(makePatient()))
      alert.fire.mockReturnValue(Promise.resolve({ isDenied: true } as any))

      component.onSubmit()
      await Promise.resolve()

      expect(router.navigate).toHaveBeenCalledWith(['/dashboard/patients'])
    })

    it('reinicia los formularios si el usuario elige "Crear Otro"', async () => {
      patientsService.createPatient.mockReturnValue(of(makePatient()))
      alert.fire.mockReturnValue(Promise.resolve({} as any))
      const initSpy = vi.spyOn(component as any, 'initializeForms')

      component.onSubmit()
      await Promise.resolve()

      expect(initSpy).toHaveBeenCalled()
    })

    it('en error, delega a handlePatientError', () => {
      patientsService.createPatient.mockReturnValue(throwError(() => ({ status: 400, error: {} })))

      component.onSubmit()

      expect(component.isSaving).toBe(false)
      expect(alert.fire).toHaveBeenCalledWith(expect.objectContaining({ title: 'Datos Inválidos' }))
    })
  })

  describe('handlePatientError (a través de createPatient)', () => {
    beforeEach(() => {
      clinicCtx.clinicId = 'clinic-1'
      component = createComponent()
      component.ngOnInit()
      component.personalInfoForm.patchValue({
        firstName: 'Juan',
        lastName: 'Perez',
        documentNumber: '1234567',
        birthDate: new Date('1990-01-01'),
        gender: Gender.MALE,
      })
    })

    const submitWithError = (error: any) => {
      patientsService.createPatient.mockReturnValue(throwError(() => error))
      component.onSubmit()
    }

    it('409 (paciente duplicado): confirma → navega a la lista con q=documentNumber', async () => {
      alert.fire.mockReturnValue(Promise.resolve({ isConfirmed: true } as any))
      submitWithError({ status: 409 })
      await Promise.resolve()

      expect(alert.fire).toHaveBeenCalledWith(expect.objectContaining({ title: '⚠️ Paciente Ya Registrado' }))
      expect(router.navigate).toHaveBeenCalledWith(['/dashboard/patients'], { queryParams: { q: '1234567' } })
    })

    it('404 con "Clinic not found": muestra alerta específica de clínica', () => {
      submitWithError({ status: 404, error: { message: 'Clinic not found' } })
      expect(alert.fire).toHaveBeenCalledWith(expect.objectContaining({ title: 'Clínica No Encontrada' }))
    })

    it('400: extrae errores de validación (array) y los muestra', () => {
      submitWithError({ status: 400, error: { message: ['Campo A inválido', 'Campo B inválido'] } })
      const call = alert.fire.mock.lastCall![0] as any
      expect(call.title).toBe('Datos Inválidos')
      expect(call.html).toContain('Campo A inválido')
      expect(call.html).toContain('Campo B inválido')
    })

    it('400 sin mensaje del backend: usa el mensaje por defecto', () => {
      submitWithError({ status: 400, error: {} })
      const call = alert.fire.mock.lastCall![0] as any
      expect(call.html).toContain('Datos inválidos. Por favor, revise el formulario.')
    })

    it('401/403: muestra alerta de falta de autorización', () => {
      submitWithError({ status: 401 })
      expect(alert.fire).toHaveBeenCalledWith(expect.objectContaining({ title: 'Sin Autorización' }))
    })

    it('>=500: ofrece reintentar y reintenta createPatient si confirma', async () => {
      patientsService.createPatient
        .mockReturnValueOnce(throwError(() => ({ status: 500 })))
        .mockReturnValueOnce(of(makePatient()))
      alert.fire.mockReturnValue(Promise.resolve({ isConfirmed: true } as any))

      component.onSubmit()
      await Promise.resolve()
      await Promise.resolve()

      expect(patientsService.createPatient).toHaveBeenCalledTimes(2)
    })

    it('error genérico: usa error.error.message si viene, si no el mensaje por defecto', () => {
      submitWithError({ status: 418, error: { message: 'Soy una tetera' } })
      expect(alert.fire).toHaveBeenCalledWith(expect.objectContaining({ title: 'Error al Guardar', text: 'Soy una tetera' }))
    })
  })

  describe('saveDraft', () => {
    beforeEach(() => {
      clinicCtx.clinicId = 'clinic-1'
      component = createComponent()
      component.ngOnInit()
    })

    it('con personalInfoForm inválido, avisa qué falta sin llamar al servicio', () => {
      component.saveDraft()
      expect(alert.fire).toHaveBeenCalledWith(expect.objectContaining({ title: 'Información Incompleta' }))
      expect(patientsService.createPatient).not.toHaveBeenCalled()
    })

    it('con personalInfoForm válido y confirmación, crea el paciente', async () => {
      component.personalInfoForm.patchValue({
        firstName: 'Juan',
        lastName: 'Perez',
        documentNumber: '1234567',
        birthDate: new Date('1990-01-01'),
        gender: Gender.MALE,
      })
      alert.fire.mockReturnValue(Promise.resolve({ isConfirmed: true } as any))
      patientsService.createPatient.mockReturnValue(of(makePatient()))

      component.saveDraft()
      await Promise.resolve()

      expect(patientsService.createPatient).toHaveBeenCalled()
    })
  })

  describe('cancel', () => {
    beforeEach(() => (component = createComponent()))

    it('si el usuario confirma, marca allowNavigationOnce y navega a la lista', async () => {
      alert.fire.mockReturnValue(Promise.resolve({ isConfirmed: true } as any))
      component.cancel()
      await Promise.resolve()
      expect(router.navigate).toHaveBeenCalledWith(['/dashboard/patients'])
    })

    it('si el usuario cancela, no navega', async () => {
      alert.fire.mockReturnValue(Promise.resolve({ isConfirmed: false } as any))
      component.cancel()
      await Promise.resolve()
      expect(router.navigate).not.toHaveBeenCalled()
    })
  })

  describe('canDeactivate', () => {
    beforeEach(() => (component = createComponent()))

    it('en modo vista, siempre permite salir', async () => {
      ;(component as any).isViewMode = true
      expect(await component.canDeactivate()).toBe(true)
    })

    it('si allowNavigationOnce está seteado, permite salir una vez y resetea el flag', async () => {
      ;(component as any).allowNavigationOnce = true
      expect(await component.canDeactivate()).toBe(true)
      expect((component as any).allowNavigationOnce).toBe(false)
    })

    it('si los 4 formularios están pristine, permite salir sin preguntar', async () => {
      expect(await component.canDeactivate()).toBe(true)
      expect(alert.fire).not.toHaveBeenCalled()
    })

    it('si algún formulario está dirty, pregunta y respeta la decisión del usuario', async () => {
      component.personalInfoForm.markAsDirty()
      alert.fire.mockReturnValue(Promise.resolve({ isConfirmed: true } as any))

      expect(await component.canDeactivate()).toBe(true)
      expect(alert.fire).toHaveBeenCalledWith(expect.objectContaining({ title: '¿Salir sin guardar?' }))
    })

    it('si el usuario no confirma el diálogo de descarte, bloquea la salida', async () => {
      component.personalInfoForm.markAsDirty()
      alert.fire.mockReturnValue(Promise.resolve({ isConfirmed: false } as any))

      expect(await component.canDeactivate()).toBe(false)
    })
  })
})
