# Guía de Diseño de Interfaz – Bartolomed

Esta guía documenta patrones visuales y de interacción para el frontend (Angular + Tailwind + Angular Material) con iconografía Material Symbols y alertas centralizadas.

## Alcance y principios

- Consistencia por encima de preferencia personal.
- Claridad: jerarquía tipográfica, espaciados y contraste adecuados.
- Foco en tareas: evitar ruido visual; priorizar acciones clave.
- Accesibilidad: estados visibles de foco, etiquetas en iconos, contraste suficiente.

## Fundamentos

- Frameworks: Angular + Angular Material (uso selectivo), Tailwind CSS.
- Tipografía: Roboto (300/400/500). Ya cargada en `src/index.html`.
- Iconografía: Material Symbols Outlined. Fuente cargada en `src/index.html`.

## Iconografía

- Preferido: Material Symbols con ligaduras

  ```html
  <span class="material-symbols-outlined">calendar_today</span>
  ```

  - Estilos globales definidos en `src/styles.css`:
    - `font-variation-settings: 'FILL' 0, 'wght' 400, 'GRAD' 0, 'opsz' 24`.
    - Alineación con `inline-flex`, centrado vertical y `line-height: 1`.

- Cuándo mantener `<mat-icon>`:
  - Dentro de `mat-form-field` con `matPrefix/matSuffix`.
  - En `mat-chip`, `mat-option`, `mat-icon-button` y controles que dependen del layout Material.
- Migración segura:
  - Reemplazar sólo íconos decorativos en dashboards, tarjetas, títulos y estados vacíos.
  - Actualizar CSS para que seletores que apuntaban a `mat-icon` contemplen `.material-symbols-outlined`.

## Colores, espacios y sombras

- Usar utilidades Tailwind:
  - Espaciados: `p-6`, `px-5 py-2.5`, `gap-4/6`.
  - Bordes: `rounded-xl`/`rounded-2xl`.
  - Sombras: `shadow-md`, `shadow-lg`, `hover:shadow-xl`.
  - Bordes sutiles: `border`, `border-slate-200`, `border-blue-100`.
  - Gradientes para métricas: `bg-gradient-to-br from-*-500 to-*-600`.
- Estado de foco:
  - Usar `focus-visible:ring-2` + `focus-visible:ring-<color>-200` y `focus-visible:ring-offset-1`.

## Tipografía y jerarquía

- Títulos de página: `text-3xl/4xl font-bold`.
- Subtítulos: `text-lg text-slate-600` o `text-blue-600` según contexto.
- Texto secundario: colores suaves (`text-slate-500/600`, `text-blue-100`).

## Patrones de layout

- Header de pantalla:
  - Botón de volver (redondo), título grande, subtítulo.
- Barra de búsqueda:
  - Input redondeado (`rounded-full`), ícono a la derecha, botón "Buscar".
- Tarjetas de métricas:
  - Contenedor `rounded-2xl shadow-lg`, gradiente, número grande, subtítulo suave, ícono decorativo.
- Listas y tablas:
  - Preferencia por HTML + Tailwind en dashboards.
  - `min-w-full`, `<thead>` con `bg-gray-50`, celdas con `px-4 py-2`.
  - Badges de estado con `px-2 py-1 rounded-full text-xs` y colores según semáforo.

## Tarjetas de Contenido

**Tarjetas principales** - Con sombra y hover:

```html
<div
  class="bg-white rounded-xl border border-slate-200 p-6 shadow-md hover:shadow-lg transition-shadow"
>
  <!-- Contenido -->
</div>
```

**Tarjetas de detalle** - Responsive y print-friendly:

```html
<div
  class="bg-white rounded-xl border border-slate-200 p-6 shadow-md hover:shadow-lg transition-shadow print:shadow-none print:rounded-none print:p-4"
>
  <h2
    class="text-lg font-semibold text-slate-900 mb-4 print:text-base print:mb-2"
  >
    Título
  </h2>
  <div class="space-y-3 print:space-y-1">
    <!-- Contenido -->
  </div>
</div>
```

**Reglas importantes:**

- Bordes redondeados: `rounded-xl`
- Sombra en pantalla: `shadow-md hover:shadow-lg`
- Transición suave: `transition-shadow`
- Print: `print:shadow-none print:rounded-none print:p-4`
- Padding: `p-6` en pantalla, `print:p-4` en impresión
- Espaciado vertical: `space-y-3` en pantalla, `print:space-y-1` en impresión

## Tablas de Datos

**Tabla estándar con Tailwind**:

```html
<div class="overflow-x-auto">
  <table class="min-w-full divide-y divide-slate-200">
    <thead class="bg-slate-50">
      <tr>
        <th
          class="px-4 py-2 text-left text-xs font-medium text-slate-500 uppercase tracking-wider"
        >
          Columna
        </th>
      </tr>
    </thead>
    <tbody class="bg-white divide-y divide-slate-200">
      <tr class="hover:bg-slate-50 transition-colors">
        <td class="px-4 py-2">{{ item.prop }}</td>
      </tr>
    </tbody>
  </table>
</div>
```

**Tabla con impresión optimizada**:

```html
<table class="min-w-full divide-y divide-slate-200">
  <thead class="bg-slate-50 print:bg-white">
    <tr>
      <th
        class="px-4 py-2 text-left text-xs font-medium text-slate-500 uppercase tracking-wider print:px-2 print:py-1"
      >
        Columna
      </th>
    </tr>
  </thead>
  <tbody class="bg-white divide-y divide-slate-200">
    <tr class="hover:bg-slate-50 transition-colors print:hover:bg-white">
      <td class="px-4 py-2 print:px-2 print:py-1">Dato</td>
    </tr>
  </tbody>
</table>
```

**Reglas importantes:**

- Tabla: `min-w-full divide-y divide-slate-200`
- Header: `bg-slate-50 print:bg-white`
- Celdas: `px-4 py-2` normal, `print:px-2 print:py-1` en impresión
- Hover: `hover:bg-slate-50 transition-colors`
- Colores: `text-slate-500` para headers, `text-slate-900` para datos

## Estados Vacíos (no-data)

**Estado vacío mejorado** - Con ícono circular:

```html
<div class="text-center py-12">
  <div
    class="w-20 h-20 mx-auto rounded-full bg-slate-100 flex items-center justify-center mb-4"
  >
    <span class="material-symbols-outlined text-slate-400 msz-40">inbox</span>
  </div>
  <p class="text-slate-600 text-lg font-medium mb-2">No hay elementos</p>
  <p class="text-slate-500 text-sm">Descripción adicional del estado vacío</p>
</div>
```

**Reglas importantes:**

- Contenedor circular: `w-20 h-20 rounded-full bg-slate-100`
- Ícono grande: `msz-40` (40px)
- Título: `text-lg font-medium text-slate-600`
- Descripción: `text-sm text-slate-500`
- Centrado: `text-center` y `mx-auto` para el ícono

## Botones

### Botones Principales (Patrón Unificado)

**Botón de acción principal** - Fondo azul claro con hover:

```html
<button
  class="inline-flex items-center gap-2 px-5 py-2.5 rounded-full font-medium bg-blue-50 text-blue-600 hover:bg-blue-100 hover:text-blue-700 shadow-md hover:shadow-lg focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-200 focus-visible:ring-offset-1 transition-all border-0"
>
  <span class="material-symbols-outlined msz-20 leading-none">add</span>
  Nuevo Registro
</button>
```

**Botón secundario** - Fondo gris claro:

```html
<button
  class="inline-flex items-center gap-2 px-5 h-11 rounded-full font-medium bg-slate-50 text-slate-700 hover:bg-slate-100 hover:text-slate-900 shadow-md hover:shadow-lg focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-slate-200 focus-visible:ring-offset-1 transition-all border-0"
>
  <span class="material-symbols-outlined msz-18">download</span>
  Exportar
</button>
```

**Botón de búsqueda** - Con estado disabled:

```html
<button
  [disabled]="!searchTerm?.trim()"
  class="inline-flex items-center gap-2 px-5 h-11 rounded-full font-medium bg-blue-50 text-blue-600 hover:bg-blue-100 hover:text-blue-700 shadow-md hover:shadow-lg focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-200 focus-visible:ring-offset-1 transition-all disabled:opacity-60 disabled:cursor-not-allowed border-0"
>
  <span class="material-symbols-outlined msz-18">search</span>
  Buscar
</button>
```

**Botón de volver/navegación** - Circular con icono:

```html
<button
  class="inline-flex items-center justify-center w-11 h-11 rounded-full bg-blue-50 text-blue-600 hover:bg-blue-100 hover:text-blue-700 shadow-md hover:shadow-lg focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-200 focus-visible:ring-offset-1 transition-all border-0"
  aria-label="Volver"
>
  <span class="material-symbols-outlined msz-20 leading-none">arrow_back</span>
</button>
```

**Reglas importantes:**

- Siempre usar `rounded-full` para botones
- Altura estándar: `h-11` o `py-2.5` para botones normales, `w-11 h-11` para circulares
- Padding horizontal: `px-5` para botones con texto
- Iconos: `msz-18` o `msz-20` con `leading-none` para centrado perfecto
- Estado de foco: `focus-visible:ring-2 focus-visible:ring-blue-200 focus-visible:ring-offset-1`
- Siempre `border-0` para eliminar bordes por defecto
- Transiciones: `transition-all` para efectos suaves
- Usar `inline-flex items-center gap-2` para alinear icono + texto

### Campos de Búsqueda (Patrón Unificado)

**Input de búsqueda** - Fondo azul claro con icono:

```html
<div class="relative">
  <input
    type="text"
    [(ngModel)]="searchTerm"
    (keyup.enter)="onSearch()"
    placeholder="Nombre, teléfono, email..."
    class="w-full h-11 rounded-full bg-blue-50 px-5 pr-12 text-slate-900 placeholder-blue-400/70 shadow-md hover:bg-blue-100 hover:shadow-lg focus:outline-none focus:ring-2 focus:ring-blue-200 focus:ring-offset-1 focus:bg-white transition border-0"
  />
  <span class="material-symbols-outlined absolute right-3 top-2.5 text-blue-400"
    >search</span
  >
</div>
```

**Select desplegable** - Con icono chevron:

```html
<div class="relative">
  <select
    [(ngModel)]="selectedOption"
    (change)="onChange()"
    class="h-11 rounded-full bg-blue-50 px-5 pr-10 text-slate-900 shadow-md hover:bg-blue-100 hover:shadow-lg focus:outline-none focus:ring-2 focus:ring-blue-200 focus:ring-offset-1 transition border-0 appearance-none cursor-pointer font-medium"
  >
    <option *ngFor="let option of options" [value]="option.value">
      {{ option.label }}
    </option>
  </select>
  <span
    class="material-symbols-outlined absolute right-3 top-2.5 text-blue-400 pointer-events-none"
  >
    expand_more
  </span>
</div>
```

**Reglas importantes:**

- Fondo: `bg-blue-50` por defecto
- Altura fija: `h-11` para consistencia
- Bordes redondeados: `rounded-full`
- Padding: `px-5` para texto, `pr-12` o `pr-10` cuando hay icono
- Placeholder: `placeholder-blue-400/70` para color suave
- Hover: `hover:bg-blue-100 hover:shadow-lg`
- Focus: `focus:bg-white focus:ring-2 focus:ring-blue-200`
- Iconos: posicionados con `absolute right-3 top-2.5`
- Siempre `border-0` para eliminar bordes por defecto
- Select: usar `appearance-none` y agregar icono manualmente

### Header Unificado de Página

```html
<div class="flex items-center justify-between mb-10">
  <div class="flex items-center gap-4">
    <button
      class="inline-flex items-center justify-center w-11 h-11 rounded-full bg-blue-50 text-blue-600 hover:bg-blue-100 hover:text-blue-700 shadow-md hover:shadow-lg focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-200 focus-visible:ring-offset-1 transition-all border-0"
      aria-label="Volver"
    >
      <span class="material-symbols-outlined msz-20 leading-none"
        >arrow_back</span
      >
    </button>
    <div class="text-left">
      <h1 class="text-3xl md:text-4xl font-bold text-slate-900 mb-0.5">
        Título de Página
      </h1>
      <p class="text-slate-600">Descripción breve de la sección</p>
    </div>
  </div>
  <button
    class="inline-flex items-center gap-2 px-5 py-2.5 rounded-full font-medium bg-blue-50 text-blue-600 hover:bg-blue-100 hover:text-blue-700 shadow-md hover:shadow-lg focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-200 focus-visible:ring-offset-1 transition-all border-0"
  >
    <span class="material-symbols-outlined msz-20 leading-none">add</span>
    Acción Principal
  </button>
</div>
```

### Barra de Búsqueda y Filtros

```html
<div class="flex items-center gap-4 mb-6">
  <!-- Campo de búsqueda -->
  <div class="flex-1 max-w-2xl">
    <div class="relative">
      <input
        type="text"
        placeholder="Buscar..."
        class="w-full h-11 rounded-full bg-blue-50 px-5 pr-12 text-slate-900 placeholder-blue-400/70 shadow-md hover:bg-blue-100 hover:shadow-lg focus:outline-none focus:ring-2 focus:ring-blue-200 focus:ring-offset-1 focus:bg-white transition border-0"
      />
      <span
        class="material-symbols-outlined absolute right-3 top-2.5 text-blue-400"
        >search</span
      >
    </div>
  </div>

  <!-- Botón buscar -->
  <button
    class="inline-flex items-center gap-2 px-5 h-11 rounded-full font-medium bg-blue-50 text-blue-600 hover:bg-blue-100 hover:text-blue-700 shadow-md hover:shadow-lg focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-200 focus-visible:ring-offset-1 transition-all border-0"
  >
    <span class="material-symbols-outlined msz-18">search</span>
    Buscar
  </button>

  <!-- Select de filtro -->
  <div class="relative">
    <select
      class="h-11 rounded-full bg-blue-50 px-5 pr-10 text-slate-900 shadow-md hover:bg-blue-100 hover:shadow-lg focus:outline-none focus:ring-2 focus:ring-blue-200 focus:ring-offset-1 transition border-0 appearance-none cursor-pointer font-medium"
    >
      <option>Todos</option>
    </select>
    <span
      class="material-symbols-outlined absolute right-3 top-2.5 text-blue-400 pointer-events-none"
      >expand_more</span
    >
  </div>

  <!-- Botón secundario -->
  <button
    class="inline-flex items-center gap-2 px-5 h-11 rounded-full font-medium bg-slate-50 text-slate-700 hover:bg-slate-100 hover:text-slate-900 shadow-md hover:shadow-lg focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-slate-200 focus-visible:ring-offset-1 transition-all border-0"
  >
    <span class="material-symbols-outlined msz-18">download</span>
    Exportar
  </button>
</div>
```

## Formularios

- `mat-form-field` con `appearance="outline"`.
- Prefijos/sufijos de iconos: mantener `<mat-icon matSuffix|matPrefix>`.
- Validación y mensajes de error con `mat-error` y `FormControl`.

## Alertas (AlertService)

- Uso centralizado para confirmaciones y notificaciones con SweetAlert2.
- Contrato:
  - Entradas: `icon`, `title`, `text` (o `html`), `confirmButtonText`, `cancelButtonText`, `showCancelButton`, `showDenyButton`.
  - Estilo: botones como píldoras, confirmación en azul, deny/cancel con bordes definidos y sin borde negro.
  - Enforce visual en `didOpen` (remover bordes/outlines residuales si aparecen).
- Ejemplo de confirmación:

  ```ts
  const result = await this.alert.fire({
    icon: 'question',
    title: '¿Eliminar registro?',
    text: 'Esta acción no se puede deshacer',
    showCancelButton: true,
    confirmButtonText: 'Sí, eliminar',
    cancelButtonText: 'Cancelar',
  });
  if (result.isConfirmed) {
    /* ... */
  }
  ```

- Ejemplo de éxito con navegación al cerrar:

  ```ts
  this.alert
    .fire({ icon: 'success', title: 'Guardado', text: 'Cambios aplicados' })
    .then(() => this.router.navigate(['/dashboard']));
  ```

## Estados vacíos (no-data)

- Patrón:

  ```html
  <div class="no-data text-center py-12">
    <span class="material-symbols-outlined">inventory_2</span>
    <p class="text-gray-500 text-lg">No hay elementos</p>
  </div>
  ```

- Asegurar que el CSS de `.no-data` estilice también `.material-symbols-outlined` (ya aplicado en varios módulos).

## Navegación y acciones

- Tarjetas clicables: `cursor-pointer` + `hover:shadow-xl hover:-translate-y-1`.
- Acciones superiores a la derecha: botones con ícono y texto.
- Acciones en filas: icon-only con tooltips y `aria-label`.

## Estilos de Impresión

**Configuración básica de @media print**:

```css
@media print {
  @page {
    margin: 15mm;
    size: A4;
  }

  body {
    print-color-adjust: exact;
    -webkit-print-color-adjust: exact;
  }
}
```

**Clases de utilidad para impresión**:

- `print:hidden` - Ocultar elementos en impresión (botones, controles)
- `print:block` - Mostrar solo en impresión
- `print:shadow-none` - Quitar sombras
- `print:rounded-none` - Quitar bordes redondeados
- `print:p-4` - Padding reducido (de `p-6` a `p-4`)
- `print:px-2 print:py-1` - Padding de tabla compacto
- `print:text-xs` - Texto más pequeño
- `print:text-[10px]` - Texto extra pequeño para etiquetas
- `print:space-y-1` - Espaciado vertical compacto
- `print:bg-white` - Forzar fondo blanco

**Patrón de página con impresión**:

```html
<div class="min-h-screen bg-slate-50 p-8 print:bg-white print:p-4">
  <div class="max-w-7xl mx-auto">
    <!-- Header normal (oculto en impresión) -->
    <div class="flex items-center justify-between mb-10 print:hidden">
      <!-- Botones y navegación -->
    </div>

    <!-- Header de impresión (solo visible al imprimir) -->
    <div class="hidden print:block text-center mb-6">
      <h1 class="text-2xl font-bold text-slate-900">TÍTULO DOCUMENTO</h1>
    </div>

    <!-- Contenido adaptable -->
    <div class="bg-white rounded-xl p-6 print:rounded-none print:p-4">
      <!-- Contenido -->
    </div>
  </div>
</div>
```

**Reglas importantes para impresión:**

- Siempre usar `@page` para configurar márgenes y tamaño
- `print-color-adjust: exact` para mantener colores
- Ocultar navegación y controles con `print:hidden`
- Reducir padding y márgenes para aprovechar espacio
- Usar tamaños de texto más pequeños pero legibles
- Eliminar sombras y bordes redondeados innecesarios
- Considerar imprimir en una sola columna con `print:col-span-1`

## Accesibilidad

- Icon-only: agregar `aria-label` o `title` descriptivo.
- Focus visible: `focus-visible:outline-none` + `focus-visible:ring-*`.
- Contraste: verificar legibilidad sobre gradientes o fondos suaves.

## Migración de iconos – Do/Don’t

- Do:
  - Reemplazar íconos decorativos por `<span class="material-symbols-outlined">…</span>`.
  - Extender selectores CSS existentes para incluir `.material-symbols-outlined`.
- Don’t:
  - Sustituir íconos dentro de `mat-form-field`, `mat-chip`, `mat-option` si rompe el layout.

## Snippets rápidos

- Tabla HTML + Tailwind (cuerpo dinámico):

  ```html
  <table class="min-w-full divide-y divide-gray-200">
    <thead class="bg-gray-50">
      <tr>
        <th
          class="px-4 py-2 text-left text-xs font-medium text-gray-500 uppercase"
        >
          Columna
        </th>
      </tr>
    </thead>
    <tbody class="bg-white divide-y divide-gray-200">
      <tr *ngFor="let item of items">
        <td class="px-4 py-2">{{ item.prop }}</td>
      </tr>
    </tbody>
  </table>
  ```

- Badge de estado:

  ```html
  <span
    class="px-2 py-1 rounded-full text-xs"
    [ngClass]="{ 'bg-green-100 text-green-800': ok, 'bg-yellow-100 text-yellow-800': warn, 'bg-red-100 text-red-800': err }"
  >
    {{ label }}
  </span>
  ```

- Ícono con Material Symbols:

  ```html
  <span class="material-symbols-outlined text-blue-600">group</span>
  ```

## Checklist para PR visuales

- [ ] Iconos decorativos usan Material Symbols con clases `msz-*` para tamaño.
- [ ] Formularios mantienen integraciones de Material (prefix/suffix, chips, selects).
- [ ] Alertas usan AlertService con estilos unificados.
- [ ] Títulos/subtítulos y espaciados según jerarquía definida.
- [ ] Estados vacíos consistentes con ícono circular y estilizados.
- [ ] Botones con foco visible y `aria-label` en icon-only.
- [ ] Tarjetas usan `rounded-xl`, `shadow-md hover:shadow-lg`, `transition-shadow`.
- [ ] Tablas usan `min-w-full divide-y divide-slate-200`, header con `bg-slate-50`.
- [ ] Páginas con impresión tienen clases `print:*` optimizadas.
- [ ] Layout responsive usa `p-8` con `max-w-7xl mx-auto`.

## Resumen de Patrones Clave

**Estructura de Página**:

- Container: `min-h-screen bg-slate-50 p-8`
- Wrapper: `max-w-7xl mx-auto`
- Header: Botón volver + Título/Subtítulo + Acciones

**Botones**:

- Principal: `bg-blue-50 text-blue-600 hover:bg-blue-100`
- Secundario: `bg-slate-50 text-slate-700 hover:bg-slate-100`
- Destructivo: `bg-red-50 text-red-600 hover:bg-red-100`
- Todos: `rounded-full h-11 px-5 shadow-md hover:shadow-lg transition-all`

**Tarjetas**:

- `bg-white rounded-xl border border-slate-200 p-6`
- `shadow-md hover:shadow-lg transition-shadow`
- Print: `print:shadow-none print:rounded-none print:p-4`

**Tablas**:

- `min-w-full divide-y divide-slate-200`
- Header: `bg-slate-50 text-xs font-medium text-slate-500`
- Filas: `hover:bg-slate-50 transition-colors`
- Print: `print:px-2 print:py-1`

**Estados Vacíos**:

- Ícono: `w-20 h-20 rounded-full bg-slate-100 msz-40`
- Título: `text-lg font-medium text-slate-600`
- Descripción: `text-sm text-slate-500`

**Impresión**:

- Config: `@page { margin: 15mm; size: A4; }`
- Header oculto: `print:hidden`
- Header de impresión: `hidden print:block`
- Optimización: `print:p-4 print:text-xs print:shadow-none`

---

Notas: El proyecto corre en Docker de forma continua; tras cambios visuales revisa directamente en el navegador (no hace falta `npm start`).
