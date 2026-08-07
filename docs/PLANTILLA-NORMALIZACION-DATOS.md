# 📋 PLANTILLA PARA NORMALIZACIÓN DE DATOS

## Sistema Médico Bartolomed

---

## 🎯 INSTRUCCIONES GENERALES

Por favor, complete las siguientes tablas con la información de sus **medicamentos** y **activos médicos**.

### Formato de Entrega:

- **Opción 1**: Llenar las tablas en Excel/Google Sheets (recomendado)
- **Opción 2**: Enviar este documento con las tablas completadas
- **Opción 3**: Enviar archivos CSV separados

### Notas Importantes:

- Los campos marcados con `*` son **obligatorios**
- Respetar los valores de las columnas con opciones predefinidas
- Si no tiene un dato, dejar el campo vacío o escribir "N/A"
- Incluir todos los medicamentos y activos que se manejan actualmente

---

## 💊 TABLA 1: MEDICAMENTOS

### Ejemplo de Registro:

| Código\* | Nombre Comercial\* | Nombre Genérico | Marca  | Concentración\* | Forma Farmacéutica\* | Categoría\* | Fabricante          | Requiere Receta | Sustancia Controlada |
| -------- | ------------------ | --------------- | ------ | --------------- | -------------------- | ----------- | ------------------- | --------------- | -------------------- |
| MED-001  | Paracetamol 500mg  | Acetaminofén    | GenFar | 500mg           | Tableta              | Analgésico  | Laboratorios GenFar | No              | No                   |
| MED-002  | Amoxicilina 500mg  | Amoxicilina     | MK     | 500mg           | Cápsula              | Antibiótico | Tecnoquímicas       | Sí              | No                   |

### Tabla para Completar:

| Código\* | Nombre Comercial\* | Nombre Genérico | Marca | Concentración\* | Forma Farmacéutica\* | Categoría\* | Fabricante | Proveedor Principal | Descripción | Ingredientes Activos | Indicaciones | Contraindicaciones | Efectos Secundarios | Instrucciones Dosificación | Condición Almacenamiento | Requiere Receta | Sustancia Controlada | Programa Control |
| -------- | ------------------ | --------------- | ----- | --------------- | -------------------- | ----------- | ---------- | ------------------- | ----------- | -------------------- | ------------ | ------------------ | ------------------- | -------------------------- | ------------------------ | --------------- | -------------------- | ---------------- |
|          |                    |                 |       |                 |                      |             |            |                     |             |                      |              |                    |                     |                            |                          |                 |                      |                  |
|          |                    |                 |       |                 |                      |             |            |                     |             |                      |              |                    |                     |                            |                          |                 |                      |                  |
|          |                    |                 |       |                 |                      |             |            |                     |             |                      |              |                    |                     |                            |                          |                 |                      |                  |

### Columnas - Descripción Detallada:

#### Campos Básicos Obligatorios:

1. **Código\*** - Código interno del medicamento (ej: MED-001, PARA-500)
2. **Nombre Comercial\*** - Nombre con el que se vende (ej: Paracetamol 500mg)
3. **Nombre Genérico** - Nombre del principio activo (ej: Acetaminofén)
4. **Marca** - Marca comercial del laboratorio (ej: GenFar, MK)
5. **Concentración\*** - Dosis/potencia (ej: 500mg, 10ml, 2.5%)
6. **Forma Farmacéutica\*** - Seleccionar uno:
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
   - Otro (especificar)

7. **Categoría\*** - Seleccionar uno:
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

#### Información del Fabricante:

8. **Fabricante** - Laboratorio que lo produce
9. **Proveedor Principal** - De quién lo compran habitualmente

#### Información Clínica (Opcional pero Recomendada):

10. **Descripción** - Breve descripción del medicamento
11. **Ingredientes Activos** - Componentes activos del medicamento
12. **Indicaciones** - Para qué se usa
13. **Contraindicaciones** - Cuándo NO debe usarse
14. **Efectos Secundarios** - Efectos adversos comunes
15. **Instrucciones Dosificación** - Cómo se debe tomar

#### Condiciones de Almacenamiento:

16. **Condición Almacenamiento** - Seleccionar uno:

- Temperatura Ambiente (15-25°C)
- Refrigerado (2-8°C)
- Congelado (-20°C o menos)
- Temperatura Controlada (específica)
- Lugar Seco
- Protegido de la Luz

#### Control y Regulación:

17. **Requiere Receta** - Sí / No
18. **Sustancia Controlada** - Sí / No
19. **Programa Control** - Si es controlado: Programa I, II, III, IV o especificar

---

## 📦 TABLA 2: STOCK INICIAL DE MEDICAMENTOS

### Ejemplo de Registro:

| Código Medicamento\* | Número de Lote\* | Cantidad\* | Costo Unitario\* | Precio Venta\* | Fecha Vencimiento\* | Fecha Recepción | Lote Proveedor | Ubicación      | Stock Mínimo |
| -------------------- | ---------------- | ---------- | ---------------- | -------------- | ------------------- | --------------- | -------------- | -------------- | ------------ |
| MED-001              | LOTE-2024-001    | 500        | 0.50             | 1.00           | 2026-12-31          | 2024-01-15      | PROV-2024-A    | Estante A1     | 50           |
| MED-002              | LOTE-2024-002    | 200        | 2.50             | 5.00           | 2025-06-30          | 2024-02-01      | PROV-2024-B    | Refrigerador 1 | 20           |

### Tabla para Completar:

| Código Medicamento\* | Número de Lote\* | Cantidad\* | Costo Unitario\* | Precio Venta\* | Fecha Vencimiento\* | Fecha Recepción | Lote Proveedor | Ubicación Física | Stock Mínimo |
| -------------------- | ---------------- | ---------- | ---------------- | -------------- | ------------------- | --------------- | -------------- | ---------------- | ------------ |
|                      |                  |            |                  |                |                     |                 |                |                  |              |
|                      |                  |            |                  |                |                     |                 |                |                  |              |
|                      |                  |            |                  |                |                     |                 |                |                  |              |

### Descripción de Columnas:

1. **Código Medicamento\*** - Debe coincidir con la Tabla 1
2. **Número de Lote\*** - Lote interno (único por medicamento)
3. **Cantidad\*** - Unidades disponibles actualmente
4. **Costo Unitario\*** - Precio al que se compró (en moneda local)
5. **Precio Venta\*** - Precio al que se vende al público
6. **Fecha Vencimiento\*** - Formato: AAAA-MM-DD (ej: 2026-12-31)
7. **Fecha Recepción** - Cuándo ingresó al inventario
8. **Lote Proveedor** - Número de lote del fabricante/proveedor
9. **Ubicación Física** - Dónde está guardado (estante, refrigerador, etc.)
10. **Stock Mínimo** - Cantidad mínima antes de reordenar (default: 10)

---

## 🏥 TABLA 3: PROVEEDORES

### Ejemplo de Registro:

| Código\* | Nombre Legal\*            | Nombre Comercial | RUC/NIT       | Persona Contacto | Email             | Teléfono     | Dirección         | Ciudad | Días Crédito | Descuento % | Estado |
| -------- | ------------------------- | ---------------- | ------------- | ---------------- | ----------------- | ------------ | ----------------- | ------ | ------------ | ----------- | ------ |
| PROV-001 | Distribuidora Médica S.A. | DisMed           | 1234567890001 | Juan Pérez       | ventas@dismed.com | 099-123-4567 | Av. Principal 123 | Quito  | 30           | 5.0         | Activo |

### Tabla para Completar:

| Código\* | Nombre Legal\* | Nombre Comercial | RUC/NIT | Persona Contacto | Email | Teléfono | Celular | Dirección | Ciudad | Provincia | País | Sitio Web | Días Crédito | Descuento % | Estado\* |
| -------- | -------------- | ---------------- | ------- | ---------------- | ----- | -------- | ------- | --------- | ------ | --------- | ---- | --------- | ------------ | ----------- | -------- |
|          |                |                  |         |                  |       |          |         |           |        |           |      |           |              |             |          |
|          |                |                  |         |                  |       |          |         |           |        |           |      |           |              |             |          |

### Descripción de Columnas:

1. **Código\*** - Código interno del proveedor
2. **Nombre Legal\*** - Razón social
3. **Nombre Comercial** - Nombre con el que opera
4. **RUC/NIT** - Identificación tributaria
5. **Persona Contacto** - Persona de contacto principal
6. **Email** - Correo electrónico
7. **Teléfono / Celular** - Números de contacto
8. **Dirección, Ciudad, Provincia, País** - Datos de ubicación
9. **Sitio Web** - URL del sitio web
10. **Días Crédito** - Días para pagar (default: 30)
11. **Descuento %** - Descuento habitual (ej: 5.0 = 5%)
12. **Estado\*** - Activo / Inactivo / Suspendido

---

## 🏥 TABLA 4: ACTIVOS MÉDICOS

### Ejemplo de Registro:

| Etiqueta\* | Nombre\*             | Tipo\*        | Categoría   | Fabricante | Modelo   | Número Serie | Estado\* | Condición\* | Precio Compra\* | Fecha Compra\* | Proveedor | Ubicación      | Asignado A |
| ---------- | -------------------- | ------------- | ----------- | ---------- | -------- | ------------ | -------- | ----------- | --------------- | -------------- | --------- | -------------- | ---------- |
| ACT-001    | Tensiómetro Digital  | Equipo Médico | Diagnóstico | Omron      | HEM-7130 | S123456      | Activo   | Bueno       | 150.00          | 2024-01-15     | MedSupply | Consultorio 1  | Dr. García |
| ACT-002    | Escritorio Ejecutivo | Mobiliario    | Oficina     | Muebles SA | MOD-2023 |              | Activo   | Excelente   | 350.00          | 2024-02-01     | OfiMax    | Administración |            |

### Tabla para Completar:

| Etiqueta\* | Nombre\* | Descripción | Tipo\* | Categoría | Sub-categoría | Fabricante | Modelo | Número Serie | Código Barras | Estado\* | Condición\* | Precio Compra\* | Fecha Compra\* | Proveedor | Número Factura | Info Garantía | Vence Garantía | Ubicación | Sala | Edificio | Piso | Asignado A | Vida Útil (años) | Método Depreciación | Valor Salvamento | Notas |
| ---------- | -------- | ----------- | ------ | --------- | ------------- | ---------- | ------ | ------------ | ------------- | -------- | ----------- | --------------- | -------------- | --------- | -------------- | ------------- | -------------- | --------- | ---- | -------- | ---- | ---------- | ---------------- | ------------------- | ---------------- | ----- |
|            |          |             |        |           |               |            |        |              |               |          |             |                 |                |           |                |               |                |           |      |          |      |            |                  |                     |                  |       |
|            |          |             |        |           |               |            |        |              |               |          |             |                 |                |           |                |               |                |           |      |          |      |            |                  |                     |                  |       |

### Columnas - Descripción Detallada:

#### Identificación (Obligatorio):

1. **Etiqueta\*** - Código único del activo (ej: ACT-001, EQ-MED-001)
2. **Nombre\*** - Nombre del activo
3. **Descripción** - Descripción detallada

#### Clasificación:

4. **Tipo\*** - Seleccionar uno:
   - Equipo Médico
   - Mobiliario
   - Computador
   - Vehículo
   - Edificio
   - Otro

5. **Categoría** - Categoría personalizada (ej: Diagnóstico, Terapia, Quirúrgico)
6. **Sub-categoría** - Sub-clasificación más específica

#### Especificaciones:

7. **Fabricante** - Marca o fabricante
8. **Modelo** - Modelo del equipo
9. **Número Serie** - Número de serie del fabricante
10. **Código Barras** - Si tiene código de barras

#### Estado:

11. **Estado\*** - Seleccionar uno:
    - Activo
    - Inactivo
    - Mantenimiento
    - Retirado
    - Vendido
    - Perdido
    - Dañado

12. **Condición\*** - Seleccionar uno:
    - Excelente
    - Bueno
    - Regular
    - Malo
    - Crítico

#### Información Financiera:

13. **Precio Compra\*** - Costo de adquisición
14. **Fecha Compra\*** - Formato: AAAA-MM-DD
15. **Proveedor** - De quién se compró
16. **Número Factura** - Número de la factura de compra
17. **Info Garantía** - Detalles de la garantía
18. **Vence Garantía** - Fecha de vencimiento de garantía

#### Ubicación:

19. **Ubicación** - Ubicación general
20. **Sala** - Sala o consultorio específico
21. **Edificio** - Edificio si aplica
22. **Piso** - Piso del edificio
23. **Asignado A** - Persona responsable del activo

#### Depreciación:

24. **Vida Útil (años)** - Años de vida útil estimada (default: 5)
25. **Método Depreciación** - Seleccionar uno:
    - Línea Recta (recomendado)
    - Saldos Decrecientes
    - Unidades de Producción
    - Sin Depreciación

26. **Valor Salvamento** - Valor residual al final de vida útil

#### Adicional:

27. **Notas** - Información adicional relevante

---

## 🔧 TABLA 5: HISTORIAL DE MANTENIMIENTO DE ACTIVOS (Opcional)

Si tiene registros de mantenimientos previos, por favor incluirlos:

| Etiqueta Activo\* | Fecha Mantenimiento\* | Tipo Mantenimiento\* | Descripción            | Costo | Realizado Por        | Próximo Mantenimiento |
| ----------------- | --------------------- | -------------------- | ---------------------- | ----- | -------------------- | --------------------- |
| ACT-001           | 2024-06-15            | Preventivo           | Calibración y limpieza | 50.00 | Servicio Técnico XYZ | 2025-06-15            |

### Tipos de Mantenimiento:

- Preventivo
- Correctivo
- Calibración
- Inspección
- Reparación
- Otro

---

## 📊 INFORMACIÓN ADICIONAL NECESARIA

### 1. Configuración de la Clínica:

- **Nombre de la Clínica**: **********\_\_\_**********
- **ID/Código de la Clínica**: **********\_\_\_**********
- **Moneda**: **\_\_\_** (ej: USD, EUR, COP)

### 2. Usuarios Administrativos:

Por favor, listar los usuarios que deben tener acceso al sistema:

| Nombre Completo | Email | Rol                                               | Área |
| --------------- | ----- | ------------------------------------------------- | ---- |
|                 |       | Admin/Doctor/Enfermera/Farmacéutico/Recepcionista |      |
|                 |       |                                                   |      |

### 3. Configuraciones Especiales:

- ¿Maneja múltiples clínicas/sucursales? Sí / No
- ¿Requiere gestión de recetas médicas? Sí / No
- ¿Maneja ventas en farmacia? Sí / No
- ¿Necesita control de inventario en tiempo real? Sí / No

---

## ✅ CHECKLIST ANTES DE ENVIAR

- [ ] Tabla 1: Medicamentos completada
- [ ] Tabla 2: Stock inicial de medicamentos completada
- [ ] Tabla 3: Proveedores completada
- [ ] Tabla 4: Activos médicos completada
- [ ] Tabla 5: Historial de mantenimiento (opcional)
- [ ] Información adicional de la clínica completada
- [ ] Revisar que los códigos sean únicos
- [ ] Verificar que las fechas estén en formato correcto
- [ ] Confirmar que los campos obligatorios (\*) están llenos

---

## 📧 ENTREGA

**Enviar a**: **********\_\_\_**********
**Formato preferido**: Excel (.xlsx) o CSV
**Fecha límite**: **********\_\_\_**********

### Archivos a Enviar:

1. `medicamentos.xlsx` (Tablas 1 y 2)
2. `proveedores.xlsx` (Tabla 3)
3. `activos.xlsx` (Tablas 4 y 5)

O un solo archivo con múltiples hojas.

---

## ❓ PREGUNTAS FRECUENTES

**P: ¿Qué pasa si no tengo toda la información?**
R: Complete los campos obligatorios (\*). Los demás se pueden actualizar después en el sistema.

**P: ¿Los códigos deben seguir un formato específico?**
R: No, puede usar su propio sistema de codificación, pero deben ser únicos.

**P: ¿Puedo enviar la información en partes?**
R: Sí, puede enviar primero medicamentos y luego activos, o viceversa.

**P: ¿Necesito incluir medicamentos que ya no uso?**
R: No, solo incluya los medicamentos y activos actualmente en uso o en inventario.

---

**Gracias por su colaboración en la normalización de datos.**  
_Sistema Médico Bartolomed - 2026_
