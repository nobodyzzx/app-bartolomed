# 📊 Plantillas CSV para Normalización de Datos

Este directorio contiene plantillas en formato CSV que pueden ser abiertas y completadas en **Excel**, **Google Sheets** o cualquier editor de hojas de cálculo.

## 📁 Archivos Incluidos

| Archivo                         | Descripción                            | Campos Obligatorios                                                               |
| ------------------------------- | -------------------------------------- | --------------------------------------------------------------------------------- |
| `1_medicamentos.csv`            | Catálogo de medicamentos               | Código, Nombre Comercial, Concentración, Forma Farmacéutica, Categoría            |
| `2_stock_inicial.csv`           | Inventario inicial por lotes           | Código Medicamento, Número Lote, Cantidad, Costo, Precio Venta, Fecha Vencimiento |
| `3_proveedores.csv`             | Lista de proveedores                   | Código, Nombre Legal, Estado                                                      |
| `4_activos.csv`                 | Inventario de activos médicos          | Etiqueta, Nombre, Tipo, Estado, Condición, Precio, Fecha Compra                   |
| `5_mantenimiento_historial.csv` | Historial de mantenimientos (opcional) | Etiqueta Activo, Fecha, Tipo                                                      |
| `6_usuarios.csv`                | Usuarios del sistema                   | Nombre, Email, Rol                                                                |

## 🚀 Instrucciones de Uso

### Opción 1: Excel / LibreOffice Calc

1. Abrir cada archivo `.csv` con Excel
2. Excel detectará automáticamente las columnas separadas por comas
3. Completar las filas con los datos reales
4. Eliminar las filas de ejemplo (mantener los encabezados)
5. Guardar como `.xlsx` para mejor compatibilidad

### Opción 2: Google Sheets

1. Ir a Google Sheets
2. Archivo → Importar → Subir
3. Seleccionar el archivo CSV
4. Elegir "Reemplazar hoja de cálculo actual"
5. Completar los datos
6. Descargar como Excel (.xlsx) o CSV

### Opción 3: Editor de Texto

Si prefiere trabajar con texto plano, puede editar los CSV directamente asegurándose de:

- Separar campos con comas (`,`)
- Si un campo contiene comas, encerrarlo en comillas (`"`)
- Mantener el formato de fechas: `AAAA-MM-DD`

## ⚠️ Notas Importantes

### Formato de Fechas

Todas las fechas deben estar en formato: `AAAA-MM-DD`

- ✅ Correcto: `2024-12-31`
- ❌ Incorrecto: `31/12/2024`, `12-31-2024`

### Números Decimales

Use punto (`.`) como separador decimal:

- ✅ Correcto: `150.50`
- ❌ Incorrecto: `150,50`

### Códigos Únicos

- Cada medicamento debe tener un código único
- Cada activo debe tener una etiqueta única
- Cada proveedor debe tener un código único
- Los lotes de stock deben tener números de lote únicos

### Valores Predefinidos

#### Para `Forma_Farmaceutica` (medicamentos):

- Tableta
- Cápsula
- Jarabe / Líquido
- Suspensión
- Inyección / Ampolla
- Crema / Pomada
- Gotas
- Supositorio
- Inhalador
- Parche
- Otro

#### Para `Categoria` (medicamentos):

- Analgésico
- Antibiótico
- Antiviral
- Antihistamínico
- Cardiovascular
- Gastrointestinal
- Respiratorio
- Neurológico
- Dermatológico
- Endocrino
- Vacuna
- Suplemento
- Controlado
- Otro

#### Para `Condicion_Almacenamiento`:

- Temperatura Ambiente
- Refrigerado
- Congelado
- Temperatura Controlada
- Lugar Seco
- Protegido de la Luz

#### Para `Tipo` (activos):

- Equipo Médico
- Mobiliario
- Computador
- Vehículo
- Edificio
- Otro

#### Para `Estado` (activos):

- Activo
- Inactivo
- Mantenimiento
- Retirado
- Vendido
- Perdido
- Dañado

#### Para `Condicion` (activos):

- Excelente
- Bueno
- Regular
- Malo
- Crítico

#### Para `Metodo_Depreciacion`:

- Línea Recta
- Saldos Decrecientes
- Unidades de Producción
- Sin Depreciación

#### Para `Rol` (usuarios):

- SUPER_ADMIN
- Admin
- Doctor
- Enfermera
- Farmacéutico
- Recepcionista

#### Para `Requiere_Receta` y `Sustancia_Controlada`:

- Sí
- No

## 📋 Checklist de Validación

Antes de enviar los archivos, verificar:

- [ ] Todos los campos obligatorios están completos
- [ ] Los códigos/etiquetas son únicos (sin duplicados)
- [ ] Las fechas están en formato `AAAA-MM-DD`
- [ ] Los números decimales usan punto (`.`)
- [ ] Los valores predefinidos coinciden con las listas arriba
- [ ] Se eliminaron las filas de ejemplo
- [ ] Los códigos en `stock_inicial.csv` coinciden con `medicamentos.csv`
- [ ] Los códigos en `mantenimiento_historial.csv` coinciden con `activos.csv`

## 🔄 Relaciones Entre Archivos

```
medicamentos.csv  ←──┐
                     │
                     └── stock_inicial.csv (usa Codigo_Medicamento)

proveedores.csv  ←── (referenciado en medicamentos y activos)

activos.csv  ←──┐
                │
                └── mantenimiento_historial.csv (usa Etiqueta_Activo)

usuarios.csv  ──→ (se crearán en el sistema)
```

## 💡 Consejos

1. **Comience con los proveedores**: Complete primero `3_proveedores.csv` para poder referenciarlos en medicamentos y activos
2. **Luego los catálogos**: Complete `1_medicamentos.csv` y `4_activos.csv`
3. **Finalmente los inventarios**: Complete `2_stock_inicial.csv` y `5_mantenimiento_historial.csv`
4. **Usuarios al final**: Complete `6_usuarios.csv`

## 📧 Entrega

Una vez completados, enviar los archivos:

- Por correo electrónico como adjuntos
- Compartir carpeta de Google Drive
- Subir a sistema de almacenamiento compartido

**Formatos aceptados**: `.csv`, `.xlsx`, `.ods`

---

¿Tienes preguntas? Consulta el documento principal: `PLANTILLA-NORMALIZACION-DATOS.md`
