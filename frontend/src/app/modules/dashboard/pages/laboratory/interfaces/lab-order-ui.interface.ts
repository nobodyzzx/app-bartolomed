export interface LabOrderItem {
  id: string
  testName: string
  category: string
  specimenType?: string
  resultValue?: string
  resultUnit?: string
  referenceRange?: string
  isAbnormal?: boolean
  resultNotes?: string
  resultFileUrl?: string
  resultedAt?: string
  enteredBy?: {
    id: string
    email: string
    personalInfo?: { firstName: string; lastName: string }
  }
}

export interface LabOrder {
  id: string
  orderNumber: string
  status: string
  orderDate: string
  clinicalNotes?: string
  isUrgent: boolean
  patient: {
    id: string
    firstName: string
    lastName: string
    documentNumber: string
  }
  doctor: {
    id: string
    email: string
    personalInfo?: { firstName: string; lastName: string }
  }
  items: LabOrderItem[]
}
