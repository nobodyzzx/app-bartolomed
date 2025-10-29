import { Component, OnInit } from '@angular/core'
import { FormControl, FormGroup, Validators } from '@angular/forms'
import { Router, ActivatedRoute } from '@angular/router'
import Swal from 'sweetalert2'
import { ErrorService } from '../../../../shared/components/services/error.service'
import { SidenavService } from '../../../../shared/components/services/sidenav.services'

export enum AppointmentType {
  CONSULTATION = 'consultation',
  FOLLOWUP = 'followup',
  EMERGENCY = 'emergency',
  PROCEDURE = 'procedure',
  CHECKUP = 'checkup',
}

export enum Priority {
  LOW = 'low',
  NORMAL = 'normal',
  HIGH = 'high',
  URGENT = 'urgent',
}

@Component({
  selector: 'app-appointment-form',
  templateUrl: './appointment-form.component.html',
})
export class AppointmentFormComponent implements OnInit {
  isExpanded: boolean = true
  isEditMode: boolean = false
  appointmentId: string | null = null

  protected readonly appointmentTypes = [
    { value: AppointmentType.CONSULTATION, label: 'Consulta' },
    { value: AppointmentType.FOLLOWUP, label: 'Seguimiento' },
    { value: AppointmentType.EMERGENCY, label: 'Emergencia' },
    { value: AppointmentType.PROCEDURE, label: 'Procedimiento' },
    { value: AppointmentType.CHECKUP, label: 'Chequeo' },
  ]

  protected readonly priorities = [
    { value: Priority.LOW, label: 'Baja' },
    { value: Priority.NORMAL, label: 'Normal' },
    { value: Priority.HIGH, label: 'Alta' },
    { value: Priority.URGENT, label: 'Urgente' },
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
    priority: new FormControl(Priority.NORMAL, Validators.required),
    reason: new FormControl('', Validators.required),
    notes: new FormControl(''),
  })

  constructor(
    public router: Router,
    private route: ActivatedRoute,
    private errorService: ErrorService,
    private sidenavService: SidenavService,
  ) {}

  ngOnInit() {
    this.sidenavService.isExpanded$.subscribe((isExpanded: boolean) => (this.isExpanded = isExpanded))

    // Obtener parámetros de la URL
    this.route.paramMap.subscribe(params => {
      this.appointmentId = params.get('id')
      this.isEditMode = !!this.appointmentId

      // Pre-llenar datos si vienen de query params
      this.route.queryParams.subscribe(queryParams => {
        if (queryParams['patientId']) {
          this.appointmentForm.patchValue({
            patientId: queryParams['patientId']
          })
        }
        if (queryParams['doctorId']) {
          this.appointmentForm.patchValue({
            doctorId: queryParams['doctorId']
          })
        }
      })

      if (this.isEditMode && this.appointmentId) {
        // Aquí cargarías los datos de la cita
        // this.loadAppointmentData(this.appointmentId)
      }
    })

    // Configurar fecha mínima como hoy
    const today = new Date().toISOString().split('T')[0]
    this.appointmentForm.get('appointmentDate')?.setValue(today)
  }

  onSubmit() {
    if (this.appointmentForm.invalid) {
      this.appointmentForm.markAllAsTouched()
      return
    }

    const appointmentData = this.appointmentForm.value

    // Combinar fecha y hora
    const date = appointmentData.appointmentDate
    const time = appointmentData.appointmentTime
    const fullDateTime = new Date(`${date}T${time}:00.000Z`)

    const submitData = {
      ...appointmentData,
      appointmentDate: fullDateTime.toISOString(),
    }

    if (this.isEditMode && this.appointmentId) {
      // Modo edición
      console.log('Actualizando cita:', submitData)
      
      Swal.fire({
        icon: 'success',
        title: 'Cita actualizada',
        text: 'La cita ha sido actualizada correctamente',
        timer: 2000,
        showConfirmButton: false,
      }).then(() => {
        this.router.navigate(['/dashboard/appointments/list'])
      })
    } else {
      // Modo crear
      console.log('Creando cita:', submitData)
      
      Swal.fire({
        icon: 'success',
        title: 'Cita programada',
        text: 'La cita ha sido programada correctamente',
        timer: 2000,
        showConfirmButton: false,
      }).then(() => {
        this.router.navigate(['/dashboard/appointments/list'])
      })
    }
  }

  // Método para verificar disponibilidad
  checkAvailability() {
    const doctorId = this.appointmentForm.get('doctorId')?.value
    const date = this.appointmentForm.get('appointmentDate')?.value
    const time = this.appointmentForm.get('appointmentTime')?.value

    if (doctorId && date && time) {
      // Aquí llamarías al servicio para verificar disponibilidad
      console.log('Verificando disponibilidad para:', { doctorId, date, time })
    }
  }
}
