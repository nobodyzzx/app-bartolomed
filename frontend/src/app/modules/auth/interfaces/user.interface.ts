export interface User {
  email: string
  id: string
  personalInfo: {
    firstName: string
    lastName: string
    phone?: string
  }
  isActive: boolean
  roles: string[]
  professionalInfo?: {
    specialization: string
    title?: string
    role?: string
    license?: string
    certifications?: string[]
    areas?: string[]
    description?: string
  }
  startDate?: Date
}
