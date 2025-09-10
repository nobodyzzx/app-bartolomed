export interface BaseAsset {
  id: string;
  name: string;
  type: string;
  manufacturer: string;
  model?: string;
  serialNumber?: string;
  purchaseDate: Date;
  purchasePrice?: number;
  warrantyExpiration?: Date;
  status: AssetStatus;
  location?: string;
  description?: string;
  createdAt?: Date;
  updatedAt?: Date;
}

export interface AssetRegistration extends Omit<BaseAsset, 'id' | 'createdAt' | 'updatedAt'> {
  supplier?: string;
  invoiceNumber?: string;
  notes?: string;
}

export interface AssetMaintenance {
  id: string;
  assetId: string;
  assetName?: string;
  maintenanceDate: Date;
  nextMaintenanceDate?: Date;
  description: string;
  type: MaintenanceType;
  status: MaintenanceStatus;
  cost?: number;
  performedBy?: string;
  notes?: string;
  attachments?: string[];
  createdAt?: Date;
  updatedAt?: Date;
}

export interface AssetInventory {
  id: string;
  assetId: string;
  assetName: string;
  location: string;
  department?: string;
  quantity: number;
  condition: AssetCondition;
  status: AssetStatus;
  lastInspectionDate?: Date;
  responsiblePerson?: string;
  notes?: string;
  updatedAt?: Date;
}

export interface AssetReport {
  id: string;
  title: string;
  type: ReportType;
  description?: string;
  date: Date;
  generatedBy?: string;
  parameters?: any;
  status: ReportStatus;
  filePath?: string;
  createdAt?: Date;
}

// Enums
export enum AssetStatus {
  ACTIVE = 'Activo',
  INACTIVE = 'Inactivo',
  MAINTENANCE = 'En Mantenimiento',
  RETIRED = 'Retirado',
  DISPOSED = 'Desechado'
}

export enum AssetCondition {
  EXCELLENT = 'Excelente',
  GOOD = 'Bueno',
  FAIR = 'Regular',
  POOR = 'Malo',
  CRITICAL = 'Crítico'
}

export enum MaintenanceType {
  PREVENTIVE = 'Preventivo',
  CORRECTIVE = 'Correctivo',
  EMERGENCY = 'Emergencia',
  CALIBRATION = 'Calibración',
  INSPECTION = 'Inspección'
}

export enum MaintenanceStatus {
  SCHEDULED = 'Programado',
  IN_PROGRESS = 'En Progreso',
  COMPLETED = 'Completado',
  CANCELLED = 'Cancelado',
  DELAYED = 'Retrasado'
}

export enum ReportType {
  LOCATION = 'Por Ubicación',
  STATUS = 'Por Estado',
  MAINTENANCE = 'Mantenimiento',
  DEPRECIATION = 'Depreciación',
  OBSOLETE = 'Obsoletos',
  FINANCIAL = 'Financiero'
}

export enum ReportStatus {
  PENDING = 'Pendiente',
  GENERATING = 'Generando',
  COMPLETED = 'Completado',
  FAILED = 'Fallido'
}

// DTOs y Filtros
export interface AssetFilters {
  status?: AssetStatus;
  type?: string;
  location?: string;
  manufacturer?: string;
  dateFrom?: Date;
  dateTo?: Date;
}

export interface MaintenanceFilters {
  assetId?: string;
  status?: MaintenanceStatus;
  type?: MaintenanceType;
  dateFrom?: Date;
  dateTo?: Date;
}

export interface CreateAssetDto extends AssetRegistration {}

export interface UpdateAssetDto extends Partial<BaseAsset> {}

export interface CreateMaintenanceDto extends Omit<AssetMaintenance, 'id' | 'createdAt' | 'updatedAt'> {}

export interface UpdateMaintenanceDto extends Partial<AssetMaintenance> {}

export interface GenerateReportDto {
  title: string;
  type: ReportType;
  description?: string;
  filters?: any;
  format?: 'pdf' | 'excel' | 'csv';
}
