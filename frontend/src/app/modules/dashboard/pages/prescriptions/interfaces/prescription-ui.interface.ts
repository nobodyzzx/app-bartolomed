export interface Prescription {
  id: string
  prescriptionNumber: string
  prescriptionDate: string
  expiryDate: string
  status: string
  diagnosis: string
  patient: {
    id: string
    firstName: string
    lastName: string
    documentNumber: string
  }
  doctor: {
    id: string
    email: string
    personalInfo?: {
      firstName: string
      lastName: string
    }
  }
  items: Array<{
    medicationName: string
    strength: string
    quantity: string
  }>
  refillsAllowed: number
  refillsUsed: number
}

export interface PrescriptionStatistics {
  total: number
  active: number
  expired: number
  expiringSoon: number
}
