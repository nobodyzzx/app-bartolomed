import { Component, DestroyRef, inject, OnInit, ViewChild } from '@angular/core'
import { takeUntilDestroyed } from '@angular/core/rxjs-interop'
import { MatDialog } from '@angular/material/dialog'
import { MatPaginator } from '@angular/material/paginator'
import { MatSort } from '@angular/material/sort'
import { ordenarComoLasDemas } from '../../../../../../shared/utils/table-sort.util'
import { ListStateService } from '../../../../../../shared/services/list-state.service'
import { MatTableDataSource } from '@angular/material/table'
import { ActivatedRoute, Router } from '@angular/router'
import { AlertService } from '@core/services/alert.service'
import { UserRoles } from '@core/enums/user-roles.enum'
import { RoleStateService } from '@core/services/role-state.service'
import { ASSIGNABLE_ROLES, AssignableRole } from '@core/constants/assignable-roles'
import { User } from '../../../../../auth/interfaces'
import { ProfessionalRoles } from '../../../../interfaces/professionalRoles.enum'
import { UserDetailDialogComponent } from '../user-detail-dialog/user-detail-dialog.component'
import { UsersService } from '../users.service'

@Component({
    selector: 'app-user-list',
    templateUrl: './user-list.component.html',
    styleUrl: './user-list.component.css',
    standalone: false
})
export class UserListComponent implements OnInit {
  private readonly destroyRef = inject(DestroyRef)

  isExpanded: boolean = true
  ProfessionalRoles = ProfessionalRoles
  availableRoles = ASSIGNABLE_ROLES

  displayedColumns: string[] = ['fullName', 'phone', 'roles', 'startDate', 'isActive', 'actions']
  dataSource: MatTableDataSource<User>
  users: User[] = []
  allUsers: User[] = []
  searchTerm: string = ''
  filterStatus: 'all' | 'active' | 'inactive' = 'all'
  isLoading = false

  /**
   * Por `set` y no por propiedad: la tabla vive dentro de un `@if` que solo
   * aparece cuando ya hay filas, así que en `ngAfterViewInit` el paginador y el
   * ordenador todavía no existen.
   */
  @ViewChild(MatPaginator)
  set paginator(paginator: MatPaginator | undefined) {
    if (paginator) this.dataSource.paginator = paginator
  }

  @ViewChild(MatSort)
  set sort(sort: MatSort | undefined) {
    if (!sort) return
    this.dataSource.sort = sort
    if (this.ordenPedido) {
      sort.active = this.ordenPedido.key
      sort.direction = this.ordenPedido.dir
      sort.sortChange.emit({ active: sort.active, direction: sort.direction })
      this.ordenPedido = null
    }
    sort.sortChange.pipe(takeUntilDestroyed(this.destroyRef)).subscribe(() => this.recordarVista())
  }

  private readonly roleState = inject(RoleStateService)
  private readonly listState = inject(ListStateService)
  private readonly route = inject(ActivatedRoute)

  /** Clave con la que se recuerda la vista de este listado. */
  private static readonly RUTA = '/dashboard/users'

  constructor(
    private usersService: UsersService,
    private router: Router,
    private alert: AlertService,
    private dialog: MatDialog,
  ) {
    this.dataSource = new MatTableDataSource<User>([])
    ordenarComoLasDemas(this.dataSource)
    this.dataSource.filterPredicate = this.createFilter()

    /**
     * Ninguna de estas columnas es un campo del usuario: el nombre cuelga de
     * `personalInfo`, la fecha de alta de `professionalInfo`, y los roles son
     * una lista. Sin traducirlas, las cabeceras pintan la flecha y no mueven
     * nada.
     */
    this.dataSource.sortingDataAccessor = (user, columna) => {
      switch (columna) {
        // Por apellido, que es como se busca a alguien en una lista.
        case 'fullName': return `${user.personalInfo?.lastName ?? ''} ${user.personalInfo?.firstName ?? ''}`.trim()
        case 'phone': return user.personalInfo?.phone ?? ''
        case 'startDate': return user.professionalInfo?.startDate
          ? new Date(user.professionalInfo.startDate).getTime()
          : ''
        // Por el primero de la lista: con varios roles no hay un orden único,
        // y el primero es el que la celda enseña delante.
        case 'roles': return user.roles?.[0] ?? ''
        case 'isActive': return user.isActive ? 'Activo' : 'Inactivo'
        default: return ''
      }
    }
  }

  ngOnInit(): void {
    /**
     * Volviendo de una ficha manda lo recordado: al abrir un usuario Angular
     * destruye este componente, y sin esto la vuelta dejaba el staff entero y
     * sin filtro.
     */
    const guardado = this.listState.recuperarSiVuelve(UserListComponent.RUTA)
    const params = this.route.snapshot.queryParamMap
    this.searchTerm = String(guardado?.['q'] ?? params.get('q') ?? '')
    const estado = String(guardado?.['estado'] ?? params.get('estado') ?? '')
    if (estado === 'active' || estado === 'inactive') this.filterStatus = estado
    this.ordenPedido = (() => {
      const sort = String(guardado?.['sort'] ?? params.get('sort') ?? '')
      const dir = String(guardado?.['dir'] ?? params.get('dir') ?? '')
      return sort && (dir === 'asc' || dir === 'desc') ? { key: sort, dir } : null
    })()

    // Guardar lo restaurado, no solo leerlo: si nadie toca un filtro no habría
    // nada en memoria, y al volver de una ficha —a la que se llega por la ruta
    // pelada, sin parámetros— la pantalla aparecería sin filtro y en la página 1.
    this.recordarVista()

    this.loadUsers()
  }

  /** Orden llegado de la URL o de la vuelta; se aplica cuando el ordenador existe. */
  private ordenPedido: { key: string; dir: 'asc' | 'desc' } | null = null

  /** Deja la vista en la URL y la recuerda para cuando se vuelva de una ficha. */
  private recordarVista(): void {
    const estado = {
      q: this.searchTerm.trim() || undefined,
      estado: this.filterStatus === 'all' ? undefined : this.filterStatus,
      sort: this.dataSource.sort?.active || undefined,
      dir: (this.dataSource.sort?.direction || undefined) as 'asc' | 'desc' | undefined,
      page: (this.dataSource.paginator?.pageIndex ?? 0) + 1,
    }
    this.listState.guardar(UserListComponent.RUTA, estado)
    this.listState.reflejarEnUrl(this.route, estado)
  }


  // Bug real: getUsers() sin argumentos siempre traía limit=25/offset=0, y el
  // MatPaginator solo paginaba client-side ese array — usuarios 26+ quedaban
  // invisibles. No hay búsqueda server-side para /users (solo limit/offset),
  // así que en vez de armar paginación real se trae todo el staff de la
  // clínica de una vez (tamaño realista para este negocio) para que el
  // buscador y el paginador sigan operando sobre el set completo.
  loadUsers(): void {
    this.isLoading = true
    this.usersService.getUsers(500).pipe(takeUntilDestroyed(this.destroyRef)).subscribe({
      next: result => {
        this.allUsers = result.data
        this.users = result.data
        this.applyFilters()
        this.isLoading = false
      },
      error: () => {
        this.alert.error('Error', 'No se pudieron cargar los usuarios')
        this.isLoading = false
      },
    })
  }

  // Navegación
  navigateToNew(): void {
    this.router.navigate(['/dashboard/users/register'])
  }

  // Filtros
  setFilterStatus(status: 'all' | 'active' | 'inactive'): void {
    this.filterStatus = status
    this.recordarVista()
    this.applyFilters()
  }

  applyFilter(): void {
    this.recordarVista()
    this.applyFilters()
  }

  private applyFilters(): void {
    let filtered = [...this.allUsers]

    // Filtrar por estado
    if (this.filterStatus === 'active') {
      filtered = filtered.filter(user => user.isActive)
    } else if (this.filterStatus === 'inactive') {
      filtered = filtered.filter(user => !user.isActive)
    }

    // Filtrar por búsqueda
    if (this.searchTerm.trim()) {
      const term = this.searchTerm.toLowerCase().trim()
      filtered = filtered.filter(user => {
        const fullName =
          `${user.personalInfo?.firstName} ${user.personalInfo?.lastName}`.toLowerCase()
        const email = user.email?.toLowerCase() || ''
        return fullName.includes(term) || email.includes(term)
      })
    }

    this.dataSource.data = filtered
  }

  private createFilter(): (data: User, filter: string) => boolean {
    return (data: User, filter: string): boolean => {
      return true // El filtro se maneja manualmente en applyFilters
    }
  }

  getActiveUsersCount(): number {
    return this.allUsers.filter(user => user.isActive).length
  }

  getInactiveUsersCount(): number {
    return this.allUsers.filter(user => !user.isActive).length
  }

  getAdminCount(): number {
    return this.allUsers.filter(u => u.roles?.some((r: string) => r.toLowerCase().includes('admin'))).length
  }

  getUserInitials(user: User): string {
    const first = user.personalInfo?.firstName?.charAt(0) ?? ''
    const last  = user.personalInfo?.lastName?.charAt(0) ?? ''
    return (first + last).toUpperCase() || user.email?.charAt(0).toUpperCase() || '?'
  }

  formatDate(date: Date | undefined): string {
    if (!date) return 'No disponible'
    return new Date(date).toLocaleDateString('es-ES', {
      year: 'numeric',
      month: 'long',
      day: 'numeric',
    })
  }

  getRoleClass(role: string): string {
    // Definimos un objeto con las clases para cada tipo de rol
    const roleClasses: Record<string, string> = {
      admin: 'bg-red-100 text-red-800',
      user: 'bg-green-100 text-green-800',
      super_user: 'bg-purple-100 text-purple-800',
      guest: 'bg-gray-100 text-gray-800',
    }

    // Verificamos si el rol existe en nuestro objeto de clases
    if (role in roleClasses) {
      return roleClasses[role]
    }

    // Si no existe, devolvemos una clase por defecto
    return 'bg-blue-100 text-blue-800'
  }

  viewUser(user: User): void {
    this.dialog.open(UserDetailDialogComponent, {
      data: user,
      width: '580px',
      maxWidth: '95vw',
      panelClass: 'rounded-dialog',
    })
  }

  editUser(user: User): void {
    // Navegar a la página de edición con el ID del usuario
    this.router.navigate(['/dashboard/users/edit', user.id])
  }

  getAvailableRolesFor(user: User): AssignableRole[] {
    // Bug real: cualquier ADMIN podía otorgarse (o a cualquiera) el rol
    // super-admin con un clic — se oculta esa opción salvo que el propio
    // usuario logueado ya sea SUPER_ADMIN. El backend igual lo rechaza con
    // 403 (defensa en profundidad, no es el único control).
    const isSuperAdmin = this.roleState.hasRole(UserRoles.SUPER_ADMIN)
    return this.availableRoles.filter(
      r => !(user.roles ?? []).includes(r.value) && (isSuperAdmin || r.value !== UserRoles.SUPER_ADMIN),
    )
  }

  addRoleToUser(user: User, roleName: string): void {
    const nombre = `${user.personalInfo?.firstName ?? ''} ${user.personalInfo?.lastName ?? ''}`.trim() || user.email
    this.alert
      .fire({
        title: `¿Agregar rol "${roleName}"?`,
        text: `Se agregará el rol a ${nombre}`,
        icon: 'question',
        showCancelButton: true,
        confirmButtonText: 'Sí, agregar',
        cancelButtonText: 'Cancelar',
        reverseButtons: true,
      })
      .then(result => {
        if (!result.isConfirmed) return
        const newRoles = [...(user.roles ?? []), roleName]
        this.usersService.updateUser({ id: user.id, roles: newRoles }).pipe(takeUntilDestroyed(this.destroyRef)).subscribe({
          next: () => this.loadUsers(),
          error: () => this.alert.error('Error', 'No se pudo agregar el rol'),
        })
      })
  }

  removeRoleFromUser(user: User, role: string): void {
    if ((user.roles ?? []).length <= 1) {
      this.alert.error('Atención', 'El usuario debe tener al menos un rol')
      return
    }
    const nombre = `${user.personalInfo?.firstName ?? ''} ${user.personalInfo?.lastName ?? ''}`.trim() || user.email
    this.alert
      .fire({
        title: `¿Quitar rol "${role}"?`,
        text: `Se quitará el rol de ${nombre}`,
        icon: 'warning',
        showCancelButton: true,
        confirmButtonText: 'Sí, quitar',
        cancelButtonText: 'Cancelar',
        reverseButtons: true,
      })
      .then(result => {
        if (result.isConfirmed) {
          const newRoles = (user.roles ?? []).filter((r: string) => r !== role)
          this.usersService.updateUser({ id: user.id, roles: newRoles }).pipe(takeUntilDestroyed(this.destroyRef)).subscribe({
            next: () => {
              this.loadUsers()
              this.alert.success('Rol removido', `El rol "${role}" fue quitado correctamente`).then()
            },
            error: () => this.alert.error('Error', 'No se pudo quitar el rol'),
          })
        }
      })
  }

  deleteUser(user: User): void {
    this.alert
      .fire({
        title: '¿Estás seguro?',
        text: `¿Deseas eliminar al usuario ${user.personalInfo?.firstName} ${user.personalInfo?.lastName}?`,
        icon: 'warning',
        showCancelButton: true,
        confirmButtonText: 'Sí, eliminar',
        cancelButtonText: 'Cancelar',
        reverseButtons: true,
      })
      .then(result => {
        if (result.isConfirmed) {
          this.usersService.deleteUser(user.id).pipe(takeUntilDestroyed(this.destroyRef)).subscribe({
            next: () => {
              this.loadUsers()
              this.alert
                .success('Usuario eliminado', 'El usuario ha sido eliminado correctamente')
                .then()
            },
            error: () => {
              this.alert.error('Error', 'No se pudo eliminar el usuario')
            },
          })
        }
      })
  }

  toggleUserStatus(user: User): void {
    const action = user.isActive ? 'desactivar' : 'activar'
    const nombre = `${user.personalInfo?.firstName ?? ''} ${user.personalInfo?.lastName ?? ''}`.trim() || user.email
    this.alert
      .fire({
        title: `¿${action.charAt(0).toUpperCase() + action.slice(1)} usuario?`,
        text: `¿Deseas ${action} a ${nombre}?`,
        icon: 'question',
        showCancelButton: true,
        confirmButtonText: `Sí, ${action}`,
        cancelButtonText: 'Cancelar',
        reverseButtons: true,
      })
      .then(result => {
        if (result.isConfirmed) {
          this.usersService.updateUserStatus(user.id, !user.isActive).pipe(takeUntilDestroyed(this.destroyRef)).subscribe({
            next: response => {
              this.loadUsers()
              const pending = response?.pendingWork
              const hasPending = !!pending && (pending.appointments > 0 || pending.prescriptions > 0 || pending.labOrders > 0)
              if (hasPending) {
                const items: string[] = []
                if (pending!.appointments > 0) items.push(`${pending!.appointments} cita(s) futura(s)`)
                if (pending!.prescriptions > 0) items.push(`${pending!.prescriptions} receta(s) sin cerrar`)
                if (pending!.labOrders > 0) items.push(`${pending!.labOrders} orden(es) de laboratorio en curso`)
                this.alert.warning(
                  'Usuario desactivado',
                  `${nombre} quedó desactivado, pero tiene ${items.join(', ')} asignadas. Reasígnelas o adviértalo al resto del equipo.`,
                )
              } else {
                this.alert
                  .success(
                    `Usuario ${user.isActive ? 'desactivado' : 'activado'}`,
                    `El usuario ha sido ${user.isActive ? 'desactivado' : 'activado'} correctamente`,
                  )
                  .then()
              }
            },
            error: () => {
              this.alert.error('Error', `No se pudo ${action} el usuario`)
            },
          })
        }
      })
  }

  getStatusClass(isActive: boolean): string {
    return isActive ? 'bg-green-100 text-green-800' : 'bg-red-100 text-red-800'
  }
}
