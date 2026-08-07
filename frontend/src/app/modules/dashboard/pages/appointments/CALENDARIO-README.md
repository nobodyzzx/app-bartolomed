# Calendario de Citas - Documentación

## Descripción

El calendario de citas es una vista mensual interactiva que permite gestionar las citas médicas de forma visual y eficiente.

## Características

### Vista del Calendario

- **Vista mensual**: Muestra todos los días del mes actual
- **Navegación**: Botones para ir al mes anterior, siguiente o volver a hoy
- **Día actual**: Resaltado con un anillo azul
- **Contador de citas**: Badge que muestra el número de citas por día

### Información de Citas

Cada cita en el calendario muestra:

- Hora de la cita
- Nombre completo del paciente
- Motivo de la consulta (truncado si es muy largo)
- Estado de la cita (código de color)
- Prioridad (borde lateral coloreado)

### Interacciones

1. **Click en día sin citas**: Abre el formulario para crear una nueva cita en esa fecha
2. **Click en cita**: Abre el formulario de edición de la cita
3. **Botón "Nueva Cita"**: Crea una cita sin fecha predefinida
4. **Cancelar cita**: Disponible desde el detalle de la cita

### Código de Colores - Estados

- **Azul claro**: Programada (scheduled)
- **Verde claro**: Confirmada (confirmed)
- **Amarillo claro**: En curso (in_progress)
- **Gris claro**: Completada (completed)
- **Rojo claro**: Cancelada (cancelled)
- **Naranja claro**: No asistió (no_show)
- **Morado claro**: Reprogramada (rescheduled)

### Código de Colores - Prioridades

- **Azul**: Baja (low)
- **Verde**: Normal (normal)
- **Amarillo**: Alta (high)
- **Rojo**: Urgente (urgent)

## Rutas

- `/dashboard/appointments/calendar` - Vista del calendario
- `/dashboard/appointments/new?date=YYYY-MM-DD` - Nueva cita con fecha predefinida
- `/dashboard/appointments/edit/:id` - Editar cita existente

## API Endpoints Utilizados

### GET /api/appointments

Obtiene todas las citas en un rango de fechas.

**Query Parameters:**

- `startDate`: Fecha de inicio (ISO 8601)
- `endDate`: Fecha de fin (ISO 8601)

### PATCH /api/appointments/:id/cancel

Cancela una cita específica.

**Body:**

```json
{
  "cancellationReason": "string"
}
```

## Componentes del Código

### TypeScript (`appointment-calendar.component.ts`)

- **Interfaces**:
  - `Appointment`: Estructura de datos de la cita
  - `CalendarDay`: Estructura de datos para cada día del calendario
- **Métodos principales**:
  - `loadAppointments()`: Carga las citas del mes actual
  - `generateCalendar()`: Genera la estructura del calendario
  - `createCalendarDay()`: Crea un día del calendario con sus citas
  - `onDayClick()`: Maneja el click en un día
  - `cancelAppointment()`: Cancela una cita con confirmación

### Template (`appointment-calendar.component.html`)

- Header con navegación y botón de nueva cita
- Controles del calendario (mes anterior/siguiente/hoy)
- Grid del calendario con días de la semana
- Leyenda de estados y prioridades
- Estado vacío cuando no hay citas

### Estilos (`appointment-calendar.component.css`)

- Alturas mínimas/máximas para las celdas
- Scrollbar personalizado para listas de citas
- Transiciones suaves

## Diseño UI

El calendario sigue los lineamientos de diseño del proyecto:

- ✅ Iconos con Material Symbols Outlined
- ✅ Alertas centralizadas con AlertService (SweetAlert2)
- ✅ Colores con Tailwind CSS
- ✅ Espaciados y sombras consistentes
- ✅ Estados de foco visibles
- ✅ Responsive design

## Estado de Carga

- Spinner de carga mientras se obtienen las citas
- Estado vacío cuando no hay citas en el mes

## Accesibilidad

- Botones con `aria-label` descriptivos
- Estados de foco visibles con anillos de color
- Contraste adecuado para legibilidad
- Navegación por teclado habilitada

## Integración

El calendario está completamente integrado con:

- Sistema de autenticación (tokens JWT)
- Interceptores de contexto de clínica
- Manejo centralizado de errores
- Servicio de alertas global

## Próximas Mejoras (Opcionales)

- [ ] Vista semanal
- [ ] Vista diaria con timeline
- [ ] Drag & drop para reprogramar citas
- [ ] Filtros por doctor, tipo de cita o estado
- [ ] Exportar calendario a PDF/ICS
- [ ] Recordatorios automáticos
- [ ] Vista de disponibilidad del doctor
