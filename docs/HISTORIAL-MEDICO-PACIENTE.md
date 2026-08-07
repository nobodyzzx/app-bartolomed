# Historial Médico del Paciente - Guía de Acceso

## 📍 Ruta de Acceso

La pantalla de historial médico está disponible en:

```
http://localhost:4200/dashboard/medical-records/patient/:patientId/history
```

**Ejemplo con ID de paciente:**

```
http://localhost:4200/dashboard/medical-records/patient/550e8400-e29b-41d4-a716-446655440000/history
```

---

## 🔘 Botones de Navegación

Hemos agregado botones de acceso rápido al historial en dos ubicaciones principales:

### 1. Dashboard de Expedientes Médicos

**Ruta:** `/dashboard/medical-records`

- **Botón:** Icono de reloj (history) color púrpura
- **Tooltip:** "Ver historial del paciente"
- **Ubicación:** Primera acción en la columna de acciones de cada expediente
- **Función:** Navega al historial completo del paciente asociado al expediente

### 2. Listado de Pacientes

**Ruta:** `/dashboard/patients`

- **Botón:** Icono de reloj (history) color púrpura
- **Tooltip:** "Ver historial médico"
- **Ubicación:** Primera acción en la columna de acciones de cada paciente
- **Función:** Navega al historial completo del paciente seleccionado

---

## ✨ Características de la Pantalla

### Información del Paciente (Tarjeta Superior Sticky)

- Nombre completo
- Tipo de sangre
- Alergias conocidas
- Contacto de emergencia

### Filtros Disponibles

- **Tipo de registro:** Todos, Consulta General, Cirugía, Transfusión, etc.
- **Rango de fechas:** Desde/Hasta
- **Búsqueda:** Por diagnóstico, motivo de consulta, etc.

### Timeline Cronológico

Cada registro muestra:

- **Círculo de color** según el tipo de consulta
- **Fecha y hora** del registro
- **Motivo de consulta**
- **Diagnóstico**
- **Signos vitales** (Presión arterial, temperatura, frecuencia cardíaca)

### Acciones por Registro

- **Ver (ojo azul):** Ver detalles completos del expediente
- **Editar (lápiz amarillo):** Modificar el expediente existente
- **Crear seguimiento (+ púrpura):** Iniciar una reconsulta relacionada

### Acciones Generales

- **Nueva consulta:** Crear un expediente completamente nuevo para el paciente
- **Volver:** Regresar a la página anterior

---

## 🔄 Flujo de Consultas y Reconsultas

### Nueva Consulta

Cuando el paciente viene con un problema **diferente** o es la primera visita:

1. Clic en botón "Nueva Consulta" (parte superior)
2. Se abre formulario limpio con el paciente preseleccionado
3. Se registra como consulta independiente

### Reconsulta (Seguimiento)

Cuando el paciente regresa por el **mismo problema**:

1. Localizar la consulta original en el timeline
2. Clic en botón "+" (Crear seguimiento)
3. Se abre formulario con:
   - Paciente preseleccionado
   - Tipo: "Seguimiento"
   - Relación con consulta original (próximamente)

> **Nota:** La vinculación automática entre consulta y reconsulta requiere implementar el campo `relatedRecordId` en el backend. Ver documentación en `docs/CONSULTAS-Y-RECONSULTAS.md`.

---

## 🎨 Código de Colores

| Color       | Significado           |
| ----------- | --------------------- |
| 🟣 Púrpura  | Acciones de historial |
| 🔵 Azul     | Ver/Visualizar        |
| 🟡 Amarillo | Editar                |
| 🟢 Verde    | Crear nuevo           |
| 🔴 Rojo     | Eliminar              |

---

## 📊 Estados del Paciente

La tarjeta superior muestra información crítica:

- **🩸 Tipo de sangre:** Importante para emergencias
- **⚠️ Alergias:** Resaltado con badge rojo si existen
- **📞 Emergencia:** Contacto directo con un clic

---

## 🚀 Próximas Mejoras

- [ ] Implementar campo `relatedRecordId` en backend
- [ ] Agrupar reconsultas bajo consulta original en el timeline
- [ ] Añadir gráficas de evolución de signos vitales
- [ ] Exportar historial completo a PDF
- [ ] Filtro por doctor tratante
- [ ] Indicadores visuales de alerta (alergias, condiciones críticas)

---

## 📖 Documentación Relacionada

- **Modelo de Consultas/Reconsultas:** `docs/CONSULTAS-Y-RECONSULTAS.md`
- **Guía de Formularios:** `frontend/FORMULARIOS-README.md`
- **Guía de Diseño UI:** `docs/GUIA-DISENO-UI.md`
