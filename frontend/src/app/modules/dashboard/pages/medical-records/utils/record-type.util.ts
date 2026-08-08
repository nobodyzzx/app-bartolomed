import { RecordType } from '../interfaces'

/**
 * Icono, etiqueta y color de cada tipo de consulta — **una sola definición**.
 *
 * Antes había dos: un `Record<>` en `medical-records-dashboard.component.ts` y una
 * cadena de ternarios en la plantilla de la cronología. Cinco de los siete tipos
 * salían distintos según la pantalla (consulta era `assignment` o
 * `medical_services`, laboratorio `biotech` o `science`, imagenología `camera_alt`
 * o `radiology`, seguimiento `update` o `refresh`, y "otro" caía en un fallback
 * que no era el suyo). Gana la del dashboard, que es la que estaba en el mapa.
 *
 * > [!warning] Al añadir un tipo, dar de alta su icono en `EXTRA_ICONS`
 * > (`scripts/build-icon-subset.mjs`). El recortador de la fuente solo escanea
 * > plantillas: un icono que sale de un mapa en `.ts` se queda fuera del subset y
 * > se ve como el nombre en texto plano.
 */
const RECORD_TYPE_ICONS: Record<string, string> = {
  [RecordType.CONSULTATION]: 'assignment',
  [RecordType.EMERGENCY]: 'emergency',
  [RecordType.SURGERY]: 'healing',
  [RecordType.FOLLOW_UP]: 'update',
  [RecordType.LABORATORY]: 'biotech',
  [RecordType.IMAGING]: 'camera_alt',
  [RecordType.OTHER]: 'description',
}

const RECORD_TYPE_LABELS: Record<string, string> = {
  [RecordType.CONSULTATION]: 'Consulta',
  [RecordType.EMERGENCY]: 'Emergencia',
  [RecordType.SURGERY]: 'Cirugía',
  [RecordType.FOLLOW_UP]: 'Seguimiento',
  [RecordType.LABORATORY]: 'Laboratorio',
  [RecordType.IMAGING]: 'Imagenología',
  [RecordType.OTHER]: 'Otro',
}

export function recordTypeIcon(type: RecordType | string | undefined): string {
  return RECORD_TYPE_ICONS[type as string] ?? RECORD_TYPE_ICONS[RecordType.OTHER]
}

export function recordTypeLabel(type: RecordType | string | undefined): string {
  return RECORD_TYPE_LABELS[type as string] ?? RECORD_TYPE_LABELS[RecordType.OTHER]
}
