import { Location } from '@angular/common'
import { ElementRef } from '@angular/core'
import { TestBed } from '@angular/core/testing'
import { FormBuilder } from '@angular/forms'
import { ActivatedRoute, Router } from '@angular/router'
import { of } from 'rxjs'
import { AlertService } from '@core/services/alert.service'
import { createSpyObj, SpyObj } from '../../../../../../../testing/spy'
import { InventoryService } from '../../services/inventory.service'
import { MedicationFormComponent } from './medication-form.component'

/**
 * El catálogo real de esta farmacia son 486 productos cargados de una planilla
 * con código, nombre y precio: sin principio activo, y 323 con la concentración
 * en `N/D`. El formulario los exigía y dejaba el botón de guardar apagado para
 * siempre, así que no se podía corregir ni una falta de ortografía.
 */
const DEL_CATALOGO_REAL = {
  id: 'med-1',
  code: 'MED-0001',
  name: 'Aceite de almendra liquida',
  strength: 'N/D',
  dosageForm: 'Unidad',
  activeIngredients: null,
  manufacturer: null,
  dosageInstructions: null,
} as any

describe('MedicationFormComponent', () => {
  let component: MedicationFormComponent
  let inventory: SpyObj<InventoryService>

  const build = (id: string | null) => {
    inventory = createSpyObj<InventoryService>('InventoryService', [
      'getMedicationById',
      'updateMedication',
      'createMedication',
    ])
    inventory.getMedicationById.mockReturnValue(of(DEL_CATALOGO_REAL))
    inventory.updateMedication.mockReturnValue(of(DEL_CATALOGO_REAL))

    TestBed.configureTestingModule({
      providers: [
        MedicationFormComponent,
        FormBuilder,
        { provide: InventoryService, useValue: inventory },
        { provide: AlertService, useValue: { success: () => {}, error: () => {} } },
        { provide: Router, useValue: { navigate: () => {} } },
        { provide: Location, useValue: { back: () => {} } },
        { provide: ElementRef, useValue: { nativeElement: document.createElement('div') } },
        { provide: ActivatedRoute, useValue: { snapshot: { paramMap: { get: () => id } } } },
      ],
    })
    // Sin compilar la plantilla: lo que se prueba es la validación, no el HTML.
    component = TestBed.inject(MedicationFormComponent)
    component.ngOnInit()
  }

  it('deja editar un producto del catálogo real, sin principio activo ni concentración', () => {
    build('med-1')

    expect(component.medicationForm.valid).toBe(true)
  })

  it('conserva la concentración original en vez de escribir "null mg"', async () => {
    build('med-1')

    await component.onSubmit()

    const [, dto] = inventory.updateMedication.mock.calls[0]
    expect(dto.strength).toBe('N/D')
    expect(dto.activeIngredients).toBeUndefined()
  })

  it('agrega al desplegable la forma farmacéutica que trae el producto', () => {
    build('med-1')

    // "Unidad" es la que usa el catálogo real; si no estuviera, el selector se
    // abriría vacío y guardar la reemplazaría por la primera de la lista.
    expect(component.dosageForms).toContain('Unidad')
    expect(component.medicationForm.get('formaFarmaceutica')?.value).toBe('Unidad')
  })

  it('sigue exigiendo el nombre, que es el único dato que siempre existe', () => {
    build(null)

    expect(component.medicationForm.valid).toBe(false)
    component.medicationForm.patchValue({ nombreComercial: 'Paracetamol' })
    expect(component.medicationForm.valid).toBe(true)
  })

  it('compone la concentración cuando sí se carga un valor', async () => {
    build('med-1')
    component.medicationForm.patchValue({ concentracionValor: 500, concentracionUnidad: 'mg' })

    await component.onSubmit()

    const [, dto] = inventory.updateMedication.mock.calls[0]
    expect(dto.strength).toBe('500 mg')
  })
})
