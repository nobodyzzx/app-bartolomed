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
  /**
   * Faltaban 'partially_paid' y 'refunded': son estados reales de
   * InvoiceStatus (backend) y getStatusLabel()/getStatusClass() ya los
   * traducían, pero el tipo no los reconocía.
   */
  status: 'paid' | 'pending' | 'overdue' | 'cancelled' | 'draft' | 'partially_paid' | 'refunded'
  /** Ausente del tipo pese a que el backend siempre la manda (columna real). */
  remainingAmount?: number
  discountAmount?: number
  /**
   * El motivo vive en los cargos (Charge), no en la factura — el backend lo
   * busca aparte y lo arma como texto único. Nunca sale en el recibo del
   * paciente: es para que el staff sepa por qué se descontó al revisar la
   * lista, no un dato de la factura en sí.
   */
  discountReasons?: string | null
}
