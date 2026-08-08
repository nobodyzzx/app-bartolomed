export interface Appointment {
  id: string
  appointmentDate: Date
  duration: number
  type: string
  status: string
  priority: string
  reason: string
  patient: {
    id: string
    firstName: string
    lastName: string
  }
  // El médico es un `User`: su nombre vive en `personalInfo` y su tratamiento en
  // `professionalInfo.title`, nunca en columnas propias. Declararlo plano —como
  // estaba— compila igual pero devuelve `undefined` en tiempo de ejecución; es lo
  // que ya rompió la columna "Doctor" y el buscador de la lista de citas.
  doctor: {
    id: string
    personalInfo?: { firstName?: string; lastName?: string }
    professionalInfo?: { title?: string; specialization?: string }
  }
}

export interface CalendarDay {
  date: Date
  isCurrentMonth: boolean
  isToday: boolean
  appointments: Appointment[]
  dayNumber: number
}
