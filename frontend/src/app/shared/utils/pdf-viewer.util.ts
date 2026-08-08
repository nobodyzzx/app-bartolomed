/**
 * Abre un PDF recibido como blob en una pestaña nueva, para verlo antes de
 * decidir si se imprime o se guarda.
 *
 * Es el comportamiento de toda la app —recetas, resultados de laboratorio,
 * consentimiento, resumen del expediente— y este helper existe para que sea
 * también el de los que no lo eran (recibos y reportes) sin repetir el mismo
 * bloque en cada componente: había seis copias.
 *
 * Un `download` directo, además de saltarse la vista previa, hace que el
 * navegador marque el archivo como "no seguro" cuando la página se sirve por
 * HTTP plano (el caso del acceso por la tailnet en desarrollo). Abrirlo en el
 * visor no pasa por esa comprobación.
 */
export function openPdfInNewTab(blob: Blob, filename: string): void {
  // Forzar el tipo: si el backend no manda `Content-Type`, el blob llega como
  // `application/octet-stream` y el navegador lo descarga en vez de mostrarlo.
  const pdf = blob.type === 'application/pdf' ? blob : new Blob([blob], { type: 'application/pdf' })
  const url = URL.createObjectURL(pdf)

  // Sin `noopener` en las features: con esa bandera `window.open` devuelve `null`
  // AUNQUE la pestaña se abra bien, y el respaldo de abajo lo tomaba por un
  // bloqueo, así que el archivo se abría Y se descargaba a la vez. La referencia
  // al opener se corta después, sobre la ventana ya devuelta.
  const tab = window.open(url, '_blank')

  if (tab) {
    tab.opener = null
  } else {
    // El bloqueador de ventanas emergentes corta cualquier `window.open` que no
    // salga directo de un clic, y estas llamadas ocurren tras volver del backend.
    // Si lo bloquea, se descarga: mejor eso que un botón que no hace nada.
    const a = document.createElement('a')
    a.href = url
    a.download = filename
    document.body.appendChild(a)
    a.click()
    document.body.removeChild(a)
  }

  // Sin margen, revocar la URL deja la pestaña recién abierta sin contenido.
  setTimeout(() => URL.revokeObjectURL(url), 60_000)
}
