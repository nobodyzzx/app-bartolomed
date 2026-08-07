# Guía de diseño UI — Frontend Bartolomed

Estas reglas aplican a **todos** los módulos del dashboard. Cualquier componente que no las cumpla debe ser corregido antes de agregar nueva funcionalidad sobre él.

> Nacieron de una refactorización sistemática en marzo 2026 de los módulos patients, medical-records y appointments para unificar el sistema visual.

## Excepción: pantallas de flujo de autenticación

Las páginas bajo `modules/auth/` (login, recuperar contraseña, seleccionar clínica) **no** siguen este documento — tienen su propio sistema visual de pantalla completa (`.login-page` y variantes centradas con `min-h-screen flex items-center justify-center`), sin sidebar ni `<app-page-header>` (no tiene sentido un botón "volver" antes de autenticarse o al elegir clínica). Sí deben usar los botones `btn btn-*` de la sección de abajo — solo el layout general de página queda exceptuado.

## Layout de páginas (dashboard)

- Envolver siempre con `<div class="page-wrapper"><div class="page-inner">...</div></div>`
- Usar `<app-page-header>` para el encabezado de cada página (título, subtítulo, botón back, acciones opcionales en el slot de contenido)
- Nunca usar `min-h-screen bg-slate-50 p-8` ni headers manuales con botón de retroceso inline

## Cabeceras de sección (tarjetas de formulario)

Cada sección de formulario es una tarjeta con este patrón:

```html
<div class="bg-white rounded-2xl shadow-sm border border-slate-200 overflow-hidden mb-6">
  <div class="flex items-center gap-4 px-6 py-4 bg-{color}-50 border-b border-{color}-100">
    <div class="w-10 h-10 rounded-full bg-{color}-100 text-{color}-600 flex items-center justify-center flex-shrink-0">
      <span class="material-symbols-outlined msz-20">{icono}</span>
    </div>
    <div>
      <h3 class="font-semibold text-slate-900 m-0 leading-tight">Título sección</h3>
      <p class="text-sm text-slate-500 m-0">Subtítulo descriptivo</p>
    </div>
  </div>
  <div class="p-6">
    <!-- campos -->
  </div>
</div>
```

Colores por módulo/sección (consistentes entre formularios):
- Azul (`blue`): participantes, información personal, información de consulta
- Verde (`green`): fechas/horarios, contacto, historia médica
- Morado (`purple`): clasificación, seguro médico, signos vitales
- Naranja (`orange`): detalles, emergencia
- Teal (`teal`): examen físico
- Indigo (`indigo`): evaluación y diagnóstico
- Slate (`slate`): secciones opcionales (consentimiento)

## Iconos en campos de formulario (mat-form-field)

- Siempre usar `matPrefix` (nunca `matSuffix` para iconos decorativos)
- Agregar clase de color que coincida con el color de la sección: `class="text-{color}-400"`
- Usar `<mat-icon matPrefix class="text-{color}-400">icon_name</mat-icon>` — NO `<span class="material-symbols-outlined" matPrefix>`
- Excepciones válidas para `matSuffix`: botones de acción (search, clear), datepicker toggles, indicadores contextuales (lock en modo seguimiento)

```html
<!-- ✅ Correcto -->
<mat-icon matPrefix class="text-blue-400">person</mat-icon>

<!-- ❌ Incorrecto -->
<mat-icon matSuffix>person</mat-icon>
<mat-icon matPrefix>person</mat-icon>  <!-- sin color -->
```

## Variantes de botones (clases globales en styles.css)

Todos los botones son CSS puro — **nunca** usar `mat-stroked-button`, `mat-flat-button`, `mat-raised-button`. Siempre `rounded-full` (píldora). **Sin bordes visibles** en ninguna variante. Aplica también a las páginas de auth (ver excepción arriba, que solo cubre el layout general).

```html
<!-- Base: siempre combinar con una variante -->
<button class="btn btn-primary">Crear</button>
<button class="btn btn-ghost">Guardar Borrador</button>
<button class="btn btn-outline">Imprimir</button>
<button class="btn btn-outline-primary">Imprimir consentimiento</button>
<button class="btn btn-danger-outline">Cancelar</button>
<button class="btn btn-danger">Eliminar</button>
```

| Clase | Color | Uso |
|---|---|---|
| `btn btn-primary` | Azul sólido | Acción principal (Crear, Guardar, Actualizar) |
| `btn btn-ghost` | Gris slate-100 | Acción secundaria (Guardar Borrador) |
| `btn btn-outline` | Gris slate-50 | Acción terciaria (Imprimir resumen) |
| `btn btn-outline-primary` | Azul-50 | Secundaria azul (Imprimir consentimiento) |
| `btn btn-danger-outline` | Rojo suave | **Cancelar** — navegación sin guardar |
| `btn btn-danger` | Rojo sólido | Acciones destructivas (Eliminar, Borrar) |

**Jerarquía visual:** primario azul > outline-primary > outline neutro > ghost > danger-outline (cancelar) | danger (eliminar)

## Botón Cancelar en el encabezado

Todo formulario de creación/edición debe tener un botón "Cancelar" en el slot de acciones del `<app-page-header>`, además del que existe en la barra inferior:

```html
<app-page-header [title]="..." subtitle="..." (back)="...">
  <button type="button" (click)="cancel()" class="btn btn-danger-outline">
    <span class="material-symbols-outlined msz-18">cancel</span>
    Cancelar
  </button>
</app-page-header>
```

- Visible en la parte superior para evitar scroll innecesario
- Mismo handler que el botón de cancelar de la barra inferior
- No aplicar en páginas de solo-lectura (view mode) ni en listados

## Barra de acciones (sticky action bar)

Usar siempre la clase global `form-action-bar` — **nunca** escribir el string inline de Tailwind:

```html
<div class="form-action-bar">
  <!-- izquierda: acción secundaria -->
  <button type="button" (click)="saveDraft()" class="btn btn-ghost">
    <span class="material-symbols-outlined msz-18">save</span>
    Guardar Borrador
  </button>

  <!-- derecha: acciones terciarias + acción principal -->
  <div class="flex items-center gap-3">
    <button type="button" (click)="print()" class="btn btn-outline">
      <span class="material-symbols-outlined msz-18">summarize</span>
      Imprimir resumen
    </button>
    <button type="button" (click)="onSubmit()" [disabled]="form.invalid" class="btn btn-primary">
      <span class="material-symbols-outlined msz-18">check_circle</span>
      Crear
    </button>
  </div>
</div>
```

Equivale a: `sticky bottom-4 z-30 bg-white/90 backdrop-blur rounded-2xl border border-slate-200 shadow-lg px-6 py-4 flex items-center justify-between gap-4 flex-wrap`

## Componentes compartidos (SharedModule)

Usar siempre en lugar de implementaciones custom:

| Componente | Uso |
|---|---|
| `<app-page-header>` | Encabezado de página con back, título, subtítulo, slot de acciones |
| `<app-stat-card>` | Tarjeta de estadística clickeable |
| `<app-search-bar>` | Barra de búsqueda con clear |
| `<app-skeleton-table>` | Estado de carga para tablas |
| `<app-empty-state>` | Estado vacío con ícono, título, subtítulo y acción opcional |

## Tablas de listado

```html
<div class="table-container">
  <div class="table-toolbar">
    <app-search-bar
      placeholder="Buscar..."
      [value]="searchTerm"
      [showClear]="!!(searchTerm || activeFilter)"
      (valueChange)="searchTerm = $event; applyFilter()"
      (cleared)="searchTerm = ''; resetFilter()"
    />
    <!-- Filtros opcionales debajo del search-bar como <ng-content> -->
  </div>
  @if (isLoading) {
    <app-skeleton-table [rows]="6" [columns]="5" />
  }
  @if (!isLoading && dataSource.data.length === 0) {
    <app-empty-state ... />
  }
  @if (!isLoading && dataSource.data.length > 0) {
    <div class="overflow-x-auto">
      <table mat-table [dataSource]="dataSource" class="w-full bg-transparent">
        <!-- encabezados -->
        <th mat-header-cell *matHeaderCellDef class="bg-slate-100 px-6 py-4">
          <span class="text-xs font-semibold text-slate-600 uppercase tracking-wide">Col</span>
        </th>
        <!-- filas -->
        <tr mat-row *matRowDef="let row; columns: displayedColumns" class="table-row-hover"></tr>
      </table>
    </div>
    <div class="table-footer">
      <span class="text-sm text-slate-500">Mostrando <span class="font-semibold text-slate-700">X</span> de <span class="font-semibold text-slate-700">Y</span></span>
      <mat-paginator [pageSizeOptions]="[10, 25, 50]" showFirstLastButtons class="bg-transparent border-0" />
    </div>
  }
</div>
```

### `<app-search-bar>` — API del componente

| Input/Output | Tipo | Descripción |
|---|---|---|
| `[value]` | `string` | Valor actual del input |
| `[placeholder]` | `string` | Texto de placeholder |
| `[showClear]` | `boolean` | Muestra el botón X para limpiar |
| `(valueChange)` | `EventEmitter<string>` | Se emite en cada keystroke |
| `(cleared)` | `EventEmitter<void>` | Se emite al presionar el botón X |

- No usar `<input type="text">` plano en tabla toolbar — siempre `<app-search-bar>`
- Colocar siempre dentro de `<div class="table-toolbar">`

### Botones de acción en tablas (columna acciones)

```html
<div class="flex items-center justify-end gap-1">
  <!-- Ver: hover azul -->
  <button type="button" matTooltip="Ver detalles"
    class="inline-flex items-center justify-center w-9 h-9 rounded-lg text-slate-500 hover:bg-blue-50 hover:text-blue-600 transition-colors border-0">
    <span class="material-symbols-outlined msz-18">visibility</span>
  </button>
  <!-- Editar: hover ámbar -->
  <button type="button" matTooltip="Editar"
    class="inline-flex items-center justify-center w-9 h-9 rounded-lg text-slate-500 hover:bg-amber-50 hover:text-amber-600 transition-colors border-0">
    <span class="material-symbols-outlined msz-18">edit</span>
  </button>
  <!-- Eliminar: hover rojo -->
  <button type="button" matTooltip="Eliminar"
    class="inline-flex items-center justify-center w-9 h-9 rounded-lg text-slate-500 hover:bg-red-50 hover:text-red-600 transition-colors border-0">
    <span class="material-symbols-outlined msz-18">delete</span>
  </button>
</div>
```

**Regla:** el color base siempre es `text-slate-500` (gris neutro). El color semántico aparece **solo en hover** mediante `hover:bg-{color}-50 hover:text-{color}-600`. Nunca usar color fijo (`text-blue-600`) en botones de acción de tabla.

Colores de hover por acción:
- Ver / detalle → `blue`
- Editar → `amber`
- Gestionar / configurar → `purple`
- Activar → `green`
- Desactivar / bloquear → `slate` con hover `red`
- Eliminar → `red`

## Confirmaciones y notificaciones

- **Confirmaciones** → `AlertService.fire({showCancelButton: true, ...})` abre `ConfirmDialogComponent` (Angular Material). Sin SweetAlert2.
- **Toasts** → `AlertService.success/error/warning()` o `NotificationService.success/error/warning()`. Sin SweetAlert2.
- SweetAlert2 fue **desinstalado** del proyecto. No re-agregar.

```typescript
// ✅ Confirmación
this.alert.fire({
  title: 'Eliminar paciente',
  text: '¿Está seguro?',
  icon: 'warning',           // → isDestructive automático
  showCancelButton: true,
  confirmButtonText: 'Eliminar',
}).then(r => { if (r.isConfirmed) { ... } })

// ✅ Toast
this.alert.success('Paciente guardado')
this.notificationService.error('Error al cargar')
```

## Sidebar colapsado — botones de icono

Los botones del sidebar en modo colapsado usan la clase `.sidebar-collapsed-btn` (global en `styles.css`). Esta clase anula el fondo gris que MDC aplica por defecto a botones con `[matMenuTriggerFor]` (tema `azure-blue.css`).

```html
<!-- ✅ Leaf item (sin hijos) -->
<a ... class="sidebar-collapsed-btn flex items-center justify-center w-12 h-12 text-blue-600 transition-colors no-underline rounded-lg border-0">
  <span class="material-symbols-outlined text-2xl">{{ item.icon }}</span>
</a>

<!-- ✅ Parent item con hijos (flyout) -->
<button ... class="sidebar-collapsed-btn flex items-center justify-center w-12 h-12 text-blue-600 transition-colors rounded-lg border-0">
  <span class="material-symbols-outlined text-2xl">{{ item.icon }}</span>
</button>
```

El CSS relevante en `styles.css`:
```css
.sidebar-collapsed-btn,
.sidebar-collapsed-btn.mat-mdc-menu-trigger {
  background-color: transparent !important;
  --mat-icon-button-state-layer-color: transparent;
  --mdc-icon-button-container-color: transparent;
}
.sidebar-collapsed-btn:hover {
  background-color: #dbeafe !important; /* blue-200 */
}
```

**No** usar `mat-icon-button` ni `mat-button` en estos elementos — deben ser elementos HTML puros sin directivas Material de botón.

## Código muerto a evitar

En todos los módulos, nunca incluir:
- `isExpanded` + suscripción a `SidenavService` (el layout maneja esto — solo navbar/sidebar/dashboard-layout deben suscribirse)
- `isDemo` / `isAuthenticated()` guards hardcodeados en vistas (la auth real siempre está activa)
- Mock data en `catchError` de servicios
- Redirect a rutas `*/list` — usar siempre la ruta canónica del módulo (ej. `/dashboard/appointments`)

Antes de crear o refactorizar cualquier página/formulario del dashboard, seguir este documento como referencia. Si un módulo no cumple estas reglas, proponer corrección antes de agregar nueva funcionalidad.
