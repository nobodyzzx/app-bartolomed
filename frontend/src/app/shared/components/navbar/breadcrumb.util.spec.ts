import { buildBreadcrumb } from './breadcrumb.util'

describe('buildBreadcrumb', () => {
  it('no muestra breadcrumb en el home del dashboard', () => {
    expect(buildBreadcrumb('/dashboard/home')).toEqual([])
  })

  it('arma Grupo > Página para una ruta hija', () => {
    const crumbs = buildBreadcrumb('/dashboard/patients')

    expect(crumbs).toEqual([
      { label: 'Gestión del Consultorio Médico', icon: 'monitor_heart', route: null },
      { label: 'Pacientes', icon: 'people', route: '/dashboard/patients' },
    ])
  })

  it('agrega "Nuevo" para rutas de creación', () => {
    const crumbs = buildBreadcrumb('/dashboard/patients/new')

    expect(crumbs[crumbs.length - 1]).toEqual({ label: 'Nuevo', route: null })
  })

  it('agrega "Detalle" cuando el último segmento es un uuid', () => {
    const crumbs = buildBreadcrumb('/dashboard/patients/9b1deb4d-3b7d-4bad-9bdd-2b0d7b3dcb6d')

    expect(crumbs[crumbs.length - 1]).toEqual({ label: 'Detalle', route: null })
  })

  it('no agrega miga final si el segmento no matchea ningún patrón conocido', () => {
    const crumbs = buildBreadcrumb('/dashboard/patients/algo-raro')

    expect(crumbs).toEqual([
      { label: 'Gestión del Consultorio Médico', icon: 'monitor_heart', route: null },
      { label: 'Pacientes', icon: 'people', route: '/dashboard/patients' },
    ])
  })

  it('usa la ruta de menú más específica cuando hay varias que matchean por prefijo', () => {
    const crumbs = buildBreadcrumb('/dashboard/pharmacy/inventory')

    expect(crumbs).toEqual([
      { label: 'Control de Farmacia', icon: 'medication', route: null },
      { label: 'Inventario', icon: 'inventory', route: '/dashboard/pharmacy/inventory' },
    ])
  })

  it('ignora query params y hash', () => {
    const crumbs = buildBreadcrumb('/dashboard/patients?page=2#top')

    expect(crumbs).toEqual([
      { label: 'Gestión del Consultorio Médico', icon: 'monitor_heart', route: null },
      { label: 'Pacientes', icon: 'people', route: '/dashboard/patients' },
    ])
  })

  it('retorna vacío para una ruta que no está en MENU_ITEMS', () => {
    expect(buildBreadcrumb('/auth/login')).toEqual([])
  })
})
