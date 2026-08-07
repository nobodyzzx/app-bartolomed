# 📚 ÍNDICE DE DOCUMENTOS - NORMALIZACIÓN DE DATOS

Este es el índice maestro de todos los documentos relacionados con la normalización de datos de clientes para el sistema Bartolomed.

---

## 📂 ESTRUCTURA DE ARCHIVOS CREADOS

```
docs/
├── PLANTILLA-NORMALIZACION-DATOS.md ⭐ (Guía principal para el cliente)
├── EMAIL-TEMPLATE-CLIENTE.md 📧 (Email listo para enviar)
├── GUIA-IMPLEMENTACION-NORMALIZACION.md 🔧 (Guía técnica para desarrolladores)
└── plantillas-csv/ 📊
    ├── README.md (Instrucciones de uso de plantillas)
    ├── 1_medicamentos.csv
    ├── 2_stock_inicial.csv
    ├── 3_proveedores.csv
    ├── 4_activos.csv
    ├── 5_mantenimiento_historial.csv
    └── 6_usuarios.csv
```

---

## 🎯 GUÍA DE USO RÁPIDO

### Para Solicitar Datos al Cliente:

1. **Personalizar el email**
   - Abrir: `EMAIL-TEMPLATE-CLIENTE.md`
   - Llenar campos: [Nombre del Cliente], [Fecha Límite], [Tu información de contacto]
   - Copiar contenido al cliente de correo

2. **Adjuntar archivos**
   - `PLANTILLA-NORMALIZACION-DATOS.md` (guía completa)
   - Todos los archivos de `plantillas-csv/` (7 archivos)

3. **Enviar y dar seguimiento**
   - Establecer recordatorio para fecha límite
   - Estar disponible para resolver dudas

### Para Implementar los Datos Recibidos:

1. **Validar archivos recibidos**
   - Seguir: `GUIA-IMPLEMENTACION-NORMALIZACION.md`
   - Sección: FASE 2 - RECEPCIÓN Y VALIDACIÓN

2. **Transformar datos**
   - Seguir: FASE 3 - TRANSFORMACIÓN DE DATOS
   - Usar scripts de mapeo incluidos

3. **Importar a base de datos**
   - Seguir: FASE 4 - IMPORTACIÓN A BASE DE DATOS
   - Elegir: Seed script o API endpoint

4. **Verificar y reportar**
   - Seguir: FASE 5 - PRUEBAS Y VERIFICACIÓN
   - Generar: FASE 6 - REPORTE AL CLIENTE

---

## 📋 DESCRIPCIÓN DE CADA DOCUMENTO

### 1. [`PLANTILLA-NORMALIZACION-DATOS.md`](PLANTILLA-NORMALIZACION-DATOS.md) ⭐

**Para**: Cliente  
**Propósito**: Guía completa con instrucciones detalladas para llenar las plantillas  
**Contenido**:

- Instrucciones generales
- Descripción detallada de cada tabla y sus campos
- Ejemplos de llenado
- Valores predefinidos aceptados
- Checklist de validación
- Preguntas frecuentes

**Cuándo usar**: Enviar junto con las plantillas CSV al cliente

---

### 2. [`EMAIL-TEMPLATE-CLIENTE.md`](EMAIL-TEMPLATE-CLIENTE.md) 📧

**Para**: Tú (para enviar al cliente)  
**Propósito**: Email pre-redactado listo para personalizar y enviar  
**Contenido**:

- Asunto sugerido
- Explicación del proceso
- Lista de archivos adjuntos
- Instrucciones de entrega
- Información de soporte

**Cuándo usar**: Al iniciar el proceso de recolección de datos

**Pasos**:

1. Copiar contenido
2. Reemplazar campos entre [corchetes]
3. Adjuntar archivos mencionados
4. Enviar

---

### 3. [`GUIA-IMPLEMENTACION-NORMALIZACION.md`](GUIA-IMPLEMENTACION-NORMALIZACION.md) 🔧

**Para**: Desarrollador/Implementador  
**Propósito**: Guía técnica paso a paso para procesar e importar datos  
**Contenido**:

- 6 fases completas de implementación
- Scripts de validación
- Código de transformación
- Ejemplos de importación
- SQL de verificación
- Template de reporte

**Cuándo usar**: Al recibir los datos del cliente y durante la implementación

**Fases incluidas**:

1. ✅ Preparación y envío
2. ✅ Recepción y validación
3. ✅ Transformación de datos
4. ✅ Importación a BD
5. ✅ Pruebas y verificación
6. ✅ Reporte al cliente

---

### 4. [`plantillas-csv/README.md`](plantillas-csv/README.md) 📊

**Para**: Cliente (guía de plantillas)  
**Propósito**: Instrucciones específicas para usar los archivos CSV  
**Contenido**:

- Cómo abrir y editar CSVs
- Formato de datos (fechas, números)
- Valores predefinidos
- Relaciones entre archivos
- Consejos de llenado

**Cuándo usar**: Enviar junto con las plantillas CSV

---

### 5. Plantillas CSV (7 archivos)

#### [`1_medicamentos.csv`](plantillas-csv/1_medicamentos.csv)

**Registros de ejemplo**: 2  
**Campos**: 19 (incluyendo código, nombre, categoría, fabricante, etc.)  
**Obligatorios**: Código, Nombre Comercial, Concentración, Forma Farmacéutica, Categoría

#### [`2_stock_inicial.csv`](plantillas-csv/2_stock_inicial.csv)

**Registros de ejemplo**: 2  
**Campos**: 10 (lote, cantidad, costos, fechas, ubicación)  
**Obligatorios**: Código Medicamento, Número Lote, Cantidad, Costo, Precio, Fecha Vencimiento  
**Relación**: Código_Medicamento → 1_medicamentos.csv

#### [`3_proveedores.csv`](plantillas-csv/3_proveedores.csv)

**Registros de ejemplo**: 2  
**Campos**: 18 (información legal, contacto, términos comerciales)  
**Obligatorios**: Código, Nombre Legal, Estado

#### [`4_activos.csv`](plantillas-csv/4_activos.csv)

**Registros de ejemplo**: 3  
**Campos**: 27 (identificación, especificaciones, financiero, depreciación)  
**Obligatorios**: Etiqueta, Nombre, Tipo, Estado, Condición, Precio Compra, Fecha Compra

#### [`5_mantenimiento_historial.csv`](plantillas-csv/5_mantenimiento_historial.csv)

**Registros de ejemplo**: 3  
**Campos**: 7 (fecha, tipo, descripción, costo)  
**Opcional**: Sí  
**Relación**: Etiqueta_Activo → 4_activos.csv

#### [`6_usuarios.csv`](plantillas-csv/6_usuarios.csv)

**Registros de ejemplo**: 6  
**Campos**: 7 (nombre, email, rol, área)  
**Obligatorios**: Nombre, Email, Rol

---

## 🔄 FLUJO DE TRABAJO COMPLETO

```
┌─────────────────────────────────────────────────────────┐
│ PASO 1: PREPARACIÓN                                     │
│ • Abrir EMAIL-TEMPLATE-CLIENTE.md                       │
│ • Personalizar con datos del cliente                    │
│ • Preparar archivos adjuntos                            │
└────────────────────┬────────────────────────────────────┘
                     │
                     ▼
┌─────────────────────────────────────────────────────────┐
│ PASO 2: ENVÍO AL CLIENTE                                │
│ • Enviar email con plantillas                           │
│ • Adjuntar PLANTILLA-NORMALIZACION-DATOS.md            │
│ • Adjuntar 7 archivos CSV                               │
└────────────────────┬────────────────────────────────────┘
                     │
                     ▼
┌─────────────────────────────────────────────────────────┐
│ PASO 3: SEGUIMIENTO (7-10 días)                         │
│ • Responder dudas del cliente                           │
│ • Recordar fecha límite                                 │
└────────────────────┬────────────────────────────────────┘
                     │
                     ▼
┌─────────────────────────────────────────────────────────┐
│ PASO 4: RECEPCIÓN DE DATOS                              │
│ • Recibir archivos del cliente                          │
│ • Abrir GUIA-IMPLEMENTACION-NORMALIZACION.md           │
└────────────────────┬────────────────────────────────────┘
                     │
                     ▼
┌─────────────────────────────────────────────────────────┐
│ PASO 5: VALIDACIÓN (FASE 2 de guía)                     │
│ • Verificar completitud                                 │
│ • Validar formato                                       │
│ • Validar datos obligatorios                            │
│ • Validar códigos únicos                                │
└────────────────────┬────────────────────────────────────┘
                     │
                     ▼
┌─────────────────────────────────────────────────────────┐
│ PASO 6: TRANSFORMACIÓN (FASE 3 de guía)                 │
│ • Mapear campos CSV → BD                                │
│ • Convertir enums                                       │
│ • Transformar tipos de datos                            │
└────────────────────┬────────────────────────────────────┘
                     │
                     ▼
┌─────────────────────────────────────────────────────────┐
│ PASO 7: IMPORTACIÓN (FASE 4 de guía)                    │
│ • Crear seed script                                     │
│ • Ejecutar importación                                  │
│ • Manejar errores                                       │
└────────────────────┬────────────────────────────────────┘
                     │
                     ▼
┌─────────────────────────────────────────────────────────┐
│ PASO 8: VERIFICACIÓN (FASE 5 de guía)                   │
│ • Verificar conteos                                     │
│ • Verificar relaciones                                  │
│ • Verificar datos críticos                              │
│ • Ejecutar pruebas                                      │
└────────────────────┬────────────────────────────────────┘
                     │
                     ▼
┌─────────────────────────────────────────────────────────┐
│ PASO 9: REPORTE (FASE 6 de guía)                        │
│ • Generar reporte de importación                        │
│ • Documentar observaciones                              │
│ • Enviar reporte al cliente                             │
└────────────────────┬────────────────────────────────────┘
                     │
                     ▼
┌─────────────────────────────────────────────────────────┐
│ PASO 10: CIERRE                                          │
│ • Crear usuarios                                        │
│ • Agendar capacitación                                  │
│ • Archivar documentos                                   │
│ • Cliente listo para usar el sistema ✅                 │
└─────────────────────────────────────────────────────────┘
```

---

## 📊 DATOS MANEJADOS

### Resumen de Información a Recopilar:

| Categoría             | Tabla               | Campos Aprox. | Complejidad |
| --------------------- | ------------------- | ------------- | ----------- |
| 💊 Medicamentos       | medications         | 19            | Media       |
| 📦 Stock Medicamentos | medication_stock    | 10            | Media       |
| 🏢 Proveedores        | suppliers           | 18            | Baja        |
| 🏥 Activos Médicos    | assets              | 27            | Alta        |
| 🔧 Historial Mantto.  | maintenance_records | 7             | Baja        |
| 👥 Usuarios           | users               | 7             | Baja        |

**Total de campos**: ~88 campos  
**Tiempo estimado cliente**: 2-5 horas (dependiendo de cantidad de registros)  
**Tiempo estimado implementación**: 4-8 horas (incluyendo validación y pruebas)

---

## ✅ CHECKLIST MAESTRO

### Antes de Enviar al Cliente

- [ ] Revisar que plantillas CSV tengan ejemplos correctos
- [ ] Personalizar EMAIL-TEMPLATE-CLIENTE.md
- [ ] Verificar que todos los archivos estén presentes
- [ ] Establecer fecha límite realista
- [ ] Preparar disponibilidad para soporte

### Durante el Proceso

- [ ] Responder dudas en máximo 24 horas
- [ ] Ofrecer videollamada si es necesario
- [ ] Recordar fecha límite 2 días antes

### Al Recibir los Datos

- [ ] Confirmar recepción al cliente
- [ ] Validar completitud de archivos
- [ ] Validar formato y estructura
- [ ] Identificar errores o faltantes
- [ ] Solicitar correcciones si es necesario

### Durante la Implementación

- [ ] Seguir guía de implementación paso a paso
- [ ] Ejecutar validaciones de datos
- [ ] Realizar importación en ambiente de prueba primero
- [ ] Verificar integridad de datos
- [ ] Crear backup antes de producción

### Después de la Importación

- [ ] Generar reporte de importación
- [ ] Enviar reporte al cliente
- [ ] Crear usuarios del sistema
- [ ] Agendar sesión de capacitación
- [ ] Archivar documentos originales
- [ ] Marcar proyecto como completado

---

## 🆘 PROBLEMAS COMUNES Y SOLUCIONES

### Problema 1: Cliente envía Excel en vez de CSV

**Solución**: Usar pandas o LibreOffice para convertir a CSV

```python
import pandas as pd
df = pd.read_excel('archivo.xlsx')
df.to_csv('archivo.csv', index=False, encoding='utf-8')
```

### Problema 2: Fechas en formato incorrecto

**Solución**: Normalizar fechas en el script de importación

```typescript
const parseDate = (dateStr: string): Date => {
  // Intentar múltiples formatos
  const formats = [
    /^\d{4}-\d{2}-\d{2}$/, // 2024-12-31
    /^\d{2}\/\d{2}\/\d{4}$/, // 31/12/2024
    // ... más formatos
  ];
  // Parser inteligente
};
```

### Problema 3: Códigos duplicados

**Solución**: Agregar sufijo automático o contactar al cliente

```typescript
if (codigoExiste) {
  codigo = `${codigo}-${index}`;
}
```

### Problema 4: Campos con valores incorrectos en enums

**Solución**: Mapear valores similares o usar valor por defecto

```typescript
const normalizeCategory = (cat: string) => {
  const normalized = cat.toLowerCase().trim();
  const mapping = {
    analgesico: 'analgesic',
    analgésico: 'analgesic',
    analgésicos: 'analgesic',
    // ... variaciones
  };
  return mapping[normalized] || 'other';
};
```

---

## 📞 CONTACTO Y SOPORTE

Para dudas sobre estos documentos:

- Revisar primero la guía correspondiente
- Consultar TROUBLESHOOTING en cada documento
- Buscar en el código de ejemplo

---

## 📝 NOTAS FINALES

- **Mantener estos documentos actualizados** cuando cambien las estructuras de BD
- **Personalizar plantillas** según necesidades específicas del cliente
- **Archivar datos originales** del cliente por si se requieren re-importaciones
- **Documentar casos especiales** para futuros clientes similares

---

**Última actualización**: 18 de Febrero de 2026  
**Versión**: 1.0  
**Autor**: Sistema Bartolomed
