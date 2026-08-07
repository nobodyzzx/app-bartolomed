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
  doctor: {
    id: string
    firstName: string
    lastName: string
  }
}

export interface CalendarDay {
  date: Date
  isCurrentMonth: boolean
  isToday: boolean
  appointments: Appointment[]
  dayNumber: number
}
