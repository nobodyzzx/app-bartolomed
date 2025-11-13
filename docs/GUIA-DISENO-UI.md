# Guía de Diseño de Interfaz – Bartolomed# Guía de Diseño de Interfaz – Bartolomed

Esta guía documenta patrones visuales y de interacción para el frontend (Angular + Tailwind + Angular Material) con iconografía Material Symbols y alertas centralizadas.Esta guía documenta patrones visuales y de interacción para el frontend (Angular + Tailwind + Angular Material) con iconografía Material Symbols y alertas centralizadas.

## Alcance y principios## Alcance y principios

- Consistencia por encima de preferencia personal.- Consistencia por encima de preferencia personal.

- Claridad: jerarquía tipográfica, espaciados y contraste adecuados.- Claridad: jerarquía tipográfica, espaciados y contraste adecuados.

- Foco en tareas: evitar ruido visual; priorizar acciones clave.- Foco en tareas: evitar ruido visual; priorizar acciones clave.

- Accesibilidad: estados visibles de foco, etiquetas en iconos, contraste suficiente.- Accesibilidad: estados visibles de foco, etiquetas en iconos, contraste suficiente.

## Fundamentos## Fundamentos

- Frameworks: Angular + Angular Material (uso selectivo), Tailwind CSS.- Frameworks: Angular + Angular Material (uso selectivo), Tailwind CSS.

- Tipografía: Roboto (300/400/500). Ya cargada en `src/index.html`.- Tipografía: Roboto (300/400/500). Ya cargada en `src/index.html`.

- Iconografía: Material Symbols Outlined. Fuente cargada en `src/index.html`.- Iconografía: Material Symbols Outlined. Fuente cargada en `src/index.html`.

## Iconografía## Iconografía

- **Preferido:** Material Symbols con ligaduras- Preferido: Material Symbols con ligaduras

  `html  `html

  <span class="material-symbols-outlined">calendar_today</span> <span class="material-symbols-outlined">calendar_today</span>

  `  `

- Estilos globales definidos en `src/styles.css`: - Estilos globales definidos en `src/styles.css`:

  - `font-variation-settings: 'FILL' 0, 'wght' 400, 'GRAD' 0, 'opsz' 24`. - `font-variation-settings: 'FILL' 0, 'wght' 400, 'GRAD' 0, 'opsz' 24`.

  - Alineación con `inline-flex`, centrado vertical y `line-height: 1`. - Alineación con `inline-flex`, centrado vertical y `line-height: 1`.

- **Tamaños personalizados con clases `msz-*`:**- Cuándo mantener `<mat-icon>`:

  - `msz-12` (12px) - Para texto muy pequeño, badges - Dentro de `mat-form-field` con `matPrefix/matSuffix`.

  - `msz-14` (14px) - Para badges y etiquetas - En `mat-chip`, `mat-option`, `mat-icon-button` y controles que dependen del layout Material.

  - `msz-16` (16px) - Para chips y elementos compactos- Migración segura:

  - `msz-18` (18px) - Para botones secundarios - Reemplazar sólo íconos decorativos en dashboards, tarjetas, títulos y estados vacíos.

  - `msz-20` (20px) - Para botones principales y headers - Actualizar CSS para que seletores que apuntaban a `mat-icon` contemplen `.material-symbols-outlined`.

  - `msz-24` (24px) - Para iconos decorativos medianos

  - `msz-40` (40px) - Para estados vacíos y métricas## Colores, espacios y sombras

- **Cuándo mantener `<mat-icon>`:**- Usar utilidades Tailwind:

  - Dentro de `mat-form-field` con `matPrefix`/`matSuffix`. - Espaciados: `p-6`, `px-5 py-2.5`, `gap-4/6`.

  - En `mat-chip`, `mat-option`, `mat-icon-button` y controles que dependen del layout Material. - Bordes: `rounded-xl`/`rounded-2xl`.

  - Sombras: `shadow-md`, `shadow-lg`, `hover:shadow-xl`.

- **Migración segura:** - Bordes sutiles: `border`, `border-slate-200`, `border-blue-100`.

  - Reemplazar sólo íconos decorativos en dashboards, tarjetas, títulos y estados vacíos. - Gradientes para métricas: `bg-gradient-to-br from-*-500 to-*-600`.

  - Actualizar CSS para que selectores que apuntaban a `mat-icon` contemplen `.material-symbols-outlined`.- Estado de foco:

  - Usar `focus-visible:ring-2` + `focus-visible:ring-<color>-200` y `focus-visible:ring-offset-1`.

## Colores, espacios y sombras

## Tipografía y jerarquía

- **Usar utilidades Tailwind:**

  - Espaciados: `p-6`, `px-5 py-2.5`, `gap-4`/`gap-6`.- Títulos de página: `text-3xl/4xl font-bold`.

  - Bordes: `rounded-xl`/`rounded-2xl`.- Subtítulos: `text-lg text-slate-600` o `text-blue-600` según contexto.

  - Sombras: `shadow-md`, `shadow-lg`, `hover:shadow-xl`.- Texto secundario: colores suaves (`text-slate-500/600`, `text-blue-100`).

  - Bordes sutiles: `border`, `border-slate-200`, `border-blue-100`.

  - Gradientes para métricas: `bg-gradient-to-br from-*-500 to-*-600`.## Patrones de layout

- **Estado de foco:**- Header de pantalla:

  - Usar `focus-visible:ring-2` + `focus-visible:ring-<color>-200` y `focus-visible:ring-offset-1`. - Botón de volver (redondo), título grande, subtítulo.

- Barra de búsqueda:

## Tipografía y jerarquía - Input redondeado (`rounded-full`), ícono a la derecha, botón "Buscar".

- Tarjetas de métricas:

- Títulos de página: `text-3xl`/`text-4xl font-bold`. - Contenedor `rounded-2xl shadow-lg`, gradiente, número grande, subtítulo suave, ícono decorativo.

- Subtítulos: `text-lg text-slate-600` o `text-blue-600` según contexto.- Listas y tablas:

- Texto secundario: colores suaves (`text-slate-500`/`600`, `text-blue-100`). - Preferencia por HTML + Tailwind en dashboards.

  - `min-w-full`, `<thead>` con `bg-gray-50`, celdas con `px-4 py-2`.

## Patrones de layout - Badges de estado con `px-2 py-1 rounded-full text-xs` y colores según semáforo.

### Header de pantalla## Tarjetas de Contenido

Botón de volver (redondo), título grande, subtítulo opcional, botón de acción principal.**Tarjetas principales** - Con sombra y hover:

### Barra de búsqueda```html

<div

Input redondeado (`rounded-full`), ícono a la derecha, botón "Buscar". class="bg-white rounded-xl border border-slate-200 p-6 shadow-md hover:shadow-lg transition-shadow"

>

### Tarjetas de métricas <!-- Contenido -->

</div>

Contenedor `rounded-xl shadow-md hover:shadow-lg`, borde lateral izquierdo de color (`border-l-4`), número grande, subtítulo suave, ícono decorativo.```

````html**Tarjetas de detalle** - Responsive y print-friendly:

<div class="bg-blue-50 p-4 rounded-xl border-l-4 border-blue-500 shadow-md hover:shadow-lg transition-shadow cursor-pointer">

  <div class="flex items-center justify-between">```html

    <div><div

      <p class="text-blue-600 text-sm font-semibold">Total Expedientes</p>  class="bg-white rounded-xl border border-slate-200 p-6 shadow-md hover:shadow-lg transition-shadow print:shadow-none print:rounded-none print:p-4"

      <p class="text-3xl font-bold text-blue-900 mt-2">{{ stats.total }}</p>>

      <p class="text-xs text-blue-600/60 mt-1">Registros en el sistema</p>  <h2

    </div>    class="text-lg font-semibold text-slate-900 mb-4 print:text-base print:mb-2"

    <span class="material-symbols-outlined text-blue-500 msz-40 !w-10 !h-10">folder_shared</span>  >

  </div>    Título

</div>  </h2>

```  <div class="space-y-3 print:space-y-1">

    <!-- Contenido -->

**Variantes de color para métricas:**  </div>

- **Azul** (`bg-blue-50`, `border-blue-500`, `text-blue-600/900`) - Total/principal</div>

- **Naranja** (`bg-orange-50`, `border-orange-500`, `text-orange-600/900`) - Borradores/pendientes```

- **Verde** (`bg-green-50`, `border-green-500`, `text-green-600/900`) - Completados/éxito

- **Rojo** (`bg-red-50`, `border-red-500`, `text-red-600/900`) - Emergencias/alertas**Reglas importantes:**



### Listas y tablas- Bordes redondeados: `rounded-xl`

- Sombra en pantalla: `shadow-md hover:shadow-lg`

- Preferencia por HTML + Tailwind en dashboards.- Transición suave: `transition-shadow`

- `min-w-full`, `<thead>` con `bg-slate-50`, celdas con `px-4 py-2`.- Print: `print:shadow-none print:rounded-none print:p-4`

- Badges de estado con `px-2 py-1 rounded-full text-xs` y colores según semáforo.- Padding: `p-6` en pantalla, `print:p-4` en impresión

- Espaciado vertical: `space-y-3` en pantalla, `print:space-y-1` en impresión

## Tarjetas de Contenido

## Tablas de Datos

### Tarjetas principales - Con sombra y hover

**Tabla estándar con Tailwind**:

```html

<div class="bg-white rounded-xl border border-slate-200 p-6 shadow-md hover:shadow-lg transition-shadow">```html

  <!-- Contenido --><div class="overflow-x-auto">

</div>  <table class="min-w-full divide-y divide-slate-200">

```    <thead class="bg-slate-50">

      <tr>

### Tarjetas de detalle - Responsive y print-friendly        <th

          class="px-4 py-2 text-left text-xs font-medium text-slate-500 uppercase tracking-wider"

```html        >

<div class="bg-white rounded-xl border border-slate-200 p-6 shadow-md hover:shadow-lg transition-shadow print:shadow-none print:rounded-none print:p-4">          Columna

  <h2 class="text-lg font-semibold text-slate-900 mb-4 print:text-base print:mb-2">        </th>

    Título      </tr>

  </h2>    </thead>

  <div class="space-y-3 print:space-y-1">    <tbody class="bg-white divide-y divide-slate-200">

    <!-- Contenido -->      <tr class="hover:bg-slate-50 transition-colors">

  </div>        <td class="px-4 py-2">{{ item.prop }}</td>

</div>      </tr>

```    </tbody>

  </table>

### Tarjetas con icono decorativo</div>

````

````html

<div class="bg-white rounded-xl shadow-md p-6">**Tabla con impresión optimizada**:

  <div class="flex items-center gap-3 mb-6">

    <div class="w-10 h-10 rounded-full bg-blue-50 text-blue-600 flex items-center justify-center shadow-sm">```html

      <span class="material-symbols-outlined msz-20">receipt_long</span><table class="min-w-full divide-y divide-slate-200">

    </div>  <thead class="bg-slate-50 print:bg-white">

    <h3 class="text-xl font-semibold text-slate-900 m-0">Información Principal</h3>    <tr>

  </div>      <th

  <!-- Contenido -->        class="px-4 py-2 text-left text-xs font-medium text-slate-500 uppercase tracking-wider print:px-2 print:py-1"

</div>      >

```        Columna

      </th>

**Reglas importantes:**    </tr>

- Bordes redondeados: `rounded-xl`  </thead>

- Sombra en pantalla: `shadow-md hover:shadow-lg`  <tbody class="bg-white divide-y divide-slate-200">

- Transición suave: `transition-shadow`    <tr class="hover:bg-slate-50 transition-colors print:hover:bg-white">

- Print: `print:shadow-none print:rounded-none print:p-4`      <td class="px-4 py-2 print:px-2 print:py-1">Dato</td>

- Padding: `p-6` en pantalla, `print:p-4` en impresión    </tr>

- Espaciado vertical: `space-y-3` en pantalla, `print:space-y-1` en impresión  </tbody>

</table>

## Tablas de Datos```



### Tabla estándar con Tailwind**Reglas importantes:**



```html- Tabla: `min-w-full divide-y divide-slate-200`

<div class="overflow-x-auto">- Header: `bg-slate-50 print:bg-white`

  <table class="min-w-full divide-y divide-slate-200">- Celdas: `px-4 py-2` normal, `print:px-2 print:py-1` en impresión

    <thead class="bg-slate-50">- Hover: `hover:bg-slate-50 transition-colors`

      <tr>- Colores: `text-slate-500` para headers, `text-slate-900` para datos

        <th class="px-4 py-2 text-left text-xs font-medium text-slate-500 uppercase tracking-wider">

          Columna## Estados Vacíos (no-data)

        </th>

      </tr>**Estado vacío mejorado** - Con ícono circular:

    </thead>

    <tbody class="bg-white divide-y divide-slate-200">```html

      <tr class="hover:bg-slate-50 transition-colors"><div class="text-center py-12">

        <td class="px-4 py-2">{{ item.prop }}</td>  <div

      </tr>    class="w-20 h-20 mx-auto rounded-full bg-slate-100 flex items-center justify-center mb-4"

    </tbody>  >

  </table>    <span class="material-symbols-outlined text-slate-400 msz-40">inbox</span>

</div>  </div>

```  <p class="text-slate-600 text-lg font-medium mb-2">No hay elementos</p>

  <p class="text-slate-500 text-sm">Descripción adicional del estado vacío</p>

### Tabla con impresión optimizada</div>

````

```````html

<table class="min-w-full divide-y divide-slate-200">**Reglas importantes:**

  <thead class="bg-slate-50 print:bg-white">

    <tr>- Contenedor circular: `w-20 h-20 rounded-full bg-slate-100`

      <th class="px-4 py-2 text-left text-xs font-medium text-slate-500 uppercase tracking-wider print:px-2 print:py-1">- Ícono grande: `msz-40` (40px)

        Columna- Título: `text-lg font-medium text-slate-600`

      </th>- Descripción: `text-sm text-slate-500`

    </tr>- Centrado: `text-center` y `mx-auto` para el ícono

  </thead>

  <tbody class="bg-white divide-y divide-slate-200">## Botones

    <tr class="hover:bg-slate-50 transition-colors print:hover:bg-white">

      <td class="px-4 py-2 print:px-2 print:py-1">Dato</td>### Botones Principales (Patrón Unificado)

    </tr>

  </tbody>**Botón de acción principal** - Fondo azul claro con hover:

</table>

``````html

<button

**Reglas importantes:**  class="inline-flex items-center gap-2 px-5 py-2.5 rounded-full font-medium bg-blue-50 text-blue-600 hover:bg-blue-100 hover:text-blue-700 shadow-md hover:shadow-lg focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-200 focus-visible:ring-offset-1 transition-all border-0"

- Tabla: `min-w-full divide-y divide-slate-200`>

- Header: `bg-slate-50 print:bg-white`  <span class="material-symbols-outlined msz-20 leading-none">add</span>

- Celdas: `px-4 py-2` normal, `print:px-2 print:py-1` en impresión  Nuevo Registro

- Hover: `hover:bg-slate-50 transition-colors`</button>

- Colores: `text-slate-500` para headers, `text-slate-900` para datos```



## Estados Vacíos (no-data)**Botón secundario** - Fondo gris claro:



### Estado vacío mejorado - Con ícono circular```html

<button

```html  class="inline-flex items-center gap-2 px-5 h-11 rounded-full font-medium bg-slate-50 text-slate-700 hover:bg-slate-100 hover:text-slate-900 shadow-md hover:shadow-lg focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-slate-200 focus-visible:ring-offset-1 transition-all border-0"

<div class="text-center py-12">>

  <div class="w-20 h-20 mx-auto rounded-full bg-slate-100 flex items-center justify-center mb-4">  <span class="material-symbols-outlined msz-18">download</span>

    <span class="material-symbols-outlined text-slate-400 msz-40">inbox</span>  Exportar

  </div></button>

  <p class="text-slate-600 text-lg font-medium mb-2">No hay elementos</p>```

  <p class="text-slate-500 text-sm">Descripción adicional del estado vacío</p>

</div>**Botón de búsqueda** - Con estado disabled:

```````

````html

**Reglas importantes:**<button

- Contenedor circular: `w-20 h-20 rounded-full bg-slate-100`  [disabled]="!searchTerm?.trim()"

- Ícono grande: `msz-40` (40px)  class="inline-flex items-center gap-2 px-5 h-11 rounded-full font-medium bg-blue-50 text-blue-600 hover:bg-blue-100 hover:text-blue-700 shadow-md hover:shadow-lg focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-200 focus-visible:ring-offset-1 transition-all disabled:opacity-60 disabled:cursor-not-allowed border-0"

- Título: `text-lg font-medium text-slate-600`>

- Descripción: `text-sm text-slate-500`  <span class="material-symbols-outlined msz-18">search</span>

- Centrado: `text-center` y `mx-auto` para el ícono  Buscar

</button>

## Botones```



### Botones Principales (Patrón Unificado)**Botón de volver/navegación** - Circular con icono:



#### Botón de acción principal - Fondo azul claro con hover```html

<button

```html  class="inline-flex items-center justify-center w-11 h-11 rounded-full bg-blue-50 text-blue-600 hover:bg-blue-100 hover:text-blue-700 shadow-md hover:shadow-lg focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-200 focus-visible:ring-offset-1 transition-all border-0"

<button  aria-label="Volver"

  type="button">

  class="inline-flex items-center gap-2 px-5 py-2.5 rounded-full font-medium bg-blue-50 text-blue-600 hover:bg-blue-100 hover:text-blue-700 shadow-md hover:shadow-lg focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-200 focus-visible:ring-offset-1 transition-all border-0"  <span class="material-symbols-outlined msz-20 leading-none">arrow_back</span>

></button>

  <span class="material-symbols-outlined msz-20 leading-none">add</span>```

  Nuevo Registro

</button>**Reglas importantes:**

````

- Siempre usar `rounded-full` para botones

#### Botón secundario - Fondo gris claro- Altura estándar: `h-11` o `py-2.5` para botones normales, `w-11 h-11` para circulares

- Padding horizontal: `px-5` para botones con texto

```html- Iconos: `msz-18`o`msz-20`con`leading-none` para centrado perfecto

<button- Estado de foco: `focus-visible:ring-2 focus-visible:ring-blue-200 focus-visible:ring-offset-1`

type="button"- Siempre `border-0` para eliminar bordes por defecto

class="inline-flex items-center gap-2 px-5 h-11 rounded-full font-medium bg-slate-50 text-slate-700 hover:bg-slate-100 hover:text-slate-900 shadow-md hover:shadow-lg focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-slate-200 focus-visible:ring-offset-1 transition-all border-0"- Transiciones: `transition-all` para efectos suaves

> - Usar `inline-flex items-center gap-2` para alinear icono + texto

<span class="material-symbols-outlined msz-18">download</span>

Exportar### Campos de Búsqueda (Patrón Unificado)

</button>

````**Input de búsqueda** - Fondo azul claro con icono:



#### Botón de búsqueda - Con estado disabled```html

<div class="relative">

```html  <input

<button    type="text"

  type="button"    [(ngModel)]="searchTerm"

  [disabled]="!searchTerm?.trim()"    (keyup.enter)="onSearch()"

  class="inline-flex items-center gap-2 px-5 h-11 rounded-full font-medium bg-blue-50 text-blue-600 hover:bg-blue-100 hover:text-blue-700 shadow-md hover:shadow-lg focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-200 focus-visible:ring-offset-1 transition-all disabled:opacity-60 disabled:cursor-not-allowed border-0"    placeholder="Nombre, teléfono, email..."

>    class="w-full h-11 rounded-full bg-blue-50 px-5 pr-12 text-slate-900 placeholder-blue-400/70 shadow-md hover:bg-blue-100 hover:shadow-lg focus:outline-none focus:ring-2 focus:ring-blue-200 focus:ring-offset-1 focus:bg-white transition border-0"

  <span class="material-symbols-outlined msz-18">search</span>  />

  Buscar  <span class="material-symbols-outlined absolute right-3 top-2.5 text-blue-400"

</button>    >search</span

```  >

</div>

#### Botón de volver/navegación - Circular con icono```



```html**Select desplegable** - Con icono chevron:

<button

  type="button"```html

  (click)="goBack()"<div class="relative">

  class="inline-flex items-center justify-center w-11 h-11 rounded-full bg-blue-50 text-blue-600 hover:bg-blue-100 hover:text-blue-700 shadow-md hover:shadow-lg focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-200 focus-visible:ring-offset-1 transition-all border-0"  <select

  matTooltip="Volver"    [(ngModel)]="selectedOption"

  aria-label="Volver"    (change)="onChange()"

>    class="h-11 rounded-full bg-blue-50 px-5 pr-10 text-slate-900 shadow-md hover:bg-blue-100 hover:shadow-lg focus:outline-none focus:ring-2 focus:ring-blue-200 focus:ring-offset-1 transition border-0 appearance-none cursor-pointer font-medium"

  <span class="material-symbols-outlined msz-20 leading-none">arrow_back</span>  >

</button>    <option *ngFor="let option of options" [value]="option.value">

```      {{ option.label }}

    </option>

#### Botón destructivo pequeño - Circular con icono  </select>

  <span

```html    class="material-symbols-outlined absolute right-3 top-2.5 text-blue-400 pointer-events-none"

<button  >

  type="button"    expand_more

  (click)="removeItem(i)"  </span>

  class="w-9 h-9 inline-flex items-center justify-center rounded-full bg-red-50 text-red-600 hover:bg-red-100 hover:text-red-700 shadow hover:shadow-md focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-red-200 focus-visible:ring-offset-1 transition-all border-0"</div>

  matTooltip="Eliminar medicamento"```

>

  <span class="material-symbols-outlined msz-18">delete</span>**Reglas importantes:**

</button>

```- Fondo: `bg-blue-50` por defecto

- Altura fija: `h-11` para consistencia

**Reglas importantes:**- Bordes redondeados: `rounded-full`

- Siempre usar `rounded-full` para botones- Padding: `px-5` para texto, `pr-12` o `pr-10` cuando hay icono

- Altura estándar: `h-11` o `py-2.5` para botones normales, `w-11 h-11` para circulares- Placeholder: `placeholder-blue-400/70` para color suave

- Padding horizontal: `px-5` para botones con texto- Hover: `hover:bg-blue-100 hover:shadow-lg`

- Iconos: `msz-18` o `msz-20` con `leading-none` para centrado perfecto- Focus: `focus:bg-white focus:ring-2 focus:ring-blue-200`

- Estado de foco: `focus-visible:ring-2 focus-visible:ring-blue-200 focus-visible:ring-offset-1`- Iconos: posicionados con `absolute right-3 top-2.5`

- Siempre `border-0` para eliminar bordes por defecto- Siempre `border-0` para eliminar bordes por defecto

- Transiciones: `transition-all` para efectos suaves- Select: usar `appearance-none` y agregar icono manualmente

- Usar `inline-flex items-center gap-2` para alinear icono + texto

- Siempre incluir `type="button"` para evitar submit accidental en formularios### Header Unificado de Página



## Campos de Búsqueda (Patrón Unificado)```html

<div class="flex items-center justify-between mb-10">

### Input de búsqueda - Fondo azul claro con icono  <div class="flex items-center gap-4">

    <button

```html      class="inline-flex items-center justify-center w-11 h-11 rounded-full bg-blue-50 text-blue-600 hover:bg-blue-100 hover:text-blue-700 shadow-md hover:shadow-lg focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-200 focus-visible:ring-offset-1 transition-all border-0"

<div class="relative">      aria-label="Volver"

  <input    >

    type="text"      <span class="material-symbols-outlined msz-20 leading-none"

    [(ngModel)]="searchTerm"        >arrow_back</span

    (keyup.enter)="onSearch()"      >

    placeholder="Nombre, teléfono, email..."    </button>

    class="w-full h-11 rounded-full bg-blue-50 px-5 pr-12 text-slate-900 placeholder-blue-400/70 shadow-md hover:bg-blue-100 hover:shadow-lg focus:outline-none focus:ring-2 focus:ring-blue-200 focus:ring-offset-1 focus:bg-white transition border-0"    <div class="text-left">

  />      <h1 class="text-3xl md:text-4xl font-bold text-slate-900 mb-0.5">

  <span class="material-symbols-outlined absolute right-3 top-2.5 text-blue-400">search</span>        Título de Página

</div>      </h1>

```      <p class="text-slate-600">Descripción breve de la sección</p>

    </div>

### Select desplegable - Con icono chevron  </div>

  <button

```html    class="inline-flex items-center gap-2 px-5 py-2.5 rounded-full font-medium bg-blue-50 text-blue-600 hover:bg-blue-100 hover:text-blue-700 shadow-md hover:shadow-lg focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-200 focus-visible:ring-offset-1 transition-all border-0"

<div class="relative">  >

  <select    <span class="material-symbols-outlined msz-20 leading-none">add</span>

    [(ngModel)]="selectedOption"    Acción Principal

    (change)="onChange()"  </button>

    class="h-11 rounded-full bg-blue-50 px-5 pr-10 text-slate-900 shadow-md hover:bg-blue-100 hover:shadow-lg focus:outline-none focus:ring-2 focus:ring-blue-200 focus:ring-offset-1 transition border-0 appearance-none cursor-pointer font-medium"</div>

  >```

    <option *ngFor="let option of options" [value]="option.value">

      {{ option.label }}### Barra de Búsqueda y Filtros

    </option>

  </select>```html

  <span class="material-symbols-outlined absolute right-3 top-2.5 text-blue-400 pointer-events-none"><div class="flex items-center gap-4 mb-6">

    expand_more  <!-- Campo de búsqueda -->

  </span>  <div class="flex-1 max-w-2xl">

</div>    <div class="relative">

```      <input

        type="text"

**Reglas importantes:**        placeholder="Buscar..."

- Fondo: `bg-blue-50` por defecto        class="w-full h-11 rounded-full bg-blue-50 px-5 pr-12 text-slate-900 placeholder-blue-400/70 shadow-md hover:bg-blue-100 hover:shadow-lg focus:outline-none focus:ring-2 focus:ring-blue-200 focus:ring-offset-1 focus:bg-white transition border-0"

- Altura fija: `h-11` para consistencia      />

- Bordes redondeados: `rounded-full`      <span

- Padding: `px-5` para texto, `pr-12` o `pr-10` cuando hay icono        class="material-symbols-outlined absolute right-3 top-2.5 text-blue-400"

- Placeholder: `placeholder-blue-400/70` para color suave        >search</span

- Hover: `hover:bg-blue-100 hover:shadow-lg`      >

- Focus: `focus:bg-white focus:ring-2 focus:ring-blue-200`    </div>

- Iconos: posicionados con `absolute right-3 top-2.5`  </div>

- Siempre `border-0` para eliminar bordes por defecto

- Select: usar `appearance-none` y agregar icono manualmente  <!-- Botón buscar -->

  <button

## Header Unificado de Página    class="inline-flex items-center gap-2 px-5 h-11 rounded-full font-medium bg-blue-50 text-blue-600 hover:bg-blue-100 hover:text-blue-700 shadow-md hover:shadow-lg focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-200 focus-visible:ring-offset-1 transition-all border-0"

  >

```html    <span class="material-symbols-outlined msz-18">search</span>

<div class="flex items-center justify-between mb-10">    Buscar

  <div class="flex items-center gap-4">  </button>

    <button

      type="button"  <!-- Select de filtro -->

      (click)="goBack()"  <div class="relative">

      class="inline-flex items-center justify-center w-11 h-11 rounded-full bg-blue-50 text-blue-600 hover:bg-blue-100 hover:text-blue-700 shadow-md hover:shadow-lg focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-200 focus-visible:ring-offset-1 transition-all border-0"    <select

      matTooltip="Volver"      class="h-11 rounded-full bg-blue-50 px-5 pr-10 text-slate-900 shadow-md hover:bg-blue-100 hover:shadow-lg focus:outline-none focus:ring-2 focus:ring-blue-200 focus:ring-offset-1 transition border-0 appearance-none cursor-pointer font-medium"

      aria-label="Volver"    >

    >      <option>Todos</option>

      <span class="material-symbols-outlined msz-20 leading-none">arrow_back</span>    </select>

    </button>    <span

    <div class="text-left">      class="material-symbols-outlined absolute right-3 top-2.5 text-blue-400 pointer-events-none"

      <h1 class="text-3xl md:text-4xl font-bold text-slate-900 mb-0.5">      >expand_more</span

        Título de Página    >

      </h1>  </div>

      <p class="text-slate-600">Descripción breve de la sección</p>

    </div>  <!-- Botón secundario -->

  </div>  <button

  <button    class="inline-flex items-center gap-2 px-5 h-11 rounded-full font-medium bg-slate-50 text-slate-700 hover:bg-slate-100 hover:text-slate-900 shadow-md hover:shadow-lg focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-slate-200 focus-visible:ring-offset-1 transition-all border-0"

    type="button"  >

    class="inline-flex items-center gap-2 px-5 py-2.5 rounded-full font-medium bg-blue-50 text-blue-600 hover:bg-blue-100 hover:text-blue-700 shadow-md hover:shadow-lg focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-200 focus-visible:ring-offset-1 transition-all border-0"    <span class="material-symbols-outlined msz-18">download</span>

  >    Exportar

    <span class="material-symbols-outlined msz-20 leading-none">add</span>  </button>

    Acción Principal</div>

  </button>```

</div>

```## Formularios



## Barra de Búsqueda y Filtros- `mat-form-field` con `appearance="outline"`.

- Prefijos/sufijos de iconos: mantener `<mat-icon matSuffix|matPrefix>`.

```html- Validación y mensajes de error con `mat-error` y `FormControl`.

<div class="flex items-center gap-4 mb-6">

  <div class="flex-1 max-w-2xl">## Alertas (AlertService)

    <div class="relative">

      <input- Uso centralizado para confirmaciones y notificaciones con SweetAlert2.

        type="text"- Contrato:

        (keyup)="applyFilter($event)"  - Entradas: `icon`, `title`, `text` (o `html`), `confirmButtonText`, `cancelButtonText`, `showCancelButton`, `showDenyButton`.

        placeholder="Buscar..."  - Estilo: botones como píldoras, confirmación en azul, deny/cancel con bordes definidos y sin borde negro.

        class="w-full h-11 rounded-full bg-blue-50 px-5 pr-12 text-slate-900 placeholder-blue-400/70 shadow-md hover:bg-blue-100 hover:shadow-lg focus:outline-none focus:ring-2 focus:ring-blue-200 focus:ring-offset-1 focus:bg-white transition border-0"  - Enforce visual en `didOpen` (remover bordes/outlines residuales si aparecen).

      />- Ejemplo de confirmación:

      <span class="material-symbols-outlined absolute right-3 top-2.5 text-blue-400">search</span>

    </div>  ```ts

  </div>  const result = await this.alert.fire({

    icon: 'question',

  <button    title: '¿Eliminar registro?',

    type="button"    text: 'Esta acción no se puede deshacer',

    class="inline-flex items-center gap-2 px-5 h-11 rounded-full font-medium bg-blue-50 text-blue-600 hover:bg-blue-100 hover:text-blue-700 shadow-md hover:shadow-lg focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-200 focus-visible:ring-offset-1 transition-all border-0"    showCancelButton: true,

  >    confirmButtonText: 'Sí, eliminar',

    <span class="material-symbols-outlined msz-18">search</span>    cancelButtonText: 'Cancelar',

    Buscar  });

  </button>  if (result.isConfirmed) {

    /* ... */

  <div class="relative">  }

    <select  ```

      class="h-11 rounded-full bg-blue-50 px-5 pr-10 text-slate-900 shadow-md hover:bg-blue-100 hover:shadow-lg focus:outline-none focus:ring-2 focus:ring-blue-200 focus:ring-offset-1 transition border-0 appearance-none cursor-pointer font-medium"

    >- Ejemplo de éxito con navegación al cerrar:

      <option>Todos</option>

    </select>  ```ts

    <span class="material-symbols-outlined absolute right-3 top-2.5 text-blue-400 pointer-events-none">expand_more</span>  this.alert

  </div>    .fire({ icon: 'success', title: 'Guardado', text: 'Cambios aplicados' })

    .then(() => this.router.navigate(['/dashboard']));

  <button  ```

    type="button"

    class="inline-flex items-center gap-2 px-5 h-11 rounded-full font-medium bg-slate-50 text-slate-700 hover:bg-slate-100 hover:text-slate-900 shadow-md hover:shadow-lg focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-slate-200 focus-visible:ring-offset-1 transition-all border-0"## Estados vacíos (no-data)

  >

    <span class="material-symbols-outlined msz-18">download</span>- Patrón:

    Exportar

  </button>  ```html

</div>  <div class="no-data text-center py-12">

```    <span class="material-symbols-outlined">inventory_2</span>

    <p class="text-gray-500 text-lg">No hay elementos</p>

## Formularios  </div>

````

### Material Form Fields

- Asegurar que el CSS de `.no-data` estilice también `.material-symbols-outlined` (ya aplicado en varios módulos).

Usar `mat-form-field` con `appearance="outline"` para formularios consistentes.

## Navegación y acciones

```````html

<mat-form-field appearance="outline">- Tarjetas clicables: `cursor-pointer` + `hover:shadow-xl hover:-translate-y-1`.

  <mat-label>Nombre del Campo</mat-label>- Acciones superiores a la derecha: botones con ícono y texto.

  <input matInput formControlName="fieldName" placeholder="Texto de ayuda" />- Acciones en filas: icon-only con tooltips y `aria-label`.

  <mat-icon matSuffix>person</mat-icon>

  <mat-error *ngIf="form.get('fieldName')?.hasError('required')">## Estilos de Impresión

    Este campo es requerido

  </mat-error>**Configuración básica de @media print**:

</mat-form-field>

``````css

@media print {

### Select con Material  @page {

    margin: 15mm;

```html    size: A4;

<mat-form-field appearance="outline">  }

  <mat-label>Seleccionar Opción</mat-label>

  <mat-select formControlName="optionId">  body {

    <mat-option value="" disabled>Selecciona una opción</mat-option>    print-color-adjust: exact;

    <mat-option *ngFor="let opt of options" [value]="opt.id">{{ opt.name }}</mat-option>    -webkit-print-color-adjust: exact;

  </mat-select>  }

  <mat-icon matSuffix>arrow_drop_down</mat-icon>}

  <mat-error *ngIf="form.get('optionId')?.hasError('required')">```

    Selecciona una opción

  </mat-error>**Clases de utilidad para impresión**:

</mat-form-field>

```- `print:hidden` - Ocultar elementos en impresión (botones, controles)

- `print:block` - Mostrar solo en impresión

### Autocomplete Personalizado- `print:shadow-none` - Quitar sombras

- `print:rounded-none` - Quitar bordes redondeados

Para campos con búsqueda y selección de entidades (pacientes, médicos, etc.):- `print:p-4` - Padding reducido (de `p-6` a `p-4`)

- `print:px-2 print:py-1` - Padding de tabla compacto

```html- `print:text-xs` - Texto más pequeño

<div class="relative">- `print:text-[10px]` - Texto extra pequeño para etiquetas

  <mat-form-field appearance="outline" class="w-full">- `print:space-y-1` - Espaciado vertical compacto

    <mat-label>Paciente</mat-label>- `print:bg-white` - Forzar fondo blanco

    <input

      matInput**Patrón de página con impresión**:

      [value]="patientFilter"

      (input)="onPatientFilter($any($event.target).value)"```html

      (focus)="showPatientDropdown = true"<div class="min-h-screen bg-slate-50 p-8 print:bg-white print:p-4">

      placeholder="Busca por nombre o documento"  <div class="max-w-7xl mx-auto">

      autocomplete="off"    <!-- Header normal (oculto en impresión) -->

    />    <div class="flex items-center justify-between mb-10 print:hidden">

    <mat-icon matSuffix>person</mat-icon>      <!-- Botones y navegación -->

    <mat-error *ngIf="form.get('patientId')?.hasError('required')">    </div>

      El paciente es requerido

    </mat-error>    <!-- Header de impresión (solo visible al imprimir) -->

  </mat-form-field>    <div class="hidden print:block text-center mb-6">

      <h1 class="text-2xl font-bold text-slate-900">TÍTULO DOCUMENTO</h1>

  <!-- Chip del paciente seleccionado -->    </div>

  <div *ngIf="selectedPatient && !showPatientDropdown" class="absolute top-2 left-3 z-10">

    <div class="inline-flex items-center gap-2 bg-blue-50 text-blue-700 px-3 py-1 rounded-full text-sm">    <!-- Contenido adaptable -->

      <span class="material-symbols-outlined msz-16">person</span>    <div class="bg-white rounded-xl p-6 print:rounded-none print:p-4">

      <span class="font-medium">{{ selectedPatient.firstName }} {{ selectedPatient.lastName }}</span>      <!-- Contenido -->

      <button    </div>

        type="button"  </div>

        (click)="clearPatient(); $event.stopPropagation()"</div>

        class="hover:bg-blue-100 rounded-full p-0.5"```

      >

        <span class="material-symbols-outlined msz-16">close</span>**Reglas importantes para impresión:**

      </button>

    </div>- Siempre usar `@page` para configurar márgenes y tamaño

  </div>- `print-color-adjust: exact` para mantener colores

- Ocultar navegación y controles con `print:hidden`

  <!-- Dropdown de pacientes -->- Reducir padding y márgenes para aprovechar espacio

  <ul- Usar tamaños de texto más pequeños pero legibles

    *ngIf="showPatientDropdown && (filteredPatients.length > 0 || patientFilter)"- Eliminar sombras y bordes redondeados innecesarios

    role="listbox"- Considerar imprimir en una sola columna con `print:col-span-1`

    aria-label="Lista de pacientes"

    class="absolute z-30 bg-white border border-slate-200 rounded-lg mt-1 w-full max-h-60 overflow-auto shadow-xl"## Accesibilidad

  >

    <li- Icon-only: agregar `aria-label` o `title` descriptivo.

      *ngIf="filteredPatients.length === 0 && patientFilter"- Focus visible: `focus-visible:outline-none` + `focus-visible:ring-*`.

      class="px-4 py-3 text-sm text-slate-500"- Contraste: verificar legibilidad sobre gradientes o fondos suaves.

    >

      Sin resultados## Migración de iconos – Do/Don’t

    </li>

    <li- Do:

      *ngFor="let p of filteredPatients"  - Reemplazar íconos decorativos por `<span class="material-symbols-outlined">…</span>`.

      (click)="selectPatient(p)"  - Extender selectores CSS existentes para incluir `.material-symbols-outlined`.

      (keydown.enter)="selectPatient(p)"- Don’t:

      role="option"  - Sustituir íconos dentro de `mat-form-field`, `mat-chip`, `mat-option` si rompe el layout.

      tabindex="0"

      [attr.aria-selected]="form.get('patientId')?.value === p.id"## Snippets rápidos

      class="px-4 py-3 hover:bg-blue-50 cursor-pointer focus:outline-none focus:bg-blue-50 transition-colors"

      [class.bg-blue-50]="form.get('patientId')?.value === p.id"- Tabla HTML + Tailwind (cuerpo dinámico):

    >

      <div class="font-medium text-slate-900">{{ p.firstName }} {{ p.lastName }}</div>  ```html

      <div class="text-xs text-slate-500 mt-0.5">  <table class="min-w-full divide-y divide-gray-200">

        <span class="material-symbols-outlined msz-12 align-middle">badge</span>    <thead class="bg-gray-50">

        {{ p.documentNumber || 'Sin documento' }}      <tr>

      </div>        <th

    </li>          class="px-4 py-2 text-left text-xs font-medium text-gray-500 uppercase"

  </ul>        >

</div>          Columna

```        </th>

      </tr>

**Chips de selección por color semántico:**    </thead>

- **Azul** (`bg-blue-50 text-blue-700`) - Para pacientes    <tbody class="bg-white divide-y divide-gray-200">

- **Verde** (`bg-green-50 text-green-700`) - Para médicos/profesionales      <tr *ngFor="let item of items">

- **Naranja** (`bg-orange-50 text-orange-700`) - Para categorías/etiquetas        <td class="px-4 py-2">{{ item.prop }}</td>

- **Rojo** (`bg-red-50 text-red-700`) - Para advertencias/restricciones      </tr>

    </tbody>

### Arrays de Formulario (FormArray)  </table>

```````

Para listas dinámicas de items dentro de un formulario:

- Badge de estado:

````html

<div class="bg-white rounded-xl shadow-md p-6">  ```html

  <div class="flex items-center justify-between mb-6">  <span

    <div class="flex items-center gap-3">    class="px-2 py-1 rounded-full text-xs"

      <div class="w-10 h-10 rounded-full bg-green-50 text-green-600 flex items-center justify-center shadow-sm">    [ngClass]="{ 'bg-green-100 text-green-800': ok, 'bg-yellow-100 text-yellow-800': warn, 'bg-red-100 text-red-800': err }"

        <span class="material-symbols-outlined msz-20">medication</span>  >

      </div>    {{ label }}

      <div>  </span>

        <h3 class="text-xl font-semibold text-slate-900 m-0">Medicamentos</h3>  ```

        <p class="text-xs text-slate-500 mt-0.5">

          {{ items.length }} medicamento(s) recetado(s)- Ícono con Material Symbols:

        </p>

      </div>  ```html

    </div>  <span class="material-symbols-outlined text-blue-600">group</span>

    <button  ```

      type="button"

      (click)="addItem()"## Checklist para PR visuales

      class="inline-flex items-center gap-2 px-5 py-2.5 rounded-full font-medium bg-blue-50 text-blue-600 hover:bg-blue-100 hover:text-blue-700 shadow-md hover:shadow-lg focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-200 focus-visible:ring-offset-1 transition-all border-0"

    >- [ ] Iconos decorativos usan Material Symbols con clases `msz-*` para tamaño.

      <span class="material-symbols-outlined msz-20 leading-none">add</span>- [ ] Formularios mantienen integraciones de Material (prefix/suffix, chips, selects).

      Agregar Medicamento- [ ] Alertas usan AlertService con estilos unificados.

    </button>- [ ] Títulos/subtítulos y espaciados según jerarquía definida.

  </div>- [ ] Estados vacíos consistentes con ícono circular y estilizados.

- [ ] Botones con foco visible y `aria-label` en icon-only.

  <div class="space-y-6" *ngIf="items.length > 0">- [ ] Tarjetas usan `rounded-xl`, `shadow-md hover:shadow-lg`, `transition-shadow`.

    <div- [ ] Tablas usan `min-w-full divide-y divide-slate-200`, header con `bg-slate-50`.

      *ngFor="let it of items.controls; let i = index"- [ ] Páginas con impresión tienen clases `print:*` optimizadas.

      class="relative border-2 border-slate-200 rounded-xl p-6 bg-gradient-to-br from-slate-50 to-white hover:border-blue-200 transition-colors"- [ ] Layout responsive usa `p-8` con `max-w-7xl mx-auto`.

    >

      <!-- Número del medicamento y botón eliminar -->## Resumen de Patrones Clave

      <div class="flex items-center justify-between mb-4">

        <div class="flex items-center gap-2">**Estructura de Página**:

          <div class="w-8 h-8 rounded-full bg-green-100 text-green-700 flex items-center justify-center font-bold text-sm">

            {{ i + 1 }}- Container: `min-h-screen bg-slate-50 p-8`

          </div>- Wrapper: `max-w-7xl mx-auto`

          <span class="font-semibold text-slate-700">Medicamento #{{ i + 1 }}</span>- Header: Botón volver + Título/Subtítulo + Acciones

        </div>

        <button**Botones**:

          type="button"

          (click)="removeItem(i)"- Principal: `bg-blue-50 text-blue-600 hover:bg-blue-100`

          class="w-9 h-9 inline-flex items-center justify-center rounded-full bg-red-50 text-red-600 hover:bg-red-100 hover:text-red-700 shadow hover:shadow-md focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-red-200 focus-visible:ring-offset-1 transition-all border-0"- Secundario: `bg-slate-50 text-slate-700 hover:bg-slate-100`

          matTooltip="Eliminar medicamento"- Destructivo: `bg-red-50 text-red-600 hover:bg-red-100`

        >- Todos: `rounded-full h-11 px-5 shadow-md hover:shadow-lg transition-all`

          <span class="material-symbols-outlined msz-18">delete</span>

        </button>**Tarjetas**:

      </div>

- `bg-white rounded-xl border border-slate-200 p-6`

      <div [formGroup]="it" class="grid grid-cols-1 md:grid-cols-2 gap-4">- `shadow-md hover:shadow-lg transition-shadow`

        <!-- Campos del formulario aquí -->- Print: `print:shadow-none print:rounded-none print:p-4`

      </div>

    </div>**Tablas**:

  </div>

</div>- `min-w-full divide-y divide-slate-200`

```- Header: `bg-slate-50 text-xs font-medium text-slate-500`

- Filas: `hover:bg-slate-50 transition-colors`

**Reglas importantes para formularios:**- Print: `print:px-2 print:py-1`

- Usar `appearance="outline"` para todos los `mat-form-field`

- Prefijos/sufijos de iconos: mantener `<mat-icon matSuffix|matPrefix>`**Estados Vacíos**:

- Validación con `mat-error` y `FormControl`

- Grid responsive: `grid grid-cols-1 md:grid-cols-2 gap-4`- Ícono: `w-20 h-20 rounded-full bg-slate-100 msz-40`

- Items de array: borde `border-2 border-slate-200` con gradiente sutil- Título: `text-lg font-medium text-slate-600`

- Numeración circular: `w-8 h-8 rounded-full bg-green-100 text-green-700`- Descripción: `text-sm text-slate-500`

- Siempre incluir `type="button"` en botones dentro de forms

**Impresión**:

## Date Picker

- Config: `@page { margin: 15mm; size: A4; }`

Angular Material proporciona un date picker integrado que se estiliza automáticamente con el tema.- Header oculto: `print:hidden`

- Header de impresión: `hidden print:block`

### Date Picker Básico- Optimización: `print:p-4 print:text-xs print:shadow-none`



```html---

<mat-form-field appearance="outline">

  <mat-label>Fecha de Emisión</mat-label>Notas: El proyecto corre en Docker de forma continua; tras cambios visuales revisa directamente en el navegador (no hace falta `npm start`).

  <input
    matInput
    [matDatepicker]="prescriptionDatePicker"
    formControlName="prescriptionDate"
  />
  <mat-datepicker-toggle matIconSuffix [for]="prescriptionDatePicker"></mat-datepicker-toggle>
  <mat-datepicker #prescriptionDatePicker></mat-datepicker>
  <mat-error *ngIf="form.get('prescriptionDate')?.hasError('required')">
    Fecha requerida
  </mat-error>
</mat-form-field>
````

### Apariencia del Calendario

El calendario desplegable de Material Design muestra:

- **Header azul** con el mes/año actual y controles de navegación
- **Selector de mes/año**: Al hacer clic en el mes se despliega un selector de mes
- **Grid de días**:
  - Días del mes actual en negro
  - Día seleccionado con fondo azul circular
  - Día actual (hoy) con borde azul
  - Días de otros meses en gris claro
- **Navegación**: Flechas `<` y `>` para cambiar de mes
- **Footer** (opcional): Botones de "Cancelar" y "Aplicar"

**Características visuales:**

- Fondo blanco con sombra `shadow-lg`
- Esquinas redondeadas `rounded-lg`
- Días clicables con hover circular azul claro
- Transiciones suaves en todos los estados
- Responsive: se ajusta al tamaño de pantalla

**Validaciones comunes:**

```typescript
// Validar que fecha de fin sea posterior a fecha de inicio
export function dateOrderValidator(
  group: AbstractControl
): ValidationErrors | null {
  const start = group.get('prescriptionDate')?.value;
  const end = group.get('expiryDate')?.value;

  if (start && end && end < start) {
    return { dateOrder: true };
  }
  return null;
}
```

**Reglas importantes:**

- Usar `matIconSuffix` para el toggle del calendario
- Vincular el input con `[matDatepicker]` y el toggle con `[for]`
- Agregar validaciones de `mat-error` para fechas requeridas
- Considerar validadores personalizados para rangos de fechas
- El componente respeta el locale configurado en Angular

## Alertas (AlertService)

Uso centralizado para confirmaciones y notificaciones con SweetAlert2.

**Contrato:**

- Entradas: `icon`, `title`, `text` (o `html`), `confirmButtonText`, `cancelButtonText`, `showCancelButton`, `showDenyButton`.
- Estilo: botones como píldoras, confirmación en azul, deny/cancel con bordes definidos y sin borde negro.
- Enforce visual en `didOpen` (remover bordes/outlines residuales si aparecen).

**Ejemplo de confirmación:**

```typescript
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

**Ejemplo de éxito con navegación al cerrar:**

```typescript
this.alert
  .fire({ icon: 'success', title: 'Guardado', text: 'Cambios aplicados' })
  .then(() => this.router.navigate(['/dashboard']));
```

## Navegación y acciones

- Tarjetas clicables: `cursor-pointer` + `hover:shadow-xl hover:-translate-y-1`.
- Acciones superiores a la derecha: botones con ícono y texto.
- Acciones en filas: icon-only con tooltips y `aria-label`.

## Estilos de Impresión

### Configuración básica de @media print

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

### Clases de utilidad para impresión

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

### Patrón de página con impresión

```html
<div class="min-h-screen bg-slate-50 p-8 print:bg-white print:p-4">
  <div class="max-w-7xl mx-auto">
    <div class="flex items-center justify-between mb-10 print:hidden">
      <!-- Header con botones de acción -->
    </div>

    <div class="hidden print:block text-center mb-6">
      <h1 class="text-2xl font-bold text-slate-900">TÍTULO DOCUMENTO</h1>
    </div>

    <div class="bg-white rounded-xl p-6 print:rounded-none print:p-4">
      <!-- Contenido principal -->
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

## Migración de iconos – Do/Don't

**Do:**

- Reemplazar íconos decorativos por `<span class="material-symbols-outlined">…</span>`.
- Extender selectores CSS existentes para incluir `.material-symbols-outlined`.

**Don't:**

- Sustituir íconos dentro de `mat-form-field`, `mat-chip`, `mat-option` si rompe el layout.

## Snippets rápidos

### Tabla HTML + Tailwind (cuerpo dinámico)

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

### Badge de estado

```html
<span
  class="px-2 py-1 rounded-full text-xs"
  [ngClass]="{
    'bg-green-100 text-green-800': ok,
    'bg-yellow-100 text-yellow-800': warn,
    'bg-red-100 text-red-800': err
  }"
>
  {{ label }}
</span>
```

### Ícono con Material Symbols

```html
<span class="material-symbols-outlined text-blue-600 msz-20">group</span>
```

## Checklist para PR visuales

- [ ] Iconos decorativos usan Material Symbols con clases `msz-*` para tamaño.
- [ ] Formularios mantienen integraciones de Material (`matPrefix`/`matSuffix`, chips, selects).
- [ ] Alertas usan `AlertService` con estilos unificados.
- [ ] Títulos/subtítulos y espaciados según jerarquía definida.
- [ ] Estados vacíos consistentes con ícono circular y estilizados.
- [ ] Botones con foco visible y `aria-label` en icon-only.
- [ ] Tarjetas usan `rounded-xl`, `shadow-md hover:shadow-lg`, `transition-shadow`.
- [ ] Tablas usan `min-w-full divide-y divide-slate-200`, header con `bg-slate-50`.
- [ ] Páginas con impresión tienen clases `print:*` optimizadas.
- [ ] Layout responsive usa `p-8` con `max-w-7xl mx-auto`.
- [ ] Todos los botones en forms tienen `type="button"` explícito.

## Resumen de Patrones Clave

### Estructura de Página

- **Container:** `min-h-screen bg-slate-50 p-8`
- **Wrapper:** `max-w-7xl mx-auto`
- **Header:** Botón volver + Título/Subtítulo + Acciones

### Botones

- **Principal:** `bg-blue-50 text-blue-600 hover:bg-blue-100`
- **Secundario:** `bg-slate-50 text-slate-700 hover:bg-slate-100`
- **Destructivo:** `bg-red-50 text-red-600 hover:bg-red-100`
- **Todos:** `rounded-full h-11 px-5 shadow-md hover:shadow-lg transition-all`
- **Siempre:** `type="button"` y `border-0`

### Tarjetas

- `bg-white rounded-xl border border-slate-200 p-6`
- `shadow-md hover:shadow-lg transition-shadow`
- **Print:** `print:shadow-none print:rounded-none print:p-4`

### Tablas

- `min-w-full divide-y divide-slate-200`
- **Header:** `bg-slate-50 text-xs font-medium text-slate-500`
- **Filas:** `hover:bg-slate-50 transition-colors`
- **Print:** `print:px-2 print:py-1`

### Estados Vacíos

- **Ícono:** `w-20 h-20 rounded-full bg-slate-100 msz-40`
- **Título:** `text-lg font-medium text-slate-600`
- **Descripción:** `text-sm text-slate-500`

### Impresión

- **Config:** `@page { margin: 15mm; size: A4; }`
- **Header oculto:** `print:hidden`
- **Header de impresión:** `hidden print:block`
- **Optimización:** `print:p-4 print:text-xs print:shadow-none`

### Formularios

- **Material:** `appearance="outline"` para todos los `mat-form-field`
- **Grid:** `grid grid-cols-1 md:grid-cols-2 gap-4`
- **Validación:** `mat-error` con mensajes descriptivos
- **Autocomplete:** Dropdown con `z-30 shadow-xl rounded-lg`
- **Chips:** Colores semánticos (azul/verde/naranja/rojo)

---

**Notas:** El proyecto corre en Docker de forma continua; tras cambios visuales revisa directamente en el navegador (no hace falta `npm start`).
