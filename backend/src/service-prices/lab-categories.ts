/**
 * Nombre legible de cada categoría clínica del tarifario de laboratorio.
 *
 * Vive en el backend porque los documentos que genera (informe de resultados)
 * tienen que nombrarlas igual que la interfaz. El frontend mantiene su propia
 * copia en `service-prices.service.ts`: son dos programas distintos y no
 * comparten módulos, pero el contenido debe coincidir.
 */
/**
 * Prefijo de código por categoría clínica.
 *
 * No es una convención nueva: es la que ya traía el tarifario del proveedor
 * (`HEM-001`, `QMS-032`…) y que hasta ahora solo existía dentro de los datos.
 * Al escribirla aquí, un examen dado de alta desde la pantalla recibe el mismo
 * prefijo que sus hermanos en vez de caer en un cajón genérico.
 */
export const LAB_CATEGORY_CODE_PREFIXES: Record<string, string> = {
  HEMATOLOGIA: 'HEM',
  COAGULACION: 'COA',
  QUIMICA_SANGUINEA: 'QMS',
  MARCADORES_TUMORALES: 'MTU',
  HORMONAS: 'HOR',
  INMUNOLOGIA_PRUEBAS_RAPIDAS: 'INM',
  ORINA: 'ORI',
  HECES_FECALES: 'HEC',
  BACTERIOLOGIA: 'BAC',
  BIOLOGIA_MOLECULAR: 'BMO',
};

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
