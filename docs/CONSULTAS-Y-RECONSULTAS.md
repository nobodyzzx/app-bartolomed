# Modelo de Consultas y Reconsultas - Sistema Bartolomed

## Problema a Resolver

Un paciente puede:

1. **Venir con una nueva molestia** → Nueva consulta independiente
2. **Venir por seguimiento de una consulta previa** → Reconsulta/seguimiento vinculada

## Solución Implementada

### Backend (Entidad MedicalRecord)

Agregar campo opcional `relatedRecordId` a la entidad:

```typescript
@Entity('medical_records')
export class MedicalRecord {
  // ... campos existentes

  @Column({ nullable: true })
  relatedRecordId?: string;

  @ManyToOne(() => MedicalRecord, { nullable: true })
  @JoinColumn({ name: 'relatedRecordId' })
  relatedRecord?: MedicalRecord;

  @OneToMany(() => MedicalRecord, (record) => record.relatedRecord)
  followUps?: MedicalRecord[];
}
```

### Frontend (Interfaz MedicalRecord)

```typescript
export interface MedicalRecord {
  // ... campos existentes
  relatedRecordId?: string;
  relatedRecord?: MedicalRecord;
  followUps?: MedicalRecord[];
}
```

## Flujos de Usuario

### 1. Nueva Consulta (molestia diferente)

**Desde listado de expedientes:**

- Usuario hace clic en "Nuevo Expediente"
- Selecciona paciente
- `relatedRecordId` queda `null`
- Se crea expediente independiente

**Desde historial del paciente:**

- Usuario hace clic en "Nueva Consulta"
- Paciente ya preseleccionado
- `relatedRecordId` queda `null`

### 2. Reconsulta/Seguimiento

**Desde historial del paciente:**

- Usuario ve la consulta original en el timeline
- Hace clic en botón "Crear seguimiento" (icono +)
- Se navega a `/medical-records/new` con queryParams:
  ```typescript
  {
    patientId: '<paciente-id>',
    relatedRecordId: '<consulta-original-id>',
    type: 'FOLLOW_UP'
  }
  ```
- El formulario:
  - Preselecciona al paciente
  - Setea el tipo como "Seguimiento"
  - Guarda el `relatedRecordId` al crear el expediente
  - Puede mostrar una sección "Consulta relacionada" con resumen de la consulta original

## Beneficios

1. **Trazabilidad**: Fácil seguir la evolución de una condición médica
2. **Historial agrupado**: En el timeline, las reconsultas pueden mostrarse anidadas bajo la consulta original
3. **Reportes**: Analizar tiempo de resolución, número de seguimientos por condición
4. **UX mejorada**: El médico ve de un vistazo todas las visitas relacionadas con la misma molestia

## Visualización en Timeline

```
┌─ 15/11/2024 - Consulta (Dolor de cabeza) ────────┐
│  Diagnóstico: Migraña                              │
│  ├─ 20/11/2024 - Seguimiento                      │
│  │  Estado: Mejoría parcial                       │
│  └─ 25/11/2024 - Seguimiento                      │
│     Estado: Resuelto                              │
└────────────────────────────────────────────────────┘

┌─ 10/11/2024 - Consulta (Dolor abdominal) ────────┐
│  Diagnóstico: Gastritis                           │
│  └─ 17/11/2024 - Seguimiento                      │
│     Estado: Resuelto                              │
└────────────────────────────────────────────────────┘
```

## Implementación en el Formulario

### Cambios en `medical-record-form.component.ts`

```typescript
ngOnInit(): void {
  // ... código existente

  // Capturar relatedRecordId de query params
  this.route.queryParams.subscribe(params => {
    if (params['patientId']) {
      this.preselectedPatientId = params['patientId'];
    }
    if (params['relatedRecordId']) {
      this.relatedRecordId = params['relatedRecordId'];
      this.loadRelatedRecord(this.relatedRecordId);
    }
    if (params['type']) {
      this.patientInfoForm.patchValue({ type: params['type'] });
    }
  });
}

private loadRelatedRecord(id: string) {
  this.medicalRecordsService.getMedicalRecordById(id).subscribe(record => {
    this.relatedRecord = record;
    // Opcional: mostrar en la UI para contexto
  });
}

private createMedicalRecordDto(): CreateMedicalRecordDto {
  return {
    ...patientData,
    ...clinicalData,
    ...evaluationData,
    relatedRecordId: this.relatedRecordId || undefined,
  };
}
```

### Cambios en el HTML (opcional)

Mostrar contexto de la consulta relacionada:

```html
<div
  class="bg-blue-50 border border-blue-200 rounded-lg p-4 mb-4"
  *ngIf="relatedRecord"
>
  <div class="flex items-center gap-2 mb-2">
    <span class="material-symbols-outlined text-blue-600">link</span>
    <h3 class="text-sm font-semibold text-blue-900">
      Seguimiento de consulta previa
    </h3>
  </div>
  <div class="text-sm text-blue-700">
    <strong>Fecha original:</strong> {{ formatDate(relatedRecord.createdAt)
    }}<br />
    <strong>Motivo:</strong> {{ relatedRecord.chiefComplaint }}<br />
    <strong>Diagnóstico:</strong> {{ relatedRecord.diagnosis }}
  </div>
</div>
```

## Backend - Endpoint adicional recomendado

```typescript
// En medical-records.controller.ts
@Get('patient/:patientId/grouped')
async getMedicalRecordsByPatientGrouped(@Param('patientId') patientId: string) {
  const records = await this.medicalRecordsService.findByPatient(patientId);
  // Agrupar consultas principales con sus seguimientos
  const grouped = records
    .filter(r => !r.relatedRecordId) // Solo consultas principales
    .map(main => ({
      ...main,
      followUps: records.filter(r => r.relatedRecordId === main.id),
    }));
  return grouped;
}
```

## Próximos Pasos

1. ✅ Crear pantalla de historial completo del paciente
2. ⏳ Agregar campo `relatedRecordId` a la entidad backend
3. ⏳ Actualizar DTO de creación para incluir `relatedRecordId`
4. ⏳ Modificar formulario para capturar `relatedRecordId` de query params
5. ⏳ Implementar visualización agrupada en el timeline (opcional pero recomendado)
6. ⏳ Agregar sección "Consulta relacionada" en el formulario cuando sea seguimiento

## Notas Importantes

- **No afecta consultas existentes**: `relatedRecordId` es opcional, las consultas actuales siguen funcionando
- **Flexible**: El médico decide si vincular o crear nueva consulta independiente
- **Sin límite de seguimientos**: Una consulta puede tener N seguimientos
- **Histórico**: No se elimina la consulta original al hacer seguimientos, se mantiene la cadena completa
