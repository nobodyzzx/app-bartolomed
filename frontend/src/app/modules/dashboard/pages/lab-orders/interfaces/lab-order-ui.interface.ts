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
  /** Laboratorio externo al que se deriva; vacío si lo procesa la clínica. */
  providerName?: string | null
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
  /** `internal` la indica un médico de la casa; `external` llega de fuera. */
  origin?: string
  referringDoctorName?: string | null
  /** Cuándo salió la muestra al laboratorio externo. */
  sentToProviderAt?: string | null
  /** Cuándo debería estar el resultado, según los plazos del proveedor. */
  expectedResultDate?: string | null
  /** Nulo en el paciente derivado sin ficha: ahí vale `patientName`. */
  patient: {
    id: string
    firstName: string
    lastName: string
    documentNumber: string
  } | null
  patientName?: string | null
  /** Nulo en las órdenes externas: no hay médico de la casa que las firme. */
  doctor: {
    id: string
    email: string
    personalInfo?: { firstName: string; lastName: string }
  } | null
  items: LabOrderItem[]
}
