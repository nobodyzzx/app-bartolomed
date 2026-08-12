import { MatSort } from '@angular/material/sort'
import { MatTableDataSource } from '@angular/material/table'
import { EstadoOrden, num, ordenar, ordenarComoLasDemas } from './table-sort.util'

interface Fila {
  nombre: string
  precio: unknown
  vence: string | null
}

const asc: EstadoOrden = { key: 'nombre', dir: 'asc' }
const desc: EstadoOrden = { key: 'nombre', dir: 'desc' }

function filas(...nombres: string[]): Fila[] {
  return nombres.map(nombre => ({ nombre, precio: 0, vence: null }))
}

const porNombre = (f: Fila) => f.nombre

describe('ordenar', () => {
  it('no toca el array que recibe', () => {
    const original = filas('Zurita', 'Ávila')

    ordenar(original, asc, porNombre)

    expect(original.map(porNombre)).toEqual(['Zurita', 'Ávila'])
  })

  it('sin sentido de orden devuelve las filas como venían', () => {
    const entrada = filas('Zurita', 'Ávila', 'Mamani')

    const salida = ordenar(entrada, { key: 'nombre', dir: '' }, porNombre)

    expect(salida.map(porNombre)).toEqual(['Zurita', 'Ávila', 'Mamani'])
  })

  /**
   * Con `<` o con `localeCompare()` sin configuración regional, "Ávila" cae
   * después de "Zurita": la vocal acentuada vive fuera del rango ASCII.
   */
  it('coloca las tildes donde se las espera en español', () => {
    const salida = ordenar(filas('Zurita', 'Ávila', 'Núñez', 'Nogales'), asc, porNombre)

    expect(salida.map(porNombre)).toEqual(['Ávila', 'Nogales', 'Núñez', 'Zurita'])
  })

  it('no separa por mayúsculas: la columna se lee como una sola lista', () => {
    const salida = ordenar(filas('banco', 'Anexo', 'Camilla', 'aguja'), asc, porNombre)

    expect(salida.map(porNombre)).toEqual(['aguja', 'Anexo', 'banco', 'Camilla'])
  })

  /** Alfabéticamente "Lote 10" va antes que "Lote 9", que no es lo que nadie busca. */
  it('lee los números dentro del texto como números', () => {
    const salida = ordenar(filas('Lote 10', 'Lote 9', 'Lote 100'), asc, porNombre)

    expect(salida.map(porNombre)).toEqual(['Lote 9', 'Lote 10', 'Lote 100'])
  })

  it('invierte con el sentido descendente', () => {
    const salida = ordenar(filas('Ávila', 'Zurita', 'Mamani'), desc, porNombre)

    expect(salida.map(porNombre)).toEqual(['Zurita', 'Mamani', 'Ávila'])
  })

  describe('números', () => {
    /**
     * Las columnas numéricas de Postgres llegan como string. Comparadas como
     * texto, "1000" queda antes que "9" y la columna de precios miente.
     */
    it('ordena por valor, no por texto, cuando se pasan por num()', () => {
      const precios: Fila[] = [
        { nombre: 'a', precio: '1000', vence: null },
        { nombre: 'b', precio: '9', vence: null },
        { nombre: 'c', precio: '87.5', vence: null },
      ]

      const salida = ordenar(precios, { key: 'precio', dir: 'asc' }, f => num(f.precio))

      expect(salida.map(f => f.nombre)).toEqual(['b', 'c', 'a'])
    })

    it('el cero es un valor, no un hueco', () => {
      const precios: Fila[] = [
        { nombre: 'a', precio: 5, vence: null },
        { nombre: 'b', precio: 0, vence: null },
      ]

      const salida = ordenar(precios, { key: 'precio', dir: 'asc' }, f => num(f.precio))

      expect(salida.map(f => f.nombre)).toEqual(['b', 'a'])
    })
  })

  describe('celdas vacías', () => {
    const conHuecos: Fila[] = [
      { nombre: 'sin fecha', precio: 0, vence: null },
      { nombre: 'vence tarde', precio: 0, vence: '2027-01-01' },
      { nombre: 'vence pronto', precio: 0, vence: '2026-01-01' },
    ]
    const porFecha = (f: Fila) => f.vence

    /**
     * En farmacia media columna de vencimientos está "sin registrar" a
     * propósito. Quien ordena por ahí busca lo que vence antes o lo ya vencido:
     * los huecos son ruido y estorban arriba en cualquiera de los dos sentidos.
     */
    it('van al final ascendiendo', () => {
      const salida = ordenar(conHuecos, { key: 'vence', dir: 'asc' }, porFecha)

      expect(salida.map(f => f.nombre)).toEqual(['vence pronto', 'vence tarde', 'sin fecha'])
    })

    it('y también descendiendo', () => {
      const salida = ordenar(conHuecos, { key: 'vence', dir: 'desc' }, porFecha)

      expect(salida.map(f => f.nombre)).toEqual(['vence tarde', 'vence pronto', 'sin fecha'])
    })
  })

  describe('fechas', () => {
    it('compara por instante y no por cómo se escribe', () => {
      const entrada = [
        { nombre: 'b', vence: new Date('2026-03-01'), precio: 0 },
        { nombre: 'a', vence: new Date('2026-01-15'), precio: 0 },
      ]

      const salida = ordenar(entrada, { key: 'vence', dir: 'asc' }, f => f.vence)

      expect(salida.map(f => f.nombre)).toEqual(['a', 'b'])
    })
  })

  describe('booleanos', () => {
    it('lo activo pesa más que lo inactivo', () => {
      const entrada = [
        { nombre: 'inactivo', activo: false },
        { nombre: 'activo', activo: true },
      ]

      const salida = ordenar(entrada, { key: 'activo', dir: 'desc' }, f => f.activo)

      expect(salida.map(f => f.nombre)).toEqual(['activo', 'inactivo'])
    })

    /** `false` no es un hueco: es "no", y tiene que ordenarse como tal. */
    it('false no se trata como celda vacía', () => {
      const entrada = [
        { nombre: 'no', activo: false },
        { nombre: 'sí', activo: true },
      ]

      const salida = ordenar(entrada, { key: 'activo', dir: 'asc' }, f => f.activo)

      expect(salida.map(f => f.nombre)).toEqual(['no', 'sí'])
    })
  })
})

describe('num', () => {
  it('convierte los numéricos que llegan como texto', () => {
    expect(num('87.5')).toBe(87.5)
  })

  it('deja pasar el hueco como hueco, para que caiga al final', () => {
    expect(num(null)).toBeNull()
    expect(num('')).toBeNull()
    expect(num(undefined)).toBeNull()
  })

  it('lo que no es un número es un hueco, no un cero', () => {
    expect(num('—')).toBeNull()
  })
})

/**
 * El comportamiento que se corrige aquí es el de `MatTableDataSource`, que
 * compara con `<` a secas. Los casos son los mismos que ya cubre `ordenar`,
 * pero entrando por donde entra una tabla de Material de verdad.
 */
describe('ordenarComoLasDemas', () => {
  interface Fila { nombre: string; lote: string; precio: number | null }

  function tabla(filas: Fila[]): MatTableDataSource<Fila> {
    const ds = new MatTableDataSource<Fila>(filas)
    ordenarComoLasDemas(ds)
    return ds
  }

  function ordenadas(ds: MatTableDataSource<Fila>, active: string, direction: 'asc' | 'desc' | '') {
    // Basta con los dos campos que `sortData` mira de la directiva.
    return ds.sortData(ds.data, { active, direction } as MatSort).map(f => f.nombre)
  }

  it('coloca las tildes donde se las espera, no donde caen por código', () => {
    const ds = tabla([
      { nombre: 'Zurita', lote: '', precio: null },
      { nombre: 'Ávila', lote: '', precio: null },
      { nombre: 'Nogales', lote: '', precio: null },
    ])

    expect(ordenadas(ds, 'nombre', 'asc')).toEqual(['Ávila', 'Nogales', 'Zurita'])
  })

  it('lee los números dentro del texto como números', () => {
    const ds = tabla([
      { nombre: 'a', lote: 'Lote 10', precio: null },
      { nombre: 'b', lote: 'Lote 9', precio: null },
    ])

    expect(ordenadas(ds, 'lote', 'asc')).toEqual(['b', 'a'])
  })

  /** Material pone los nulos arriba al invertir; aquí el hueco se queda abajo. */
  it('deja las celdas vacías al final en los dos sentidos', () => {
    const ds = tabla([
      { nombre: 'sin precio', lote: '', precio: null },
      { nombre: 'caro', lote: '', precio: 90 },
      { nombre: 'barato', lote: '', precio: 10 },
    ])

    expect(ordenadas(ds, 'precio', 'asc')).toEqual(['barato', 'caro', 'sin precio'])
    expect(ordenadas(ds, 'precio', 'desc')).toEqual(['caro', 'barato', 'sin precio'])
  })

  it('respeta el accesor propio de la tabla', () => {
    const ds = tabla([
      { nombre: 'Ana Zurita', lote: '', precio: null },
      { nombre: 'Beto Ávila', lote: '', precio: null },
    ])
    // Por apellido, como hacen las tablas con nombre compuesto.
    ds.sortingDataAccessor = (f, _k) => f.nombre.split(' ')[1].toLowerCase()

    expect(ordenadas(ds, 'nombre', 'asc')).toEqual(['Beto Ávila', 'Ana Zurita'])
  })

  it('sin sentido de orden devuelve las filas como venían', () => {
    const ds = tabla([
      { nombre: 'Zurita', lote: '', precio: null },
      { nombre: 'Ávila', lote: '', precio: null },
    ])

    expect(ordenadas(ds, 'nombre', '')).toEqual(['Zurita', 'Ávila'])
  })

  /** `sort()` de Material muta el array; el nuestro no debe tocar los datos. */
  it('no reordena los datos originales de la tabla', () => {
    const ds = tabla([
      { nombre: 'Zurita', lote: '', precio: null },
      { nombre: 'Ávila', lote: '', precio: null },
    ])

    ordenadas(ds, 'nombre', 'asc')

    expect(ds.data.map(f => f.nombre)).toEqual(['Zurita', 'Ávila'])
  })
})
