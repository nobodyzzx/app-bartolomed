import { Component, OnInit, ViewChild } from '@angular/core'
import { MatPaginator } from '@angular/material/paginator'
import { MatTableDataSource } from '@angular/material/table'
import { Router } from '@angular/router'
import Swal from 'sweetalert2'
import { User } from '../../../../auth/interfaces'
import { ProfessionalRoles } from '../../../interfaces/professionalRoles.enum'
import { UsersService } from '../users.service'

@Component({
  selector: 'app-user-list',
  templateUrl: './user-list.component.html',
  styleUrl: './user-list.component.css',
})
export class UserListComponent implements OnInit {
  isExpanded: boolean = true
  ProfessionalRoles = ProfessionalRoles

  displayedColumns: string[] = ['fullName', 'phone', 'roles', 'startDate', 'isActive', 'actions']
  dataSource: MatTableDataSource<User>
  users: User[] = []
  allUsers: User[] = []
  searchTerm: string = ''
  filterStatus: 'all' | 'active' | 'inactive' = 'all'

  @ViewChild(MatPaginator) paginator!: MatPaginator

  constructor(
    private usersService: UsersService,
    private router: Router,
  ) {
    this.dataSource = new MatTableDataSource<User>([])
    this.dataSource.filterPredicate = this.createFilter()
  }

  ngOnInit(): void {
    this.loadUsers()
  }

  ngAfterViewInit() {
    this.dataSource.paginator = this.paginator
  }

  loadUsers(): void {
    this.usersService.findAll().subscribe({
      next: users => {
        this.allUsers = users
        this.users = users
        this.applyFilters()
      },
      error: error => {
        console.error('Error loading users:', error)
        Swal.fire('Error', 'No se pudieron cargar los usuarios', 'error')
      },
    })
  }

  // Navegación
  navigateToDashboard(): void {
    this.router.navigate(['/dashboard/users'])
  }

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
    // CSS personalizado para las pestañas
    const tabsCSS = `
      .tabs-container {
        display: flex;
        border-bottom: 1px solid #e5e7eb;
        margin-bottom: 1rem;
      }
      .tab {
        padding: 0.75rem 1.5rem;
        cursor: pointer;
        font-weight: 600;
        transition: all 0.3s;
        border-bottom: 3px solid transparent;
      }
      .tab.active {
        color: #3b82f6;
        border-bottom-color: #3b82f6;
      }
      .tab-content {
        display: none;
        animation: fadeIn 0.3s ease-in-out;
      }
      .tab-content.active {
        display: block;
      }
      @keyframes fadeIn {
        from { opacity: 0; }
        to { opacity: 1; }
      }
      .info-row {
        display: flex;
        margin-bottom: 0.75rem;
        align-items: baseline;
      }
      .info-label {
        font-weight: 600;
        color: #4b5563;
        width: 40%;
      }
      .info-value {
        color: #1f2937;
        width: 60%;
      }
      .avatar {
        width: 100px;
        height: 100px;
        border-radius: 50%;
        background-color: #e0f2fe;
        display: flex;
        align-items: center;
        justify-content: center;
        margin: 0 auto 1rem;
      }
      .avatar-text {
        font-size: 2.5rem;
        font-weight: bold;
        color: #3b82f6;
      }
      .user-name {
        text-align: center;
        font-size: 1.5rem;
        font-weight: bold;
        color: #1e3a8a;
        margin-bottom: 0.5rem;
      }
      .user-email {
        text-align: center;
        color: #6b7280;
        margin-bottom: 1.5rem;
      }
      .user-roles {
        display: flex;
        flex-wrap: wrap;
        justify-content: center;
        gap: 0.5rem;
        margin-bottom: 1.5rem;
      }
      .role-badge {
        padding: 0.25rem 0.75rem;
        border-radius: 9999px;
        font-size: 0.75rem;
        font-weight: 500;
      }
    `

    // Crear HTML para las pestañas
    const personalInfoHTML = `
      <div class="info-row">
        <div class="info-label">Nombre completo:</div>
        <div class="info-value">${user.personalInfo?.firstName || 'N/A'} ${user.personalInfo?.lastName || 'N/A'}</div>
      </div>
      <div class="info-row">
        <div class="info-label">Teléfono:</div>
        <div class="info-value">${user.personalInfo?.phone || 'No disponible'}</div>
      </div>
      <div class="info-row">
        <div class="info-label">Email:</div>
        <div class="info-value">${user.email}</div>
      </div>
      <div class="info-row">
        <div class="info-label">Estado:</div>
        <div class="info-value">
          <span class="${user.isActive ? 'bg-green-100 text-green-800' : 'bg-red-100 text-red-800'}" style="padding: 0.25rem 0.75rem; border-radius: 9999px;">
            ${user.isActive ? 'Activo' : 'Inactivo'}
          </span>
        </div>
      </div>
    `

    const professionalInfoHTML = `
      <div class="info-row">
        <div class="info-label">Título:</div>
        <div class="info-value">${user.professionalInfo?.title || 'No disponible'}</div>
      </div>
      <div class="info-row">
        <div class="info-label">Rol professional:</div>
        <div class="info-value">${user.professionalInfo?.role || 'No disponible'}</div>
      </div>
      <div class="info-row">
        <div class="info-label">Especialización:</div>
        <div class="info-value">${user.professionalInfo?.specialization || 'No disponible'}</div>
      </div>
      <div class="info-row">
        <div class="info-label">Licencia:</div>
        <div class="info-value">${user.professionalInfo?.license || 'No disponible'}</div>
      </div>
      <div class="info-row">
        <div class="info-label">Certificaciones:</div>
        <div class="info-value">${
          user.professionalInfo?.certifications?.length
            ? user.professionalInfo.certifications.join(', ')
            : 'No disponible'
        }</div>
      </div>
      <div class="info-row">
        <div class="info-label">Áreas de práctica:</div>
        <div class="info-value">${
          user.professionalInfo?.areas?.length
            ? user.professionalInfo.areas.join(', ')
            : 'No disponible'
        }</div>
      </div>
      <div class="info-row">
        <div class="info-label">Fecha de inicio:</div>
        <div class="info-value">${this.formatDate(user.startDate)}</div>
      </div>
      <div class="info-row">
        <div class="info-label">Descripción:</div>
        <div class="info-value">${user.professionalInfo?.description || 'No disponible'}</div>
      </div>
    `

    // Obtener los colores de roles
    const getRoleBadge = (role: string) => {
      const roleColors: Record<string, string> = {
        admin: 'background-color: #fecaca; color: #991b1b;',
        user: 'background-color: #d1fae5; color: #065f46;',
        super_user: 'background-color: #ddd6fe; color: #5b21b6;',
        guest: 'background-color: #e5e7eb; color: #4b5563;',
      }
      return roleColors[role.toLowerCase()] || 'background-color: #bfdbfe; color: #1e40af;'
    }

    // Generar badges de roles
    const rolesBadges = user.roles
      .map(role => `<span class="role-badge" style="${getRoleBadge(role)}">${role}</span>`)
      .join('')

    // Modal HTML completo
    const modalHTML = `
      <style>${tabsCSS}</style>
      <div class="avatar">
        <div class="avatar-text">${user.personalInfo?.firstName?.charAt(0) || '?'}</div>
      </div>
      <div class="user-name">${user.personalInfo?.firstName || 'N/A'} ${user.personalInfo?.lastName || 'N/A'}</div>
      <div class="user-email">${user.email}</div>
      <div class="user-roles">
        ${rolesBadges}
      </div>
      <div class="tabs-container">
        <div class="tab active" data-tab="personal">Información Personal</div>
        <div class="tab" data-tab="professional">Información professional</div>
      </div>
      <div class="tab-content active" id="personal-tab">
        ${personalInfoHTML}
      </div>
      <div class="tab-content" id="professional-tab">
        ${professionalInfoHTML}
      </div>
    `

    // Mostrar modal con SweetAlert2
    Swal.fire({
      title: '',
      html: modalHTML,
      width: '600px',
      confirmButtonText: 'Cerrar',
      confirmButtonColor: '#3085d6',
      customClass: {
        container: 'user-details-modal',
        popup: 'rounded-lg',
        confirmButton: 'rounded-md',
      },
      didOpen: () => {
        // Añadir funcionalidad a las pestañas
        const tabs = document.querySelectorAll('.tab')
        const tabContents = document.querySelectorAll('.tab-content')

        tabs.forEach(tab => {
          tab.addEventListener('click', () => {
            // Remover clase active de todas las pestañas
            tabs.forEach(t => t.classList.remove('active'))
            tabContents.forEach(c => c.classList.remove('active'))

            // Añadir clase active a la pestaña seleccionada
            tab.classList.add('active')
            const tabName = tab.getAttribute('data-tab')
            document.getElementById(`${tabName}-tab`)?.classList.add('active')
          })
        })
      },
    })
  }

  editUser(user: User): void {
    // Navegar a la página de edición con el ID del usuario
    this.router.navigate(['/dashboard/users/edit', user.id])
  }

  editRoles(user: User): void {
    // Mostrar modal de edición de roles
    Swal.fire({
      title: `Editar roles de ${user.personalInfo?.firstName} ${user.personalInfo?.lastName}`,
      html: `
        <div style="text-align: left;">
          <p style="margin-bottom: 1rem;"><strong>Email:</strong> ${user.email}</p>
          <p style="margin-bottom: 1rem;"><strong>Roles actuales:</strong></p>
          <div style="display: flex; flex-wrap: wrap; gap: 0.5rem; margin-bottom: 1.5rem;">
            ${user.roles?.map(role => `<span style="background-color: #dbeafe; color: #1e40af; padding: 0.25rem 0.75rem; border-radius: 9999px; font-size: 0.875rem;">${role}</span>`).join('') || '<em>Sin roles</em>'}
          </div>
          <p style="margin-bottom: 0.5rem;"><strong>Para editar los roles, navega a la sección de edición de usuario.</strong></p>
        </div>
      `,
      confirmButtonText: 'Editar usuario',
      cancelButtonText: 'Cerrar',
      showCancelButton: true,
    }).then(result => {
      if (result.isConfirmed) {
        this.editUser(user)
      }
    })
  }

  deleteUser(user: User): void {
    Swal.fire({
      title: '¿Estás seguro?',
      text: `¿Deseas eliminar al usuario ${user.personalInfo?.firstName} ${user.personalInfo?.lastName}?`,
      icon: 'warning',
      showCancelButton: true,
      confirmButtonText: 'Sí, eliminar',
      cancelButtonText: 'Cancelar',
      confirmButtonColor: '#d33',
      cancelButtonColor: '#3085d6',
      reverseButtons: true,
    }).then(result => {
      if (result.isConfirmed) {
        this.usersService.deleteUser(user.id).subscribe({
          next: () => {
            this.loadUsers()
            Swal.fire({
              title: 'Usuario eliminado',
              text: 'El usuario ha sido eliminado correctamente',
              icon: 'success',
              timer: 2000,
              showConfirmButton: false,
            })
          },
          error: error => {
            console.error('Error eliminando usuario:', error)
            Swal.fire('Error', 'No se pudo eliminar el usuario', 'error')
          },
        })
      }
    })
  }

  getStatusClass(isActive: boolean): string {
    return isActive ? 'bg-green-100 text-green-800' : 'bg-red-100 text-red-800'
  }
}
