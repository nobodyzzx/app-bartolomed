import { MatSort, Sort } from '@angular/material/sort'
import { MatTableDataSource } from '@angular/material/table'

/**
 * Ordenamiento por cabecera para las tablas que pintan un array a mano, sin
 * `MatTableDataSource`.
 *
 * Existe para que las tablas ordenen **igual**. Escrito tabla por tabla, cada
 * una acababa comparando a su manera: una pondría "Ávila" después de "Zurita"
 * porque `<` compara puntos de código, otra dejaría "Lote 10" antes que
 * "Lote 9", y una tercera ordenaría los precios como texto —"1000" antes que
 * "9"— porque las columnas numéricas de Postgres llegan como string.
 *
 * Se usa con el directivo `matSort` sobre cualquier `<table>`, sin necesidad de
 * `mat-table`:
 *
 * ```html
 * <table matSort [matSortActive]="orden.key" [matSortDirection]="orden.dir"
 *        (matSortChange)="onSort($event)">
 *   <th mat-sort-header="name">Nombre</th>
 * ```
 * ```ts
 * orden: EstadoOrden = { key: 'name', dir: 'asc' }
 * onSort(sort: Sort) { this.orden = leerOrden(sort) }
 * get filas() { return ordenar(this.items, this.orden, (i, k) => ...) }
 * ```
 */

/** Sentido del orden. `''` es el tercer estado de `matSort`: sin ordenar. */
export type SortDir = 'asc' | 'desc' | ''

/** Qué columna ordena una tabla y en qué sentido. */
export interface EstadoOrden {
  key: string
  dir: SortDir
}

/** Traduce el evento de `matSort` al estado que guarda el componente. */
export function leerOrden(sort: Sort): EstadoOrden {
  return { key: sort.active, dir: sort.direction }
}

/** Lo que se puede comparar en una celda. */
export type ValorOrdenable = string | number | Date | boolean | null | undefined

/**
 * Copia ordenada de `items`. No toca el array original: el orden es cosa de la
 * vista y el dato de partida tiene que seguir siendo el que llegó del servidor.
 *
 * Sin sentido de orden (`dir: ''`) devuelve el orden en que venían, que suele
 * ser el que decidió el backend y casi siempre significa algo —lo más reciente
 * primero, o el número de documento.
 *
 * `valor` recibe la fila y la columna pulsada, y devuelve con qué comparar.
 */
export function ordenar<T>(
  items: readonly T[],
  orden: EstadoOrden,
  valor: (item: T, key: string) => ValorOrdenable,
): T[] {
  if (!orden.dir || !orden.key) return [...items]

  const sentido = orden.dir === 'asc' ? 1 : -1

  return [...items].sort((a, b) => {
    const va = valor(a, orden.key)
    const vb = valor(b, orden.key)

    // Los huecos se resuelven **fuera** del signo: si se compararan como un
    // valor más, invertir la columna se los llevaría arriba.
    const vacioA = esVacio(va)
    const vacioB = esVacio(vb)
    if (vacioA && vacioB) return 0
    if (vacioA) return 1
    if (vacioB) return -1

    return comparar(va, vb) * sentido
  })
}

/**
 * Celda sin nada que comparar. `false` y `0` no lo son: son respuestas.
 *
 * Van al final **en los dos sentidos**. Una columna de vencimientos con la
 * mitad "sin registrar" es el caso corriente en farmacia, y ahí lo que se busca
 * es lo que vence antes o lo que venció ya: los huecos estorban arriba
 * ascendiendo tanto como descendiendo.
 */
function esVacio(v: ValorOrdenable): boolean {
  return v === null || v === undefined || v === ''
}

function comparar(a: ValorOrdenable, b: ValorOrdenable): number {
  if (a instanceof Date || b instanceof Date) {
    return fecha(a) - fecha(b)
  }

  if (typeof a === 'boolean' || typeof b === 'boolean') {
    return Number(a) - Number(b)
  }

  if (typeof a === 'number' && typeof b === 'number') {
    return a - b
  }

  // `numeric` para que "Lote 9" venga antes que "Lote 10", y la configuración
  // regional española para que las tildes y la ñ caigan donde se las espera.
  return String(a).localeCompare(String(b), 'es', { numeric: true, sensitivity: 'base' })
}

function fecha(v: ValorOrdenable): number {
  const t = v instanceof Date ? v.getTime() : new Date(String(v)).getTime()
  return Number.isNaN(t) ? 0 : t
}

/**
 * Hace que una tabla de Material ordene igual que las demás.
 *
 * `MatTableDataSource` compara con `<` a secas: sin configuración regional y
 * sin entender números dentro del texto. Por eso en sus tablas "Ávila" caía
 * después de "Zurita" —la vocal acentuada vive fuera del rango ASCII— y
 * "Lote 10" antes que "Lote 9". Las tablas planas usan `ordenar()` y no tenían
 * ese problema, así que media aplicación ordenaba de una manera y media de
 * otra.
 *
 * Se cambia solo la **comparación**. El `sortingDataAccessor` de cada tabla
 * sigue mandando sobre qué valor se compara, que es lo propio de cada una.
 *
 * Llamar una vez, al construir el dataSource.
 */
export function ordenarComoLasDemas<T>(dataSource: MatTableDataSource<T>): void {
  // `sortData` recibe la directiva `MatSort`, no el evento `Sort`; los dos
  // campos que importan se llaman igual.
  dataSource.sortData = (data: T[], sort: MatSort) =>
    ordenar(data, { key: sort.active, dir: sort.direction }, (item, key) =>
      dataSource.sortingDataAccessor(item, key) as ValorOrdenable,
    )
}

/**
 * Atajo para las columnas numéricas que viajan como string desde Postgres.
 * Devolver el string a secas las ordenaría alfabéticamente, que es como "1000"
 * acaba antes que "9".
 */
export function num(v: unknown): number | null {
  if (v === null || v === undefined || v === '') return null
  const n = Number(v)
  return Number.isNaN(n) ? null : n
}
