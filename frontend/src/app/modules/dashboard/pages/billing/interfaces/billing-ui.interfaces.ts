export interface PatientOption {
  id: string
  firstName: string
  lastName: string
}

export interface ClinicOption {
  id: string
  name: string
}

export interface BillingStatistics {
  totalInvoices: number
  paid: number
  pending: number
  overdue: number
  totalRevenue: number
  pendingRevenue: number
}

export interface RecentInvoice {
  id: string
  invoiceNumber: string
  /**
   * Puede venir null: una factura nace de los cargos del checkout, y estos
   * no siempre tienen paciente detrás (venta de mostrador, ver
   * CheckoutService.assertSinglePatient). La interfaz lo declaraba
   * obligatorio, así que cualquier factura sin paciente rompía
   * `getPatientName()` (accedía a `.firstName` de null) al renderizar esa
   * fila de la tabla.
   */
  patient: {
    firstName: string
    lastName: string
  } | null
  issueDate: string
  totalAmount: number
  status: 'paid' | 'pending' | 'overdue' | 'cancelled' | 'draft'
}
