import { TestBed } from '@angular/core/testing'
import { ReactiveFormsModule } from '@angular/forms'
import { MAT_DIALOG_DATA, MatDialogRef } from '@angular/material/dialog'
import { of } from 'rxjs'
import { createSpyObj, SpyObj } from '../../../../../../testing/spy'
import { AssetStatus, AssetType, BaseAsset, TargetClinic } from '../interfaces/assets.interfaces'
import { AssetRegistrationService } from '../services/asset-registration.service'
import { InventoryCountsService } from '../services/inventory-counts.service'
import { MoveAssetDialogComponent } from './move-asset-dialog.component'

/** Los ambientes reales: unos vienen de la planilla en mayúscula y sin tildes,
 *  otros se cargaron a mano con ambas cosas. */
const AMBIENTES = [
  'Administración',
  'BAÑO',
  'Consultorio 1',
  'CONSULTORIO MEDICO 1',
  'SALA DE ESPERA',
  'SALA ECOGRAFIA',
]

const ASSET: BaseAsset = {
  id: 'asset-1',
  assetTag: 'AF-0042',
  name: 'Porta pico',
  quantity: 4,
  type: AssetType.OTHER,
  status: AssetStatus.ACTIVE,
  location: 'SALA ECOGRAFIA',
}

/**
 * Sin `imports: [MiFeatureModule]` y sin compilar plantilla: el diálogo se
 * instancia como proveedor porque lo que se prueba es el filtrado, no el HTML.
 */
describe('MoveAssetDialogComponent', () => {
  let component: MoveAssetDialogComponent
  let assetService: SpyObj<AssetRegistrationService>
  let counts: SpyObj<InventoryCountsService>

  function crear(clinicas: TargetClinic[] = []): MoveAssetDialogComponent {
    assetService = createSpyObj<AssetRegistrationService>('AssetRegistrationService', ['getLocations'])
    counts = createSpyObj<InventoryCountsService>('InventoryCountsService', ['getTargetClinics', 'move'])
    assetService.getLocations.mockReturnValue(of(AMBIENTES))
    counts.getTargetClinics.mockReturnValue(of(clinicas))

    TestBed.configureTestingModule({
      imports: [ReactiveFormsModule],
      providers: [
        MoveAssetDialogComponent,
        { provide: AssetRegistrationService, useValue: assetService },
        { provide: InventoryCountsService, useValue: counts },
        { provide: MatDialogRef, useValue: createSpyObj('MatDialogRef', ['close']) },
        { provide: MAT_DIALOG_DATA, useValue: { asset: ASSET } },
      ],
    })

    const dialog = TestBed.inject(MoveAssetDialogComponent)
    dialog.ngOnInit()
    return dialog
  }

  beforeEach(() => {
    TestBed.resetTestingModule()
    component = crear()
  })

  it('no ofrece el ambiente donde el ítem ya está', () => {
    expect(component.locations).not.toContain('SALA ECOGRAFIA')
    expect(component.locations).toContain('BAÑO')
  })

  it('sin nada escrito ofrece todos los ambientes', () => {
    expect(component.filteredLocations).toEqual(component.locations)
  })

  it('recorta la lista con lo que se va tecleando', () => {
    component.form.get('toLocation')!.setValue('consul')

    expect(component.filteredLocations).toEqual(['Consultorio 1', 'CONSULTORIO MEDICO 1'])
  })

  it('ignora tildes y mayúsculas a los dos lados', () => {
    component.form.get('toLocation')!.setValue('administracion')
    expect(component.filteredLocations).toEqual(['Administración'])

    component.form.get('toLocation')!.setValue('BAÑO')
    expect(component.filteredLocations).toEqual(['BAÑO'])
  })

  it('no ofrece nada cuando el nombre tecleado es nuevo', () => {
    component.form.get('toLocation')!.setValue('Depósito nuevo')

    expect(component.filteredLocations).toEqual([])
  })

  it('al elegir otra clínica sugiere los ambientes de esa clínica, no los de esta', () => {
    TestBed.resetTestingModule()
    component = crear([{ id: 'clinica-2', name: 'Virgen de las Nieves', locations: ['RECEPCION'] }])

    component.form.get('toClinicId')!.setValue('clinica-2')

    expect(component.locations).toEqual(['RECEPCION'])
    // Cambiar de clínica limpia lo tecleado: pertenece al otro edificio.
    expect(component.form.get('toLocation')!.value).toBe('')
  })
})
