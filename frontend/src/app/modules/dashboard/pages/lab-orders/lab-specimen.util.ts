/**
 * Deduce qué muestra se toma para un estudio.
 *
 * Manda la **categoría clínica del tarifario** (`ORINA`, `HECES_FECALES`,
 * `HEMATOLOGIA`…), que es un dato real del catálogo; el nombre solo se usa
 * para los casos que la categoría no resuelve — dentro de Bacteriología o
 * Biología molecular conviven muestras muy distintas.
 *
 * La primera versión adivinaba solo por el nombre y fallaba en **12 de los 110
 * estudios**: "Amilasuria", "Proteinuria", "Rotavirus" o "Test de Graham" no
 * llevan la palabra orina ni heces, y salían todos como sangre.
 *
 * Es una ayuda, no una verdad: el tipo de muestra sigue siendo editable en el
 * formulario. Si algún día el tarifario guarda la muestra como columna propia,
 * este archivo sobra.
 */

export type LabCategory = 'blood' | 'imaging' | 'other'

export interface SpecimenGuess {
  category: LabCategory
  /** Vacío cuando no se puede saber: mejor que el usuario lo escriba a que mienta. */
  specimenType: string
}

const SANGRE: SpecimenGuess = { category: 'blood', specimenType: 'Sangre' }
const ORINA: SpecimenGuess = { category: 'other', specimenType: 'Orina' }
const HECES: SpecimenGuess = { category: 'other', specimenType: 'Heces' }
const ESPUTO: SpecimenGuess = { category: 'other', specimenType: 'Esputo' }
const HISOPADO: SpecimenGuess = { category: 'other', specimenType: 'Hisopado' }
const SIN_DETERMINAR: SpecimenGuess = { category: 'other', specimenType: '' }

/** Casos que el nombre resuelve sin ambigüedad, por encima de la categoría. */
const POR_NOMBRE: Array<{ patron: RegExp; guess: SpecimenGuess }> = [
  {
    patron: /radiograf|rayos\s*x|ecograf|ultrasonid|tomograf|resonanc|mamograf|doppler/i,
    guess: { category: 'imaging', specimenType: 'No aplica' },
  },
  // El sufijo -uria delata la orina: amilasuria, proteinuria, glucosuria…
  { patron: /orina|uria\b|urocultivo|uroan[aá]lisis|clearance|antidoping/i, guess: ORINA },
  { patron: /copro|heces|fecal|parasitol|graham|rotavirus|amebas/i, guess: HECES },
  { patron: /esput|expectorac|baciloscop/i, guess: ESPUTO },
  { patron: /exudad|hisopad|secrec|nasal|far[ií]ng|vph|papiloma|covid|papanicolaou|citol/i, guess: HISOPADO },
  { patron: /espermiograma/i, guess: { category: 'other', specimenType: 'Semen' } },
]

/** Muestra habitual de cada categoría del tarifario. */
const POR_CATEGORIA: Record<string, SpecimenGuess> = {
  HEMATOLOGIA: SANGRE,
  COAGULACION: SANGRE,
  QUIMICA_SANGUINEA: SANGRE,
  MARCADORES_TUMORALES: SANGRE,
  HORMONAS: SANGRE,
  INMUNOLOGIA_PRUEBAS_RAPIDAS: SANGRE,
  ORINA: ORINA,
  HECES_FECALES: HECES,
  // Bacteriología y Biología molecular mezclan muestras (urocultivo, esputo,
  // hisopado, semen): sin una regla por nombre no se puede suponer nada.
  BACTERIOLOGIA: SIN_DETERMINAR,
  BIOLOGIA_MOLECULAR: SIN_DETERMINAR,
}

export function inferSpecimen(
  testName: string | null | undefined,
  labCategory?: string | null,
): SpecimenGuess {
  const nombre = (testName ?? '').trim()

  const porNombre = nombre ? POR_NOMBRE.find(r => r.patron.test(nombre))?.guess : undefined
  if (porNombre) return porNombre

  const porCategoria = labCategory ? POR_CATEGORIA[labCategory] : undefined
  if (porCategoria) return porCategoria

  // Sin categoría (estudios anteriores al tarifario real) la sangre es lo más
  // probable, y en el peor caso se corrige a mano.
  return SANGRE
}
