export interface PaginatedResult<T> {
  data: T[]
  total: number
  page: number
  limit: number
}

// Alineado 1:1 con backend/src/assets/entities/asset.entity.ts — bug real: el
// campo de garantía se llamaba warrantyExpiration acá pero warrantyExpiry en
// el backend (nunca se usaba, quedaba huérfano); faltaban además la mayoría
// de los campos que el formulario ya envía (category, condition, vendor,
// depreciación, ubicación detallada, mantenimiento), así que CreateAssetDto
// no representaba el payload real (funcionaba solo porque assetForm.value es
// `any` y TS no lo validaba).
export interface BaseAsset {
  id: string
  name: string
  type: AssetType
  assetTag?: string
  category?: string
  subCategory?: string
  manufacturer: string
  model?: string
  serialNumber?: string
  barcodeNumber?: string
  purchaseDate: Date
  purchasePrice?: number
  currentValue?: number
  warrantyExpiry?: Date
  status: AssetStatus
  condition?: AssetCondition
  location?: string
  description?: string
  createdAt?: Date
  updatedAt?: Date
}

export interface AssetRegistration extends Omit<BaseAsset, 'id' | 'createdAt' | 'updatedAt'> {
  vendor?: string
  invoiceNumber?: string
  warrantyInfo?: string
  depreciationMethod?: DepreciationMethod
  usefulLifeYears?: number
  salvageValue?: number
  room?: string
  building?: string
  floor?: string
  lastMaintenanceDate?: Date
  nextMaintenanceDate?: Date
  maintenanceIntervalMonths?: number
  notes?: string
}

// Campos alineados 1:1 con backend/src/assets/entities/asset-maintenance.entity.ts
// (bug real: antes usaba assetName/maintenanceDate/cost/performedBy, campos que
// no existen en el backend — el formulario nunca podía guardar correctamente).
export interface AssetMaintenance {
  id: string
  assetId: string
  asset?: { id: string; name: string; assetTag: string }
  title: string
  description?: string
  type: MaintenanceType
  status: MaintenanceStatus
  scheduledDate: Date
  completedDate?: Date
  estimatedCost?: number
  actualCost?: number
  technician?: string
  vendor?: string
  workPerformed?: string
  partsReplaced?: string
  notes?: string
  priority?: number
  nextMaintenanceDate?: Date
  createdAt?: Date
  updatedAt?: Date
}

export interface AssetReport {
  id: string
  title: string
  type: ReportType
  description?: string
  date: Date
  dateFrom?: Date
  dateTo?: Date
  generatedBy?: { id: string; personalInfo?: { firstName: string; lastName: string } }
  parameters?: any
  filters?: { status?: AssetStatus }
  status: ReportStatus
  format?: ReportFormat
  filePath?: string
  fileName?: string
  errorMessage?: string
  createdAt?: Date
}

// Enums
// Valores en inglés/minúscula para que coincidan EXACTAMENTE con
// backend/src/assets/entities/asset.entity.ts (AssetStatus/AssetCondition) —
// bug real: antes estaban en español y ningún activo real matcheaba nunca
// contra estos valores (stats, filtros y colores de estado siempre en 0/gris,
// sin ningún error visible). Las etiquetas en español van en getStatusLabel().
export enum AssetStatus {
  ACTIVE = 'active',
  INACTIVE = 'inactive',
  MAINTENANCE = 'maintenance',
  RETIRED = 'retired',
  SOLD = 'sold',
  LOST = 'lost',
  DAMAGED = 'damaged',
}

export enum AssetType {
  MEDICAL_EQUIPMENT = 'medical_equipment',
  FURNITURE = 'furniture',
  COMPUTER = 'computer',
  VEHICLE = 'vehicle',
  BUILDING = 'building',
  OTHER = 'other',
}

export enum DepreciationMethod {
  STRAIGHT_LINE = 'straight_line',
  DECLINING_BALANCE = 'declining_balance',
  UNITS_OF_PRODUCTION = 'units_of_production',
  NO_DEPRECIATION = 'no_depreciation',
}

export enum AssetCondition {
  EXCELLENT = 'excellent',
  GOOD = 'good',
  FAIR = 'fair',
  POOR = 'poor',
  CRITICAL = 'critical',
}

export enum MaintenanceType {
  PREVENTIVE = 'Preventivo',
  CORRECTIVE = 'Correctivo',
  EMERGENCY = 'Emergencia',
  CALIBRATION = 'Calibración',
  INSPECTION = 'Inspección',
}

export enum MaintenanceStatus {
  SCHEDULED = 'Programado',
  IN_PROGRESS = 'En Progreso',
  COMPLETED = 'Completado',
  CANCELLED = 'Cancelado',
  DELAYED = 'Retrasado',
}

export enum ReportType {
  LOCATION = 'Por Ubicación',
  STATUS = 'Por Estado',
  MAINTENANCE = 'Mantenimiento',
  DEPRECIATION = 'Depreciación',
  OBSOLETE = 'Obsoletos',
  FINANCIAL = 'Financiero',
}

export enum ReportStatus {
  PENDING = 'Pendiente',
  GENERATING = 'Generando',
  COMPLETED = 'Completado',
  FAILED = 'Fallido',
}

// Valores en mayúsculas para coincidir con backend/src/assets/entities/asset-report.entity.ts
// (ReportFormat) — el reporte se guarda con @IsEnum(ReportFormat), 'pdf' en minúscula
// era rechazado con 400.
export enum ReportFormat {
  PDF = 'PDF',
  EXCEL = 'EXCEL',
  CSV = 'CSV',
  JSON = 'JSON',
}

/**
 * Extensión del archivo que sirve `GET /assets/reports/:id/download` según el
 * formato elegido al generar. Antes el backend servía CSV siempre y ambas
 * pantallas hardcodeaban `.csv`.
 */
export function reportFileExtension(format: ReportFormat | undefined): string {
  const extensions: Record<ReportFormat, string> = {
    [ReportFormat.PDF]: 'pdf',
    [ReportFormat.EXCEL]: 'xlsx',
    [ReportFormat.CSV]: 'csv',
    [ReportFormat.JSON]: 'json',
  }
  return (format && extensions[format]) || 'csv'
}

// DTOs y Filtros
export interface AssetFilters {
  status?: AssetStatus
  type?: string
  location?: string
  manufacturer?: string
  category?: string
  condition?: AssetCondition
  purchaseDateFrom?: string
  purchaseDateTo?: string
  search?: string
  dateFrom?: Date
  dateTo?: Date
}

export interface MaintenanceFilters {
  assetId?: string
  status?: MaintenanceStatus
  type?: MaintenanceType
  dateFrom?: Date
  dateTo?: Date
}

export interface CreateAssetDto extends AssetRegistration {}

// Espejo de backend/src/assets/dto/update-asset.dto.ts (PartialType(CreateAssetDto))
export interface UpdateAssetDto extends Partial<AssetRegistration> {}

export interface CreateMaintenanceDto {
  assetId: string
  title: string
  description?: string
  type?: MaintenanceType
  scheduledDate: string
  estimatedCost?: number
  technician?: string
  vendor?: string
  notes?: string
  priority?: number
}

export interface UpdateMaintenanceDto {
  title?: string
  description?: string
  type?: MaintenanceType
  status?: MaintenanceStatus
  scheduledDate?: string
  completedDate?: string
  estimatedCost?: number
  actualCost?: number
  technician?: string
  vendor?: string
  workPerformed?: string
  partsReplaced?: string
  notes?: string
  priority?: number
  nextMaintenanceDate?: string
}

// Alineado 1:1 con backend/src/assets/dto/asset-report.dto.ts — bug real: antes
// dateFrom/dateTo iban anidados dentro de `filters` (que el backend nunca lee para
// eso, son campos propios del DTO) y `date` (NOT NULL sin default) faltaba por
// completo, así que el rango de fechas del formulario no hacía nada y el 500 de
// Postgres podía volver a aparecer si el backend dejaba de tolerar el campo ausente.
export interface GenerateReportDto {
  title: string
  type: ReportType
  description?: string
  format: ReportFormat
  date: string
  dateFrom?: string
  dateTo?: string
  filters?: { status?: AssetStatus }
}

// ─── Traslados de activos entre clínicas ──────────────────────────────────────

export enum AssetTransferStatus {
  REQUESTED = 'requested',
  IN_TRANSIT = 'in_transit',
  COMPLETED = 'completed',
  REJECTED = 'rejected',
  RETURNED = 'returned',
}

export interface AssetTransferItem {
  id: string
  assetId: string
  asset?: BaseAsset
  notes?: string
}

export interface AssetTransfer {
  id: string
  transferNumber: string
  sourceClinicId: string
  sourceClinic?: { id: string; name: string }
  targetClinicId: string
  targetClinic?: { id: string; name: string }
  status: AssetTransferStatus
  notes?: string
  requestedById: string
  requestedBy?: { id: string; personalInfo?: { firstName: string; lastName: string } }
  dispatchedById?: string
  dispatchedBy?: { id: string; personalInfo?: { firstName: string; lastName: string } }
  dispatchedAt?: Date
  receivedById?: string
  receivedBy?: { id: string; personalInfo?: { firstName: string; lastName: string } }
  receivedAt?: Date
  rejectionReason?: string
  items: AssetTransferItem[]
  createdAt?: Date
  updatedAt?: Date
}

export interface CreateAssetTransferDto {
  targetClinicId: string
  notes?: string
  items: { assetId: string; notes?: string }[]
}

export interface AssetTransferAuditLog {
  id: string
  transferId: string
  action: string
  actorId: string
  actor?: { id: string; personalInfo?: { firstName: string; lastName: string } }
  actorClinicId: string
  actorClinic?: { id: string; name: string }
  snapshot?: Record<string, any>
  createdAt: Date
}
