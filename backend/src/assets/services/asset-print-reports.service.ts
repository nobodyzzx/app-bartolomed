import { BadRequestException, Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { In, Not, Repository } from 'typeorm';
import { Clinic } from '../../clinics/entities/clinic.entity';
import { TypstCompilerService } from '../../pdf/typst-compiler.service';
import { typstString } from '../../pdf/utils/typst-escape.util';
import { Asset, AssetCondition, AssetStatus, AssetType } from '../entities/asset.entity';

export type PaperSize = 'oficio' | 'a4';

export interface AssetPrintOptions {
  /** Limita el informe a un solo ambiente (coincidencia exacta con `location`). */
  location?: string;
  paper?: PaperSize;
}

export interface HandoverOptions extends AssetPrintOptions {
  /** Nombres para el pie de firmas; si faltan, la línea sale en blanco para llenar a mano. */
  deliveredBy?: string;
  receivedBy?: string;
}

/** Ambientes sin `location` cargada — se agrupan aparte en vez de desaparecer del listado. */
const SIN_UBICACION = 'Sin ubicación asignada';

const TYPE_LABELS: Record<string, string> = {
  [AssetType.MEDICAL_EQUIPMENT]: 'Equipo médico',
  [AssetType.FURNITURE]: 'Mobiliario',
  [AssetType.COMPUTER]: 'Cómputo',
  [AssetType.VEHICLE]: 'Vehículo',
  [AssetType.BUILDING]: 'Inmueble',
  [AssetType.OTHER]: 'Otro',
};

const CONDITION_LABELS: Record<string, string> = {
  [AssetCondition.EXCELLENT]: 'Excelente',
  [AssetCondition.GOOD]: 'Bueno',
  [AssetCondition.FAIR]: 'Regular',
  [AssetCondition.POOR]: 'Malo',
  [AssetCondition.CRITICAL]: 'Crítico',
};

const CONDITION_COLORS: Record<string, string> = {
  [AssetCondition.EXCELLENT]: 'green',
  [AssetCondition.GOOD]: 'green',
  [AssetCondition.FAIR]: 'amber',
  [AssetCondition.POOR]: 'red',
  [AssetCondition.CRITICAL]: 'red',
};

const STATUS_LABELS: Record<string, string> = {
  [AssetStatus.ACTIVE]: 'Activo',
  [AssetStatus.INACTIVE]: 'Inactivo',
  [AssetStatus.MAINTENANCE]: 'Mantenimiento',
  [AssetStatus.RETIRED]: 'De baja',
  [AssetStatus.SOLD]: 'Vendido',
  [AssetStatus.LOST]: 'Extraviado',
  [AssetStatus.DAMAGED]: 'Dañado',
};

const STATUS_COLORS: Record<string, string> = {
  [AssetStatus.ACTIVE]: 'green',
  [AssetStatus.INACTIVE]: 'gray',
  [AssetStatus.MAINTENANCE]: 'amber',
  [AssetStatus.RETIRED]: 'gray',
  [AssetStatus.SOLD]: 'gray',
  [AssetStatus.LOST]: 'red',
  [AssetStatus.DAMAGED]: 'red',
};

/**
 * Estados que sacan el activo del piso: un inventario que se recorre, se cuenta
 * o se firma no debe listar lo que ya no está físicamente. `DAMAGED` sí queda —
 * el equipo sigue en el ambiente aunque no funcione, y quien recibe el ambiente
 * tiene que hacerse cargo de él.
 */
const ESTADOS_FUERA_DE_PISO = [AssetStatus.RETIRED, AssetStatus.SOLD, AssetStatus.LOST];

/** Condiciones que exigen atención — el informe de mal estado se arma con estas. */
const CONDICIONES_MALAS = [AssetCondition.FAIR, AssetCondition.POOR, AssetCondition.CRITICAL];

interface LocationGroup {
  location: string;
  assets: Asset[];
}

/**
 * Informes de activos fijos pensados para el papel, no para la contabilidad.
 *
 * El inventario de esta clínica se cargó como conteo físico por ambiente: sin
 * precio de compra, sin fecha, sin número de serie y sin responsable asignado.
 * Los seis tipos de `AssetReport` que existían asumían lo contrario —
 * Depreciación y Financiero imprimían Bs 0,00 en las 290 filas, Obsoletos
 * filtraba por una condición que nadie cargó y Mantenimiento no tenía una sola
 * fila que mostrar. Estos cinco informes se apoyan solo en lo que el dato real
 * tiene: código, descripción, tipo, condición, estado y ambiente.
 *
 * A diferencia de `AssetReportExportService`, acá no se persiste nada: el PDF se
 * compila al vuelo con los datos del momento, por el mismo motivo que el informe
 * de laboratorio no se archiva — un activo corregido no debe dejar un PDF que
 * miente.
 */
@Injectable()
export class AssetPrintReportsService {
  constructor(
    @InjectRepository(Asset)
    private readonly assetRepository: Repository<Asset>,
    @InjectRepository(Clinic)
    private readonly clinicRepository: Repository<Clinic>,
    private readonly typstCompiler: TypstCompilerService,
  ) {}

  // ─── 1. Inventario por ambiente ───────────────────────────────────────────

  /**
   * El listado de referencia: qué hay en cada ambiente, con su código y estado.
   * Es el que se imprime para el traspaso y el que se archiva.
   */
  async inventoryByLocation(rawClinicId: string | undefined, opts: AssetPrintOptions = {}): Promise<Buffer> {
    const clinicId = this.requireClinicId(rawClinicId);
    const [assets, clinic] = await Promise.all([this.loadAssets(clinicId, opts), this.loadClinic(clinicId)]);
    const groups = this.groupByLocation(assets);

    const secciones = groups
      .map(g =>
        this.section(
          this.tituloAmbiente(g),
          this.table(
            ['Código', 'Descripción', 'Cant.', 'Tipo', 'Condición', 'Estado'],
            g.assets.map(a => [
              typstString(a.assetTag),
              typstString(a.name),
              `strong(${typstString(String(a.quantity ?? 1))})`,
              typstString(TYPE_LABELS[a.type] ?? a.type),
              this.badge(CONDITION_LABELS[a.condition] ?? a.condition, CONDITION_COLORS[a.condition]),
              this.badge(STATUS_LABELS[a.status] ?? a.status, STATUS_COLORS[a.status]),
            ]),
            ['left', 'left', 'center', 'left', 'center', 'center'],
            ['0.85fr', '3.2fr', '0.55fr', '1fr', '0.9fr', '0.9fr'],
          ),
        ),
      )
      .join('\n\n');

    const body = `
  ${this.kpiRow(assets, groups)}

  #v(6pt)
  ${secciones || '#noData()'}

  #v(18pt)
  #sigRow((
    (name: "", role: "Responsable del inventario"),
    (name: "", role: "Administración"),
  ))
`;

    return this.compile({
      title: 'Inventario de Activos Fijos',
      badge: 'Inventario',
      clinic,
      meta: [
        ['Ítems', String(assets.length)],
        ['Unidades', String(this.unidades(assets))],
        ['Ambientes', String(groups.length)],
        ...(opts.location ? ([['Filtro', opts.location]] as Array<[string, string]>) : []),
      ],
      body,
      paper: opts.paper,
    });
  }

  // ─── 2. Acta de entrega y recepción ───────────────────────────────────────

  /**
   * Lo que hoy se hace a mano. Un inventario sin acta firmada no responsabiliza
   * a nadie: esta lleva el detalle por ambiente, una columna de observaciones en
   * blanco para anotar al momento de recibir, y el pie de firmas.
   */
  async handoverAct(rawClinicId: string | undefined, opts: HandoverOptions = {}): Promise<Buffer> {
    const clinicId = this.requireClinicId(rawClinicId);
    const [assets, clinic] = await Promise.all([this.loadAssets(clinicId, opts), this.loadClinic(clinicId)]);
    const groups = this.groupByLocation(assets);

    // La clínica puede no tener localidad cargada (San Bartolomé no la tiene) —
    // "En la localidad de la clínica, a los..." se leía como un marcador de
    // plantilla sin reemplazar. Sin lugar, el acta arranca por la fecha.
    const lugar = [clinic?.localidad, clinic?.provincia, clinic?.departamento].filter(Boolean).join(', ');
    const encabezadoFecha = lugar ? `En ${lugar}, a los ${this.fechaLarga()},` : `A los ${this.fechaLarga()},`;
    const ambitoTexto = opts.location
      ? `del ambiente ${opts.location}`
      : `de los ${groups.length} ambientes de ${clinic?.name ?? 'la clínica'}`;

    const secciones = groups
      .map(g =>
        this.section(
          this.tituloAmbiente(g),
          this.table(
            ['Código', 'Descripción', 'Cant.', 'Condición', 'Observaciones'],
            g.assets.map(a => [
              typstString(a.assetTag),
              typstString(a.name),
              `strong(${typstString(String(a.quantity ?? 1))})`,
              this.badge(CONDITION_LABELS[a.condition] ?? a.condition, CONDITION_COLORS[a.condition]),
              // En blanco a propósito: se llena a mano al recorrer el ambiente.
              '[]',
            ]),
            ['left', 'left', 'center', 'center', 'left'],
            ['0.85fr', '2.9fr', '0.55fr', '0.9fr', '2.1fr'],
          ),
        ),
      )
      .join('\n\n');

    const body = `
  #block(below: 10pt)[
    #align(center)[
      #text(size: 13pt, weight: "bold", tracking: 0.8pt)[ACTA DE ENTREGA Y RECEPCIÓN DE ACTIVOS FIJOS]
    ]
  ]

  #block(below: 12pt)[
    #set par(justify: true)
    #text(size: 9.5pt)[
      // El texto dinámico entra como string en modo código (#(...)) y no
      // embebido en el markup: embebido, Typst reparsearía un nombre de
      // ambiente con asterisco o guion bajo como marcas de formato.
      #(${typstString(encabezadoFecha)}) se procede a la entrega y recepción de los activos fijos
      #(${typstString(ambitoTexto)}), detallados a continuación.
      Quien recibe declara haber verificado físicamente las #strong[${this.unidades(assets)}] unidades
      de los #strong[${assets.length}] ítems listados, así como su condición al momento de la entrega,
      y asume la responsabilidad de su
      custodia, uso y conservación. Toda observación se consigna en la columna correspondiente.
    ]
  ]

  ${secciones || '#noData()'}

  #v(20pt)
  #sigRow((
    (name: ${typstString(opts.deliveredBy || '')}, role: "Entrega — Nombre, firma y C.I."),
    (name: ${typstString(opts.receivedBy || '')}, role: "Recibe — Nombre, firma y C.I."),
    (name: "", role: "Vo. Bo. Administración"),
  ))
`;

    return this.compile({
      title: 'Acta de Entrega y Recepción de Activos Fijos',
      badge: 'Acta',
      clinic,
      meta: [
        ['Ítems', String(assets.length)],
        ['Unidades', String(this.unidades(assets))],
        ['Ambientes', String(groups.length)],
        ...(opts.location ? ([['Ambiente', opts.location]] as Array<[string, string]>) : []),
      ],
      body,
      paper: opts.paper,
    });
  }

  // ─── 3. Hoja de toma de inventario físico ─────────────────────────────────

  /**
   * La hoja con la que se sale a contar. No lleva estado ni condición del
   * sistema a propósito: el que cuenta no debe leer lo que el sistema cree, sino
   * marcar lo que ve. Los hallazgos se cargan después.
   */
  async countSheet(rawClinicId: string | undefined, opts: AssetPrintOptions = {}): Promise<Buffer> {
    const clinicId = this.requireClinicId(rawClinicId);
    const [assets, clinic] = await Promise.all([this.loadAssets(clinicId, opts), this.loadClinic(clinicId)]);
    const groups = this.groupByLocation(assets);

    // Casillas dibujadas y no un carácter «☐»: la fuente Inter no trae el glifo
    // y Typst lo sustituye por un rectángulo vacío distinto en cada visor.
    // Sin `#`: las celdas se interpolan como argumentos de `styledTable`, o sea
    // en modo código, donde el `#` no va.
    const casilla = 'box(width: 9pt, height: 9pt, stroke: 0.6pt + gris-texto, radius: 1pt)';

    const secciones = groups
      .map(g =>
        this.section(
          this.tituloAmbiente(g),
          this.table(
            // "Esperado" contra "Contado" en vez de una casilla está/falta: con
            // cantidades, marcar una casilla no dice nada de las 4 unidades que
            // debería haber. La casilla se conserva para los ítems de una sola.
            // "Cant." y no "Esperado": con la columna angosta, el encabezado
            // largo se parte por el guionado ("ESPERA-DO") y se lee peor.
            ['Código', 'Descripción', 'Cant.', 'Contado', 'Observaciones'],
            g.assets.map(a => [
              typstString(a.assetTag),
              typstString(a.name),
              `strong(${typstString(String(a.quantity ?? 1))})`,
              (a.quantity ?? 1) === 1 ? casilla : '[]',
              '[]',
            ]),
            ['left', 'left', 'center', 'center', 'left'],
            ['0.85fr', '3.1fr', '0.7fr', '0.7fr', '2.2fr'],
          ),
        ),
      )
      .join('\n\n');

    const body = `
  #block(below: 10pt)[
    #text(size: 8.5pt, fill: gris-muted)[
      Anote en "Contado" las unidades halladas de cada ítem —o marque la casilla si es una sola— y
      use observaciones para todo lo que no coincida: bienes movidos a otro ambiente, deterioro,
      o encontrados que no figuran en esta hoja.
    ]
  ]

  ${secciones || '#noData()'}

  #v(16pt)
  #section("Activos encontrados que no figuran en esta hoja")[
    ${this.table(
      ['Descripción', 'Ambiente', 'Cantidad'],
      // Cuatro filas en blanco: sin ellas no hay dónde anotar lo que aparece de
      // más, que es justo lo que una toma de inventario busca detectar.
      Array.from({ length: 4 }, () => ['[]', '[]', '[]']),
      ['left', 'left', 'left'],
      ['3fr', '1.6fr', '1.2fr'],
    )}
  ]

  #v(18pt)
  #sigRow((
    (name: "", role: "Realizó el conteo — Nombre y firma"),
    (name: "", role: "Verificó — Nombre y firma"),
  ))
`;

    return this.compile({
      title: 'Hoja de Toma de Inventario Físico',
      badge: 'Conteo físico',
      clinic,
      meta: [
        ['Ítems', String(assets.length)],
        ['Unidades esperadas', String(this.unidades(assets))],
        ['Ambientes', String(groups.length)],
        ['Fecha del conteo', '____ / ____ / ________'],
      ],
      body,
      paper: opts.paper,
    });
  }

  // ─── 4. Resumen ejecutivo ─────────────────────────────────────────────────

  /** Una hoja para dirección: cuánto hay, dónde está y en qué condición. */
  async executiveSummary(rawClinicId: string | undefined, opts: AssetPrintOptions = {}): Promise<Buffer> {
    const clinicId = this.requireClinicId(rawClinicId);
    const [assets, clinic] = await Promise.all([this.loadAssets(clinicId, {}), this.loadClinic(clinicId)]);
    const groups = this.groupByLocation(assets);

    // Solo los tipos con al menos un activo: con los seis fijos, "Vehículo" e
    // "Inmueble" salían como dos columnas enteras de guiones que solo comen
    // ancho a las que sí tienen datos.
    const tipos = Object.values(AssetType).filter(t => assets.some(a => a.type === t));
    const filasAmbiente = groups.map(g => [
      `strong(${typstString(g.location)})`,
      ...tipos.map(t => typstString(String(g.assets.filter(a => a.type === t).length || '—'))),
      `strong(${typstString(String(g.assets.length))})`,
    ]);
    filasAmbiente.push([
      'strong("TOTAL")',
      ...tipos.map(t => `strong(${typstString(String(assets.filter(a => a.type === t).length))})`),
      `strong(${typstString(String(assets.length))})`,
    ]);

    const porCondicion = Object.values(AssetCondition).map(c => ({
      label: CONDITION_LABELS[c] ?? c,
      count: assets.filter(a => a.condition === c).length,
      color: CONDITION_COLORS[c],
    }));
    const maxCondicion = Math.max(1, ...porCondicion.map(c => c.count));

    const enMalEstado = assets.filter(a => CONDICIONES_MALAS.includes(a.condition)).length;
    const enMantenimiento = assets.filter(a => a.status === AssetStatus.MAINTENANCE).length;

    const body = `
  #kpiGrid((
    kpiCard("Ítems", ${typstString(String(assets.length))}, "Distintos, en piso", color: "blue"),
    kpiCard("Unidades", ${typstString(String(this.unidades(assets)))}, "Sumando cantidades", color: "green"),
    kpiCard("Equipo médico", ${typstString(String(assets.filter(a => a.type === AssetType.MEDICAL_EQUIPMENT).length))}, "Ítems del total", color: "purple"),
    kpiCard("Requieren atención", ${typstString(String(enMalEstado + enMantenimiento))}, "Mal estado o en mantenimiento", color: "amber"),
  ))

  #v(8pt)
  // Dos columnas: sin esto el informe se iba a tres hojas y dejaba de ser un
  // resumen. El gráfico de barras por ambiente se quitó por redundante — la
  // columna Total de la tabla dice lo mismo con el número exacto.
  #grid(
    columns: (1.55fr, 1fr),
    column-gutter: 14pt,
    align: (top, top),
    // Cada celda del grid va envuelta en un bloque de contenido: los argumentos
    // del grid se evalúan en modo código, donde section() no lleva almohadilla.
    [
      ${this.section(
        'Ambiente por tipo de activo',
        `#set text(size: 8pt)
    ${this.table(
      ['Ambiente', ...tipos.map(t => TYPE_LABELS[t] ?? t), 'Total'],
      filasAmbiente,
      ['left', ...tipos.map(() => 'center'), 'center'],
      // 1.15fr y no 0.9: con menos, el encabezado más largo ("EQUIPO MÉDICO")
      // se parte a la mitad con guion mientras las columnas de números sobran.
      ['2fr', ...tipos.map(() => '1.15fr'), '0.85fr'],
    )}`,
      )}
    ],
    [
      #section("Condición del parque")[
        #hBarChart((
          ${porCondicion
            .map(
              c =>
                `(label: ${typstString(c.label)}, value: ${typstString(String(c.count))}, ` +
                `pct: ${Math.round((c.count / maxCondicion) * 100)}, color: "${c.color}")`,
            )
            .join(',\n          ')}
        ))
      ]

      #section("Los cinco ambientes con más activos")[
        ${this.table(
          ['Ambiente', 'Activos', '% del total'],
          groups
            .slice(0, 5)
            .map(g => [
              `strong(${typstString(g.location)})`,
              typstString(String(g.assets.length)),
              typstString(`${Math.round((g.assets.length / Math.max(1, assets.length)) * 100)}%`),
            ]),
          ['left', 'center', 'center'],
          ['2.2fr', '0.8fr', '0.9fr'],
        )}
      ]
    ],
  )
`;

    return this.compile({
      title: 'Resumen de Activos Fijos',
      badge: 'Resumen',
      clinic,
      meta: [
        ['Ítems', String(assets.length)],
        ['Unidades', String(this.unidades(assets))],
        ['Ambientes', String(groups.length)],
        ['Requieren atención', String(enMalEstado + enMantenimiento)],
      ],
      body,
      paper: opts.paper,
      landscape: true,
    });
  }

  // ─── 5. Mal estado y bajas ────────────────────────────────────────────────

  /**
   * Lo que hay que reponer, reparar o dar de baja. Hoy son pocos renglones
   * porque el inventario se acaba de cargar; es el informe que crece con el uso.
   */
  async conditionAndDisposals(rawClinicId: string | undefined, opts: AssetPrintOptions = {}): Promise<Buffer> {
    const clinicId = this.requireClinicId(rawClinicId);
    const clinic = await this.loadClinic(clinicId);

    const [malEstado, bajas] = await Promise.all([
      this.assetRepository.find({
        where: {
          clinic: { id: clinicId },
          isActive: true,
          condition: In(CONDICIONES_MALAS),
          status: Not(In(ESTADOS_FUERA_DE_PISO)),
        },
        order: { condition: 'DESC', location: 'ASC', assetTag: 'ASC' },
      }),
      this.assetRepository.find({
        where: { clinic: { id: clinicId }, status: In(ESTADOS_FUERA_DE_PISO) },
        order: { status: 'ASC', location: 'ASC', assetTag: 'ASC' },
      }),
    ]);

    const filaDetalle = (a: Asset) => [
      typstString(a.assetTag),
      typstString(a.name),
      `strong(${typstString(String(a.quantity ?? 1))})`,
      typstString(a.location || SIN_UBICACION),
      this.badge(CONDITION_LABELS[a.condition] ?? a.condition, CONDITION_COLORS[a.condition]),
      this.badge(STATUS_LABELS[a.status] ?? a.status, STATUS_COLORS[a.status]),
      typstString(a.notes || '—'),
    ];

    const headers = ['Código', 'Descripción', 'Cant.', 'Ambiente', 'Condición', 'Estado', 'Observaciones'];
    const aligns = ['left', 'left', 'center', 'left', 'center', 'center', 'left'];
    const widths = ['0.8fr', '2.4fr', '0.5fr', '1.3fr', '0.85fr', '0.85fr', '1.9fr'];

    const body = `
  #kpiGrid((
    kpiCard("En mal estado", ${typstString(String(malEstado.length))}, "Regular, malo o crítico", color: "amber"),
    kpiCard("Críticos", ${typstString(String(malEstado.filter(a => a.condition === AssetCondition.CRITICAL).length))}, "Fuera de servicio inminente", color: "red"),
    // "gray" existe para badge() pero NO para kpiCard(): colores-kpi solo tiene
    // green/blue/amber/red/purple/orange, y pedirle otra clave revienta la
    // compilación entera del PDF con un 500.
    kpiCard("Dados de baja", ${typstString(String(bajas.length))}, "Retirados, vendidos o extraviados", color: "blue"),
  ), columns: 3)

  #v(10pt)
  ${
    malEstado.length > 0
      ? this.section(
          'Activos en mal estado — requieren reparación o reposición',
          this.table(headers, malEstado.map(filaDetalle), aligns, widths),
        )
      : `#section("Activos en mal estado")[
    #align(center)[#v(10pt) #text(size: 8.5pt, fill: gris-muted)[Ningún activo registrado en condición regular, mala o crítica.] #v(10pt)]
  ]`
  }

  ${
    bajas.length > 0
      ? this.section('Activos dados de baja', this.table(headers, bajas.map(filaDetalle), aligns, widths))
      : `#section("Activos dados de baja")[
    #align(center)[#v(10pt) #text(size: 8.5pt, fill: gris-muted)[Ningún activo dado de baja hasta la fecha.] #v(10pt)]
  ]`
  }

  #v(18pt)
  #sigRow((
    (name: "", role: "Responsable de activos"),
    (name: "", role: "Administración"),
  ))
`;

    return this.compile({
      title: 'Activos en Mal Estado y Bajas',
      badge: 'Mal estado y bajas',
      clinic,
      meta: [
        ['En mal estado', String(malEstado.length)],
        ['Dados de baja', String(bajas.length)],
      ],
      body,
      paper: opts.paper,
      landscape: true,
    });
  }

  // ─── Datos ────────────────────────────────────────────────────────────────

  /**
   * `resolveClinicId()` devuelve `string | undefined` y `ClinicScopeGuard` ya
   * garantiza el header, pero sin esto una llamada sin clínica listaría los
   * activos de todas — exactamente lo que el aislamiento entre clínicas impide.
   */
  private requireClinicId(clinicId?: string): string {
    if (!clinicId) throw new BadRequestException('clinicId is required');
    return clinicId;
  }

  private async loadAssets(clinicId: string, opts: AssetPrintOptions): Promise<Asset[]> {
    return this.assetRepository.find({
      where: {
        clinic: { id: clinicId },
        isActive: true,
        status: Not(In(ESTADOS_FUERA_DE_PISO)),
        ...(opts.location ? { location: opts.location } : {}),
      },
      order: { location: 'ASC', assetTag: 'ASC' },
    });
  }

  private async loadClinic(clinicId: string): Promise<Clinic | null> {
    return this.clinicRepository.findOne({ where: { id: clinicId } });
  }

  private groupByLocation(assets: Asset[]): LocationGroup[] {
    const map = new Map<string, Asset[]>();
    for (const a of assets) {
      const key = a.location?.trim() || SIN_UBICACION;
      const list = map.get(key);
      if (list) list.push(a);
      else map.set(key, [a]);
    }
    // Por cantidad descendente: los ambientes grandes abren el listado, que es
    // el orden en que se recorre la clínica cuando se hace el inventario.
    return [...map.entries()]
      .map(([location, list]) => ({ location, assets: list }))
      .sort((a, b) => b.assets.length - a.assets.length || a.location.localeCompare(b.location, 'es'));
  }

  // ─── Helpers Typst ────────────────────────────────────────────────────────

  private kpiRow(assets: Asset[], groups: LocationGroup[]): string {
    const malEstado = assets.filter(a => CONDICIONES_MALAS.includes(a.condition)).length;
    return `#kpiGrid((
    kpiCard("Ítems", ${typstString(String(assets.length))}, "En el listado", color: "blue"),
    kpiCard("Unidades", ${typstString(String(this.unidades(assets)))}, ${typstString(`En ${groups.length} ambiente(s)`)}, color: "green"),
    kpiCard("Equipo médico", ${typstString(String(assets.filter(a => a.type === AssetType.MEDICAL_EQUIPMENT).length))}, "Del total", color: "purple"),
    kpiCard("En mal estado", ${typstString(String(malEstado))}, "Regular o peor", color: "amber"),
  ))`;
  }

  /** Suma de existencias: los informes hablan de ítems y de unidades, no son lo mismo. */
  private unidades(assets: Asset[]): number {
    return assets.reduce((n, a) => n + (Number(a.quantity) || 1), 0);
  }

  /** "SALA ECOGRAFIA — 58 ítems / 190 unidades" (omite el segundo si coinciden). */
  private tituloAmbiente(g: LocationGroup): string {
    const u = this.unidades(g.assets);
    return u === g.assets.length
      ? `${g.location} — ${g.assets.length} ítem(s)`
      : `${g.location} — ${g.assets.length} ítem(s) / ${u} unidades`;
  }

  private badge(text: string, color = 'gray'): string {
    return `badge(${typstString(text)}, color: "${color}")`;
  }

  private section(title: string, body: string): string {
    return `#section(${typstString(title)})[
    ${body}
  ]`;
  }

  /**
   * Coma final obligatoria en las filas: sin ella una tabla de UNA sola fila
   * `((a, b))` no es un array de tuplas para Typst sino la tupla suelta, y
   * `styledTable` termina indexando caracteres en vez de columnas (gotcha ya
   * documentado en `reports-pdf.service.ts`).
   */
  private table(headers: string[], rows: string[][], align: string[], widths: string[]): string {
    if (rows.length === 0) return '#noData()';
    return `#styledTable(
      (${headers.map(h => typstString(h)).join(', ')}),
      (
        ${rows.map(cells => `(${cells.join(', ')})`).join(',\n        ')},
      ),
      align: (${align.join(', ')}),
      widths: (${widths.join(', ')}),
    )`;
  }

  /** "9 días del mes de agosto de 2026" — la fórmula que usan las actas acá. */
  private fechaLarga(): string {
    const partes = new Intl.DateTimeFormat('es-BO', {
      timeZone: 'America/La_Paz',
      day: 'numeric',
      month: 'long',
      year: 'numeric',
    }).formatToParts(new Date());
    const parte = (t: string) => partes.find(p => p.type === t)?.value ?? '';
    return `${parte('day')} días del mes de ${parte('month')} de ${parte('year')}`;
  }

  private nowBO(): string {
    return new Date().toLocaleString('es-BO', { timeZone: 'America/La_Paz' });
  }

  private compile(opts: {
    title: string;
    badge: string;
    clinic: Clinic | null;
    meta: Array<[string, string]>;
    body: string;
    paper?: PaperSize;
    landscape?: boolean;
  }): Promise<Buffer> {
    const metaFields: Array<[string, string]> = [
      ['Generado', this.nowBO()],
      ['Clínica', opts.clinic?.name ?? '—'],
      ...opts.meta,
    ];
    const metaTypst = metaFields.map(([k, v]) => `(${typstString(k)}, ${typstString(v)})`).join(',\n  ') + ',';

    // Oficio (21,6 × 33 cm) por defecto: es el papel que la clínica tiene en la
    // impresora, y en vertical entran ~15 renglones más por hoja que en A4.
    // Typst no tiene ese tamaño con nombre, hay que darlo explícito.
    const pageOpts = (opts.paper ?? 'oficio') === 'a4' ? 'paper: "a4"' : 'width: 21.6cm, height: 33cm';

    return this.typstCompiler
      .compile(`#import "/templates/bartolomed-base.typ": bartolomedDoc, header, metaBar, section, kpiCard, kpiGrid, styledTable, badge, noData, hBarChart, sigRow, gris-texto, gris-muted

#show: bartolomedDoc.with(title: ${typstString(opts.title)}, ${pageOpts}, landscape: ${opts.landscape ? 'true' : 'false'})

#header(name: "BARTOLOMED", subtitle: "Control de Activos Fijos", badge: ${typstString(opts.badge)})
#metaBar((
  ${metaTypst}
))

#pad(x: 28pt, y: 12pt)[
${opts.body}
]
`);
  }
}
