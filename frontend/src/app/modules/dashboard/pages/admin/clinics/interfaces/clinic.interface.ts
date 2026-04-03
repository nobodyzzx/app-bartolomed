export interface Clinic {
  id: string
  name: string
  address: string
  phone: string
  email?: string
  description?: string
  departamento?: string
  provincia?: string
  localidad?: string
  isActive: boolean
  createdAt: Date
  updatedAt: Date
  createdBy?: {
    id: string
    firstName: string
    lastName: string
  }
  users?: any[]
  patients?: any[]
}

export interface CreateClinicDto {
  name: string
  address: string
  phone: string
  email?: string
  description?: string
  departamento?: string
  provincia?: string
  localidad?: string
  isActive?: boolean
}

export interface UpdateClinicDto extends Partial<CreateClinicDto> {
  isActive?: boolean
}

export interface ClinicStatistics {
  totalClinics: number
  activeClinics: number
  inactiveClinics: number
  clinicsWithUsers: {
    clinicId: string
    clinicName: string
    userCount: number
  }[]
  clinicsWithPatients: {
    clinicId: string
    clinicName: string
    patientCount: number
  }[]
}
