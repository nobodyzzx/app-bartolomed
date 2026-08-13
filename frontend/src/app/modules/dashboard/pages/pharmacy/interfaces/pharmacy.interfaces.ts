// ===========================
// Enums - Alineados con backend
// ===========================

export enum MedicationCategory {
  ANALGESIC = 'analgesic',
  ANTIBIOTIC = 'antibiotic',
  ANTIVIRAL = 'antiviral',
  ANTIHISTAMINE = 'antihistamine',
  CARDIOVASCULAR = 'cardiovascular',
  GASTROINTESTINAL = 'gastrointestinal',
  RESPIRATORY = 'respiratory',
  NEUROLOGICAL = 'neurological',
  DERMATOLOGICAL = 'dermatological',
  ENDOCRINE = 'endocrine',
  VACCINE = 'vaccine',
  SUPPLEMENT = 'supplement',
  CONTROLLED = 'controlled',
  OTHER = 'other',
}

export enum StorageCondition {
  ROOM_TEMPERATURE = 'room_temperature',
  REFRIGERATED = 'refrigerated',
  FROZEN = 'frozen',
  CONTROLLED_TEMPERATURE = 'controlled_temperature',
  DRY_PLACE = 'dry_place',
  LIGHT_PROTECTED = 'light_protected',
}

export enum PurchaseOrderStatus {
  DRAFT = 'draft',
  PENDING = 'pending',
  APPROVED = 'approved',
  SENT = 'sent',
  PARTIALLY_RECEIVED = 'partially_received',
  RECEIVED = 'received',
  DELIVERED = 'delivered',
  CANCELLED = 'cancelled',
}

export enum SaleStatus {
  COMPLETED = 'completed',
  PENDING = 'pending',
  CANCELLED = 'cancelled',
  REFUNDED = 'refunded',
}

export enum PaymentMethod {
  CASH = 'cash',
  CARD = 'card',
  TRANSFER = 'transfer',
  INSURANCE = 'insurance',
  MIXED = 'mixed',
  QR = 'qr',
}

export enum InvoiceStatus {
  PAID = 'paid',
  PENDING = 'pending',
  OVERDUE = 'overdue',
  CANCELLED = 'cancelled',
}

// ===========================
// Interfaces - Medication (Producto)
// ===========================

export interface Medication {
  id: string
  code: string
  name: string
  genericName?: string
  brandName?: string
  strength: string
  dosageForm: string
  category: MedicationCategory
  manufacturer?: string
  supplier?: string
  description?: string
  activeIngredients?: string
  indications?: string
  contraindications?: string
  sideEffects?: string
  dosageInstructions?: string
  storageCondition: StorageCondition
  /** Medicamento, insumo o cuidado personal. */
  productType?: ProductType
  requiresPrescription?: boolean
  isControlledSubstance?: boolean
  controlledSubstanceSchedule?: string
  /** El producto solo llega como muestra médica del laboratorio. Informativo. */
  isMedicalSample?: boolean
  isActive?: boolean
  createdAt?: string
  updatedAt?: string
}

/**
 * Qué clase de producto es, aparte de su categoría farmacológica. Un 20% del
 * catálogo no son medicamentos: bajalenguas y barbijos por un lado, biberones
 * y cepillos por otro.
 */
export enum ProductType {
  MEDICATION = 'medication',
  SUPPLY = 'supply',
  PERSONAL_CARE = 'personal_care',
}

export const PRODUCT_TYPE_LABELS: Record<ProductType, string> = {
  [ProductType.MEDICATION]: 'Medicamento',
  [ProductType.SUPPLY]: 'Insumo',
  [ProductType.PERSONAL_CARE]: 'Cuidado personal',
}

export interface CreateMedicationDto {
  code: string
  name: string
  genericName?: string
  brandName?: string
  strength: string
  dosageForm: string
  category: MedicationCategory
  manufacturer?: string
  supplier?: string
  description?: string
  activeIngredients?: string
  indications?: string
  contraindications?: string
  sideEffects?: string
  dosageInstructions?: string
  storageCondition: StorageCondition
  requiresPrescription?: boolean
  isControlledSubstance?: boolean
  controlledSubstanceSchedule?: string
  productType?: ProductType
  isMedicalSample?: boolean
}

export interface UpdateMedicationDto extends Partial<CreateMedicationDto> {
  isActive?: boolean
}

// ===========================
// Interfaces - Stock Batch
// ===========================

export interface MedicationStock {
  id: string
  medicationId: string
  medication?: Medication
  batchNumber: string
  quantity: number
  quantityReserved?: number
  reservedQuantity?: number
  availableQuantity?: number
  unitCost: number
  sellingPrice: number
  /** Nulo/ausente = vencimiento sin registrar. NO significa que no venza. */
  expiryDate?: string | null
  receivedDate: string
  supplierBatch?: string
  location?: string
  minimumStock?: number
  /** Este lote entró como muestra médica, no comprado. Informativo. */
  isMedicalSample?: boolean
  clinicId?: string
  clinic?: { id: string; name: string }
  isExpired?: boolean
  daysUntilExpiry?: number
  createdAt?: string
  updatedAt?: string
}

export interface CreateMedicationStockDto {
  medicationId: string
  batchNumber: string
  quantity: number
  unitCost: number
  sellingPrice: number
  expiryDate?: string | null
  receivedDate: string
  supplierBatch?: string
  location?: string
  minimumStock?: number
  isMedicalSample?: boolean
  clinicId: string
}

export interface UpdateMedicationStockDto {
  quantity?: number
  unitCost?: number
  sellingPrice?: number
  location?: string
  minimumStock?: number
}

export interface TransferStockDto {
  sourceStockId: string
  toClinicId: string
  quantity: number
  location?: string
  note?: string
}

// ===========================
// Interfaces - Supplier
// ===========================

export enum SupplierType {
  MEDICAMENTOS = 'medicamentos',
  INSUMOS = 'insumos',
  SERVICIOS = 'servicios',
}

export enum SupplierStatus {
  ACTIVE = 'active',
  INACTIVE = 'inactive',
  SUSPENDED = 'suspended',
}

export interface Supplier {
  id: string
  code?: string
  nombreComercial: string // antes: name
  tradeName?: string // backend actual
  razonSocial: string
  idTributario: string // RUC, RFC, NIT, etc.
  tipoProveedor: SupplierType
  contactPerson: string
  email: string
  phone?: string
  mobile?: string
  address?: string
  city?: string
  state?: string
  country?: string
  website?: string
  paymentTerms?: number
  discountRate?: number
  taxId?: string // Deprecated: usar idTributario
  notes?: string
  status: SupplierStatus // Campo actual del backend
  isActive?: boolean // Backward compatibility
  createdAt?: string
  updatedAt?: string
  // Backward compatibility
  name?: string
}

export interface CreateSupplierDto {
  nombreComercial: string
  razonSocial: string
  idTributario: string
  tipoProveedor: SupplierType
  contactPerson: string
  email: string
  phone?: string
  address?: string
  city?: string
  state?: string
  country?: string
  notes?: string
}

export interface UpdateSupplierDto extends Partial<CreateSupplierDto> {
  isActive?: boolean
}

// ===========================
// Interfaces - Purchase Order
// ===========================

export interface PurchaseOrderItem {
  id?: string
  productName: string
  productCode?: string
  medicationId?: string
  medicationName?: string
  brand?: string
  quantity: number
  unitPrice: number
  subtotal?: number
  receivedQuantity?: number
  notes?: string
}

export interface PurchaseOrder {
  id: string
  orderNumber: string
  supplierId: string
  supplier?: Supplier
  clinicId?: string
  orderDate: string
  expectedDeliveryDate?: string
  actualDeliveryDate?: string
  status: PurchaseOrderStatus
  subtotal: number
  taxRate?: number
  taxAmount?: number
  discountAmount?: number
  shippingCost?: number
  totalAmount: number
  notes?: string
  items: PurchaseOrderItem[]
  createdById?: string
  createdBy?: any
  createdAt?: string
  updatedAt?: string
}

export interface CreatePurchaseOrderDto {
  supplierId: string
  clinicId?: string
  orderDate: string
  expectedDeliveryDate?: string
  taxRate?: number
  discountAmount?: number
  shippingCost?: number
  notes?: string
  items: CreatePurchaseOrderItemDto[]
}

export interface CreatePurchaseOrderItemDto {
  productName: string
  productCode?: string
  medicationId?: string
  medicationName?: string
  brand?: string
  quantity: number
  unitPrice: number
  notes?: string
}

export interface UpdatePurchaseOrderStatusDto {
  status: PurchaseOrderStatus
  actualDeliveryDate?: string
  notes?: string
}

// ===========================
// Interfaces - Sale (Venta/Dispensación)
// ===========================

export interface SaleItem {
  id?: string
  medicationStockId: string
  medicationStock?: MedicationStock
  /**
   * Nombre del producto tal como estaba al vender. La entidad lo guarda
   * desnormalizado a propósito: un producto renombrado después no debe
   * reescribir lo que dice un recibo ya emitido. Faltaba en la interfaz, y por
   * eso la pantalla de detalle tiraba de la relación —que ese endpoint ni
   * siquiera carga— y pintaba "Producto" en todas las líneas.
   */
  productName?: string
  productCode?: string
  brand?: string
  quantity: number
  unitPrice: number
  discountPercent?: number
  discountAmount?: number
  subtotal: number
  batchNumber?: string
  expiryDate?: string
}

/**
 * Espejo de lo que devuelve `GET /pharmacy-sales`. Los nombres importan: la
 * interfaz declaraba `totalAmount`, `taxAmount`, `discountAmount`, `changeAmount`
 * y `createdById`, que el backend no manda, y omitía `saleDate`, `total`, `tax`,
 * `discount`, `change` y `soldBy`, que sí. Como TypeScript no protege lo que no
 * está declarado, la columna "Fecha" leía `sale.date` —campo inexistente— y salía
 * vacía en todas las filas sin que nada fallara.
 */
export interface Sale {
  id: string
  saleNumber: string
  saleDate: string
  patientId?: string
  patient?: any
  patientName?: string
  doctorName?: string
  paymentMethod: PaymentMethod
  subtotal: number
  taxRate?: number
  tax?: number
  discount?: number
  total: number
  amountPaid: number
  change?: number
  chargedToAccount?: boolean
  status: SaleStatus
  notes?: string
  prescriptionId?: string
  prescriptionNumber?: string
  items: SaleItem[]
  clinicId: string
  soldById?: string
  soldBy?: any
  createdAt?: string
  updatedAt?: string
}

export interface CreateSaleDto {
  patientId?: string
  patientName?: string
  /** Obligatorio si hay descuento: el backend rechaza una rebaja sin motivo. */
  discountReason?: string
  paymentMethod: PaymentMethod
  taxRate?: number
  discountAmount?: number
  amountPaid: number
  notes?: string
  prescriptionNumber?: string
  /** Id de la receta a dispensar; el backend la valida y la marca DISPENSED al completar la venta. */
  prescriptionId?: string
  /**
   * Deja el medicamento a cuenta del paciente en vez de cobrarlo en farmacia:
   * el importe pasa a la caja general como un cargo pendiente. El backend solo
   * lo acepta con receta y paciente registrado — una venta de mostrador se
   * cobra en farmacia y punto.
   */
  chargeToAccount?: boolean
  items: CreateSaleItemDto[]
  clinicId: string
}

export interface CreateSaleItemDto {
  medicationStockId: string
  quantity: number
  unitPrice: number
  discountPercent?: number
  discountReason?: string
  discountAmount?: number
  totalPrice?: number
  batchNumber?: string
  expiryDate?: string
}

export interface UpdateSaleDto {
  status?: SaleStatus
  paymentMethod?: PaymentMethod
  amountPaid?: number
  notes?: string
}

// ===========================
// Interfaces - Invoice (Factura)
// ===========================

export interface Invoice {
  id: string
  invoiceNumber: string
  saleId: string
  sale?: Sale
  issueDate: string
  date?: string // Alias para issueDate
  dueDate?: string
  paymentDate?: string
  status: InvoiceStatus
  subtotal: number
  taxAmount: number
  totalAmount: number
  total?: number // Alias para totalAmount
  amountPaid: number
  balanceDue: number
  patientName?: string
  patientId?: string
  notes?: string
  clinicId: string
  createdAt?: string
  updatedAt?: string
}

export interface CreateInvoiceDto {
  saleId: string
  dueDate?: string
  notes?: string
}

// ===========================
// Legacy interfaces (mantener por compatibilidad temporal)
// ===========================

/** @deprecated Use Medication instead */
export interface Product {
  id: number
  name: string
  brand: string
  stock: number
  price: number
  expirationDate: string
  category?: string
  description?: string
  minStock?: number
  location?: string
}

/** @deprecated Use PurchaseOrder instead */
export interface Order {
  id?: string
  supplierId: number
  date: string
  items: OrderItem[]
  status?: 'pending' | 'approved' | 'delivered' | 'cancelled'
  total?: number
  supplierName?: string
}

/** @deprecated Use PurchaseOrderItem instead */
export interface OrderItem {
  productId: number
  productName?: string
  quantity: number
  price?: number
  subtotal?: number
}

// ===========================
// UI-only interfaces
// ===========================

export interface PrescriptionListItem {
  id: string
  prescriptionNumber: string
  prescriptionDate: string
  expiryDate: string
  status?: string
  items: Array<{
    medicationName: string
    quantity: string
    strength?: string
  }>
  patient?: any
  doctor?: any
}

export interface SaleRow {
  saleNumber: string
  id: string
  saleId: string
  patientName: string
  date: string
  paymentMethod: string
  total: number
  status: InvoiceStatus
}

export interface ReceiveItemForm {
  itemId: string
  productName: string
  orderedQuantity: number
  previouslyReceived: number
  receivingQuantity: number
  notes: string
  batchNumber?: string
  expiryDate?: string
}

export interface PaginatedResult<T> {
  data: T[]
  total: number
  page: number
  limit: number
}
