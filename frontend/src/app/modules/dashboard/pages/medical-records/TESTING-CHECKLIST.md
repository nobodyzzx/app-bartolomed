# Checklist de Testing - Medical Records Module

## 📋 Testing Funcional

### ✅ 1. Navegación del Stepper

**Objetivo:** Verificar que el flujo de 4 pasos funciona correctamente

- [ ] **Paso 1 → Paso 2:**

  - Completar información del paciente
  - Ingresar motivo de consulta (mínimo 10 caracteres)
  - Clic en "Siguiente"
  - Verificar que avanza al Paso 2

- [ ] **Paso 2 → Paso 3:**

  - Llenar al menos un campo de historia médica o signos vitales
  - Clic en "Siguiente"
  - Verificar que avanza al Paso 3

- [ ] **Paso 3 → Paso 4:**

  - Llenar al menos un campo de examen físico o evaluación
  - Clic en "Siguiente"
  - Verificar que avanza al Paso 4 con resumen visible

- [ ] **Navegación hacia atrás:**

  - Usar botón "Anterior" en cada paso
  - Verificar que los datos se mantienen
  - Verificar que la barra de progreso se actualiza correctamente

- [ ] **Barra de progreso:**
  - Verificar que muestra 0% → 25% → 50% → 75% → 100%
  - Verificar que refleja los pasos completados

---

### ✅ 2. CTA desde Lista de Pacientes

**Objetivo:** Verificar integración entre módulos de Pacientes y Medical Records

- [ ] **Acceso al botón:**

  - Navegar a `/dashboard/patients`
  - Verificar que el botón verde "Crear Expediente Médico" (ícono `note_add`) está visible
  - Verificar que el tooltip muestra "Crear Expediente Médico"

- [ ] **Navegación con pre-selección:**

  - Clic en botón de un paciente específico
  - Verificar navegación a `/dashboard/medical-records/new?patientId=XXX`
  - Verificar que el paciente está pre-seleccionado en el Paso 1
  - Verificar que el dropdown de pacientes está deshabilitado o muestra el correcto

- [ ] **Card informativo visible:**
  - Verificar que aparece el card de información médica del paciente
  - Verificar que muestra tipo de sangre, alergias, medicamentos

---

### ✅ 3. Precarga de Datos Médicos del Paciente

**Objetivo:** Verificar que los datos del paciente se cargan y actualizan correctamente

- [ ] **Carga inicial:**

  - Crear expediente desde lista de pacientes
  - Verificar que el card informativo aparece automáticamente
  - Verificar que muestra los datos correctos del paciente

- [ ] **Datos mostrados:**

  - ✓ Tipo de sangre con ícono de gota roja
  - ✓ Alergias con ícono de advertencia amarillo
  - ✓ Medicamentos con ícono verde de medicación
  - ✓ Antecedentes médicos (si existen)

- [ ] **Cambio de paciente:**

  - Cambiar manualmente el paciente en el dropdown
  - Verificar que el card informativo se actualiza
  - Verificar que los datos corresponden al nuevo paciente

- [ ] **Paciente sin datos:**
  - Seleccionar paciente sin tipo de sangre/alergias/medicamentos
  - Verificar que muestra "No registrado" / "Ninguna registrada" / "Ninguno registrado"

---

### ✅ 4. Validadores de Signos Vitales

**Objetivo:** Verificar la validación visual en tiempo real

#### 4.1 Temperatura

- [ ] **Valor normal (36-37.5°C):**

  - Ingresar: 36.5°C
  - Verificar borde **verde** en el campo
  - Verificar mensaje: "Valor normal (36-37.5°C)"
  - Verificar ícono de check verde

- [ ] **Valor en advertencia (35.5-36°C o 37.5-38°C):**

  - Ingresar: 38°C
  - Verificar borde **amarillo** en el campo
  - Verificar mensaje de advertencia
  - Verificar ícono de warning amarillo

- [ ] **Valor crítico (<35.5°C o >38°C):**
  - Ingresar: 39.5°C
  - Verificar borde **rojo** en el campo
  - Verificar mensaje crítico
  - Verificar ícono de error rojo

#### 4.2 Presión Arterial

- [ ] **Valores normales:**

  - Sistólica: 120 mmHg → Verificar verde
  - Diastólica: 80 mmHg → Verificar verde

- [ ] **Valores en advertencia:**

  - Sistólica: 140 mmHg → Verificar amarillo
  - Diastólica: 90 mmHg → Verificar amarillo

- [ ] **Valores críticos:**
  - Sistólica: 180 mmHg → Verificar rojo
  - Diastólica: 110 mmHg → Verificar rojo

#### 4.3 Otros Signos Vitales

- [ ] **Frecuencia Cardíaca:**

  - Normal (60-100 lpm) → Verde
  - Advertencia (50-60 o 100-120 lpm) → Amarillo
  - Crítico (<50 o >120 lpm) → Rojo

- [ ] **Saturación de Oxígeno:**

  - Normal (≥95%) → Verde
  - Advertencia (90-95%) → Amarillo
  - Crítico (<90%) → Rojo

- [ ] **Campos opcionales (Peso, Altura):**
  - Verificar que no muestran validación
  - Verificar que aceptan valores sin restricciones

---

### ✅ 5. Resumen en Paso 4

**Objetivo:** Verificar que el resumen muestra información correcta

- [ ] **Sección Paciente:**

  - Verificar nombre completo del paciente
  - Verificar tipo de registro (Consulta, Emergencia, etc.)
  - Verificar badge "EMERGENCIA" si `isEmergency = true`

- [ ] **Motivo de Consulta:**

  - Verificar que muestra el texto capturado en Paso 1
  - Verificar `line-clamp-3` para textos largos

- [ ] **Signos Vitales:**

  - Completar varios signos vitales en Paso 2
  - Verificar que aparecen en grid responsive (2 en móvil, 4 en desktop)
  - Verificar formato: valor + unidad (ej: "36.5 °C")
  - Verificar que solo muestra los completados

- [ ] **Diagnóstico y Plan:**

  - Llenar diagnóstico en Paso 3
  - Verificar que aparece en el resumen
  - Llenar plan de tratamiento
  - Verificar que aparece en el resumen
  - Dejar vacíos → Verificar que no aparecen

- [ ] **Nota informativa:**
  - Verificar presencia del banner azul con recordatorio

---

### ✅ 6. Consentimiento Informado (Opcional)

**Objetivo:** Verificar el nuevo flujo flexible de consentimiento

#### 6.1 Banner Informativo

- [ ] Verificar que aparece el banner azul con información sobre opcionalidad
- [ ] Verificar que lista las 4 opciones:
  - Completar y subir archivo
  - Generar e imprimir
  - Dejarlo en blanco
  - Guardar sin consentimiento

#### 6.2 Campos Opcionales

- [ ] **Tipo de Consentimiento:**

  - Verificar que label dice "(opcional)"
  - Verificar que NO hay validación requerida
  - Verificar que se puede dejar vacío

- [ ] **Descripción:**

  - Verificar que label dice "(opcional)"
  - Verificar que NO hay validación de longitud mínima
  - Verificar hint: "Puede completar este campo para generar un documento imprimible"

- [ ] **Firmado por:**
  - Verificar que label dice "(opcional)"
  - Verificar que se puede dejar vacío

#### 6.3 Botón Imprimir/Exportar

- [ ] **Estado deshabilitado:**

  - No completar ningún campo de consentimiento
  - Verificar que el botón NO aparece

- [ ] **Estado habilitado:**

  - Completar al menos descripción o firmado por
  - Verificar que aparece botón morado "Imprimir/Exportar"
  - Verificar ícono `print`

- [ ] **Funcionalidad de impresión:**
  - Completar tipo, descripción y firmado por
  - Clic en "Imprimir/Exportar"
  - Verificar que abre ventana nueva con documento
  - Verificar contenido del documento:
    - ✓ Header con título y fecha
    - ✓ Datos del paciente (nombre, documento, email, teléfono)
    - ✓ Médico tratante
    - ✓ Motivo de consulta
    - ✓ Descripción del consentimiento
    - ✓ Declaración legal estándar
    - ✓ Secciones de firma (paciente y médico)
    - ✓ Footer con fecha de generación
    - ✓ Botón "🖨️ Imprimir" visible
  - Clic en botón de imprimir dentro del documento
  - Verificar que se activa el diálogo de impresión del navegador

#### 6.4 Subida de Archivo

- [ ] **Sección claramente marcada como opcional:**

  - Verificar título: "Subir Documento Firmado (Opcional)"
  - Verificar texto explicativo claro
  - Verificar formatos aceptados: PDF, JPG, PNG

- [ ] **Selección de archivo:**

  - Clic en "Seleccionar Archivo"
  - Elegir PDF de prueba
  - Verificar que aparece card verde con check
  - Verificar que muestra nombre y tamaño del archivo

- [ ] **Preview de imagen:**
  - Subir imagen JPG/PNG
  - Verificar que aparece preview visual
  - Verificar tamaño máximo del preview

#### 6.5 Guardado con/sin Consentimiento

- [ ] **Guardar SIN consentimiento:**

  - Completar Pasos 1-3 (datos básicos, historia, evaluación)
  - NO completar Paso 4 (dejar consentimiento vacío)
  - Clic en "Crear Expediente"
  - Verificar que guarda correctamente
  - Verificar mensaje: "¡Expediente creado!"
  - Verificar navegación a lista de expedientes

- [ ] **Guardar CON consentimiento pero SIN archivo:**

  - Completar Pasos 1-3
  - Completar descripción y firmado por en Paso 4
  - NO subir archivo
  - Clic en "Crear Expediente"
  - Verificar que guarda correctamente
  - Verificar que el consentimiento se registra

- [ ] **Guardar CON consentimiento y archivo:**
  - Completar Pasos 1-3
  - Completar descripción y firmado por
  - Subir archivo PDF
  - Clic en "Crear Expediente"
  - Verificar que guarda correctamente
  - Verificar que el archivo se sube

---

### ✅ 7. Guardar Borrador

**Objetivo:** Verificar funcionalidad de autoguardado

- [ ] **Desde Paso 1:**

  - Completar solo información básica
  - Clic en "Guardar Borrador"
  - Verificar confirmación
  - Verificar que guarda con datos del Paso 1

- [ ] **Desde Paso 2:**

  - Avanzar a Paso 2, llenar datos clínicos
  - Clic en "Guardar Borrador"
  - Verificar que guarda datos de Pasos 1 y 2

- [ ] **Desde cualquier paso:**
  - Verificar que el botón está disponible en todos los pasos
  - Verificar que muestra diálogo de confirmación antes de guardar

---

## 🔧 Testing de Casos Borde

### ✅ 8. Paciente sin Datos Médicos

- [ ] Seleccionar paciente recién creado (sin tipo de sangre, alergias, medicamentos)
- [ ] Verificar que el card informativo aparece
- [ ] Verificar que muestra textos por defecto:
  - "No registrado" para tipo de sangre
  - "Ninguna registrada" para alergias
  - "Ninguno registrado" para medicamentos
- [ ] Verificar que NO aparece sección de antecedentes si está vacía

### ✅ 9. No Ingresar Signos Vitales

- [ ] Completar Paso 1 y Paso 2 (solo historia médica)
- [ ] NO llenar ningún signo vital
- [ ] Avanzar al Paso 4
- [ ] Verificar que la sección "Signos Vitales" NO aparece en el resumen
- [ ] Verificar que se puede guardar el expediente sin signos vitales

### ✅ 10. Cambiar Paciente con Datos Llenos

- [ ] Completar Paso 1 con Paciente A
- [ ] Llenar historia médica y signos vitales en Paso 2
- [ ] Regresar al Paso 1
- [ ] Cambiar a Paciente B en el dropdown
- [ ] Verificar que:
  - Card informativo se actualiza con datos de Paciente B
  - Los datos de historia/signos vitales se MANTIENEN (no se borran)
- [ ] Avanzar al Paso 4
- [ ] Verificar que el resumen muestra datos de Paciente B

### ✅ 11. Valores Críticos en Múltiples Signos Vitales

- [ ] Ingresar valores críticos en varios signos:
  - Temperatura: 40°C (rojo)
  - PA Sistólica: 190 mmHg (rojo)
  - Saturación O2: 85% (rojo)
- [ ] Verificar que TODOS muestran borde rojo simultáneamente
- [ ] Verificar que TODOS muestran mensajes de error
- [ ] Verificar que el formulario permite continuar (no bloquea)
- [ ] Avanzar al Paso 4 y verificar que el resumen muestra estos valores

### ✅ 12. Expediente sin Consentimiento

- [ ] Completar Pasos 1-3 normalmente
- [ ] En Paso 4, NO completar NADA del consentimiento
- [ ] Verificar que botón "Imprimir/Exportar" NO aparece
- [ ] Clic en "Crear Expediente"
- [ ] Verificar que guarda correctamente
- [ ] Verificar que NO intenta crear registro de consentimiento
- [ ] Verificar mensaje de éxito

### ✅ 13. Imprimir Consentimiento sin Descripción

- [ ] Completar solo "Firmado por" en consentimiento
- [ ] NO completar descripción
- [ ] Clic en "Imprimir/Exportar"
- [ ] Verificar que el documento se genera
- [ ] Verificar que la sección "Descripción del Consentimiento" NO aparece
- [ ] Verificar que las demás secciones siguen presentes

### ✅ 14. Cancelar Formulario

- [ ] Llenar datos en varios pasos
- [ ] Clic en botón "Cancelar" (X rojo en header)
- [ ] Verificar diálogo de confirmación:
  - "¿Descartar cambios?"
  - Botón "Sí, salir"
  - Botón "Continuar editando"
- [ ] Clic en "Continuar editando"
  - Verificar que permanece en el formulario
  - Verificar que los datos se mantienen
- [ ] Clic en "Cancelar" nuevamente
- [ ] Clic en "Sí, salir"
  - Verificar navegación a `/dashboard/medical-records`
  - Verificar que los datos se descartan

---

## 📊 Checklist de Verificación Final

### ✅ Compilación y Errores

- [x] No hay errores de TypeScript
- [x] No hay errores de template HTML
- [x] No hay errores en consola del navegador
- [ ] No hay warnings críticos

### ✅ Funcionalidades Principales

- [ ] Stepper de 4 pasos funciona completamente
- [ ] CTA desde pacientes pre-selecciona correctamente
- [ ] Precarga de datos médicos del paciente visible
- [ ] Validadores de signos vitales funcionan (verde/amarillo/rojo)
- [ ] Resumen en Paso 4 muestra información correcta
- [ ] Consentimiento es completamente opcional
- [ ] Impresión de consentimiento genera documento correcto
- [ ] Guardado funciona con y sin consentimiento

### ✅ Experiencia de Usuario

- [ ] Navegación fluida entre pasos
- [ ] Feedback visual claro en todos los campos
- [ ] Mensajes de error y validación comprensibles
- [ ] Botones y acciones claramente etiquetados
- [ ] Responsive en móvil y desktop
- [ ] Accesibilidad: navegación por teclado funciona
- [ ] Tooltips informativos presentes

### ✅ Casos Borde Manejados

- [ ] Paciente sin datos médicos
- [ ] Sin signos vitales ingresados
- [ ] Cambio de paciente con datos llenos
- [ ] Múltiples valores críticos simultáneos
- [ ] Expediente sin consentimiento
- [ ] Imprimir sin descripción completa
- [ ] Cancelación con confirmación

---

## 🎯 Resultado Esperado

✅ **APROBADO:** Todos los checkboxes marcados, sin errores críticos  
⚠️ **APROBADO CON OBSERVACIONES:** <95% completado, errores menores documentados  
❌ **RECHAZADO:** <80% completado o errores críticos bloqueantes

---

## 📝 Notas del Testing

**Fecha de testing:** ********\_********

**Tester:** ********\_********

**Navegador/OS:** ********\_********

**Observaciones:**

```
(Espacio para notas, bugs encontrados, mejoras sugeridas)
```

---

**Estado:** ⬜ Pendiente | ⬜ En Progreso | ⬜ Completado
