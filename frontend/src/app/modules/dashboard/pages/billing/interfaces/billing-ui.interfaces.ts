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
  patient: {
    firstName: string
    lastName: string
  }
  issueDate: string
  totalAmount: number
  status: 'paid' | 'pending' | 'overdue' | 'cancelled' | 'draft'
}
