# Assets API - Backend Documentation

## Endpoints Implementados

### Base URL

```
/api/assets
```

### Autenticación

Todos los endpoints requieren autenticación JWT y roles específicos.

---

## Endpoints

### 1. Crear Activo

**POST** `/api/assets`

**Roles permitidos:** `ADMIN`, `SUPER_ADMIN`

**Body:**

```json
{
  "name": "Máquina de Rayos X Digital",
  "description": "Equipo de rayos X de alta resolución",
  "type": "medical_equipment",
  "category": "Diagnóstico",
  "manufacturer": "Siemens",
  "model": "MULTIX Fusion",
  "serialNumber": "SX-2024-001",
  "status": "active",
  "condition": "excellent",
  "purchasePrice": 85000,
  "purchaseDate": "2023-01-15",
  "vendor": "MedEquip Solutions",
  "invoiceNumber": "INV-2023-001",
  "warrantyExpiry": "2026-01-15",
  "depreciationMethod": "straight_line",
  "usefulLifeYears": 10,
  "salvageValue": 5000,
  "location": "Sala de Radiología A",
  "room": "102",
  "building": "Edificio Principal",
  "floor": "1",
  "maintenanceIntervalMonths": 6,
  "notes": "Requiere mantenimiento especializado semestral"
}
```

**Response:**

```json
{
  "id": "uuid",
  "assetTag": "MED-123456-789",
  "name": "Máquina de Rayos X Digital",
  ...
  "currentValue": 82500,
  "accumulatedDepreciation": 2500,
  "monthlyDepreciation": 666.67,
  "createdAt": "2024-11-14T10:00:00Z",
  "updatedAt": "2024-11-14T10:00:00Z"
}
```

---

### 2. Listar Activos (con filtros)

**GET** `/api/assets`

**Roles permitidos:** `ADMIN`, `SUPER_ADMIN`, `DOCTOR`, `NURSE`

**Query Params:**

- `status` (opcional): `active`, `inactive`, `maintenance`, `retired`, `sold`, `lost`, `damaged`
- `type` (opcional): `medical_equipment`, `furniture`, `computer`, `vehicle`, `building`, `other`
- `condition` (opcional): `excellent`, `good`, `fair`, `poor`, `critical`
- `manufacturer` (opcional): búsqueda parcial (LIKE)
- `location` (opcional): búsqueda parcial (LIKE)
- `category` (opcional): búsqueda parcial (LIKE)
- `purchaseDateFrom` (opcional): formato `YYYY-MM-DD`
- `purchaseDateTo` (opcional): formato `YYYY-MM-DD`
- `search` (opcional): búsqueda general en nombre, descripción, serial, assetTag

**Ejemplo:**

```
GET /api/assets?status=active&type=medical_equipment&search=rayos
```

**Response:**

```json
[
  {
    "id": "uuid",
    "assetTag": "MED-123456-789",
    "name": "Máquina de Rayos X Digital",
    "status": "active",
    "condition": "excellent",
    "currentValue": 82500,
    "location": "Sala de Radiología A",
    ...
  }
]
```

---

### 3. Obtener Estadísticas

**GET** `/api/assets/stats`

**Roles permitidos:** `ADMIN`, `SUPER_ADMIN`

**Response:**

```json
{
  "total": 25,
  "active": 20,
  "inactive": 2,
  "maintenance": 2,
  "retired": 1,
  "totalValue": 450000,
  "currentValue": 380000,
  "totalDepreciation": 70000,
  "underWarranty": 15,
  "maintenanceDue": 3,
  "byType": {
    "medical_equipment": 15,
    "furniture": 5,
    "computer": 5
  },
  "byCondition": {
    "excellent": 10,
    "good": 12,
    "fair": 3
  }
}
```

---

### 4. Validar Número de Serie

**GET** `/api/assets/validate-serial/:serialNumber`

**Roles permitidos:** `ADMIN`, `SUPER_ADMIN`

**Query Params:**

- `excludeId` (opcional): UUID del activo a excluir de la validación (para edición)

**Ejemplo:**

```
GET /api/assets/validate-serial/SX-2024-001?excludeId=uuid-123
```

**Response:**

```json
true // o false
```

---

### 5. Obtener Valores Únicos

**GET** `/api/assets/unique/:field`

**Roles permitidos:** `ADMIN`, `SUPER_ADMIN`

**Fields permitidos:** `type`, `manufacturer`, `location`, `category`

**Ejemplo:**

```
GET /api/assets/unique/manufacturer
```

**Response:**

```json
["Siemens", "Philips", "GE Healthcare", "Medtronic"]
```

---

### 6. Obtener un Activo

**GET** `/api/assets/:id`

**Roles permitidos:** `ADMIN`, `SUPER_ADMIN`, `DOCTOR`, `NURSE`

**Response:**

```json
{
  "id": "uuid",
  "assetTag": "MED-123456-789",
  "name": "Máquina de Rayos X Digital",
  "description": "Equipo de rayos X de alta resolución",
  "type": "medical_equipment",
  "status": "active",
  "condition": "excellent",
  "purchasePrice": 85000,
  "currentValue": 82500,
  "accumulatedDepreciation": 2500,
  "monthlyDepreciation": 666.67,
  "location": "Sala de Radiología A",
  "isUnderWarranty": true,
  "isMaintenanceDue": false,
  "daysUntilMaintenance": 45,
  "clinic": { ... },
  "createdBy": { ... },
  "assignedTo": { ... },
  ...
}
```

---

### 7. Actualizar Activo

**PATCH** `/api/assets/:id`

**Roles permitidos:** `ADMIN`, `SUPER_ADMIN`

**Body:** (todos los campos opcionales)

```json
{
  "status": "maintenance",
  "condition": "good",
  "location": "Sala de Radiología B",
  "notes": "Actualizado tras mantenimiento"
}
```

**Response:** Activo actualizado completo

---

### 8. Eliminar Activo (soft delete)

**DELETE** `/api/assets/:id`

**Roles permitidos:** `ADMIN`, `SUPER_ADMIN`

**Response:** `204 No Content`

---

## Enums

### AssetType

```typescript
enum AssetType {
  MEDICAL_EQUIPMENT = 'medical_equipment',
  FURNITURE = 'furniture',
  COMPUTER = 'computer',
  VEHICLE = 'vehicle',
  BUILDING = 'building',
  OTHER = 'other',
}
```

### AssetStatus

```typescript
enum AssetStatus {
  ACTIVE = 'active',
  INACTIVE = 'inactive',
  MAINTENANCE = 'maintenance',
  RETIRED = 'retired',
  SOLD = 'sold',
  LOST = 'lost',
  DAMAGED = 'damaged',
}
```

### AssetCondition

```typescript
enum AssetCondition {
  EXCELLENT = 'excellent',
  GOOD = 'good',
  FAIR = 'fair',
  POOR = 'poor',
  CRITICAL = 'critical',
}
```

### DepreciationMethod

```typescript
enum DepreciationMethod {
  STRAIGHT_LINE = 'straight_line',
  DECLINING_BALANCE = 'declining_balance',
  UNITS_OF_PRODUCTION = 'units_of_production',
  NO_DEPRECIATION = 'no_depreciation',
}
```

---

## Características Especiales

### 1. Asset Tag Auto-generado

Cada activo recibe un `assetTag` único al crearse:

- Formato: `{TYPE_PREFIX}-{TIMESTAMP}-{RANDOM}`
- Ejemplo: `MED-123456-789`

### 2. Cálculo Automático de Depreciación

La entidad calcula automáticamente:

- `currentValue`: Valor actual del activo
- `accumulatedDepreciation`: Depreciación acumulada
- `monthlyDepreciation`: Depreciación mensual

### 3. Métodos Helper en Entidad

```typescript
asset.getAge(); // Edad en años
asset.isUnderWarranty(); // ¿Bajo garantía?
asset.isMaintenanceDue(); // ¿Requiere mantenimiento?
asset.getDaysUntilMaintenance(); // Días hasta próximo mantenimiento
```

### 4. Multi-tenant (Preparado)

Relación con `Clinic` lista para filtrar por clínica cuando se implemente el contexto.

---

## Errores Comunes

### 400 Bad Request

```json
{
  "statusCode": 400,
  "message": "El número de serie ya existe",
  "error": "Bad Request"
}
```

### 404 Not Found

```json
{
  "statusCode": 404,
  "message": "Activo no encontrado",
  "error": "Not Found"
}
```

### 403 Forbidden

```json
{
  "statusCode": 403,
  "message": "You do not have the required role. Required: ADMIN, SUPER_ADMIN",
  "error": "Forbidden"
}
```

---

## TODO

- [ ] Implementar filtro por `clinicId` desde contexto de usuario
- [ ] Implementar endpoints de `MaintenanceRecord`
- [ ] Exportación a CSV/Excel desde backend
- [ ] Historial de cambios (audit trail)
- [ ] Carga de imágenes/documentos adjuntos
- [ ] Reportes de depreciación
