import { Component, DestroyRef, inject, OnInit, ViewChild } from '@angular/core'
import { takeUntilDestroyed } from '@angular/core/rxjs-interop'
import { MatDialog } from '@angular/material/dialog'
import { MatPaginator } from '@angular/material/paginator'
import { MatTableDataSource } from '@angular/material/table'
import { Router } from '@angular/router'
import { AlertService } from '@core/services/alert.service'
import { User } from '../../../../../auth/interfaces'
import { ProfessionalRoles } from '../../../../interfaces/professionalRoles.enum'
import { Role, RolesService } from '../../roles/services/roles.service'
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
  availableRoles: Role[] = []

  displayedColumns: string[] = ['fullName', 'phone', 'roles', 'startDate', 'isActive', 'actions']
  dataSource: MatTableDataSource<User>
  users: User[] = []
  allUsers: User[] = []
  searchTerm: string = ''
  filterStatus: 'all' | 'active' | 'inactive' = 'all'
  isLoading = false

  @ViewChild(MatPaginator) paginator!: MatPaginator

  constructor(
    private usersService: UsersService,
    private rolesService: RolesService,
    private router: Router,
    private alert: AlertService,
    private dialog: MatDialog,
  ) {
    this.dataSource = new MatTableDataSource<User>([])
    this.dataSource.filterPredicate = this.createFilter()
  }

  ngOnInit(): void {
    this.loadUsers()
    this.rolesService.findAll(true).pipe(takeUntilDestroyed(this.destroyRef)).subscribe({ next: roles => (this.availableRoles = roles) })
  }

  ngAfterViewInit() {
    this.dataSource.paginator = this.paginator
  }

  loadUsers(): void {
    this.isLoading = true
    this.usersService.getUsers().pipe(takeUntilDestroyed(this.destroyRef)).subscribe({
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
    this.applyFilters()
  }

  applyFilter(): void {
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

  getAvailableRolesFor(user: User): Role[] {
    return this.availableRoles.filter(r => !(user.roles ?? []).includes(r.name))
  }

  addRoleToUser(user: User, roleName: string): void {
    const newRoles = [...(user.roles ?? []), roleName]
    this.usersService.updateUser({ id: user.id, roles: newRoles }).pipe(takeUntilDestroyed(this.destroyRef)).subscribe({
      next: () => this.loadUsers(),
      error: () => this.alert.error('Error', 'No se pudo agregar el rol'),
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
            next: () => {
              this.loadUsers()
              this.alert
                .success(
                  `Usuario ${user.isActive ? 'desactivado' : 'activado'}`,
                  `El usuario ha sido ${user.isActive ? 'desactivado' : 'activado'} correctamente`,
                )
                .then()
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
