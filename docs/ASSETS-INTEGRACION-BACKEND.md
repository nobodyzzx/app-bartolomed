# Integración Backend de Activos - Documentación

## Resumen

Se completó la integración del módulo de activos conectando el frontend Angular con el backend NestJS implementado previamente.

---

## Cambios Realizados

### 1. Servicio HTTP Real (Frontend)

**Archivo:** `frontend/src/app/modules/dashboard/pages/assets-control/services/asset-registration.service.ts`

**Cambios principales:**

- ✅ Eliminado mock data (5 activos de prueba)
- ✅ Implementado HttpClient para llamadas a API REST
- ✅ Agregado manejo de errores con ErrorService
- ✅ Integrado AlertService para notificaciones de éxito
- ✅ Soporte completo para filtros (status, type, location, manufacturer, category, condition, dates, search)
- ✅ Nuevo método `getCategories()` para valores únicos
- ✅ Tipado de `AssetStats` con interface exportada

**Métodos implementados:**

```typescript
getAssets(filters?: AssetFilters): Observable<BaseAsset[]>
getAssetById(id: string): Observable<BaseAsset>
createAsset(assetData: CreateAssetDto): Observable<BaseAsset>
updateAsset(id: string, assetData: Partial<CreateAssetDto>): Observable<BaseAsset>
deleteAsset(id: string): Observable<void>
getAssetTypes(): Observable<string[]>
getManufacturers(): Observable<string[]>
getLocations(): Observable<string[]>
getCategories(): Observable<string[]>
validateSerialNumber(serialNumber: string, excludeId?: string): Observable<boolean>
getAssetStats(): Observable<AssetStats>
```

**Patrón de manejo de errores:**

```typescript
private handleHttpError = (error: any): Observable<never> => {
  this.errorService.handleError(error);
  return throwError(() => error);
};
```

---

### 2. Ajuste del Componente (Frontend)

**Archivo:** `asset-registration.component.ts`

**Cambios:**

- ✅ Actualizado `deleteAsset()` para manejar `Observable<void>` (antes era `Observable<boolean>`)
- ✅ Eliminada validación `if (success)` ya que el método no retorna booleano
- ✅ El error se maneja automáticamente en el servicio (ErrorService muestra el alert)

**Antes:**

```typescript
next: (success) => {
  if (success) {
    // lógica
  }
  this.loading = false;
};
```

**Después:**

```typescript
next: () => {
  // lógica ejecutada directamente
  this.loading = false;
};
```

---

### 3. Documentación de API

**Archivo:** `docs/ASSETS-BACKEND-API.md`

**Contenido:**

- 📄 Documentación completa de los 8 endpoints
- 📄 Ejemplos de request/response para cada operación
- 📄 Query params soportados en filtros
- 📄 Enums (AssetType, AssetStatus, AssetCondition, DepreciationMethod)
- 📄 Características especiales (asset tag auto-generado, cálculo de depreciación)
- 📄 Métodos helper de la entidad
- 📄 Errores comunes con códigos HTTP
- 📄 TODOs pendientes (multi-tenant, mantenimiento, exportación)

---

## Endpoints Disponibles

### Base URL: `/api/assets`

| Método | Endpoint                                | Descripción            | Roles                             |
| ------ | --------------------------------------- | ---------------------- | --------------------------------- |
| GET    | `/assets`                               | Listar con filtros     | ADMIN, SUPER_ADMIN, DOCTOR, NURSE |
| GET    | `/assets/stats`                         | Estadísticas agregadas | ADMIN, SUPER_ADMIN                |
| GET    | `/assets/validate-serial/:serialNumber` | Validar unicidad       | ADMIN, SUPER_ADMIN                |
| GET    | `/assets/unique/:field`                 | Valores únicos         | ADMIN, SUPER_ADMIN                |
| POST   | `/assets`                               | Crear activo           | ADMIN, SUPER_ADMIN                |
| GET    | `/assets/:id`                           | Obtener por ID         | ADMIN, SUPER_ADMIN, DOCTOR, NURSE |
| PATCH  | `/assets/:id`                           | Actualizar             | ADMIN, SUPER_ADMIN                |
| DELETE | `/assets/:id`                           | Eliminar (soft)        | ADMIN, SUPER_ADMIN                |

---

## Flujo de Datos

```
┌─────────────────────────────────────────────────────────┐
│                     FRONTEND (Angular)                   │
├─────────────────────────────────────────────────────────┤
│  asset-registration.component.ts                         │
│    ↓ loadAssets()                                        │
│  asset-registration.service.ts                           │
│    → GET /api/assets?filters                             │
└─────────────────────────────────────────────────────────┘
                            ↓
┌─────────────────────────────────────────────────────────┐
│                    BACKEND (NestJS)                      │
├─────────────────────────────────────────────────────────┤
│  assets.controller.ts                                    │
│    → @Auth(ValidRoles.ADMIN, SUPER_ADMIN, ...)          │
│    → AssetsService.findAll(filters, clinicId)           │
│       → TypeORM QueryBuilder con filtros                │
│          → PostgreSQL: SELECT * FROM asset WHERE ...     │
└─────────────────────────────────────────────────────────┘
                            ↓
┌─────────────────────────────────────────────────────────┐
│                      RESPUESTA                           │
├─────────────────────────────────────────────────────────┤
│  JSON: BaseAsset[] con campos calculados                │
│    - currentValue (depreciación aplicada)                │
│    - accumulatedDepreciation                             │
│    - isUnderWarranty (computed)                          │
│    - daysUntilMaintenance (computed)                     │
└─────────────────────────────────────────────────────────┘
```

---

## Ejemplo de Uso

### Crear un Activo

**Frontend (Componente):**

```typescript
onSubmit() {
  const formData: CreateAssetDto = this.assetForm.value;
  this.assetService.createAsset(formData).subscribe({
    next: (asset) => {
      console.log('Activo creado:', asset.assetTag);
      // AlertService muestra "Éxito: Activo creado correctamente"
      this.loadAssets();
      this.loadStats();
    }
    // Los errores se manejan automáticamente en el servicio
  });
}
```

**Backend Response:**

```json
{
  "id": "uuid-generated",
  "assetTag": "MED-1731600000-789",
  "name": "Máquina de Rayos X",
  "type": "medical_equipment",
  "status": "active",
  "purchasePrice": 85000,
  "currentValue": 85000,
  "accumulatedDepreciation": 0,
  "monthlyDepreciation": 666.67,
  "isUnderWarranty": true,
  "daysUntilMaintenance": 180,
  "createdAt": "2024-11-14T10:00:00Z"
}
```

### Filtrar Activos

**Frontend:**

```typescript
const filters: AssetFilters = {
  status: AssetStatus.ACTIVE,
  type: 'medical_equipment',
  search: 'rayos',
};

this.assetService.getAssets(filters).subscribe({
  next: (assets) => (this.assets = assets),
});
```

**Request generado:**

```
GET /api/assets?status=active&type=medical_equipment&search=rayos
```

---

## Manejo de Errores

El servicio usa un patrón centralizado de manejo de errores:

1. **ErrorService** captura errores HTTP y muestra SweetAlert automáticamente
2. **throwError** re-lanza el error para que el componente pueda reaccionar si es necesario
3. **AlertService** muestra notificaciones de éxito en operaciones CRUD

### Tipos de Errores

| Código | Título                 | Acción                                |
| ------ | ---------------------- | ------------------------------------- |
| 400    | Error de Validación    | Muestra mensaje del backend           |
| 401    | Error de Autenticación | Redirige a login (interceptor)        |
| 403    | Error de Permisos      | "No tiene permisos suficientes"       |
| 404    | No Encontrado          | "Activo no encontrado"                |
| 500    | Error del Servidor     | "Error interno. Intente más tarde"    |
| 0      | Error de Conexión      | "No se pudo conectar con el servidor" |

---

## Características Especiales Implementadas

### 1. Asset Tag Auto-generado

Cada activo recibe un tag único: `{PREFIX}-{TIMESTAMP}-{RANDOM}`

- Prefijos: `MED`, `FUR`, `COM`, `VEH`, `BLD`, `OTH`
- Timestamp: Unix timestamp
- Random: 3 dígitos

### 2. Depreciación Automática

Calculada con hooks `@BeforeInsert` y `@BeforeUpdate`:

```typescript
const monthsOwned = differenceInMonths(new Date(), purchaseDate);
const totalMonths = usefulLifeYears * 12;
const totalDepreciation = purchasePrice - salvageValue;
this.monthlyDepreciation = totalDepreciation / totalMonths;
this.accumulatedDepreciation = this.monthlyDepreciation * monthsOwned;
this.currentValue = purchasePrice - this.accumulatedDepreciation;
```

### 3. Computed Properties

- `isUnderWarranty`: Compara fecha actual con `warrantyExpiry`
- `isMaintenanceDue`: Calcula basado en `lastMaintenanceDate` y `maintenanceIntervalMonths`
- `daysUntilMaintenance`: Días restantes hasta próximo mantenimiento
- `getAge()`: Edad del activo en años

---

## Estado Actual

### ✅ Completado

- Backend CRUD completo (DTOs, Service, Controller, Module)
- Servicio frontend con HttpClient
- Manejo de errores centralizado
- Alertas de éxito con SweetAlert2
- Documentación de API
- Integración de filtros avanzados
- Validación de serial number
- Estadísticas agregadas

### 🔄 Pendiente

- [ ] Implementar filtro por `clinicId` (multi-tenant)
- [ ] Validación asíncrona en wizard de registro
- [ ] Endpoints de `MaintenanceRecord`
- [ ] Exportación backend (CSV/Excel)
- [ ] Carga de imágenes/documentos
- [ ] Historial de cambios (audit trail)
- [ ] Reportes de depreciación
- [ ] Tests unitarios (backend y frontend)
- [ ] Tests E2E con Bruno

---

## Pruebas Recomendadas

1. **Crear un activo** desde el wizard y verificar:

   - Asset tag generado correctamente
   - Depreciación calculada (si tiene datos)
   - Alert de éxito mostrado

2. **Filtrar activos** con diferentes combinaciones:

   - Status + Type
   - Manufacturer + Location
   - Search general

3. **Validar serial number** durante creación:

   - Debe rechazar duplicados
   - Debe permitir mismo serial en edición (excludeId)

4. **Eliminar activo** y verificar:

   - SweetAlert de confirmación
   - Soft delete (no eliminación física)
   - Estadísticas actualizadas

5. **Ver estadísticas** en cards del dashboard:
   - Total, active, maintenance, retired
   - Total value vs current value
   - By type, by condition

---

## Notas de Desarrollo

- **Environment:** `baseUrl` apunta a `http://localhost:3000/api` en desarrollo
- **Interceptors:** AuthInterceptor inyecta JWT, ClinicContextInterceptor agrega `X-Clinic-Id`
- **TypeORM:** Entity ya registrada en `app.module.ts`
- **Roles:** Backend valida con `@Auth()` decorator, frontend con guards en rutas
- **Date handling:** Backend usa `Date`, frontend puede necesitar transformación ISO strings

---

## Próximos Pasos Sugeridos

1. **Integrar validación asíncrona en wizard:**

   ```typescript
   serialNumberCtrl.setAsyncValidators([
     (control: AbstractControl) => {
       return this.assetService
         .validateSerialNumber(control.value)
         .pipe(map((isValid) => (isValid ? null : { serialExists: true })));
     },
   ]);
   ```

2. **Implementar filtro por clínica:**

   - Extraer `clinicId` del contexto de usuario (JWT o ClinicContextService)
   - Actualizar controller TODOs
   - Agregar `WHERE clinic.id = :clinicId` en queries

3. **Agregar Swagger decorators:**

   ```typescript
   @ApiOperation({ summary: 'Crear un nuevo activo' })
   @ApiResponse({ status: 201, description: 'Activo creado', type: Asset })
   @ApiResponse({ status: 400, description: 'Datos inválidos' })
   ```

4. **Tests E2E con Bruno:**
   - Colección `/bruno/app-bartolomed/Assets/`
   - Crear, Listar, Actualizar, Eliminar
   - Validar serial duplicado
   - Stats endpoint
