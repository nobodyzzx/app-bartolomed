/**
 * Nombre legible de cada categoría clínica del tarifario de laboratorio.
 *
 * Vive en el backend porque los documentos que genera (informe de resultados)
 * tienen que nombrarlas igual que la interfaz. El frontend mantiene su propia
 * copia en `service-prices.service.ts`: son dos programas distintos y no
 * comparten módulos, pero el contenido debe coincidir.
 */
export const LAB_CATEGORY_LABELS: Record<string, string> = {
  HEMATOLOGIA: 'Hematología',
  COAGULACION: 'Coagulación',
  QUIMICA_SANGUINEA: 'Química sanguínea',
  MARCADORES_TUMORALES: 'Marcadores tumorales',
  HORMONAS: 'Hormonas',
  INMUNOLOGIA_PRUEBAS_RAPIDAS: 'Inmunología y pruebas rápidas',
  ORINA: 'Orina',
  HECES_FECALES: 'Heces fecales',
  BACTERIOLOGIA: 'Bacteriología',
  BIOLOGIA_MOLECULAR: 'Biología molecular y otros',
};
