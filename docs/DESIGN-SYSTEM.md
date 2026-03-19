# Design System — Bartolomed

Stack: **Angular 18** · **Angular Material 18 (MDC)** · **Tailwind CSS 3** · **Material Symbols Outlined**

> Documento de referencia. Ante cualquier duda sobre cómo implementar un elemento de UI, esta guía es la fuente de verdad. El componente de referencia es `medical-records-dashboard.component.html`.

---

## 1. Contenedor de Página

Toda página del dashboard sigue esta estructura raíz:

```html
<div class="min-h-screen bg-slate-50 p-8">
  <div class="max-w-7xl mx-auto">

    <!-- 1. Header -->
    <!-- 2. Stats cards (si aplica) -->
    <!-- 3. Contenido principal (tabla / formulario) -->

  </div>
</div>
```

**Reglas:**
- Padding externo: siempre `p-8`. Nunca `p-6`.
- Ancho máximo: siempre `max-w-7xl mx-auto`.
- Fondo de página: siempre `bg-slate-50`.

---

## 2. Header de Página

```html
<div class="flex items-center justify-between mb-10">
  <div class="flex items-center gap-4">

    <!-- Botón volver (opcional) -->
    <button type="button" (click)="goBack()" aria-label="Volver"
      class="inline-flex items-center justify-center w-11 h-11 rounded-full
             bg-blue-50 text-blue-600 hover:bg-blue-100 hover:text-blue-700
             shadow-md hover:shadow-lg focus-visible:outline-none focus-visible:ring-2
             focus-visible:ring-blue-200 focus-visible:ring-offset-1 transition-all border-0">
      <span class="material-symbols-outlined msz-20 leading-none">arrow_back</span>
    </button>

    <div class="text-left">
      <h1 class="text-3xl md:text-4xl font-bold text-slate-900 mb-0.5">Título</h1>
      <p class="text-slate-600">Descripción breve de la sección</p>
    </div>
  </div>

  <!-- CTA principal (opcional) -->
  <button type="button"
    class="inline-flex items-center gap-2 px-5 h-11 rounded-full font-medium
           bg-blue-600 text-white hover:bg-blue-700
           shadow-md hover:shadow-lg focus-visible:outline-none focus-visible:ring-2
           focus-visible:ring-blue-400 focus-visible:ring-offset-1 transition-all border-0">
    <span class="material-symbols-outlined msz-20 leading-none">add</span>
    Nueva Entidad
  </button>
</div>
```

**Reglas:**
- `mb-10` fijo entre header y el primer bloque de contenido.
- Botón volver: icono redondo `w-11 h-11`, azul ghost.
- CTA principal: **azul sólido** `bg-blue-600 text-white`, altura `h-11`.
- Si hay dos botones en el header (ej. "Exportar" + "Nuevo"): el secundario usa `bg-slate-50 text-slate-700`.
- Nunca usar `py-2.5` en botones de header: usar `h-11`.

---

## 3. Tarjetas de Estadísticas (Stats Cards)

### Tarjeta filtrable (click filtra la tabla)

```html
<div class="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-8">

  <div
    class="bg-blue-50 p-5 rounded-2xl border-l-4 border-blue-500
           shadow-md hover:shadow-lg transition-all cursor-pointer select-none"
    [class.ring-2]="filtroActivo === 'todos'"
    [class.ring-blue-400]="filtroActivo === 'todos'"
    (click)="setFiltro('todos')"
  >
    <div class="flex items-center justify-between">
      <div>
        <p class="text-blue-600 text-sm font-semibold">Total</p>
        <p class="text-3xl font-bold text-blue-900 mt-1">{{ stats.total }}</p>
        <p class="text-xs text-blue-500 mt-1">Descripción breve</p>
      </div>
      <span class="material-symbols-outlined text-blue-300" style="font-size: 40px">
        inventory_2
      </span>
    </div>
  </div>

</div>
```

### Tarjeta solo informativa (no filtra — ej. totales monetarios)

```html
<div class="bg-emerald-50 p-5 rounded-2xl border-l-4 border-emerald-500
            shadow-md hover:shadow-lg transition-all select-none">
  <!-- igual que arriba, sin cursor-pointer ni ring ni (click) -->
</div>
```

**Reglas:**
- Relleno: `p-5` (no `p-4`).
- Bordes: `rounded-2xl` (no `rounded-xl`).
- Sombra base: `shadow-md hover:shadow-lg transition-all`.
- Selección: `select-none` en todas. `cursor-pointer` solo en las filtrables.
- Anillo activo: `[class.ring-2]` + `[class.ring-{color}-400]` cuando la tarjeta filtra la tabla.
- Icono: `text-{color}-300` con `style="font-size: 40px"`. **Nunca** `msz-40 text-{color}-500`.
- Número: `text-3xl font-bold text-{color}-900 mt-1`.
- Sublabel: `text-xs text-{color}-500 mt-1`.
- Grid: `gap-6 mb-8`. Si hay 5 columnas: `lg:grid-cols-5`.

### Paleta de colores de stats (orden convencional)

| Posición | Color | Uso típico |
|---|---|---|
| 1ª | `blue` | Total / todos |
| 2ª | `green` | Activos / completados / aprobados |
| 3ª | `amber` / `orange` | Pendientes / borradores / advertencia |
| 4ª | `red` / `slate` | Cancelados / de baja / valores monetarios |
| Extra | `purple` / `emerald` | Ingresos / valores monetarios |

---

## 4. Tarjeta de Contenido (Card)

Contenedor de tablas, formularios o listas:

```html
<div class="bg-white rounded-2xl shadow-md overflow-hidden">
  <!-- contenido -->
</div>
```

**Reglas:**
- Siempre `rounded-2xl shadow-md`. Nunca `rounded-xl shadow-sm` ni bordes (`border border-slate-200`).
- `overflow-hidden` cuando contiene tabla con scroll horizontal.

### Header de card (cuando tiene título propio)

```html
<div class="flex items-center justify-between p-6 border-b border-slate-100">
  <h2 class="text-xl font-bold text-slate-900">Título del Card</h2>
  <button type="button"
    class="inline-flex items-center gap-2 px-4 h-9 rounded-full font-medium
           bg-blue-50 text-blue-600 hover:bg-blue-100 hover:text-blue-700
           shadow-sm hover:shadow-md focus-visible:outline-none focus-visible:ring-2
           focus-visible:ring-blue-200 focus-visible:ring-offset-1 transition-all border-0">
    Ver todos
  </button>
</div>
```

**Reglas:**
- Separador interno: `border-b border-slate-100` (no `border-slate-200`).
- Botones secundarios dentro de cards: ghost `bg-{color}-50`, altura `h-9`.

---

## 5. Tablas (mat-table)

```html
<div class="bg-white rounded-2xl shadow-md overflow-hidden">

  <!-- Buscador (dentro del card, antes de la tabla) -->
  <div class="p-6 border-b border-slate-100">
    <div class="flex-1 max-w-md relative">
      <input type="text" (keyup)="applyFilter($event)" placeholder="Buscar..."
        class="w-full h-11 rounded-full bg-blue-50 px-5 pr-12 text-slate-900
               placeholder-blue-400/70 shadow-md hover:bg-blue-100 hover:shadow-lg
               focus:outline-none focus:ring-2 focus:ring-blue-200 focus:ring-offset-1
               focus:bg-white transition border-0" />
      <span class="material-symbols-outlined absolute right-4 top-2.5 text-blue-400 msz-18">
        search
      </span>
    </div>
  </div>

  <!-- Loading -->
  <div *ngIf="loading" class="flex justify-center items-center py-12">
    <mat-spinner diameter="50"></mat-spinner>
  </div>

  <!-- Estado vacío -->
  <div *ngIf="!loading && dataSource.data.length === 0" class="text-center py-12 px-6">
    <span class="material-symbols-outlined text-6xl text-slate-400 mb-4 block">
      icono_relevante
    </span>
    <p class="text-lg font-semibold text-slate-700 mb-2">Sin registros</p>
    <p class="text-sm text-slate-400 mb-6">Descripción de por qué está vacío</p>
    <button type="button" (click)="crearNuevo()"
      class="inline-flex items-center gap-2 px-5 h-11 rounded-full font-medium
             bg-blue-600 text-white hover:bg-blue-700 shadow-md hover:shadow-lg
             focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-400
             focus-visible:ring-offset-1 transition-all border-0">
      <span class="material-symbols-outlined msz-18 leading-none">add</span>
      Crear primer registro
    </button>
  </div>

  <!-- Tabla -->
  <div *ngIf="!loading && dataSource.data.length > 0" class="overflow-x-auto">
    <table mat-table [dataSource]="dataSource" matSort class="w-full bg-transparent">

      <!-- Columna de datos -->
      <ng-container matColumnDef="nombre">
        <th mat-header-cell *matHeaderCellDef mat-sort-header class="bg-slate-100 px-6 py-4">
          <span class="text-xs font-semibold text-slate-600 uppercase tracking-wide">
            Nombre
          </span>
        </th>
        <td mat-cell *matCellDef="let row" class="px-6 py-4 text-slate-900 font-medium">
          {{ row.nombre }}
        </td>
      </ng-container>

      <!-- Columna de estado con badge -->
      <ng-container matColumnDef="status">
        <th mat-header-cell *matHeaderCellDef class="bg-slate-100 px-6 py-4">
          <span class="text-xs font-semibold text-slate-600 uppercase tracking-wide">Estado</span>
        </th>
        <td mat-cell *matCellDef="let row" class="px-6 py-4">
          <span class="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-medium border"
            [ngClass]="{
              'bg-green-50 text-green-700 border-green-200': row.status === 'active',
              'bg-orange-50 text-orange-700 border-orange-200': row.status === 'pending',
              'bg-red-50 text-red-700 border-red-200': row.status === 'cancelled'
            }">
            <span class="w-1.5 h-1.5 rounded-full"
              [ngClass]="{
                'bg-green-600': row.status === 'active',
                'bg-orange-600': row.status === 'pending',
                'bg-red-600': row.status === 'cancelled'
              }">
            </span>
            {{ getStatusLabel(row.status) }}
          </span>
        </td>
      </ng-container>

      <!-- Columna de acciones -->
      <ng-container matColumnDef="actions">
        <th mat-header-cell *matHeaderCellDef class="bg-slate-100 px-6 py-4">
          <span class="text-xs font-semibold text-slate-600 uppercase tracking-wide">Acciones</span>
        </th>
        <td mat-cell *matCellDef="let row" class="px-6 py-4">
          <div class="flex items-center gap-1">
            <button type="button"
              class="inline-flex items-center justify-center w-9 h-9 rounded-lg
                     text-blue-600 hover:bg-blue-50 transition-colors border-0"
              (click)="ver(row); $event.stopPropagation()"
              matTooltip="Ver detalles" aria-label="Ver detalles">
              <span class="material-symbols-outlined msz-18 leading-none">visibility</span>
            </button>
            <button type="button"
              class="inline-flex items-center justify-center w-9 h-9 rounded-lg
                     text-amber-600 hover:bg-amber-50 transition-colors border-0"
              (click)="editar(row); $event.stopPropagation()"
              matTooltip="Editar" aria-label="Editar">
              <span class="material-symbols-outlined msz-18 leading-none">edit</span>
            </button>
            <button type="button"
              class="inline-flex items-center justify-center w-9 h-9 rounded-lg
                     text-red-600 hover:bg-red-50 transition-colors border-0"
              (click)="eliminar(row); $event.stopPropagation()"
              matTooltip="Eliminar" aria-label="Eliminar">
              <span class="material-symbols-outlined msz-18 leading-none">delete</span>
            </button>
          </div>
        </td>
      </ng-container>

      <tr mat-header-row *matHeaderRowDef="displayedColumns" class="border-b border-slate-200"></tr>
      <tr mat-row *matRowDef="let row; columns: displayedColumns"
          (click)="ver(row)"
          class="border-b border-slate-100 hover:bg-blue-50/40 transition-colors cursor-pointer">
      </tr>
    </table>
  </div>

  <!-- Footer: fuera de overflow-x-auto -->
  <div *ngIf="!loading && dataSource.data.length > 0"
    class="flex items-center justify-between px-6 py-3 bg-slate-50 border-t border-slate-100">
    <span class="text-sm text-slate-500">
      <span class="font-semibold text-slate-700">{{ dataSource.filteredData.length }}</span>
      registros en total
    </span>
    <mat-paginator [pageSizeOptions]="[10, 25, 50, 100]" showFirstLastButtons
                   class="bg-transparent border-0">
    </mat-paginator>
  </div>

</div>
```

**Reglas:**
- El `<div class="overflow-x-auto">` contiene **solo la tabla**. El footer va fuera.
- Headers: `class="bg-slate-100 px-6 py-4"` con `<span class="text-xs font-semibold text-slate-600 uppercase tracking-wide">`. Sin iconos en el `<th>`.
- Celdas: `px-6 py-4` (no `p-4`).
- Fila header: `class="border-b border-slate-200"`.
- Filas de datos: `hover:bg-blue-50/40` (no `hover:bg-slate-50`).
- Fila clickeable → navega al detalle. Botones de acción usan `$event.stopPropagation()`.
- Botones de acción en tabla: `w-9 h-9 rounded-lg`, nunca `mat-icon-button`.
- Tamaños de paginador: `[10, 25, 50, 100]`.

### Colores de botones de acción

| Acción | Color texto | Hover bg |
|---|---|---|
| Ver / Detalle | `text-blue-600` | `hover:bg-blue-50` |
| Editar | `text-amber-600` | `hover:bg-amber-50` |
| Eliminar | `text-red-600` | `hover:bg-red-50` |
| Completar / Aprobar | `text-green-600` | `hover:bg-green-50` |
| Cancelar | `text-red-600` | `hover:bg-red-50` |
| Imprimir | `text-slate-600` | `hover:bg-slate-100` |

---

## 6. Avatar de Inicial

Para representar pacientes, usuarios o entidades con nombre en tablas:

```html
<div class="flex items-center gap-2">
  <div class="w-9 h-9 rounded-full bg-blue-100 text-blue-700
              flex items-center justify-center flex-shrink-0 font-semibold text-sm">
    {{ entidad.nombre?.charAt(0) || '?' }}
  </div>
  <div>
    <div class="font-medium text-slate-900">{{ entidad.nombre }}</div>
    <div class="text-xs text-slate-500">Dato secundario</div>
  </div>
</div>
```

---

## 7. Badges de Estado

```html
<!-- Con punto de color -->
<span class="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-medium border"
  [ngClass]="{
    'bg-green-50  text-green-700  border-green-200':  status === 'active',
    'bg-orange-50 text-orange-700 border-orange-200': status === 'pending',
    'bg-red-50    text-red-700    border-red-200':    status === 'cancelled',
    'bg-slate-50  text-slate-600  border-slate-200':  status === 'draft'
  }">
  <span class="w-1.5 h-1.5 rounded-full"
    [ngClass]="{
      'bg-green-600':  status === 'active',
      'bg-orange-600': status === 'pending',
      'bg-red-600':    status === 'cancelled',
      'bg-slate-400':  status === 'draft'
    }">
  </span>
  {{ getStatusLabel(status) }}
</span>
```

### Paleta de estados

| Estado | Colores |
|---|---|
| Activo / Completado / Pagado | `green-50 · green-700 · green-200` |
| Pendiente / En proceso | `orange-50 · orange-700 · orange-200` |
| Cancelado / Vencido / Error | `red-50 · red-700 · red-200` |
| Borrador / Inactivo | `slate-50 · slate-600 · slate-200` |
| Aprobado | `green-50 · green-700 · green-200` |
| Enviado / Programado | `blue-50 · blue-700 · blue-200` |

---

## 8. Botones

### CTA principal (crear / agregar / guardar)
```html
<button type="button"
  class="inline-flex items-center gap-2 px-5 h-11 rounded-full font-medium
         bg-blue-600 text-white hover:bg-blue-700
         shadow-md hover:shadow-lg focus-visible:outline-none focus-visible:ring-2
         focus-visible:ring-blue-400 focus-visible:ring-offset-1 transition-all border-0
         disabled:opacity-50 disabled:cursor-not-allowed">
  <span class="material-symbols-outlined msz-20 leading-none">add</span>
  Nueva Entidad
</button>
```

### Secundario (acciones de menor importancia)
```html
<button type="button"
  class="inline-flex items-center gap-2 px-5 h-11 rounded-full font-medium
         bg-slate-50 text-slate-700 hover:bg-slate-100 hover:text-slate-900
         shadow-md hover:shadow-lg focus-visible:outline-none focus-visible:ring-2
         focus-visible:ring-slate-200 focus-visible:ring-offset-1 transition-all border-0">
  <span class="material-symbols-outlined msz-20 leading-none">download</span>
  Exportar
</button>
```

### Ghost azul (dentro de cards, "Ver todos", "Limpiar filtros")
```html
<button type="button"
  class="inline-flex items-center gap-2 px-4 h-9 rounded-full font-medium
         bg-blue-50 text-blue-600 hover:bg-blue-100 hover:text-blue-700
         shadow-sm hover:shadow-md focus-visible:outline-none focus-visible:ring-2
         focus-visible:ring-blue-200 focus-visible:ring-offset-1 transition-all border-0">
  Ver todos
</button>
```

### Botón volver (header)
```html
<button type="button" aria-label="Volver"
  class="inline-flex items-center justify-center w-11 h-11 rounded-full
         bg-blue-50 text-blue-600 hover:bg-blue-100 hover:text-blue-700
         shadow-md hover:shadow-lg focus-visible:outline-none focus-visible:ring-2
         focus-visible:ring-blue-200 focus-visible:ring-offset-1 transition-all border-0">
  <span class="material-symbols-outlined msz-20 leading-none">arrow_back</span>
</button>
```

**Reglas generales de botones:**
- Header CTA: `h-11` (azul sólido si es principal, slate ghost si es secundario).
- Botones dentro de cards / filtros: `h-9`.
- Nunca usar `py-2.5` — usar `h-11` o `h-9`.
- Nunca `mat-raised-button`, `mat-flat-button` ni `mat-stroked-button` con estilos Tailwind.
- Siempre `border-0` en botones Tailwind para anular reset de Angular Material.

---

## 9. Inputs y Filtros

### Input de búsqueda
```html
<div class="relative">
  <input type="text" (keyup)="applyFilter($event)" placeholder="Buscar..."
    class="w-full h-11 rounded-full bg-blue-50 px-5 pr-12 text-slate-900
           placeholder-blue-400/70 shadow-md hover:bg-blue-100 hover:shadow-lg
           focus:outline-none focus:ring-2 focus:ring-blue-200 focus:ring-offset-1
           focus:bg-white transition border-0" />
  <span class="material-symbols-outlined msz-18 absolute right-4 top-2.5 text-blue-400">
    search
  </span>
</div>
```

### mat-form-field (siempre `appearance="outline"`)
```html
<mat-form-field appearance="outline" class="w-full">
  <mat-label>Estado</mat-label>
  <mat-select [(value)]="filtro" (selectionChange)="aplicarFiltro()">
    <mat-option [value]="null">Todos</mat-option>
    <mat-option value="active">Activo</mat-option>
  </mat-select>
</mat-form-field>
```

**Reglas:**
- Búsqueda: `bg-blue-50`, `rounded-full`.
- `mat-form-field`: siempre `appearance="outline"`.
- Grid de formulario: `grid grid-cols-1 md:grid-cols-2 gap-4`.

---

## 10. Estado Vacío (Empty State)

```html
<div class="text-center py-12 px-6">
  <span class="material-symbols-outlined text-6xl text-slate-400 mb-4 block">
    icono_relevante
  </span>
  <p class="text-lg font-semibold text-slate-700 mb-2">Sin registros</p>
  <p class="text-sm text-slate-400 mb-6">Descripción opcional</p>
  <button type="button" (click)="crearNuevo()"
    class="inline-flex items-center gap-2 px-5 h-11 rounded-full font-medium
           bg-blue-600 text-white hover:bg-blue-700 shadow-md hover:shadow-lg
           focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-400
           focus-visible:ring-offset-1 transition-all border-0">
    <span class="material-symbols-outlined msz-18 leading-none">add</span>
    Crear primer registro
  </button>
</div>
```

**Reglas:**
- Siempre `py-12 px-6`.
- Icono `text-6xl text-slate-400 mb-4 block`.
- Botón CTA azul sólido.

---

## 11. Estado de Carga

```html
<!-- Dentro de tabla / lista -->
<div *ngIf="loading" class="flex justify-center items-center py-12">
  <mat-spinner diameter="50"></mat-spinner>
</div>
```

**Reglas:**
- Siempre `mat-spinner diameter="50"`. Nunca `animate-spin` manual.

---

## 12. Iconografía

```html
<!-- Correcto -->
<span class="material-symbols-outlined msz-20 leading-none">edit</span>

<!-- Incorrecto — no usar -->
<mat-icon>edit</mat-icon>
```

### Tamaños estándar (clases `msz-*`)

| Clase | px equiv. | Uso |
|---|---|---|
| `msz-14` | ~14px | Punto de estado dentro de badges |
| `msz-16` | ~16px | Iconos decorativos pequeños |
| `msz-18` | ~18px | Botones de tabla (`w-9 h-9`) |
| `msz-20` | ~20px | Botones de header (`w-11 h-11`), CTA |
| `msz-24` | ~24px | Iconos en avatares circulares |
| `msz-40` | ~40px | Solo en Acciones Rápidas del main-dashboard |
| `style="font-size: 40px"` | 40px | **Stats cards** (no usar `msz-40` aquí) |

**Regla clave:** En stats cards el icono siempre lleva `style="font-size: 40px"` y color `text-{color}-300`. En ningún otro sitio se usa `style="font-size: 40px"`.

---

## 13. Aviso / Banner informativo

```html
<div class="mb-8">
  <div class="bg-amber-50 border-l-4 border-amber-500 p-4 rounded-xl shadow-sm">
    <div class="flex items-start gap-3 text-amber-800 text-sm">
      <span class="material-symbols-outlined msz-24 text-amber-600">info</span>
      <p class="m-0 leading-relaxed">
        <span class="font-semibold">Título del aviso:</span> Mensaje explicativo.
      </p>
    </div>
  </div>
</div>
```

---

## 14. Estructura completa de una página de listado

```
min-h-screen bg-slate-50 p-8
└── max-w-7xl mx-auto
    ├── Header (flex justify-between mb-10)
    │   ├── [botón volver] + título + subtítulo
    │   └── [botón CTA azul sólido]
    │
    ├── Stats cards (grid gap-6 mb-8) — opcional
    │   ├── Card azul: Total
    │   ├── Card verde: Activos / completados
    │   ├── Card amber/orange: Pendientes
    │   └── Card rojo/purple: Cancelados / ingresos
    │
    └── Card principal (bg-white rounded-2xl shadow-md overflow-hidden)
        ├── Buscador (p-6 border-b border-slate-100)
        ├── [Filtros adicionales mat-form-field] — opcional
        ├── Loading state
        ├── Empty state
        ├── overflow-x-auto
        │   └── mat-table
        │       ├── thead: bg-slate-100 px-6 py-4 + span uppercase tracking-wide
        │       ├── tbody: hover:bg-blue-50/40 border-b border-slate-100
        │       └── acciones: w-9 h-9 rounded-lg inline-flex
        └── Footer (flex justify-between px-6 py-3 bg-slate-50 border-t border-slate-100)
            ├── Contador: "N registros en total"
            └── mat-paginator [10, 25, 50, 100]
```

---

## 15. Checklist para revisar una página nueva

- [ ] Padding externo `p-8`, max-width `max-w-7xl`
- [ ] Header con `mb-10`, botón volver redondo azul, CTA azul sólido `h-11`
- [ ] Stats cards: `p-5 rounded-2xl border-l-4 shadow-md hover:shadow-lg transition-all`
- [ ] Stats cards filtrables: `cursor-pointer select-none` + ring activo
- [ ] Stats cards solo informativas: `select-none` sin `cursor-pointer` ni ring
- [ ] Icono de stats: `text-{color}-300 style="font-size: 40px"`
- [ ] Card principal: `rounded-2xl shadow-md` sin `border`
- [ ] Separador interno de card: `border-b border-slate-100` (no `border-slate-200`)
- [ ] Headers de tabla: `bg-slate-100 px-6 py-4` + `span text-xs font-semibold uppercase tracking-wide`
- [ ] Celdas de tabla: `px-6 py-4`
- [ ] Filas: `hover:bg-blue-50/40` (no `hover:bg-slate-50`)
- [ ] Footer **fuera** del `overflow-x-auto`
- [ ] Botones de acción: `w-9 h-9 rounded-lg inline-flex` (no `mat-icon-button`)
- [ ] Sin uso de `rounded-xl` en contenedores (solo `rounded-2xl` o `rounded-full`)
- [ ] Sin `py-2.5` en botones de header (usar `h-11`)
- [ ] Inputs de búsqueda con `bg-blue-50 rounded-full`
