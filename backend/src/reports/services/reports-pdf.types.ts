/**
 * Tipos para los datos que recibe ReportsPdfService.
 *
 * Los reportes provienen de queries SQL crudas con shapes flexibles, por lo
 * que las interfaces son **estructurales y permisivas** (index signatures
 * con `unknown`). Esto evita `any` puro pero permite que el caller pase
 * shapes específicos sin error de TypeScript.
 *
 * El objetivo del tipado aquí no es validación estricta — es:
 *  1) Marcar las firmas públicas con un nombre descriptivo (no `any`).
 *  2) Permitir refactor incremental: el día que un shape se estabilice,
 *     se puede ajustar la interface sin tocar la firma.
 */

export type Numeric = number | string | null | undefined;

/**
 * Fila genérica devuelta por queries SQL ad-hoc o por TypeORM.
 * Permisivo por diseño: acepta entidades, plain objects y rows crudas.
 */
export type ReportRow = object;

/** Estructura genérica para reportes que retornan un objeto con secciones. */
export interface ReportSections {
  [key: string]: unknown;
}

// ─── Reportes core ─────────────────────────────────────────────────────────

export interface FinancialReportData extends ReportSections {
  summary?: ReportRow;
  monthlyRevenue?: ReportRow[];
  paymentMethods?: ReportRow[];
}

export interface DemographicsReportData extends ReportSections {
  totalPatients?: Numeric;
  genderDistribution?: ReportRow[];
  ageGroupDistribution?: ReportRow[];
  bloodTypeDistribution?: ReportRow[];
}

/** Doctor performance puede venir como array de filas o como objeto agregado. */
export type DoctorPerformanceReportData = ReportRow[] | (ReportSections & { doctors?: ReportRow[] });

export interface AppointmentsReportData extends ReportSections {
  totalAppointments?: Numeric;
  statusDistribution?: ReportRow[];
  typeDistribution?: ReportRow[];
  monthlyDistribution?: ReportRow[];
  cancellationRate?: Numeric;
  byStatus?: ReportRow[];
  byDay?: ReportRow[];
}

export interface MedicalRecordsReportData extends ReportSections {
  totalRecords?: Numeric;
  typeDistribution?: ReportRow[];
  statusDistribution?: ReportRow[];
  topDiagnoses?: ReportRow[];
  byMonth?: ReportRow[];
}

export interface DashboardReportData extends ReportSections {
  patientsTotal?: Numeric;
  appointmentsToday?: Numeric;
  revenueMonth?: Numeric;
  pendingInvoices?: Numeric;
}

export interface CriticalStockReportData extends ReportSections {
  belowMinimum?: ReportRow[];
  expiringSoon?: ReportRow[];
  expired?: ReportRow[];
  items?: ReportRow[];
  summary?: ReportRow;
}

export interface TransferEfficiencyReportData extends ReportSections {
  kpiByRoute?: ReportRow[];
  stalledTransfers?: ReportRow[];
  stalledCount?: Numeric;
  transfers?: ReportRow[];
  summary?: ReportRow;
}

// ─── Reportes farmacia (filas) ─────────────────────────────────────────────

export interface RotationRow extends ReportRow {
  medicationName?: string;
  alertLevel?: string;
}

export interface MarginRow extends ReportRow {
  medicationName?: string;
}

export interface ProfitabilityRow extends ReportRow {
  month?: unknown;
  revenue?: Numeric;
  cogs?: Numeric;
  grossMargin?: Numeric;
  grossMarginPct?: Numeric;
}

export interface SalesByPharmacistRow extends ReportRow {
  pharmacistName?: string;
  revenuePct?: Numeric;
}

export interface MedicationDetailRow extends ReportRow {
  medicationName?: string;
}

export interface InventoryByCategoryRow extends ReportRow {
  category?: string;
}

// ─── Reportes farmacia (estructurados) ─────────────────────────────────────

export interface DailySalesReportData extends ReportSections {
  dailySales?: ReportRow[];
  paymentBreakdown?: ReportRow[];
}

export interface ExpiryBucketsReportData extends ReportSections {
  already_expired?: ReportRow[];
  expires_lt30?: ReportRow[];
  expires_30_60?: ReportRow[];
  expires_60_90?: ReportRow[];
  summary?: ReportRow;
}

export interface PharmacistDayMedicationData extends ReportSections {
  rows?: ReportRow[];
  byPharmacist?: ReportRow[];
}

export interface ValorizedInventoryData extends ReportSections {
  rows?: ReportRow[];
  summary?: ReportRow;
}

export interface NoMovementReportData extends ReportSections {
  days?: Numeric;
  rows?: ReportRow[];
  totalStockValue?: Numeric;
}

export interface PrescriptionVsFreeData extends ReportSections {
  summary?: ReportRow[] | ReportRow;
  byMedication?: ReportRow[];
}

export interface SalesByPaymentMethodData extends ReportSections {
  summary?: ReportRow[] | ReportRow;
  daily?: ReportRow[];
  grandTotal?: Numeric;
  byMethod?: ReportRow[];
}

export interface MonthlySalesComparisonData extends ReportSections {
  rows?: ReportRow[];
  summary?: ReportRow;
}
