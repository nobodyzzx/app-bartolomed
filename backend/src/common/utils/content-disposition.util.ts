/**
 * Cabecera `Content-Disposition` con un nombre de archivo seguro.
 *
 * Node lanza `ERR_INVALID_CHAR` ante cualquier carácter no ASCII en una
 * cabecera HTTP, y los nombres de este sistema son en español: un informe
 * titulado "Inventario de activos — traspaso" hacía fallar la descarga con un
 * 500 **después** de haberse generado correctamente, que es de los errores más
 * confusos de diagnosticar.
 *
 * Se emiten los dos formatos que define el RFC 6266: `filename` con una versión
 * transliterada, que entienden todos los clientes, y `filename*` con el nombre
 * real codificado, que usan los navegadores actuales.
 */
export function contentDisposition(fileName: string): string {
  const plano = fileName
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')  // quita los acentos ya separados
    .replace(/[^\x20-\x7E]/g, '-')     // cualquier otro no-ASCII (rayas, comillas tipográficas)
    .replace(/["\\]/g, '')            // comillas y barras romperían el propio valor
    .trim();

  return `attachment; filename="${plano}"; filename*=UTF-8''${encodeURIComponent(fileName)}`;
}
