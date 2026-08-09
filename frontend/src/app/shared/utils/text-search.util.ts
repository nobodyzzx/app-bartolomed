/**
 * Comparación de texto que ignora acentos y mayúsculas, para los buscadores
 * que filtran en el navegador.
 *
 * Hace falta porque los datos y quien escribe no coinciden: el inventario
 * oficial de farmacia se transcribió **sin una sola tilde** —"Algodon",
 * "Tincion", "Bisturi", "Branula"— y quien busca escribe "algodón", como se
 * escribe. Un `includes()` literal no encuentra nada y el producto parece no
 * existir, que fue exactamente el síntoma reportado.
 *
 * El equivalente del backend vive en `common/utils/accent-insensitive.util.ts`
 * y usa `translate()` de Postgres. Son dos programas distintos y no comparten
 * módulos, pero deben comportarse igual.
 */

/** Minúsculas y sin acentos. `NFD` separa la vocal de su tilde y luego se quita. */
export function normalizeForSearch(value: unknown): string {
  return String(value ?? '')
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase()
    .trim()
}

/**
 * ¿Alguno de los campos contiene el término? Ignora acentos y mayúsculas en
 * los dos lados: normalizar solo uno no serviría de nada.
 */
export function matchesSearch(term: string, ...fields: unknown[]): boolean {
  const needle = normalizeForSearch(term)
  if (!needle) return true
  return fields.some(f => f != null && normalizeForSearch(f).includes(needle))
}
