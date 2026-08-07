import { MENU_ITEMS } from '@core/constants/menu-items'
import { MenuItem } from '@core/interfaces/menu-item.interface'

export interface BreadcrumbCrumb {
  label: string
  icon?: string
  route: string | null
}

/** Último segmento de la URL → label legible, para acciones típicas sin metadata de ruta propia. */
const TRAILING_LABELS: Record<string, string> = {
  new: 'Nuevo',
  edit: 'Editar',
}

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i

function flattenMenu(items: MenuItem[], parent?: MenuItem): { item: MenuItem; parent?: MenuItem }[] {
  return items.flatMap(item => [
    { item, parent },
    ...(item.children ? flattenMenu(item.children, item) : []),
  ])
}

/**
 * Deriva "Grupo > Página [> Acción]" reutilizando MENU_ITEMS (misma fuente que el sidebar) en vez
 * de exigir data.breadcrumb en cada ruta del router — evita tocar los ~15 módulos de rutas lazy.
 * Best-effort: sin metadata por ruta, la miga final (id/"new"/"edit") es una aproximación.
 */
export function buildBreadcrumb(url: string): BreadcrumbCrumb[] {
  const path = url.split('?')[0].split('#')[0]
  if (path === '/dashboard/home' || path === '/dashboard') return []

  const candidates = flattenMenu(MENU_ITEMS).filter(({ item }) => item.route && path.startsWith(item.route))
  if (candidates.length === 0) return []

  const match = candidates.sort((a, b) => b.item.route!.length - a.item.route!.length)[0]

  const crumbs: BreadcrumbCrumb[] = []
  if (match.parent) crumbs.push({ label: match.parent.label, icon: match.parent.icon, route: null })
  crumbs.push({ label: match.item.label, icon: match.item.icon, route: match.item.route! })

  const rest = path.slice(match.item.route!.length).split('/').filter(Boolean)
  const last = rest[rest.length - 1]
  if (last) {
    const label = TRAILING_LABELS[last] ?? (UUID_RE.test(last) ? 'Detalle' : null)
    if (label) crumbs.push({ label, route: null })
  }

  return crumbs
}
