# Instrucciones para cliente - Proyecto Bartolomed

Este documento explica como completar y revisar los archivos de normalizacion de datos (medicamentos, stock, proveedores, activos, mantenimiento y usuarios).

## Archivos que se usan

Los archivos base estan en la carpeta docs/plantillas-csv:

- 1_medicamentos.csv
- 2_stock_inicial.csv
- 3_proveedores.csv
- 4_activos.csv
- 5_mantenimiento_historial.csv
- 6_usuarios.csv

Si se entrega un archivo con un nombre de sede (ej: Irupana, Chulumani), es la misma estructura y reglas.

## Como completar los archivos

1. Abrir los CSV en Excel o Google Sheets.
2. Mantener la fila de encabezados (no borrarla).
3. Completar las filas con la informacion real.
4. Borrar las filas de ejemplo si las hay.
5. Guardar en formato CSV o XLSX.

## Reglas de formato

- Fechas siempre en formato AAAA-MM-DD.
- Decimales con punto. Ejemplo: 10.50
- Si un campo tiene comas, usar comillas.

## Reglas por tipo de archivo

Nota: Si no tienen datos de proveedores o mantenimientos, esos archivos se pueden completar mas adelante en la aplicacion. No es obligatorio entregarlos ahora.

### Medicamentos (1_medicamentos.csv)

- Campos obligatorios: Codigo, Nombre_Comercial, Concentracion, Forma_Farmaceutica, Categoria.
- Este archivo es solo el catalogo de medicamentos. No lleva cantidades.
- Usar valores de categoria y forma farmaceutica segun la guia.

### Stock inicial (2_stock_inicial.csv)

- Codigo_Medicamento debe coincidir con 1_medicamentos.csv.
- Aqui es donde se colocan las cantidades.
- Completar Numero_Lote, Cantidad, Costo_Unitario, Precio_Venta y Fecha_Vencimiento si se conoce.

### Proveedores (3_proveedores.csv)

- Codigo unico para cada proveedor.
- Estado: Activo o Inactivo.
- Si no tienen datos de proveedores, pueden omitir este archivo y completarlo mas adelante en la aplicacion.

### Activos (4_activos.csv)

- Etiqueta unica para cada activo.
- Completar Tipo, Estado y Condicion con valores permitidos.

### Mantenimiento (5_mantenimiento_historial.csv)

- Etiqueta_Activo debe existir en 4_activos.csv.
- Completar Fecha y Tipo.
- Si no tienen datos de mantenimiento, pueden omitir este archivo y completarlo mas adelante en la aplicacion.

### Usuarios (6_usuarios.csv)

- Email unico por usuario.
- Rol valido (SUPER_ADMIN, Admin, Doctor, Enfermera, Farmaceutico, Recepcionista).

## Envio de cambios

- Enviar los archivos actualizados por el canal o correo acordado.
- Si hay correcciones de nombres, indicar el cambio exacto (antes -> despues).
