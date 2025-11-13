# API Ventas de Farmacia

## Endpoints

### GET /api/pharmacy-sales

Devuelve sólo ventas con estado `completed` (modo facturación sólo pagadas).

Query params soportados (cuando se quite la restricción en backend):

- `status`: `pending|completed|cancelled`
- `startDate`, `endDate` (ISO) – rango de fechas de venta

### GET /api/pharmacy-sales?status=completed

Forzando filtrado explícito de ventas completadas.

### GET /api/pharmacy-sales/:id

Detalle de una venta (incluye items y usuario que vendió).

### POST /api/pharmacy-sales

Crea una venta en estado `pending`.

### PATCH /api/pharmacy-sales/:id

Actualiza campos permitidos de una venta (no si está `completed`).

### PATCH /api/pharmacy-sales/:id/status

Actualiza estado (`pending|completed|cancelled`). Al pasar a `completed` se planifica futura reducción de stock.

Body:

```json
{
  "status": "completed",
  "notes": "Pago en efectivo"
}
```

### DELETE /api/pharmacy-sales/:id

Elimina una venta (no `completed`).

### GET /api/pharmacy-sales/daily-total/:date

Total monetario de ventas completadas en un día (YYYY-MM-DD).

### GET /api/pharmacy-sales/summary

Resumen agregado.

Query params opcionales:

- `startDate` ISO
- `endDate` ISO

Respuesta:

```json
{
  "totalSales": 42,
  "completedSales": 42,
  "pendingSales": 0,
  "cancelledSales": 0,
  "totalRevenue": 1234.56,
  "dateRange": {
    "startDate": "2025-11-01T00:00:00.000Z",
    "endDate": "2025-11-13T23:59:59.999Z"
  }
}
```

## Notas de Implementación

- `findAll()` restringido temporalmente a `SaleStatus.COMPLETED` para alinearse con vista de facturación.
- Para volver a exponer todas las ventas, crear endpoint separado (`/pharmacy-sales/all`) o reintroducir filtro `status` en frontend.
- Resumen calcula métricas en una sola consulta base + agregación en memoria (optimizable con SUM + COUNT condicionales si crece volumen).

## Próximos Pasos Opcionales

- Añadir índices en columnas `saleDate`, `status`.
- Integrar reducción de stock real en `updateStatus` -> `completed`.
- Endpoint de exportación (CSV/Excel) directo.
