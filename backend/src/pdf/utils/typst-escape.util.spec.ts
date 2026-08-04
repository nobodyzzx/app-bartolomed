import { typstEscape, typstString } from './typst-escape.util';

describe('typstEscape', () => {
  it('escapa backslash', () => {
    expect(typstEscape('C:\\ruta')).toBe('C:\\\\ruta');
  });

  it('escapa comillas dobles', () => {
    expect(typstEscape('Dr. "Pepe" Pérez')).toBe('Dr. \\"Pepe\\" Pérez');
  });

  it('no toca caracteres de markup Typst (no son markup acá, son texto literal)', () => {
    expect(typstEscape('#título *importante* [nota]')).toBe('#título *importante* [nota]');
  });

  it('convierte números a string', () => {
    expect(typstEscape(42)).toBe('42');
  });

  it('null/undefined devuelven string vacío', () => {
    expect(typstEscape(null)).toBe('');
    expect(typstEscape(undefined)).toBe('');
  });

  /**
   * Regresión: si no se escapa `"`, un nombre de paciente/medicamento con
   * comillas rompe el string Typst generado (o, en el peor caso, permite
   * inyectar código Typst adicional después de cerrar el string a propósito).
   * La propiedad que importa no es la ausencia literal de `"` en el output
   * (sigue apareciendo, ahora escapada) sino que NINGÚN `"` quede sin un `\`
   * inmediatamente antes — eso es lo que hace que Typst ya no lo interprete
   * como el cierre del string.
   */
  it('previene que una comilla sin escapar cierre el string Typst antes de tiempo', () => {
    const maligno = '") #{ "inyectado';
    const escapado = typstEscape(maligno);
    const comillasSinEscapar = escapado.match(/(?<!\\)"/g) ?? [];
    expect(comillasSinEscapar).toHaveLength(0);
  });
});

describe('typstString', () => {
  it('envuelve el valor escapado en comillas', () => {
    expect(typstString('Juan')).toBe('"Juan"');
  });

  it('escapa antes de envolver', () => {
    expect(typstString('Dr. "Pepe"')).toBe('"Dr. \\"Pepe\\""');
  });
});
