# Wizard de Registro de Activos

Ruta: `/dashboard/assets-control/registration/wizard`

## Pasos

1. Básico: Nombre, Tipo, Fabricante, Modelo, Serie, Estado, Descripción.
2. Compra: Fecha, Precio, Garantía, Proveedor, Nº Factura.
3. Ubicación: Ubicación física, Notas.
4. Revisión: Resumen consolidado antes de confirmar.

## Reglas

- Validación de serie única vía `validateSerialNumber` antes de crear.
- Estados permitidos reutilizan `AssetStatus`.
- Fechas convertidas a `Date` antes de enviar a `createAsset`.

## Extensiones Futuras

- Paso de metadatos técnicos (voltaje, calibración, clasificación riesgo).
- Adjuntar documentos (factura PDF, póliza garantía).
- Integración backend real (sustituir mock service).
- Auditoría: registrar usuario que crea el activo.

## Export / Integración

El wizard reutiliza el mismo servicio de registro, por lo que la lista en `asset-registration` mostrará inmediatamente el nuevo activo tras recarga.
