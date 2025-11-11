import { Component, OnInit } from '@angular/core'
import { FormControl, FormGroup, Validators } from '@angular/forms'
import { ActivatedRoute, Router } from '@angular/router'
import { AlertService } from '@core/services/alert.service'
import { ErrorService } from '../../../../shared/components/services/error.service'
import { SidenavService } from '../../../../shared/components/services/sidenav.services'
import { User } from '../../../auth/interfaces/user.interface'
import { Clinic } from '../clinics/interfaces'
import { ClinicsService } from '../clinics/services/clinics.service'
import { Patient } from '../patients/interfaces'
import { PatientsService } from '../patients/services/patients.service'
import { UsersService } from '../users/users.service'
import {
  AppointmentPriority,
  AppointmentsService,
  AppointmentType,
  CreateAppointmentDto,
} from './services/appointments.service'

@Component({
  selector: 'app-appointment-form',
  templateUrl: './appointment-form.component.html',
})
export class AppointmentFormComponent implements OnInit {
  isExpanded: boolean = true
  isEditMode: boolean = false
  appointmentId: string | null = null
  isLoading: boolean = false

  // Listas de datos
  patients: Patient[] = []
  doctors: User[] = []
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

  public appointmentForm: FormGroup = new FormGroup({
    patientId: new FormControl('', Validators.required),
    doctorId: new FormControl('', Validators.required),
    clinicId: new FormControl('', Validators.required),
    appointmentDate: new FormControl('', Validators.required),
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
    private errorService: ErrorService,
    private sidenavService: SidenavService,
    private alert: AlertService,
    private appointmentsService: AppointmentsService,
    private patientsService: PatientsService,
    private usersService: UsersService,
    private clinicsService: ClinicsService,
  ) {}

  ngOnInit() {
    this.sidenavService.isExpanded$.subscribe(
      (isExpanded: boolean) => (this.isExpanded = isExpanded),
    )

    // Cargar datos iniciales
    this.loadInitialData()

    // Obtener parámetros de la URL
    this.route.paramMap.subscribe(params => {
      this.appointmentId = params.get('id')
      this.isEditMode = !!this.appointmentId

      // Pre-llenar datos si vienen de query params
      this.route.queryParams.subscribe(queryParams => {
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

    // Configurar fecha mínima como hoy
    if (!this.appointmentForm.get('appointmentDate')?.value) {
      const today = new Date().toISOString().split('T')[0]
      this.appointmentForm.get('appointmentDate')?.setValue(today)
    }
  }

  loadInitialData(): void {
    this.isLoading = true

    // Cargar pacientes
    this.patientsService.findAll().subscribe({
      next: patients => {
        this.patients = patients.filter(p => p.isActive)
      },
      error: error => {
        console.error('Error al cargar pacientes:', error)
      },
    })

    // Cargar doctores (usuarios con rol doctor)
    this.usersService.getUsers().subscribe({
      next: users => {
        this.doctors = users.filter(u => u.isActive && u.roles.includes('doctor'))
      },
      error: error => {
        console.error('Error al cargar doctores:', error)
      },
    })

    // Cargar clínicas
    this.clinicsService.findAll(true).subscribe({
      next: clinics => {
        this.clinics = clinics
        // Si solo hay una clínica, pre-seleccionarla
        if (this.clinics.length === 1) {
          this.appointmentForm.patchValue({
            clinicId: this.clinics[0].id,
          })
        }
        this.isLoading = false
      },
      error: error => {
        console.error('Error al cargar clínicas:', error)
        this.isLoading = false
      },
    })
  }

  loadAppointmentData(id: string): void {
    this.isLoading = true
    this.appointmentsService.getAppointment(id).subscribe({
      next: appointment => {
        // Separar fecha y hora
        const appointmentDate = new Date(appointment.appointmentDate)
        const dateStr = appointmentDate.toISOString().split('T')[0]
        const timeStr = appointmentDate.toTimeString().slice(0, 5)

        this.appointmentForm.patchValue({
          patientId: appointment.patient.id,
          doctorId: appointment.doctor.id,
          clinicId: appointment.clinic.id,
          appointmentDate: dateStr,
          appointmentTime: timeStr,
          duration: appointment.duration,
          appointmentType: appointment.type,
          priority: appointment.priority,
          reason: appointment.reason,
          notes: appointment.notes || '',
        })
        this.isLoading = false
      },
      error: error => {
        console.error('Error al cargar cita:', error)
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
      this.alert.fire({
        icon: 'warning',
        title: 'Formulario incompleto',
        text: 'Por favor complete todos los campos requeridos',
      })
      return
    }

    this.isLoading = true

    const appointmentData = this.appointmentForm.value

    // Combinar fecha y hora
    const date = appointmentData.appointmentDate
    const time = appointmentData.appointmentTime
    const fullDateTime = new Date(`${date}T${time}:00`)

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
      this.appointmentsService.updateAppointment(this.appointmentId, submitData).subscribe({
        next: () => {
          this.isLoading = false
          this.router.navigate(['/dashboard/appointments/list'])
        },
        error: error => {
          console.error('Error al actualizar cita:', error)
          this.isLoading = false
        },
      })
    } else {
      this.appointmentsService.createAppointment(submitData).subscribe({
        next: () => {
          this.isLoading = false
          this.router.navigate(['/dashboard/appointments/list'])
        },
        error: error => {
          console.error('Error al crear cita:', error)
          this.isLoading = false
        },
      })
    }
  }

  // Método para verificar disponibilidad
  checkAvailability() {
    const doctorId = this.appointmentForm.get('doctorId')?.value
    const date = this.appointmentForm.get('appointmentDate')?.value
    const time = this.appointmentForm.get('appointmentTime')?.value
    const clinicId = this.appointmentForm.get('clinicId')?.value

    if (!doctorId || !date || !time) {
      this.alert.fire({
        icon: 'info',
        title: 'Datos incompletos',
        text: 'Por favor seleccione doctor, fecha y hora',
      })
      return
    }

    const fullDateTime = new Date(`${date}T${time}:00`)

    this.appointmentsService
      .getDoctorAvailability(doctorId, fullDateTime.toISOString(), clinicId)
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
        error: error => {
          console.error('Error al verificar disponibilidad:', error)
        },
      })
  }

  goBack() {
    this.router.navigate(['/dashboard/appointments'])
  }

  // Helpers para el template
  getPatientFullName(patient: Patient): string {
    return `${patient.firstName} ${patient.lastName}`
  }

  getDoctorFullName(doctor: User): string {
    return `${doctor.personalInfo?.firstName || ''} ${doctor.personalInfo?.lastName || ''}`.trim()
  }

  getDoctorSpecialization(doctor: User): string {
    return doctor.professionalInfo?.specialization || 'Sin especialización'
  }
}
