# Guía de Refactorización del Template de Expediente Médico

## Estado Actual ✅

### Backend (TypeScript) - COMPLETADO

- ✅ Componente refactorizado de 6 a 4 FormGroups
- ✅ Validadores inteligentes de signos vitales creados (`validators/vital-signs.validators.ts`)
- ✅ Manejo de `patientId` desde query params
- ✅ Métodos auxiliares para validación visual
- ✅ Estilos CSS agregados para alertas de signos vitales
- ✅ CTA "Crear Expediente" en lista de pacientes

### Frontend (HTML) - PENDIENTE

El template actual tiene 1079 líneas con 6 pasos. Necesita reducirse a 4 pasos.

---

## Estructura de los 4 Nuevos Pasos

### Paso 1: Información del Paciente ✅ (Ya existe, mantener)

FormGroup: `patientInfoForm`
Campos:

- patientId (select de pacientes)
- doctorId (select de doctores)
- type (select tipo de consulta)
- isEmergency (checkbox)
- chiefComplaint (textarea, requerido, mínimo 10 caracteres)

### Paso 2: Datos Clínicos (Historia + Signos Vitales) 🔧 MERGE

FormGroup: `clinicalDataForm`

**Sección: Historia Médica**

- historyOfPresentIllness
- pastMedicalHistory
- medications
- allergies
- socialHistory
- familyHistory
- reviewOfSystems

**Sección: Signos Vitales con Validación Inteligente**
Agregar a cada campo de signos vitales:

```html
<mat-form-field appearance="outline" [ngClass]="getVitalSignClasses('temperature')">
  <mat-label>Temperatura (°C)</mat-label>
  <input
    matInput
    type="number"
    formControlName="temperature"
    placeholder="36.5"
    step="0.1"
    min="30"
    max="45"
  />
  <span
    class="material-symbols-outlined vital-sign-icon"
    [ngClass]="getVitalSignIcon('temperature') ? getVitalSignIcon('temperature').split('_')[0] : ''"
  >
    {{ getVitalSignIcon('temperature') }}
  </span>
  <mat-hint
    *ngIf="getVitalSignMessage('temperature')"
    [ngClass]="{'vital-sign-hint': true, 
                        'normal': !clinicalDataForm.get('temperature')?.hasError('vitalSignWarning') && !clinicalDataForm.get('temperature')?.hasError('vitalSignDanger'),
                        'warning': clinicalDataForm.get('temperature')?.hasError('vitalSignWarning'),
                        'danger': clinicalDataForm.get('temperature')?.hasError('vitalSignDanger')}"
  >
    {{ getVitalSignMessage('temperature') }}
  </mat-hint>
  <mat-error *ngIf="clinicalDataForm.get('temperature')?.hasError('vitalSignDanger')">
    ⚠️ {{ getVitalSignMessage('temperature') }}
  </mat-error>
</mat-form-field>
```

Campos de signos vitales con validadores:

- temperature (con vitalSignValidator)
- systolicBP
- diastolicBP
- heartRate
- respiratoryRate
- oxygenSaturation
- weight (sin validador)
- height (sin validador)

**Tooltip informativo** - Agregar card con rangos de referencia:

```html
<div class="mt-6 p-4 bg-blue-50 rounded-lg border-l-4 border-blue-500">
  <h3 class="text-sm font-bold text-blue-800 mb-2">📊 Rangos de Referencia para Signos Vitales</h3>
  <div class="text-xs text-blue-700 grid grid-cols-2 md:grid-cols-3 gap-3">
    <div>
      <strong>Temperatura:</strong><br />
      <span class="text-green-600">✓ Normal: 36-37.5°C</span><br />
      <span class="text-yellow-600">⚠ Alerta: 35.5-36 / 37.5-38°C</span><br />
      <span class="text-red-600">⛔ Crítico: <35.5 / >39.5°C</span>
    </div>
    <div>
      <strong>Presión Arterial Sistólica:</strong><br />
      <span class="text-green-600">✓ Normal: 90-130 mmHg</span><br />
      <span class="text-yellow-600">⚠ Alerta: 80-90 / 130-140</span><br />
      <span class="text-red-600">⛔ Crítico: <80 / >160</span>
    </div>
    <!-- Agregar similar para los demás signos -->
  </div>
</div>
```

### Paso 3: Evaluación (Examen Físico + Plan) 🔧 MERGE

FormGroup: `evaluationForm`

**Sección: Examen Físico**

- physicalExamination (resumen)
- generalAppearance
- heent
- cardiovascular
- respiratory
- abdominal
- neurological
- musculoskeletal
- skin

**Sección: Evaluación y Plan**

- assessment
- plan
- diagnosis
- differentialDiagnosis
- treatmentPlan
- followUpInstructions
- patientEducation
- notes
- followUpDate

### Paso 4: Resumen y Consentimiento (Opcional) 🆕 NUEVO

FormGroup: `consentForm` (opcional)

**Sección: Resumen de Datos Capturados**
Mostrar tarjetas con resumen de:

1. Información del paciente (nombre, tipo de consulta, motivo)
2. Datos clínicos capturados (si se llenaron)
3. Evaluación registrada (si se llenó)

**Sección: Consentimiento (Opcional)**

- consentType (select, sin required)
- description (textarea, min 20 si se llena)
- signedBy (input text)
- Archivo adjunto (opcional)

Mensaje informativo:

```html
<mat-card class="mb-6 bg-amber-50 border-l-4 border-amber-500">
  <mat-card-content>
    <div class="flex items-start gap-3">
      <span class="material-symbols-outlined text-amber-600 text-2xl">info</span>
      <div>
        <h4 class="font-semibold text-amber-800 mb-1">Formulario de Consentimiento Opcional</h4>
        <p class="text-sm text-amber-700">
          El formulario de consentimiento es opcional. Puedes completarlo ahora o agregarlo
          posteriormente editando el expediente médico.
        </p>
      </div>
    </div>
  </mat-card-content>
</mat-card>
```

---

## Cambios en la Estructura del Template

### Header (Mantener)

```html
<div class="min-h-screen bg-slate-50 p-8">
  <div class="max-w-7xl mx-auto">
    <div class="flex items-center justify-between mb-10">
      <!-- Botón atrás + título -->
    </div>

    <!-- Barra de progreso -->
    <div class="bg-white rounded-xl shadow-md p-6 mb-8" *ngIf="!isLoading">
      <!-- getStepProgress() ya actualizado a 4 pasos -->
    </div>
  </div>
</div>
```

### Stepper

```html
<mat-stepper [linear]="true" #stepper *ngIf="!isLoading" class="custom-stepper">
  <!-- Paso 1: Información del Paciente (SIN CAMBIOS) -->
  <mat-step [stepControl]="patientInfoForm">
    <ng-template matStepLabel>
      <div class="step-label">
        <div class="step-icon-badge">
          <span class="material-symbols-outlined">person</span>
        </div>
        <div class="step-text">
          <div class="step-title">Información</div>
          <div class="step-subtitle">Paciente y consulta</div>
        </div>
      </div>
    </ng-template>
    <form [formGroup]="patientInfoForm">
      <!-- Mantener contenido existente -->
    </form>
  </mat-step>

  <!-- Paso 2: Datos Clínicos (MERGE historia + vitales) -->
  <mat-step [stepControl]="clinicalDataForm">
    <ng-template matStepLabel>
      <div class="step-label">
        <div class="step-icon-badge">
          <span class="material-symbols-outlined">monitor_heart</span>
        </div>
        <div class="step-text">
          <div class="step-title">Datos Clínicos</div>
          <div class="step-subtitle">Historia y signos vitales</div>
        </div>
      </div>
    </ng-template>
    <form [formGroup]="clinicalDataForm">
      <!-- Sección Historia Médica -->
      <!-- Sección Signos Vitales con validadores -->
    </form>
  </mat-step>

  <!-- Paso 3: Evaluación (MERGE examen + plan) -->
  <mat-step [stepControl]="evaluationForm">
    <ng-template matStepLabel>
      <div class="step-label">
        <div class="step-icon-badge">
          <span class="material-symbols-outlined">assignment</span>
        </div>
        <div class="step-text">
          <div class="step-title">Evaluación</div>
          <div class="step-subtitle">Examen y plan</div>
        </div>
      </div>
    </ng-template>
    <form [formGroup]="evaluationForm">
      <!-- Sección Examen Físico -->
      <!-- Sección Evaluación y Plan -->
    </form>
  </mat-step>

  <!-- Paso 4: Resumen y Consentimiento (NUEVO, opcional) -->
  <mat-step [stepControl]="consentForm">
    <ng-template matStepLabel>
      <div class="step-label">
        <div class="step-icon-badge">
          <span class="material-symbols-outlined">check_circle</span>
        </div>
        <div class="step-text">
          <div class="step-title">Finalizar</div>
          <div class="step-subtitle">Resumen y consentimiento</div>
        </div>
      </div>
    </ng-template>
    <form [formGroup]="consentForm">
      <!-- Tarjetas de resumen -->
      <!-- Formulario de consentimiento opcional -->

      <!-- Botones finales -->
      <div class="flex items-center justify-between mt-8">
        <button mat-stroked-button matStepperPrevious>Anterior</button>
        <div class="flex gap-3">
          <button mat-stroked-button (click)="saveDraft()" type="button">Guardar Borrador</button>
          <button
            mat-flat-button
            color="primary"
            (click)="onSubmit()"
            [disabled]="isSaving || !patientInfoForm.valid"
            class="rounded-full px-6"
          >
            <span class="material-symbols-outlined">save</span>
            {{ isEditMode ? 'Actualizar' : 'Crear' }} Expediente
          </button>
        </div>
      </div>
    </form>
  </mat-step>
</mat-stepper>
```

---

## Verificación de Compilación

Después de refactorizar el HTML, verificar que no hay errores:

```bash
# En el directorio frontend
cd /mnt/USER/Projects/app-bartolomed/frontend
npm run lint
```

Si hay errores de compilación TypeScript relacionados con el template, revisar:

1. Nombres de FormGroups (deben ser: patientInfoForm, clinicalDataForm, evaluationForm, consentForm)
2. Métodos del componente llamados desde el template
3. Directivas y pipes de Angular

---

## Testing Manual

1. **Navegación desde lista de pacientes:**

   - Ir a Lista de Pacientes
   - Clic en botón verde "Crear Expediente Médico" (ícono note_add)
   - Verificar que abre formulario con paciente pre-seleccionado

2. **Navegación desde formulario de paciente:**

   - Crear nuevo paciente
   - En diálogo de éxito, clic en "Crear Expediente Médico"
   - Verificar que abre formulario con paciente pre-seleccionado

3. **Validación de signos vitales:**

   - En Paso 2, llenar signos vitales con valores:
     - Normales (ej: temp 36.5, PA 120/80) → debe mostrar borde verde
     - Advertencia (ej: temp 38.5, PA 145/95) → debe mostrar borde amarillo
     - Peligro (ej: temp 40, PA 180/110) → debe mostrar borde rojo y mensaje de error
   - Verificar que los mensajes de validación aparecen bajo cada campo
   - Verificar que los íconos cambian según el estado

4. **Flujo completo del stepper:**

   - Completar Paso 1 (Paciente)
   - Llenar Paso 2 (Historia + Signos Vitales)
   - Llenar Paso 3 (Examen + Evaluación)
   - Ver resumen en Paso 4
   - Crear expediente sin consentimiento
   - Verificar que se crea correctamente

5. **Barra de progreso:**
   - Verificar que muestra 0%, 25%, 50%, 75%, 100% según pasos completados
   - Verificar que calcula correctamente con 4 pasos (25% cada uno)

---

## Archivos Modificados

✅ **Backend (TypeScript):**

- `medical-record-form.component.ts` - Refactorizado
- `validators/vital-signs.validators.ts` - Creado
- `medical-record-form.component.css` - Estilos agregados
- `patient-list.component.ts` - Método `createMedicalRecord()` agregado
- `patient-list.component.html` - Botón "Crear Expediente" agregado

❌ **Pendiente:**

- `medical-record-form.component.html` - Refactorizar de 6 a 4 pasos

---

## Notas Finales

- **Backup creado:** `medical-record-form.component.html.backup` contiene el template original de 6 pasos
- **Validadores no bloquean:** Los validadores de signos vitales solo muestran advertencias visuales, no impiden el guardado
- **Consentimiento opcional:** Ya no es requerido, se puede agregar después editando el expediente
- **Progreso actualizado:** `getStepProgress()` ahora calcula sobre 4 pasos (25% cada uno)

---

## Próximos Pasos Sugeridos

1. Refactorizar el template HTML siguiendo esta guía
2. Probar flujo completo en desarrollo
3. Implementar mejora #5: Precarga de datos médicos del paciente (mostrar alergias, medicamentos, tipo de sangre cuando se selecciona paciente)
