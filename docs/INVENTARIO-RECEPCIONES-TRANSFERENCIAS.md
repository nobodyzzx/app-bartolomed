# Inventario y Recepciones - Notas de Implementación y Próximos Pasos

## Implementación Completada

### Recepción de Órdenes de Compra con Inventario

**Backend (`purchase-orders.service.ts`)**:

- Al recibir items (`POST /:id/receive`):
  - Actualiza `receivedQuantity` por ítem validando contra el pendiente.
  - **Integración con inventario**: Por cada cantidad recibida (delta):
    - Crea un lote en `MedicationStock` usando `addStock()`.
    - Parámetros:
      - `batchNumber`: usa el del DTO si viene; si no, genera `${orderNumber}-${itemId}-${timestamp}`.
      - `expiryDate`: usa la del DTO si viene; si no, usa `expectedDeliveryDate` o +365 días.
      - `unitCost` y `sellingPrice` (provisional): iguales a `item.unitPrice`.
      - `clinicId`: tomado de la orden (validado como obligatorio).
    - Registra `StockMovement` tipo `PURCHASE` con referencia al `orderNumber`.
  - Determina estado final: `partially_received` o `received`.
  - Fija `actualDeliveryDate` si está completo.

**Frontend (`purchase-order-receive`)**:

- Formulario incluye campos opcionales por ítem:
  - `batchNumber`: texto libre.
  - `expiryDate`: date picker.
- Se envían en el payload si están completos; si no, backend usa defaults.

### Transferencia de Stock entre Clínicas

**Backend (`inventory.service.ts`)**:

- Endpoint: `POST /pharmacy/inventory/stock/transfer`
- DTO: `{ sourceStockId, toClinicId, quantity, location?, note? }`
- Proceso:
  - Valida cantidad > 0 y `availableQuantity` suficiente en origen.
  - Verifica que clínica destino exista.
  - Descuenta de origen: `quantity` y `availableQuantity`.
  - Crea lote destino:
    - Nuevo `batchNumber`: `${original}-T${timestamp}` (evita conflicto de unicidad global).
    - Copia atributos (medication, precios, expiryDate, etc.).
    - `clinic`: destino.
  - Registra dos `StockMovement` tipo `TRANSFER`:
    - Out: desde origen con referencia `to:${toClinicId}`.
    - In: hacia destino con referencia `from:${sourceClinicId}`.

**Frontend (`transfer-stock`)**:

- Carga clínicas activas (excluyendo la actual) con `ClinicsService`.
- Carga stocks disponibles (`availableQuantity > 0`) de clínica actual con `InventoryService`.
- Selección de lote: dropdown con display "Nombre - Lote: XXX (N disp.)".
- Muestra resumen del lote seleccionado (medicamento, lote, disponible, vencimiento).
- Validación dinámica de cantidad máxima según `availableQuantity`.
- Confirmación con SweetAlert mostrando detalles del producto y destino.

---

## Validaciones Implementadas

### Recepción

- ✅ `clinicId` obligatorio en la orden antes de recibir (error si falta).
- ✅ Cantidad a recibir no puede exceder el pendiente por ítem.
- ✅ Batch único global: si backend detecta batch duplicado, falla al crear stock (se captura sin romper).

### Transferencia

- ✅ Cantidad > 0 y ≤ `availableQuantity` del lote origen.
- ✅ Clínica destino debe existir y estar activa.
- ✅ Batch destino único (sufijo `-T<timestamp>`).

---

## Pricing y Lógica de Negocio Pendiente

### Pricing al Recibir

**Situación actual**:

- `unitCost` = `item.unitPrice` (costo del PO).
- `sellingPrice` = `item.unitPrice` (sin margen aplicado).

**Opciones a implementar**:

1. **Margen fijo por clínica**:
   - Tabla `clinic_settings` con `defaultMargin` (ej. 1.3 = +30%).
   - Al recibir: `sellingPrice = unitCost * clinic.defaultMargin`.
2. **Margen por categoría de medicamento**:
   - `MedicationCategory` con margen asociado.
   - Al recibir: consultar categoría y aplicar margen.
3. **Lista de precios manual**:
   - Permitir que al recibir se especifique `sellingPrice` por lote.
   - Añadir campo opcional en DTO de recepción.

**Recomendación**: Opción 1 (margen por clínica) + override manual opcional.

### Validaciones Adicionales

**Recepción**:

- [ ] Bloquear recepción si orden está en estado `CANCELLED` o `DELIVERED`.
- [ ] Auditoría: registrar `receivedBy` (userId) en el lote creado.
- [ ] Validar que `medicationId` exista antes de crear stock (actualmente se captura error).

**Transferencia**:

- [ ] Validar que usuario tenga permisos en ambas clínicas (origen y destino).
- [ ] Registrar `processedBy` en los movimientos TRANSFER.
- [ ] Opcional: requerir aprobación para transferencias > umbral de cantidad o valor.

### Mejoras de UX

**Recepción**:

- [ ] Botón "Capturar lote y vencimiento para todos" con valores masivos.
- [ ] Validación frontend: warning si expiryDate < hoy o < 30 días.
- [ ] Previsualización del lote que se creará (batch, expiry, ubicación).

**Transferencia**:

- [ ] Búsqueda/filtro de stocks por medicamento, lote, o ubicación.
- [ ] Historial de transferencias recientes en la vista de inventario.
- [ ] Confirmación de recepción en clínica destino (workflow de aprobación).

**Inventario general**:

- [ ] Vista consolidada de stock por medicamento (sumando lotes de todas las clínicas).
- [ ] Alertas de stock bajo por clínica (basado en `minimumStock`).
- [ ] Dashboard de vencimientos próximos (frontend ya tiene servicio, faltan alertas visuales).

---

## Migración de Datos Legacy

**Items con `orderId` vs `order_id`**:

- Si hay órdenes antiguas con items usando columna `orderId` (antes de la refactor):
  - Opción 1: Migración SQL manual para actualizar FK.
  - Opción 2: Reseed completo (recomendado si DB es dev/staging).

**Órdenes sin `clinicId`**:

- Script para asignar clínica por defecto o basado en `createdBy.clinic`.
- Validar antes de permitir recepción.

---

## Testing Recomendado

### Backend E2E

- [ ] Crear orden → recibir parcial → verificar stock creado y movimiento.
- [ ] Recibir completo → verificar estado `received` y `actualDeliveryDate`.
- [ ] Recibir con batch/expiry custom → verificar que se usen.
- [ ] Transferir stock → verificar descuento origen, creación destino, movimientos.
- [ ] Intentar transferir más de `availableQuantity` → error.

### Frontend

- [ ] Flujo completo de recepción con lote y vencimiento.
- [ ] Flujo de transferencia seleccionando lote y clínica.
- [ ] Validación de formularios (cantidad máxima, campos requeridos).

---

## Roadmap de Funcionalidades

### Corto plazo (sprint actual)

- [x] Recepción con creación de stock y movimientos.
- [x] Transferencia inter-clínica con UI mejorada.
- [x] Validación de `clinicId` obligatorio.
- [ ] Implementar margen de pricing configurable por clínica.
- [ ] Bloquear recepción en estados inválidos (cancelled/delivered).

### Mediano plazo

- [ ] Auditoría completa: `receivedBy`, `processedBy` en movimientos.
- [ ] Workflow de aprobación para transferencias grandes.
- [ ] Dashboard de alertas (bajo stock, vencimientos).
- [ ] Reportes de movimientos de stock por rango de fechas.

### Largo plazo

- [ ] Integración con ventas/dispensación para reservar y consumir stock.
- [ ] Trazabilidad completa de lote (de compra a venta).
- [ ] Multi-moneda y conversión de precios.
- [ ] API de inventario para integraciones externas.

---

## Comandos de Verificación

### Backend (desde /mnt/USER/Projects/app-bartolomed)

```fish
# Verificar compilación
cd backend
npm run build

# Ejecutar tests
npm test

# Ver logs de contenedor backend (Podman)
podman-compose logs -f backend
```

### Frontend (desde /mnt/USER/Projects/app-bartolomed)

```fish
# Verificar compilación Angular
cd frontend
ng build

# Linter
ng lint
```

### API manual (con token válido)

```fish
# Recibir orden con batch y expiry
set TOKEN (cat /tmp/token.txt | tr -d '\n')
printf '{"items":[{"itemId":"ITEM-UUID","receivingQuantity":5,"batchNumber":"LOTE-001","expiryDate":"2026-12-31"}]}' | \
  curl -s -X POST http://localhost:3000/api/pharmacy/purchase-orders/ORDER-UUID/receive \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer $TOKEN" \
  -d @- | jq

# Transferir stock
printf '{"sourceStockId":"STOCK-UUID","toClinicId":"CLINIC-UUID","quantity":3,"note":"Transferencia de prueba"}' | \
  curl -s -X POST http://localhost:3000/api/pharmacy/inventory/stock/transfer \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer $TOKEN" \
  -d @- | jq
```

---

## Notas Técnicas

### Unicidad de Batch

- **Backend**: `batchNumber` es `unique` a nivel global en `medication_stock`.
- **Recepción**: Si usuario no proporciona batch, se genera único con timestamp.
- **Transferencia**: Nuevo batch destino = `${origen}-T${timestamp}` para evitar colisión.
- **Gotcha**: Si dos usuarios reciben simultáneamente con mismo batch manual → error. Capturado en try/catch.

### Movimientos de Stock

- **Tipos**: `PURCHASE`, `SALE`, `ADJUSTMENT`, `EXPIRY`, `DAMAGE`, `TRANSFER`, `RETURN`.
- **Auditoría**: Cada movimiento tiene `movementDate`, `processedBy` (futuro), `reference` (orderNumber, saleId, etc.), `notes`.
- **Cálculo automático**: `totalAmount = quantity * unitPrice` (vía `@BeforeInsert`).

### Estados de Orden

- `DRAFT` → `PENDING` → `APPROVED` → `SENT` → `PARTIALLY_RECEIVED` → `RECEIVED` → `DELIVERED`
- `CANCELLED` (cualquier momento).
- **Recepción**: solo válida si no está `CANCELLED` o `DELIVERED` (pendiente validar).

---

**Última actualización**: 2025-11-12  
**Responsables**: Equipo Backend/Frontend Farmacia  
**Próxima revisión**: Implementar pricing configurable y auditoría de usuarios.
