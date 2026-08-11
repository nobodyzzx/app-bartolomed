import { Location } from '@angular/common'
import { TestBed } from '@angular/core/testing'
import { MatDialog } from '@angular/material/dialog'
import { Router } from '@angular/router'
import { AlertService } from '@core/services/alert.service'
import { of } from 'rxjs'
import { createSpyObj, SpyObj } from '../../../../../../testing/spy'
import { AssetCondition, AssetStatus, AssetType, BaseAsset } from '../interfaces/assets.interfaces'
import { AssetRegistrationService } from '../services/asset-registration.service'
import { AssetInventoryControlComponent } from './asset-inventory-control.component'

let n = 0
function activo(parcial: Partial<BaseAsset> = {}): BaseAsset {
  n += 1
  return {
    id: `a-${n}`,
    assetTag: `AF-000${n}`,
    name: `Ítem ${n}`,
    quantity: 1,
    type: AssetType.OTHER,
    status: AssetStatus.ACTIVE,
    condition: AssetCondition.GOOD,
    location: 'SALA ECOGRAFIA',
    ...parcial,
  }
}

/**
 * El componente se instancia como proveedor: lo que se prueba son los criterios
 * de las tarjetas, no la tabla de Material.
 */
describe('AssetInventoryControlComponent', () => {
  let component: AssetInventoryControlComponent
  let assetService: SpyObj<AssetRegistrationService>

  beforeEach(() => {
    assetService = createSpyObj<AssetRegistrationService>('AssetRegistrationService', [
      'getAllAssets',
      'deleteAsset',
    ])
    assetService.getAllAssets.mockReturnValue(of([]))

    TestBed.configureTestingModule({
      providers: [
        AssetInventoryControlComponent,
        { provide: AssetRegistrationService, useValue: assetService },
        { provide: Router, useValue: createSpyObj('Router', ['navigate']) },
        { provide: Location, useValue: createSpyObj('Location', ['back']) },
        { provide: AlertService, useValue: createSpyObj('AlertService', ['fire', 'success']) },
        { provide: MatDialog, useValue: createSpyObj('MatDialog', ['open']) },
      ],
    })

    component = TestBed.inject(AssetInventoryControlComponent)
  })

  /** Carga el inventario que reciba y aplica la vista pedida. */
  function cargar(assets: BaseAsset[]): void {
    assetService.getAllAssets.mockReturnValue(of(assets))
    component.loadAssets()
  }

  describe('las tarjetas cuentan y filtran con el mismo criterio', () => {
    const dañado = activo({ status: AssetStatus.DAMAGED })
    const gastado = activo({ condition: AssetCondition.POOR })
    const critico = activo({ condition: AssetCondition.CRITICAL })
    const enUso = activo()
    const porConfirmar = activo({ status: AssetStatus.INACTIVE })

    beforeEach(() => cargar([dañado, gastado, critico, enUso, porConfirmar]))

    /**
     * El fallo que motivó el criterio compartido: "en desuso" contaba los
     * dañados **y** los de condición mala, pero al pulsar la tarjeta se filtraba
     * solo por `status`, así que decía 3 y mostraba 1.
     */
    it('"En Desuso" muestra tantas filas como anuncia', () => {
      expect(component.contar('enDesuso')).toBe(3)

      component.setVista('enDesuso')

      expect(component.dataSource.filteredData.length).toBe(3)
      expect(component.dataSource.filteredData).toEqual(
        expect.arrayContaining([dañado, gastado, critico]),
      )
    })

    /**
     * Lo gastado y lo crítico siguen en estado "activo" en la ficha, así que
     * contando solo por `status` figuraban a la vez como operativos y como
     * inservibles: entre las tres tarjetas salían más ítems de los que hay.
     */
    it('"En Uso" deja fuera lo inservible y lo que está por confirmar', () => {
      expect(component.contar('enUso')).toBe(1)

      component.setVista('enUso')

      expect(component.dataSource.filteredData).toEqual([enUso])
    })

    it('ninguna tarjeta cuenta un ítem que ya cuenta otra', () => {
      const suma =
        component.contar('enUso') + component.contar('porConfirmar') + component.contar('enDesuso')

      expect(suma).toBe(component.contar('todos'))
    })

    it('"Por Confirmar" son los que no tienen entrega registrada', () => {
      expect(component.contar('porConfirmar')).toBe(1)

      component.setVista('porConfirmar')

      expect(component.dataSource.filteredData).toEqual([porConfirmar])
    })

    it('"Ítems" devuelve el inventario entero', () => {
      component.setVista('enUso')
      component.setVista('todos')

      expect(component.contar('todos')).toBe(5)
      expect(component.dataSource.filteredData.length).toBe(5)
    })
  })

  describe('unidades', () => {
    it('suma cantidades, no fichas', () => {
      cargar([activo({ quantity: 4 }), activo({ quantity: 137 }), activo({ quantity: 1 })])

      expect(component.contar('todos')).toBe(3)
      expect(component.getTotalUnits()).toBe(142)
    })

    /**
     * Las columnas numéricas de Postgres llegan como string; sumarlas con `+`
     * las concatenaba y reventaba el `DecimalPipe`, que tumbaba el render de
     * toda la pantalla.
     */
    it('suma aunque la cantidad llegue como texto', () => {
      cargar([activo({ quantity: '4' as unknown as number }), activo({ quantity: '2' as unknown as number })])

      expect(component.getTotalUnits()).toBe(6)
    })
  })

  describe('hayFiltro', () => {
    beforeEach(() => cargar([activo()]))

    it('es falso con el inventario entero a la vista', () => {
      expect(component.hayFiltro).toBe(false)
    })

    it('es verdadero con una tarjeta activa', () => {
      component.setVista('enUso')

      expect(component.hayFiltro).toBe(true)
    })

    it('es verdadero mientras haya algo escrito en el buscador', () => {
      component.applyFilter('porta')
      expect(component.hayFiltro).toBe(true)

      component.applyFilter('   ')
      expect(component.hayFiltro).toBe(false)
    })
  })
})
