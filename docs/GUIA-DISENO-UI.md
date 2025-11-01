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
  - Input redondeado (`rounded-full`), ícono a la derecha, botón “Buscar”.
- Tarjetas de métricas:
  - Contenedor `rounded-2xl shadow-lg`, gradiente, número grande, subtítulo suave, ícono decorativo.
- Listas y tablas:
  - Preferencia por HTML + Tailwind en dashboards.
  - `min-w-full`, `<thead>` con `bg-gray-50`, celdas con `px-4 py-2`.
  - Badges de estado con `px-2 py-1 rounded-full text-xs` y colores según semáforo.

## Botones

- Botones de acción principales: `mat-raised-button` + clases utilitarias (ej. `rounded-xl`).
- Botones tipo “píldora”: `rounded-full`, `gap-2`, icono a la izquierda.
- Icon-only: usar `mat-icon-button` o contenedor `w-9 h-9 rounded-full hover:bg-gray-100` con Material Symbols.

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

- [ ] Iconos decorativos usan Material Symbols.
- [ ] Formularios mantienen integraciones de Material (prefix/suffix, chips, selects).
- [ ] Alertas usan AlertService con estilos unificados.
- [ ] Títulos/subtítulos y espaciados según jerarquía definida.
- [ ] Estados vacíos consistentes y estilizados.
- [ ] Botones con foco visible y `aria-label` en icon-only.

---

Notas: El proyecto corre en Docker de forma continua; tras cambios visuales revisa directamente en el navegador (no hace falta `npm start`).
