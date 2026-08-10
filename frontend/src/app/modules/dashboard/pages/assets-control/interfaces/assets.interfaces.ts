export interface PaginatedResult<T> {
  data: T[]
  total: number
  page: number
  limit: number
}

/**
 * Ítem del inventario, alineado con `backend/src/assets/entities/asset.entity.ts`.
 * La ficha se redujo a lo que la clínica usa: qué es, cuánto hay, dónde está y
 * si sirve. Precio, depreciación, garantía, categoría y ubicación detallada se
 * retiraron de la base — ver `SlimDownAssets`.
 */
export interface BaseAsset {
  id: string
  name: string
  /** Unidades del ítem en su ubicación. El backend nunca la devuelve vacía. */
  quantity: number
  type: AssetType
  assetTag?: string
  manufacturer?: string
  model?: string
  serialNumber?: string
  status: AssetStatus
  condition?: AssetCondition
  location?: string
  notes?: string
  createdAt?: Date
  updatedAt?: Date
}

/**
 * Alta y edición: los mismos campos que la ficha. Antes agregaba proveedor,
 * factura, garantía, método de depreciación, vida útil, valor residual, sala,
 * edificio, piso y fechas de mantenimiento — todos retirados de la ficha.
 */
export interface AssetRegistration extends Omit<BaseAsset, 'id' | 'createdAt' | 'updatedAt'> {}

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

export enum AssetCondition {
  EXCELLENT = 'excellent',
  GOOD = 'good',
  FAIR = 'fair',
  POOR = 'poor',
  CRITICAL = 'critical',
}

// DTOs y Filtros
export interface AssetFilters {
  status?: AssetStatus
  type?: string
  location?: string
  manufacturer?: string
  condition?: AssetCondition
  search?: string
}

export interface CreateAssetDto extends AssetRegistration {}

// Espejo de backend/src/assets/dto/update-asset.dto.ts (PartialType(CreateAssetDto))
export interface UpdateAssetDto extends Partial<AssetRegistration> {}

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

// ─── Movimientos entre ambientes ─────────────────────────────────────────────

export interface AssetMovement {
  id: string
  assetId: string
  assetName: string
  fromLocation?: string
  toLocation: string
  quantity: number
  notes?: string
  movedBy?: { id: string; personalInfo?: { firstName: string; lastName: string } }
  clinic?: { id: string; name: string }
  /** Solo cuando el ítem cruzó a la otra clínica. */
  toClinic?: { id: string; name: string }
  createdAt: string
}

export interface MoveAssetDto {
  toLocation: string
  /** Omitido, el ítem se queda en su clínica, que es el caso corriente. */
  toClinicId?: string
  quantity?: number
  notes?: string
}

/** Clínica a la que se puede mandar un ítem, con los ambientes que ya tiene. */
export interface TargetClinic {
  id: string
  name: string
  locations: string[]
}

// ─── Toma de inventario físico ───────────────────────────────────────────────

export enum InventoryCountStatus {
  OPEN = 'open',
  CLOSED = 'closed',
  CANCELLED = 'cancelled',
}

export interface InventoryCountItem {
  id: string
  assetId: string
  assetName: string
  assetTag?: string
  expectedQuantity: number
  /** `null` = sin contar todavía, distinto de haber contado 0. */
  countedQuantity: number | null
  notes?: string
}

export interface InventoryCountSummary {
  items: number
  contados: number
  sinContar: number
  coinciden: number
  faltantes: number
  sobrantes: number
  unidadesEsperadas: number
  unidadesContadas: number
}

export interface InventoryCount {
  id: string
  countNumber: string
  location?: string
  status: InventoryCountStatus
  notes?: string
  items?: InventoryCountItem[]
  summary?: InventoryCountSummary
  startedBy?: { id: string; personalInfo?: { firstName: string; lastName: string } }
  closedBy?: { id: string; personalInfo?: { firstName: string; lastName: string } }
  closedAt?: string
  createdAt: string
}
