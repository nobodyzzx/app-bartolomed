# Design System — Bartolomed

Stack: Angular 18 + Angular Material 18 (MDC) + Tailwind CSS 3 + Material Symbols Outlined.

---

## 1. Paleta de Colores

| Token semántico | Tailwind base | Uso |
|---|---|---|
| Primary | `blue-600` / `blue-50` | CTA principal, crear, agregar |
| Secondary | `slate-700` / `slate-50` | Acciones secundarias, navegación, utilidades |
| Warning | `amber-600` / `amber-50` | Acciones especiales (transferir, exportar) |
| Danger | `red-600` / `red-50` | Eliminar, acciones destructivas |
| Success | `green-600` / `green-50` | Confirmar, aprobar (raro — preferir primary) |
| Surface | `slate-50` | Fondo de página |
| Surface card | `white` | Fondo de tarjetas/panels |

---

## 2. Botones

### Variante principal (CTA / crear / agregar)
```html
<button type="button"
  class="inline-flex items-center gap-2 px-5 py-2.5 rounded-full font-medium
         bg-blue-50 text-blue-600 hover:bg-blue-100 hover:text-blue-700
         shadow-md hover:shadow-lg focus-visible:outline-none focus-visible:ring-2
         focus-visible:ring-blue-200 focus-visible:ring-offset-1
         transition-all disabled:opacity-60 disabled:cursor-not-allowed border-0">
  <span class="material-symbols-outlined msz-20 leading-none">add</span>
  Nueva Entidad
</button>
```

### Variante secundaria (navegación, utilidades)
```html
<button type="button"
  class="inline-flex items-center gap-2 px-5 py-2.5 rounded-full font-medium
         bg-slate-50 text-slate-700 hover:bg-slate-100 hover:text-slate-900
         shadow-md hover:shadow-lg focus-visible:outline-none focus-visible:ring-2
         focus-visible:ring-slate-200 focus-visible:ring-offset-1
         transition-all border-0">
  <span class="material-symbols-outlined msz-20 leading-none">arrow_back</span>
  Volver
</button>
```

### Variante warning (acciones especiales)
```html
<button type="button"
  class="inline-flex items-center gap-2 px-5 py-2.5 rounded-full font-medium
         bg-amber-50 text-amber-600 hover:bg-amber-100 hover:text-amber-700
         shadow-md hover:shadow-lg focus-visible:outline-none focus-visible:ring-2
         focus-visible:ring-amber-200 focus-visible:ring-offset-1
         transition-all border-0">
  <span class="material-symbols-outlined msz-20 leading-none">local_shipping</span>
  Transferir
</button>
```

### Variante danger (eliminar)
```html
<button type="button"
  class="inline-flex items-center gap-2 px-5 py-2.5 rounded-full font-medium
         bg-red-50 text-red-600 hover:bg-red-100 hover:text-red-700
         shadow-md hover:shadow-lg focus-visible:outline-none focus-visible:ring-2
         focus-visible:ring-red-200 focus-visible:ring-offset-1
         transition-all border-0">
  <span class="material-symbols-outlined msz-20 leading-none">delete</span>
  Eliminar
</button>
```

### Botón icono (volver / acciones de fila)
```html
<!-- Volver (header) -->
<button type="button" aria-label="Volver"
  class="inline-flex items-center justify-center w-11 h-11 rounded-full
         bg-blue-50 text-blue-600 hover:bg-blue-100 hover:text-blue-700
         shadow-md hover:shadow-lg focus-visible:outline-none focus-visible:ring-2
         focus-visible:ring-blue-200 focus-visible:ring-offset-1 transition-all border-0">
  <span class="material-symbols-outlined msz-20 leading-none">arrow_back</span>
</button>

<!-- Acción de tabla (editar/ver/eliminar) -->
<button type="button" matTooltip="Editar"
  class="inline-flex items-center justify-center w-9 h-9 rounded-lg
         text-blue-600 hover:bg-blue-50 transition-colors border-0">
  <span class="material-symbols-outlined msz-20">edit</span>
</button>
```

### Reglas
- Máximo **2 botones primarios** por vista. Si hay más acciones → secondary o warning.
- Iconos: **siempre `material-symbols-outlined`**, nunca `mat-icon` en botones Tailwind.
- Icono va **antes** del texto, salvo en botones de solo icono.
- `h-11` y `py-2.5` son equivalentes (~44px). Usar `py-2.5` en botones con texto.

---

## 3. Header de Página

```html
<div class="flex items-center justify-between mb-10">
  <div class="flex items-center gap-4">
    <!-- Botón volver -->
    <button type="button" (click)="goBack()" aria-label="Volver"
      class="inline-flex items-center justify-center w-11 h-11 rounded-full
             bg-blue-50 text-blue-600 hover:bg-blue-100 hover:text-blue-700
             shadow-md hover:shadow-lg focus-visible:outline-none focus-visible:ring-2
             focus-visible:ring-blue-200 focus-visible:ring-offset-1 transition-all border-0">
      <span class="material-symbols-outlined msz-20 leading-none">arrow_back</span>
    </button>
    <div class="text-left">
      <h1 class="text-3xl md:text-4xl font-bold text-slate-900 mb-0.5">Título de Sección</h1>
      <p class="text-slate-600">Descripción breve</p>
    </div>
  </div>
  <!-- Botón CTA principal -->
  <button type="button" class="... btn-primary ...">
    <span class="material-symbols-outlined msz-20 leading-none">add</span>
    Nueva Entidad
  </button>
</div>
```

**Reglas:**
- `mb-10` fijo entre header y contenido.
- `h1` siempre con `text-3xl md:text-4xl font-bold text-slate-900 mb-0.5`.
- Subtítulo siempre con `text-slate-600`.
- Botón de volver: siempre icono redondo azul a la izquierda del título.

---

## 4. Búsqueda e Inputs

### Input de búsqueda (siempre azul)
```html
<div class="relative">
  <input type="text" placeholder="Buscar..."
    class="w-full h-11 rounded-full bg-blue-50 px-5 pr-12 text-slate-900
           placeholder-blue-400/70 shadow-md hover:bg-blue-100 hover:shadow-lg
           focus:outline-none focus:ring-2 focus:ring-blue-200 focus:ring-offset-1
           focus:bg-white transition border-0" />
  <span class="material-symbols-outlined msz-18 absolute right-4 top-2.5 text-blue-400">search</span>
</div>
```

### mat-form-field (siempre `appearance="outline"`)
```html
<mat-form-field appearance="outline" class="w-full">
  <mat-label>Campo</mat-label>
  <input matInput formControlName="campo" />
  <mat-error *ngIf="form.get('campo')?.hasError('required')">Requerido</mat-error>
</mat-form-field>
```

**Reglas:**
- Inputs de búsqueda: siempre `bg-blue-50`, nunca `bg-slate-50`.
- `mat-form-field`: siempre `appearance="outline"`. Nunca sin appearance.
- Grid de formulario estándar: `grid grid-cols-1 md:grid-cols-2 gap-4`.

---

## 5. Tablas

Usar `mat-table` con `matSort` y `mat-paginator`. No usar `<table>` HTML pura.

```html
<div class="bg-white rounded-2xl shadow-md overflow-hidden">
  <table mat-table [dataSource]="dataSource" matSort class="w-full bg-transparent">

    <ng-container matColumnDef="columna">
      <th mat-header-cell *matHeaderCellDef mat-sort-header
          class="bg-slate-100 text-slate-800 font-semibold p-4 text-left">
        Columna
      </th>
      <td mat-cell *matCellDef="let row" class="p-4 text-slate-700">
        {{ row.columna }}
      </td>
    </ng-container>

    <!-- Columna de acciones -->
    <ng-container matColumnDef="actions">
      <th mat-header-cell *matHeaderCellDef class="bg-slate-100 text-slate-800 font-semibold p-4 text-right">
        Acciones
      </th>
      <td mat-cell *matCellDef="let row" class="p-4 text-right">
        <button type="button" matTooltip="Editar"
          class="inline-flex items-center justify-center w-9 h-9 rounded-lg
                 text-blue-600 hover:bg-blue-50 transition-colors border-0">
          <span class="material-symbols-outlined msz-20">edit</span>
        </button>
        <button type="button" matTooltip="Eliminar"
          class="inline-flex items-center justify-center w-9 h-9 rounded-lg
                 text-red-600 hover:bg-red-50 transition-colors border-0">
          <span class="material-symbols-outlined msz-20">delete</span>
        </button>
      </td>
    </ng-container>

    <tr mat-header-row *matHeaderRowDef="displayedColumns" class="border-b-2 border-slate-200"></tr>
    <tr mat-row *matRowDef="let row; columns: displayedColumns"
        class="border-b border-slate-100 hover:bg-slate-50 transition-colors"></tr>
  </table>

  <mat-paginator [pageSizeOptions]="[10, 25, 50]" showFirstLastButtons
                 class="bg-slate-50 border-t border-slate-200">
  </mat-paginator>
</div>
```

**Reglas:**
- Tamaños de página estándar: `[10, 25, 50]`.
- Header de tabla: `bg-slate-100 text-slate-800 font-semibold p-4`.
- Fila: `border-b border-slate-100 hover:bg-slate-50 transition-colors`.

---

## 6. Tarjetas de Estadísticas

```html
<div class="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-10">
  <div class="bg-blue-50 p-4 rounded-xl border-l-4 border-blue-500 shadow-md hover:shadow-lg transition-shadow">
    <div class="flex items-center justify-between">
      <div>
        <p class="text-blue-600 text-sm font-semibold">Total</p>
        <p class="text-3xl font-bold text-blue-900 mt-2">{{ count }}</p>
        <p class="text-xs text-blue-600/60 mt-1">Descripción breve</p>
      </div>
      <span class="material-symbols-outlined text-blue-400 msz-40">icono</span>
    </div>
  </div>
  <!-- Colores por card: blue → amber → green → red (en ese orden) -->
</div>
```

**Reglas:**
- Siempre `lg:grid-cols-4` (no 2). Si hay menos de 4 stats, usar `lg:grid-cols-N` donde N = cantidad.
- `mb-10` después del grid.
- Colores estándar de stats: blue, amber, green, red.

---

## 7. Estado Vacío (Empty State)

```html
<div class="text-center py-12 px-6">
  <span class="material-symbols-outlined text-6xl text-slate-400 mb-4 block">icono_relevante</span>
  <p class="text-slate-500 text-lg mb-2">No se encontraron registros</p>
  <p class="text-slate-400 text-sm mb-6">Descripción opcional de por qué está vacío</p>
  <button type="button" (click)="crearNuevo()"
    class="inline-flex items-center gap-2 px-5 py-2.5 rounded-full font-medium
           bg-blue-50 text-blue-600 hover:bg-blue-100 hover:text-blue-700
           shadow-md hover:shadow-lg focus-visible:outline-none focus-visible:ring-2
           focus-visible:ring-blue-200 focus-visible:ring-offset-1 transition-all border-0">
    <span class="material-symbols-outlined msz-20 leading-none">add</span>
    Crear primer registro
  </button>
</div>
```

**Reglas:**
- Siempre `py-12 px-6` (no `py-8`).
- Siempre incluir botón de acción CTA.
- Icono de 6xl con `block` y `mb-4`.

---

## 8. Estado de Carga (Loading)

### Inline (dentro de un contenedor)
```html
<div *ngIf="loading()" class="flex justify-center items-center py-12">
  <mat-spinner diameter="50"></mat-spinner>
</div>
```

### Overlay (pantalla completa — solo en formularios de carga inicial)
```html
<div *ngIf="isLoading" class="fixed inset-0 bg-black/30 backdrop-blur-sm flex items-center justify-center z-50">
  <div class="bg-white rounded-xl shadow-lg p-6 flex flex-col items-center gap-3">
    <mat-spinner diameter="50"></mat-spinner>
    <p class="text-slate-700 text-sm">Cargando...</p>
  </div>
</div>
```

**Reglas:**
- Siempre `mat-spinner` con `diameter="50"`. Nunca `animate-spin` manual.
- Tablas y listas: loading inline.
- Formularios que cargan datos: loading overlay.

---

## 9. Iconografía

- **Siempre** `<span class="material-symbols-outlined">nombre_icono</span>`.
- Tamaños estándar con clase `msz-*`: `msz-18` (botones pequeños), `msz-20` (botones), `msz-24` (decorativos), `msz-40` (stats), `msz-48` (cards grandes).
- `<mat-icon>` solo dentro de `mat-form-field` con `matPrefix`/`matSuffix`.

---

## 10. Estructura de página estándar

```html
<div class="min-h-screen bg-slate-50 p-8">
  <div class="max-w-7xl mx-auto">

    <!-- 1. Header -->
    <!-- 2. Stats cards (opcional) -->
    <!-- 3. Filtros / búsqueda -->
    <!-- 4. Tabla / Lista -->
    <!-- 5. Loading state -->
    <!-- 6. Empty state -->

  </div>
</div>
```

**Contenedor:** siempre `min-h-screen bg-slate-50 p-8` + `max-w-7xl mx-auto`.
