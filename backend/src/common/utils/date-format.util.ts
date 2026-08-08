/**
 * Formato de fechas para lo que ve el usuario (PDFs, Excel, respuestas).
 *
 * La distinción importante no es de estilo, es de tipo de dato:
 *
 * - Una columna `date` de Postgres es **un día del calendario**, no un
 *   instante. TypeORM la entrega como `'YYYY-MM-DD'`, y `new Date('2026-08-07')`
 *   la interpreta como medianoche **UTC**. Si después se formatea en
 *   `America/La_Paz` (UTC−4), esa medianoche retrocede a las 20:00 del día
 *   anterior y se imprime el día equivocado. Pasaba en todo el sistema: una
 *   paciente nacida el 19/05/1977 salía como 18/05/1977 en su informe.
 *   Para esas columnas, `formatPlainDate` — se formatea en UTC, sin desplazar.
 *
 * - Una columna `timestamptz` (`createdAt`, `resultedAt`, `paidAt`…) sí es un
 *   instante, y debe mostrarse en la hora local de la clínica.
 *   Para esas, `formatDateTime` / `formatInstantDate`.
 *
 * Regla práctica: si el dato se eligió en un datepicker (fecha de orden,
 * vencimiento, nacimiento), es `formatPlainDate`. Si lo puso el sistema al
 * ocurrir algo, es `formatDateTime`.
 */

const CLINIC_TZ = 'America/La_Paz';
const LOCALE = 'es-BO';

const DAY_OPTS: Intl.DateTimeFormatOptions = {
  day: '2-digit',
  month: '2-digit',
  year: 'numeric',
};

function toDate(value: Date | string | null | undefined): Date | null {
  if (value === null || value === undefined || value === '') return null;
  const date = value instanceof Date ? value : new Date(value);
  return Number.isNaN(date.getTime()) ? null : date;
}

/** Columnas `date`: día del calendario, sin desplazamiento de zona. */
export function formatPlainDate(
  value: Date | string | null | undefined,
  fallback = '—',
): string {
  const date = toDate(value);
  if (!date) return fallback;
  return date.toLocaleDateString(LOCALE, { ...DAY_OPTS, timeZone: 'UTC' });
}

/** Columnas `timestamptz`, mostrando solo el día en hora de la clínica. */
export function formatInstantDate(
  value: Date | string | null | undefined,
  fallback = '—',
): string {
  const date = toDate(value);
  if (!date) return fallback;
  return date.toLocaleDateString(LOCALE, { ...DAY_OPTS, timeZone: CLINIC_TZ });
}

/** Columnas `timestamptz` con hora, en hora de la clínica. */
export function formatDateTime(
  value: Date | string | null | undefined,
  fallback = '—',
): string {
  const date = toDate(value);
  if (!date) return fallback;
  return date.toLocaleString(LOCALE, {
    ...DAY_OPTS,
    hour: '2-digit',
    minute: '2-digit',
    timeZone: CLINIC_TZ,
  });
}

/**
 * Hoy como `YYYY-MM-DD` **en la zona de la clínica**, para guardar en columnas
 * `date`.
 *
 * El backend corre en UTC, así que `new Date()` a las 22:00 de Bolivia ya es el
 * día siguiente. Una fecha de calendario calculada así queda corrida: una orden
 * enviada el 07/08 con 9 días de plazo daba el 17/08 en vez del 16/08.
 */
export function todayInClinicTz(): string {
  // 'en-CA' es el locale que produce YYYY-MM-DD.
  return new Date().toLocaleDateString('en-CA', { timeZone: CLINIC_TZ });
}

/**
 * Suma días a una fecha `YYYY-MM-DD` sin pasar por husos horarios: aritmética
 * de calendario pura, que es lo que corresponde a una columna `date`.
 */
export function addCalendarDays(isoDate: string, days: number): string {
  const [year, month, day] = isoDate.split('-').map(Number);
  const fecha = new Date(Date.UTC(year, month - 1, day));
  fecha.setUTCDate(fecha.getUTCDate() + days);
  return fecha.toISOString().slice(0, 10);
}

/** Momento de impresión de un documento: siempre un instante real. */
export function nowInClinicTz(): string {
  return formatDateTime(new Date());
}
