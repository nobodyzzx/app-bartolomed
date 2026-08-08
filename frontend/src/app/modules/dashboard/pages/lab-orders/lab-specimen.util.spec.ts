import { inferSpecimen } from './lab-specimen.util'

describe('inferSpecimen', () => {
  describe('casos que el nombre resuelve solo', () => {
    it('reconoce el sufijo -uria como orina, aunque no diga "orina"', () => {
      // Los que fallaban con la primera versión: salían todos como sangre.
      for (const estudio of ['Amilasuria', 'Proteinuria', 'Glucosuria', 'Creatinuria', 'Uricosuria']) {
        expect(inferSpecimen(estudio, 'ORINA').specimenType).toBe('Orina')
      }
    })

    it('reconoce heces sin que aparezca la palabra', () => {
      for (const estudio of ['Test de Graham', 'Rotavirus', 'Amebas en fresco', 'Moco fecal']) {
        expect(inferSpecimen(estudio, 'HECES_FECALES').specimenType).toBe('Heces')
      }
    })

    it('marca la imagenología como estudio sin muestra', () => {
      expect(inferSpecimen('Radiografía de tórax')).toEqual({
        category: 'imaging',
        specimenType: 'No aplica',
      })
    })

    it('el nombre manda sobre la categoría cuando son incompatibles', () => {
      // Helicobacter en heces está catalogado en Inmunología, cuya muestra
      // habitual es sangre: el nombre es más específico y debe ganar.
      expect(inferSpecimen('Helicobacter pylori en heces', 'INMUNOLOGIA_PRUEBAS_RAPIDAS').specimenType)
        .toBe('Heces')
      expect(inferSpecimen('Urocultivo y antibiograma', 'BACTERIOLOGIA').specimenType).toBe('Orina')
    })
  })

  describe('categoría del tarifario', () => {
    it('las categorías de sangre dan sangre', () => {
      for (const cat of [
        'HEMATOLOGIA',
        'COAGULACION',
        'QUIMICA_SANGUINEA',
        'MARCADORES_TUMORALES',
        'HORMONAS',
        'INMUNOLOGIA_PRUEBAS_RAPIDAS',
      ]) {
        expect(inferSpecimen('Estudio cualquiera', cat)).toEqual({
          category: 'blood',
          specimenType: 'Sangre',
        })
      }
    })

    it('deja la muestra en blanco en las categorías que mezclan varias', () => {
      // Bacteriología y Biología molecular admiten sangre, esputo, hisopado o
      // semen según el estudio: suponer una sería inventarla.
      for (const cat of ['BACTERIOLOGIA', 'BIOLOGIA_MOLECULAR']) {
        expect(inferSpecimen('Cultivos y antibiogramas', cat).specimenType).toBe('')
      }
    })
  })

  it('supone sangre cuando no hay categoría (estudios anteriores al tarifario real)', () => {
    expect(inferSpecimen('Hemograma completo')).toEqual({ category: 'blood', specimenType: 'Sangre' })
  })

  it('no revienta con un nombre vacío o nulo', () => {
    expect(inferSpecimen('')).toEqual({ category: 'blood', specimenType: 'Sangre' })
    expect(inferSpecimen(null)).toEqual({ category: 'blood', specimenType: 'Sangre' })
    expect(inferSpecimen(undefined)).toEqual({ category: 'blood', specimenType: 'Sangre' })
  })
})
