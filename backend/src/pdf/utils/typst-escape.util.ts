/**
 * Escapa un valor para insertarlo dentro de un literal de string Typst
 * (`"..."`) al generar el `.typ` de entrada. Solo hace falta escapar `\` y
 * `"` — a diferencia de un conversor Markdown→Typst (que si necesita escapar
 * caracteres de markup como `* _ # [ ]`), acá los datos siempre llegan como
 * argumentos de función (`header(name: "...")`), nunca como markup crudo, así
 * que Typst los trata como texto literal sin volver a parsearlos.
 *
 * Mismo alcance que `escaparTypstString()` de cotizaciones-tecnocondor
 * (`packages/plantilla-pdf/src/compilar-una.ts`).
 */
export function typstEscape(value: string | number | null | undefined): string {
  if (value === null || value === undefined) return '';
  return String(value).replace(/\\/g, '\\\\').replace(/"/g, '\\"');
}

/** `typstEscape` envuelto en comillas, listo para interpolar en un `.typ`. */
export function typstString(value: string | number | null | undefined): string {
  return `"${typstEscape(value)}"`;
}
