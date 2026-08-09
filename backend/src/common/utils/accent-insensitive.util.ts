/**
 * Búsqueda insensible a acentos.
 *
 * Buscar "Noemi" tiene que encontrar a "Noemí", y "cirugia" a "cirugía": en un
 * teclado de mostrador nadie pone tildes, y un buscador que las exige devuelve
 * "sin resultados" sobre datos que sí existen.
 *
 * Se usa `translate()` de Postgres y no la extensión `unaccent` para no
 * depender de que esté instalada: en la base de producción está *disponible*
 * pero no creada, y hacerlo obligatorio convertiría un buscador en un problema
 * de despliegue.
 */

/**
 * Vocales acentuadas y su equivalente plano. El orden de los dos textos tiene
 * que coincidir carácter a carácter: es lo que espera `translate()`.
 */
export const ACCENTED = 'áéíóúüñÁÉÍÓÚÜÑ';
export const UNACCENTED = 'aeiouunAEIOUUN';

/** Quita los acentos del lado JavaScript, para el término de búsqueda. */
export function stripAccents(value: string): string {
  return value.replace(/[áéíóúüñ]/g, c => UNACCENTED[ACCENTED.indexOf(c)] ?? c);
}

/**
 * Fragmento SQL que normaliza una columna a minúsculas y sin acentos.
 *
 * `column` se interpola en la consulta, así que **solo puede venir de código**,
 * nunca de la petición: es un nombre de columna, no un dato.
 */
export function unaccentedColumn(column: string): string {
  return `translate(LOWER(${column}), '${ACCENTED}', '${UNACCENTED}')`;
}

/**
 * Prepara el término para comparar con `unaccentedColumn`: minúsculas, sin
 * acentos y envuelto en comodines. Los mismos reemplazos hay que aplicarlos a
 * los dos lados, o el patrón no casaría nunca.
 */
export function unaccentedTerm(search: string): string {
  return `%${stripAccents(search.trim().toLowerCase())}%`;
}
