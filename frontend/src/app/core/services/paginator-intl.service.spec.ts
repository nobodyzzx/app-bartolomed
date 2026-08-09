import { SpanishPaginatorIntl } from './paginator-intl.service'

describe('SpanishPaginatorIntl', () => {
  let intl: SpanishPaginatorIntl

  beforeEach(() => {
    intl = new SpanishPaginatorIntl()
  })

  it('traduce las etiquetas del paginador', () => {
    expect(intl.itemsPerPageLabel).toBe('Filas por página')
    expect(intl.nextPageLabel).toBe('Página siguiente')
    expect(intl.previousPageLabel).toBe('Página anterior')
    expect(intl.firstPageLabel).toBe('Primera página')
    expect(intl.lastPageLabel).toBe('Última página')
  })

  it('arma el rango de la primera página', () => {
    expect(intl.getRangeLabel(0, 50, 503)).toBe('1 – 50 de 503')
  })

  it('arma el rango de una página intermedia', () => {
    expect(intl.getRangeLabel(2, 50, 503)).toBe('101 – 150 de 503')
  })

  it('no se pasa del total en la última página, que casi nunca está completa', () => {
    // Sin acotar el fin diría "501 – 550 de 503".
    expect(intl.getRangeLabel(10, 50, 503)).toBe('501 – 503 de 503')
  })

  it('sin resultados no inventa un rango', () => {
    expect(intl.getRangeLabel(0, 50, 0)).toBe('0 de 0')
  })

  it('tolera un tamaño de página en cero sin devolver NaN', () => {
    expect(intl.getRangeLabel(0, 0, 20)).toBe('0 de 20')
  })
})
