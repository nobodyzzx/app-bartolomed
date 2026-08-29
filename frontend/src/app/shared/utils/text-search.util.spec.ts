import { matchesSearch, normalizeForSearch } from './text-search.util'

describe('normalizeForSearch', () => {
  it('quita tildes', () => {
    expect(normalizeForSearch('Algodón')).toBe('algodon')
  })

  it('pasa a minúsculas', () => {
    expect(normalizeForSearch('CIPROFLOXACINA')).toBe('ciprofloxacina')
  })

  it('recorta espacios', () => {
    expect(normalizeForSearch('  bisturi  ')).toBe('bisturi')
  })

  it('null/undefined se tratan como cadena vacía', () => {
    expect(normalizeForSearch(null)).toBe('')
    expect(normalizeForSearch(undefined)).toBe('')
  })

  it('acepta valores que no son string (ej. números)', () => {
    expect(normalizeForSearch(123)).toBe('123')
  })
})

describe('matchesSearch', () => {
  it('encuentra una subcadena literal', () => {
    expect(matchesSearch('cipr', 'Ciprofloxacina')).toBe(true)
  })

  /**
   * Este es el caso que motivó la revisión: un usuario reportó que buscar
   * "cipr" no encontraba "Ciprofloxacina" — no se pudo reproducir el bug en
   * el código (matchesSearch ya lo maneja bien), pero es exactamente el
   * caso a blindar con un test.
   */
  it('no confunde "cipr" con cualquier campo que solo tenga una de sus letras', () => {
    expect(matchesSearch('cipr', 'Paracetamol')).toBe(false) // tiene 'r', no "cipr"
    expect(matchesSearch('cipr', 'Ibuprofeno')).toBe(false) // tiene 'i', 'p', 'r', pero no en ese orden contiguo
  })

  it('ignora tildes en el dato aunque el término no las lleve, y viceversa', () => {
    expect(matchesSearch('algodon', 'Algodón')).toBe(true)
    expect(matchesSearch('algodón', 'Algodon')).toBe(true)
  })

  it('ignora mayúsculas en los dos lados', () => {
    expect(matchesSearch('CIPRO', 'ciprofloxacina')).toBe(true)
  })

  it('un término vacío (o solo espacios) hace que todo coincida', () => {
    expect(matchesSearch('', 'cualquier cosa')).toBe(true)
    expect(matchesSearch('   ', 'cualquier cosa')).toBe(true)
  })

  it('revisa varios campos con OR: alcanza con que uno coincida', () => {
    expect(matchesSearch('lote-9', 'Paracetamol', 'LOTE-9', undefined)).toBe(true)
  })

  it('no revienta con campos null/undefined entre los candidatos', () => {
    expect(matchesSearch('algo', null, undefined, 'Algodón')).toBe(true)
    expect(matchesSearch('nada', null, undefined)).toBe(false)
  })
})
