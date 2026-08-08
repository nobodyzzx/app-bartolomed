/**
 * Formato de fechas que vienen del backend.
 *
 * La distinción no es de estilo, es de tipo de dato:
 *
 * - Una columna `date` (`birthDate`, `orderDate`, `issueDate`, `expiryDate`…)
 *   es **un día del calendario**, no un instante. Llega como `'YYYY-MM-DD'` y
 *   `new Date('1977-05-19')` la interpreta como medianoche **UTC**. En el
 *   navegador del usuario (Bolivia, UTC−4) eso son las 20:00 del día anterior,
 *   así que cualquier formateo local imprime el día equivocado: una paciente
 *   nacida el 19/05/1977 aparecía como 18/05/1977.
 *   Para esas, `formatPlainDate`, que formatea en UTC y no desplaza nada.
 *
 * - Una columna `timestamptz` (`createdAt`, `resultedAt`, `paidAt`…) sí es un
 *   instante y debe verse en la hora local. Para esas, `formatDateTime`.
 *
 * En las plantillas, el equivalente del primer caso es pasar `'UTC'` como
 * tercer argumento del pipe: `{{ x | date: 'dd/MM/yyyy' : 'UTC' }}`.
 */

const LOCALE = 'es-BO'

function toDate(value: Date | string | null | undefined): Date | null {
  if (value === null || value === undefined || value === '') return null
  const date = value instanceof Date ? value : new Date(value)
  return Number.isNaN(date.getTime()) ? null : date
}

/** Columnas `date`: día del calendario, sin desplazamiento de zona. */
export function formatPlainDate(value: Date | string | null | undefined, fallback = ''): string {
  const date = toDate(value)
  if (!date) return fallback
  return date.toLocaleDateString(LOCALE, {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
    timeZone: 'UTC',
  })
}

/**
 * Fecha de hoy como `YYYY-MM-DD` **en la hora local**, para nombrar archivos y
 * rellenar filtros.
 *
 * `new Date().toISOString().slice(0, 10)` da el día en UTC: en Bolivia
 * (UTC−4), a partir de las 20:00 ya es el día siguiente, así que un reporte
 * descargado al cerrar caja se guardaba con la fecha de mañana.
 */
export function todayLocalISO(): string {
  return toLocalISODate(new Date())
}

/**
 * Convierte un `Date` a `YYYY-MM-DD` **usando sus componentes locales**, que es
 * lo que hay que enviar al backend para una columna `date`.
 *
 * `toISOString().slice(0, 10)` no sirve: pasa el instante a UTC primero. Un
 * datepicker inicializado con `new Date()` lleva la hora actual, así que a las
 * 20:37 de Bolivia el ISO ya es del día siguiente y la orden se guardaba
 * fechada mañana. Verificado en vivo el 2026-08-07.
 */
export function toLocalISODate(value: Date | string | null | undefined): string {
  const date = toDate(value)
  if (!date) return ''
  const mes = String(date.getMonth() + 1).padStart(2, '0')
  const dia = String(date.getDate()).padStart(2, '0')
  return `${date.getFullYear()}-${mes}-${dia}`
}

/** Columnas `timestamptz`: instante real, en la hora local del usuario. */
export function formatDateTime(value: Date | string | null | undefined, fallback = ''): string {
  const date = toDate(value)
  if (!date) return fallback
  return date.toLocaleDateString(LOCALE, {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  })
}
