// Componentes Typst compartidos por todos los PDF de Bartolomed — puerto de
// las clases CSS que hoy repiten (triplicadas) los 3 *-pdf.service.ts de
// Puppeteer (.hd, .meta, .sec, .kpi-card, .tbl, .badge). Un solo lugar.

#let navy = rgb("#1e3a5f")
#let gris-texto = rgb("#374151")
#let gris-muted = rgb("#6b7280")
#let gris-claro = rgb("#94a3b8")
#let borde = rgb("#d1d5db")
#let borde-claro = rgb("#e5e7eb")
#let borde-suave = rgb("#e2e8f0")
#let fondo-suave = rgb("#f8fafc")
#let fondo-raya = rgb("#f9fafb")

#let verde = rgb("#059669")
#let azul = rgb("#2563eb")
#let ambar = rgb("#d97706")
#let rojo = rgb("#dc2626")
#let violeta = rgb("#7c3aed")
#let naranja = rgb("#f97316")

// Bug real encontrado al migrar dailySalesHtml (Puppeteer): usaba
// kpiCard(..., 'orange') pero el CSS de reports-pdf.service.ts nunca definía
// `.kpi-card.orange` — el acento superior quedaba sin color. Se agrega acá de
// verdad, con el mismo naranja que ya usa el gráfico de barras de ese reporte.
#let colores-kpi = (
  green: verde, blue: azul, amber: ambar, red: rojo, purple: violeta, orange: naranja,
)

#let estilos-badge = (
  green: (fondo: rgb("#dcfce7"), texto: rgb("#166534")),
  amber: (fondo: rgb("#fef3c7"), texto: rgb("#92400e")),
  red: (fondo: rgb("#fee2e2"), texto: rgb("#991b1b")),
  blue: (fondo: rgb("#dbeafe"), texto: rgb("#1e40af")),
  gray: (fondo: rgb("#f3f4f6"), texto: rgb("#374151")),
  purple: (fondo: rgb("#f3e8ff"), texto: rgb("#6b21a8")),
)

/// Documento base: setea página, fuente y footer con numeración — llamar vía
/// `#show: bartolomedDoc.with(title: ..., subtitle: ..., paper: "a4")`.
/// A diferencia de cotizaciones-tecnocondor, el header (logo+nombre) NO se
/// repite por página — mismo comportamiento que Puppeteer hoy (headerTemplate
/// vacío), el header va una sola vez al inicio del body vía `header()`.
#let bartolomedDoc(
  title: "",
  paper: "a4",
  /// Apaisado. Los informes de datos son tablas de 8-10 columnas y en vertical
  /// los encabezados se parten a la mitad ("CATEGO-RÍA", "DISPO-NIBLE") y las
  /// celdas se estrechan hasta ser ilegibles. Los documentos de una sola
  /// columna —recetas, recibos, consentimientos, informes de laboratorio— se
  /// quedan en vertical, que es como se archivan y se firman.
  landscape: false,
  /// Tamaño explícito, que gana sobre `paper`. Existe para el oficio boliviano
  /// (21,6 × 33 cm), que no está entre los tamaños con nombre de Typst y es el
  /// papel que la clínica tiene en la impresora.
  width: none,
  height: none,
  body,
) = {
  set document(title: title, author: "Bartolomed")
  // hyphenate: true — sin esto, una palabra larga sin espacios (ej.
  // "cardiovascular" en la columna Categoría) no tiene dónde partirse dentro
  // de una columna angosta y se desborda visualmente sobre la celda vecina
  // en vez de ajustarse (bug real encontrado en vivo en el reporte de
  // Medicamentos Sin Movimiento).
  set text(font: "Inter", size: 9.5pt, lang: "es", hyphenate: true)
  set page(
    ..if width != none and height != none {
      (width: width, height: height)
    } else {
      (paper: paper)
    },
    flipped: landscape,
    margin: (top: 0pt, bottom: 14mm, x: 0pt),
    footer: context {
      line(length: 100%, stroke: 0.5pt + borde-suave)
      v(4pt)
      pad(x: 28pt)[
        #grid(
          columns: (1fr, auto, 1fr),
          align: (left + horizon, center + horizon, right + horizon),
          text(size: 9pt, fill: gris-claro)[BARTOLOMED — Sistema de Gestión Clínica],
          text(size: 9pt, fill: gris-claro)[
            Página #counter(page).get().first() de #counter(page).final().first()
          ],
          align(right, text(size: 9pt, fill: gris-claro)[Documento confidencial]),
        )
      ]
    },
  )
  body
}

/// Cabecera con logo + nombre + subtítulo + badge a la derecha (equivalente a
/// `.hd` en el CSS actual).
#let header(name: "Bartolomed", subtitle: "", badge: none, logo-path: "/assets/logo.png") = block(
  width: 100%,
  inset: (x: 28pt, y: 12pt),
  stroke: (bottom: 2.5pt + navy),
)[
  #grid(
    columns: (auto, 1fr, auto),
    column-gutter: 14pt,
    align: (left + horizon, left + horizon, right + horizon),
    box(width: 46pt, height: 46pt)[
      #align(center + horizon, image(logo-path, width: 44pt, height: 44pt, fit: "contain"))
    ],
    [
      #text(size: 17pt, weight: "bold", fill: navy, tracking: 1pt)[#name] \
      #text(size: 8pt, fill: gris-muted, tracking: 0.6pt)[#upper(subtitle)]
    ],
    if badge != none {
      box(stroke: 1.5pt + navy, radius: 4pt, inset: (x: 14pt, y: 6pt))[
        #text(size: 9pt, weight: "bold", fill: navy, tracking: 0.5pt)[#upper(badge)]
      ]
    },
  )
]

/// Barra de metadatos (equivalente a `.meta`) — `fields` es un array de
/// pares (label, value) ya formateados como string.
#let metaBar(fields) = block(
  width: 100%,
  inset: (x: 28pt, y: 6pt),
  stroke: (bottom: 1pt + borde),
)[
  #text(size: 8pt, fill: gris-texto)[
    #fields.map(f => [*#(f.at(0)):* #(f.at(1))]).join("    ")
  ]
]

/// Sección con acento izquierdo (equivalente a `.sec`/`.sec-hd`/`.sec-bd`).
#let section(title, body) = block(
  width: 100%,
  breakable: true,
  above: 12pt,
  below: 0pt,
  stroke: 1pt + borde,
  radius: 3pt,
)[
  #block(
    width: 100%,
    fill: fondo-suave,
    inset: (x: 8pt, y: 4pt),
    stroke: (left: 3pt + navy),
  )[
    #text(size: 7.5pt, weight: "bold", fill: navy, tracking: 0.8pt)[#upper(title)]
  ]
  #block(width: 100%, inset: (x: 12pt, y: 10pt))[#body]
]

/// Tarjeta KPI individual (equivalente a `.kpi-card`).
#let kpiCard(label, value, sub, color: "blue") = block(
  width: 100%,
  fill: fondo-suave,
  stroke: (
    top: 3pt + colores-kpi.at(color),
    rest: 1pt + borde-suave,
  ),
  radius: 6pt,
  inset: (x: 14pt, y: 12pt),
)[
  #align(center)[
    #text(size: 7pt, fill: gris-muted, tracking: 0.5pt)[#upper(label)] \
    #v(2pt)
    #text(size: 15pt, weight: "bold")[#value] \
    #text(size: 7pt, fill: gris-claro)[#sub]
  ]
]

/// Grilla de tarjetas KPI, `n` columnas (default 4).
#let kpiGrid(cards, columns: 4) = grid(
  columns: (1fr,) * columns,
  gutter: 12pt,
  ..cards
)

/// Tabla con el mismo estilo que `.tbl` (header navy sólido, filas rayadas).
/// `widths`: fracciones opcionales por columna (ej. `(2fr, 1fr, 1fr)`) para
/// tablas con muchas columnas donde el ancho uniforme (`1fr` default) hace
/// que headers largos como "MEDICAMENTO"/"GENÉRICO" se superpongan entre sí
/// (bug real encontrado en vivo en el reporte de Inventario Valorizado, 10
/// columnas).
#let styledTable(headers, rows, align: none, widths: none) = table(
  columns: if widths != none { widths } else { (1fr,) * headers.len() },
  align: if align != none { align } else { left },
  stroke: 0.5pt + borde-claro,
  fill: (_, y) => {
    if y == 0 { navy } else if calc.rem(y, 2) == 0 { fondo-raya } else { white }
  },
  table.header(..headers.map(h => text(fill: white, weight: "bold", size: 7.5pt, upper(h)))),
  ..rows.flatten()
)

/// Badge/pill de estado (equivalente a `.badge`/`.status-badge`).
#let badge(txt, color: "gray") = {
  let estilo = estilos-badge.at(color)
  box(fill: estilo.fondo, radius: 999pt, inset: (x: 8pt, y: 2pt))[
    // `hyphenate: false`: el documento activa el guionado para que los nombres
    // largos de medicamento quepan en columnas angostas, pero dentro de una
    // píldora eso parte la etiqueta a la mitad ("AGOTA-DO", "SIN PRE-CIO") y
    // ensucia toda la columna de estado.
    #text(size: 7pt, weight: "bold", fill: estilo.texto, tracking: 0.3pt, hyphenate: false)[#upper(txt)]
  ]
}

/// Barra horizontal de progreso (equivalente al `barChart()` CSS puro de
/// medicalRecordsHtml) — `rows` es un array de diccionarios
/// `(label: str, value: str, pct: 0-100, color: "blue"|"green"|...)`.
#let hBarChart(rows) = {
  for r in rows {
    grid(
      columns: (110pt, 1fr, 46pt),
      column-gutter: 8pt,
      align: (left + horizon, left + horizon, right + horizon),
      text(size: 7.5pt, fill: gris-texto)[#r.label],
      block(width: 100%, height: 9pt, fill: fondo-suave, radius: 2pt, stroke: 0.5pt + borde-suave)[
        #block(width: r.pct * 1%, height: 100%, fill: colores-kpi.at(r.color), radius: 2pt)
      ],
      text(size: 7.5pt, weight: "bold")[#r.value],
    )
    v(5pt)
  }
}

// Nota: NO hay un helper `chartImage()` acá a propósito. Typst resuelve
// rutas relativas de `image()` contra el archivo donde la LLAMADA está
// escrita — si esta función viviera acá (templates/) y el `.typ` de entrada
// (en .tmp/<uuid>/, por request) le pasara un nombre de archivo relativo como
// "chart-1.png", Typst lo buscaría en templates/, no en .tmp/<uuid>/ (bug
// real encontrado migrando dailySalesHtml). Cada *Typst() del service emite
// `#image("chart-N.png", ...)` directo en el .typ de entrada.

/// Etiqueta pequeña en mayúsculas sobre un gráfico secundario (equivalente al
/// `<p>` uppercase inline que usaba Puppeteer para "Métodos de Pago"/"Por
/// Género"/"Tendencia Mensual"/etc. en los reportes con 2 gráficos lado a lado).
#let chartLabel(txt) = block(below: 6pt)[
  #text(size: 7.5pt, weight: "bold", fill: gris-texto, tracking: 0.5pt)[#upper(txt)]
]

/// Campo de formulario: label chico en mayúsculas + valor — línea inferior
/// para valores de una línea, caja con borde para texto multilínea
/// (equivalente a `.lbl`/`.val`/`.val-box` de recetas y expedientes médicos).
#let field(label, value, multiline: false) = block(width: 100%, above: 0pt, below: 7pt)[
  #text(size: 7pt, weight: "bold", fill: gris-muted, tracking: 0.4pt)[#upper(label)]
  #v(2pt)
  #if multiline [
    #block(width: 100%, stroke: 1pt + borde, radius: 2pt, inset: (x: 7pt, y: 5pt))[
      #text(size: 9pt)[#value]
    ]
  ] else [
    #block(width: 100%, stroke: (bottom: 1pt + gris-claro), inset: (bottom: 2pt))[
      #text(size: 9.5pt)[#value]
    ]
  ]
]

/// Fila de firmas — `sigs` es un array de diccionarios `(name: str, role: str)`.
#let sigRow(sigs) = grid(
  columns: (1fr,) * sigs.len(),
  column-gutter: 24pt,
  ..sigs.map(s => align(center)[
    #v(36pt)
    #line(length: 100%, stroke: 0.5pt + gris-texto)
    #v(4pt)
    #text(size: 9pt, weight: "bold")[#s.name]
    #v(1pt)
    #text(size: 7.5pt, fill: gris-muted)[#s.role]
  ])
)

/// Sin datos — placeholder consistente.
#let noData() = align(center)[
  #v(12pt)
  #text(size: 8.5pt, fill: gris-claro)[Sin datos disponibles para el período seleccionado]
  #v(12pt)
]
