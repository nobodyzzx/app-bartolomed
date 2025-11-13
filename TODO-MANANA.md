# TODO Mañana

## Activos (Alta Prioridad)

- Backend: entidad `Asset`, módulo, repositorio, CRUD + filtros (status, type, manufacturer, location, fecha compra desde/hasta).
- Endpoint stats `/api/assets/stats` (total, active, maintenance, retired, totalValue).
- Sustituir servicio mock por `AssetsApiService` en frontend (listado, creación, stats, validación serie async).
- Validación async número de serie con debounce en wizard (estado visual inline).
- Estado vacío (sin activos) con CTA al wizard.
- Exportación CSV (y plan para XLSX) desde tabla.

## Mejoras Wizard Activos

- Botón "Duplicar desde activo" (cargar datos base y permitir edición).
- Previsualización depreciación (placeholder con fórmula lineal simple).
- Indicadores de carga por step (spinner pequeño en botón "Siguiente" cuando aplica).

## Depreciación (Opcional / Después de CRUD Básico)

- Campos: `purchasePrice`, `usefulLifeMonths`, `residualValue`.
- Servicio cálculo lineal: depreciación mensual, valor en fecha actual.
- (Opcional) Endpoint histórico si se requiere informe.

## Ventas Farmacia

- Confirmar necesidad de permiso sólo lectura (`PharmacyBillingRead`). Si sí:
  - Agregar enum, mapear en `role-permissions.map.ts`, actualizar rutas y menú.
- Mover filtros de fecha y método de pago al backend (query params) para evitar traer todas las ventas.
- Tipos más estrictos: interfaz `SalePatient` y remover `(s as any)`.

## Refactor / Utilidades

- Util común de fechas (`parseBackendDate`, `toIso` seguro) para ventas y activos.
- Revisar que `MaterialModule` exporte: `MatStepperModule`, `MatDatepickerModule`, `MatSelectModule`, `MatFormFieldModule`, `MatInputModule`, `MatIconModule`, `MatButtonModule`, `MatTooltipModule`, `MatProgressSpinnerModule`.

## Seguridad

- Decorar nuevos endpoints de activos con `@Auth(ValidRoles.ADMIN, ValidRoles.SUPER_ADMIN)` (y otros roles según política: quizá `PHARMACIST` si corresponde).
- Multi-clínica: filtrar por `clinicId` si se añade ese campo a activos.

## Testing

- Backend: pruebas unitarias para servicio de activos (crear, filtrar, stats).
- Frontend: prueba de wizard (ensamblado de `reviewData`, validación serie mock).

## Documentación

- `docs/ASSETS-BACKEND.md`: modelo, endpoints, ejemplos de requests.
- Actualizar `docs/ASSETS-WIZARD.md` tras integración real.
- Si se agregan filtros backend a ventas: actualizar `PHARMACY-SALES-API.md`.

## Export / Reporting Futuro

- Endpoint `/api/assets/export?format=csv|xlsx` (stream).
- Plantilla básica para reporte PDF (futuro).

## Deuda Menor

- Mensajes uniformes (AlertService vs SnackBar) en activos.
- Reemplazar magic strings de métodos de pago por enum centralizado.

---

**Orden recomendado:** CRUD backend activos → Integración frontend → Validación serie async → Filtros server ventas → Export CSV activos → Permisos extra (si aplica) → Depreciación → Tests → Docs.
