import { Component, DestroyRef, ElementRef, inject, OnInit } from '@angular/core'
import { takeUntilDestroyed } from '@angular/core/rxjs-interop'
import { FormControl, FormGroup, Validators } from '@angular/forms'
import { ActivatedRoute, Router } from '@angular/router'
import { AlertService } from '@core/services/alert.service'
import { countInvalidFields, scrollToFirstInvalidField } from '../../../../shared/utils/form-errors.util'
import { Clinic } from '../admin/clinics/interfaces'
import { ClinicsService } from '../admin/clinics/services/clinics.service'
import { Patient } from '../patients/interfaces'
import { PatientsService } from '../patients/services/patients.service'
import { ClinicalStaffMember, UsersService } from '../admin/users/users.service'
import {
  AppointmentPriority,
  AppointmentsService,
  AppointmentType,
  CreateAppointmentDto,
} from './services/appointments.service'

@Component({
    selector: 'app-appointment-form',
    templateUrl: './appointment-form.component.html',
    standalone: false
})
export class AppointmentFormComponent implements OnInit {
  private readonly destroyRef = inject(DestroyRef)

  isEditMode: boolean = false
  appointmentId: string | null = null
  isLoading: boolean = false

  // Listas de datos
  patients: Patient[] = []
  doctors: ClinicalStaffMember[] = []
  clinics: Clinic[] = []

  protected readonly appointmentTypes = [
    { value: AppointmentType.CONSULTATION, label: 'Consulta General' },
    { value: AppointmentType.FOLLOW_UP, label: 'Seguimiento' },
    { value: AppointmentType.EMERGENCY, label: 'Emergencia' },
    { value: AppointmentType.SURGERY, label: 'Cirugía' },
    { value: AppointmentType.LABORATORY, label: 'Laboratorio' },
    { value: AppointmentType.IMAGING, label: 'Imagenología' },
    { value: AppointmentType.VACCINATION, label: 'Vacunación' },
    { value: AppointmentType.THERAPY, label: 'Terapia' },
    { value: AppointmentType.OTHER, label: 'Otro' },
  ]

  protected readonly priorities = [
    { value: AppointmentPriority.LOW, label: 'Baja' },
    { value: AppointmentPriority.NORMAL, label: 'Normal' },
    { value: AppointmentPriority.HIGH, label: 'Alta' },
    { value: AppointmentPriority.URGENT, label: 'Urgente' },
  ]

  protected readonly durations = [
    { value: 15, label: '15 minutos' },
    { value: 30, label: '30 minutos' },
    { value: 45, label: '45 minutos' },
    { value: 60, label: '1 hora' },
    { value: 90, label: '1.5 horas' },
    { value: 120, label: '2 horas' },
  ]

  // Límite del datepicker de la cita: no se puede agendar en el pasado.
  protected readonly today = new Date()

  public appointmentForm: FormGroup = new FormGroup({
    // disabled se fija en el estado inicial del FormControl (sintaxis { value, disabled }),
    // no vía [disabled] en la plantilla — mezclar ambos deja al FormControl real
    // desincronizado del DOM. Arrancan deshabilitados porque patients/doctors/clinics se
    // cargan async en loadInitialData(); se habilitan ahí mismo cuando cada lista deja de
    // estar vacía (ver updateSelectControlDisabled()).
    patientId: new FormControl({ value: '', disabled: true }, Validators.required),
    doctorId: new FormControl({ value: '', disabled: true }, Validators.required),
    clinicId: new FormControl({ value: '', disabled: true }, Validators.required),
    appointmentDate: new FormControl<Date | null>(null, Validators.required),
    appointmentTime: new FormControl('', Validators.required),
    duration: new FormControl(30, Validators.required),
    appointmentType: new FormControl(AppointmentType.CONSULTATION, Validators.required),
    priority: new FormControl(AppointmentPriority.NORMAL, Validators.required),
    reason: new FormControl('', Validators.required),
    notes: new FormControl(''),
  })

  constructor(
    public router: Router,
    private route: ActivatedRoute,
    private alert: AlertService,
    private appointmentsService: AppointmentsService,
    private patientsService: PatientsService,
    private usersService: UsersService,
    private clinicsService: ClinicsService,
    private elRef: ElementRef,
  ) {}

  ngOnInit() {
    // Cargar datos iniciales
    this.loadInitialData()

    // Obtener parámetros de la URL
    this.route.paramMap.pipe(takeUntilDestroyed(this.destroyRef)).subscribe(params => {
      this.appointmentId = params.get('id')
      this.isEditMode = !!this.appointmentId

      // Pre-llenar datos si vienen de query params
      this.route.queryParams.pipe(takeUntilDestroyed(this.destroyRef)).subscribe(queryParams => {
        if (queryParams['patientId']) {
          this.appointmentForm.patchValue({
            patientId: queryParams['patientId'],
          })
        }
        if (queryParams['doctorId']) {
          this.appointmentForm.patchValue({
            doctorId: queryParams['doctorId'],
          })
        }
        if (queryParams['date']) {
          this.appointmentForm.patchValue({
            appointmentDate: queryParams['date'],
          })
        }
      })

      if (this.isEditMode && this.appointmentId) {
        this.loadAppointmentData(this.appointmentId)
      }
    })

    // Fecha por defecto: hoy
    if (!this.appointmentForm.get('appointmentDate')?.value) {
      this.appointmentForm.get('appointmentDate')?.setValue(new Date())
    }
  }

  loadInitialData(): void {
    this.isLoading = true

    // Cargar pacientes
    this.patientsService.findAll().pipe(takeUntilDestroyed(this.destroyRef)).subscribe({
      next: patients => {
        this.patients = patients.data.filter(p => p.isActive)
        this.updateSelectControlDisabled('patientId', this.patients.length)
      },
      error: () => {},
    })

    // Cargar doctores (personal clínico con rol doctor). Va por `clinical-staff` y no por
    // `GET /users`: aquel exige ADMIN + UsersManage, así que a enfermería y recepción —que
    // son quienes agendan— les devolvía 403, la lista quedaba vacía y el select de doctor
    // se quedaba deshabilitado, dejando el formulario permanentemente inválido.
    this.usersService.getClinicalStaff().pipe(takeUntilDestroyed(this.destroyRef)).subscribe({
      next: staff => {
        this.doctors = staff.filter(u => u.roles.includes('doctor'))
        this.updateSelectControlDisabled('doctorId', this.doctors.length)
      },
      error: () => {},
    })

    // Cargar clínicas
    this.clinicsService.findAll(true).pipe(takeUntilDestroyed(this.destroyRef)).subscribe({
      next: clinics => {
        this.clinics = clinics
        this.updateSelectControlDisabled('clinicId', this.clinics.length)
        // Si solo hay una clínica, pre-seleccionarla
        if (this.clinics.length === 1) {
          this.appointmentForm.patchValue({
            clinicId: this.clinics[0].id,
          })
        }
        this.isLoading = false
      },
      error: () => {
        this.isLoading = false
      },
    })
  }

  // Paciente/doctor/clínica arrancan deshabilitados (listas vacías hasta que cargan);
  // habilitar/deshabilitar acá según llegue contenido, nunca vía [disabled] en la plantilla.
  private updateSelectControlDisabled(controlName: string, optionsLength: number): void {
    const control = this.appointmentForm.get(controlName)
    if (!control) return
    if (optionsLength > 0) {
      control.enable({ emitEvent: false })
    } else {
      control.disable({ emitEvent: false })
    }
  }

  loadAppointmentData(id: string): void {
    this.isLoading = true
    this.appointmentsService.getAppointment(id).pipe(takeUntilDestroyed(this.destroyRef)).subscribe({
      next: appointment => {
        // Separar fecha y hora
        const appointmentDate = new Date(appointment.appointmentDate)
        const timeStr = appointmentDate.toTimeString().slice(0, 5)

        this.appointmentForm.patchValue({
          patientId: appointment.patient.id,
          doctorId: appointment.doctor.id,
          clinicId: appointment.clinic.id,
          appointmentDate: appointmentDate,
          appointmentTime: timeStr,
          duration: appointment.duration,
          appointmentType: appointment.type,
          priority: appointment.priority,
          reason: appointment.reason,
          notes: appointment.notes || '',
        })
        this.isLoading = false
      },
      error: () => {
        this.alert
          .fire({
            icon: 'error',
            title: 'Error',
            text: 'No se pudo cargar la información de la cita',
          })
          .then(() => {
            this.router.navigate(['/dashboard/appointments'])
          })
      },
    })
  }

  onSubmit() {
    if (this.appointmentForm.invalid) {
      this.appointmentForm.markAllAsTouched()
      this.scrollToFirstError()
      return
    }

    this.isLoading = true

    const appointmentData = this.appointmentForm.value

    // Combinar fecha (Date del datepicker) y hora (string HH:mm)
    const date = appointmentData.appointmentDate as Date
    const time = appointmentData.appointmentTime as string
    const fullDateTime = new Date(
      date.getFullYear(),
      date.getMonth(),
      date.getDate(),
      parseInt(time.split(':')[0], 10),
      parseInt(time.split(':')[1], 10),
    )

    const submitData: CreateAppointmentDto = {
      patientId: appointmentData.patientId,
      doctorId: appointmentData.doctorId,
      clinicId: appointmentData.clinicId,
      appointmentDate: fullDateTime.toISOString(),
      duration: appointmentData.duration,
      type: appointmentData.appointmentType,
      priority: appointmentData.priority,
      reason: appointmentData.reason,
      notes: appointmentData.notes || undefined,
      isEmergency: appointmentData.priority === AppointmentPriority.URGENT,
    }

    if (this.isEditMode && this.appointmentId) {
      this.appointmentsService.updateAppointment(this.appointmentId, submitData).pipe(takeUntilDestroyed(this.destroyRef)).subscribe({
        next: () => {
          this.isLoading = false
          this.router.navigate(['/dashboard/appointments'])
        },
        error: () => {
          this.isLoading = false
        },
      })
    } else {
      this.appointmentsService.createAppointment(submitData).pipe(takeUntilDestroyed(this.destroyRef)).subscribe({
        next: () => {
          this.isLoading = false
          this.router.navigate(['/dashboard/appointments'])
        },
        error: () => {
          this.isLoading = false
        },
      })
    }
  }

  // Método para verificar disponibilidad
  checkAvailability() {
    const doctorId = this.appointmentForm.get('doctorId')?.value
    const date: Date | null = this.appointmentForm.get('appointmentDate')?.value
    const time: string = this.appointmentForm.get('appointmentTime')?.value
    const clinicId = this.appointmentForm.get('clinicId')?.value

    if (!doctorId || !date || !time) {
      this.alert.fire({
        icon: 'info',
        title: 'Datos incompletos',
        text: 'Por favor seleccione doctor, fecha y hora',
      })
      return
    }

    const fullDateTime = new Date(
      date.getFullYear(),
      date.getMonth(),
      date.getDate(),
      parseInt(time.split(':')[0], 10),
      parseInt(time.split(':')[1], 10),
    )

    this.appointmentsService
      .getDoctorAvailability(doctorId, fullDateTime.toISOString(), clinicId)
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: availability => {
          if (availability.available) {
            this.alert.fire({
              icon: 'success',
              title: 'Horario disponible',
              text: 'El horario seleccionado está disponible',
            })
          } else {
            this.alert.fire({
              icon: 'warning',
              title: 'Horario no disponible',
              text: availability.message || 'Este horario ya está ocupado',
              confirmButtonText: 'Entendido',
            })
          }
        },
        error: () => {},
      })
  }

  private scrollToFirstError(): void {
    scrollToFirstInvalidField(this.elRef.nativeElement as HTMLElement)
  }

  // Badges de error por sección — appointmentForm es un único FormGroup (no uno por
  // sección como patient-form), así que cada método acota el conteo a los campos de su
  // propia tarjeta visual. Visibles recién tras markAllAsTouched() en onSubmit().
  participantsErrorCount(): number {
    return countInvalidFields(this.appointmentForm, ['patientId', 'doctorId', 'clinicId'])
  }

  scheduleErrorCount(): number {
    return countInvalidFields(this.appointmentForm, ['appointmentDate', 'appointmentTime', 'duration'])
  }

  classificationErrorCount(): number {
    return countInvalidFields(this.appointmentForm, ['appointmentType', 'priority'])
  }

  detailsErrorCount(): number {
    return countInvalidFields(this.appointmentForm, ['reason', 'notes'])
  }

  goBack() {
    this.router.navigate(['/dashboard/appointments'])
  }

  // Helpers para el template
  getPatientFullName(patient: Patient): string {
    return `${patient.firstName} ${patient.lastName}`
  }

  getDoctorFullName(doctor: ClinicalStaffMember): string {
    return `${doctor.personalInfo?.firstName || ''} ${doctor.personalInfo?.lastName || ''}`.trim()
  }

  getDoctorSpecialization(doctor: ClinicalStaffMember): string {
    return doctor.professionalInfo?.specialization || 'Sin especialización'
  }
}
