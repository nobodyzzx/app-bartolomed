import { Component, OnInit } from '@angular/core'
import { Router } from '@angular/router'
import { AlertService } from '@core/services/alert.service'
import { ErrorService } from '../../../../../shared/components/services/error.service'
import { User } from '../../../../auth/interfaces/user.interface'
import { UsersService } from '../users.service'

interface UserStatistics {
  totalUsers: number
  activeUsers: number
  inactiveUsers: number
  usersByRole: { [key: string]: number }
  recentRegistrations: number
}

@Component({
  selector: 'app-user-management',
  templateUrl: './user-management.component.html',
  styleUrl: './user-management.component.css',
})
export class UserManagementComponent implements OnInit {
  readonly Object = Object
  statistics: UserStatistics | null = null
  recentUsers: User[] = []
  isLoading = false
  searchTerm = ''

  constructor(
    private usersService: UsersService,
    private router: Router,
    private errorService: ErrorService,
    private alert: AlertService,
  ) {}

  ngOnInit(): void {
    this.loadRecentUsers()
  }

  loadRecentUsers() {
    this.isLoading = true
    this.usersService.getUsers().subscribe({
      next: users => {
        // Obtener los 5 usuarios más recientes
        this.recentUsers = users
          .sort((a, b) => {
            const dateA = a.startDate ? new Date(a.startDate).getTime() : 0
            const dateB = b.startDate ? new Date(b.startDate).getTime() : 0
            return dateB - dateA
          })
          .slice(0, 5)

        // Calcular estadísticas
        this.calculateStatistics(users)
        this.isLoading = false
      },
      error: error => {
        this.errorService.handleError(error)
        this.isLoading = false
      },
    })
  }

  calculateStatistics(users: User[]) {
    const activeUsers = users.filter(u => u.isActive).length
    const inactiveUsers = users.filter(u => !u.isActive).length

    // Contar usuarios por rol
    const usersByRole: { [key: string]: number } = {}
    users.forEach(user => {
      user.roles.forEach(role => {
        usersByRole[role] = (usersByRole[role] || 0) + 1
      })
    })

    // Usuarios registrados en el último mes
    const lastMonth = new Date()
    lastMonth.setMonth(lastMonth.getMonth() - 1)
    const recentRegistrations = users.filter(
      u => u.startDate && new Date(u.startDate) >= lastMonth,
    ).length

    this.statistics = {
      totalUsers: users.length,
      activeUsers,
      inactiveUsers,
      usersByRole,
      recentRegistrations,
    }
  }

  getUserFullName(user: User): string {
    if (user.personalInfo) {
      return `${user.personalInfo.firstName} ${user.personalInfo.lastName}`
    }
    return user.email
  }

  getUserInitials(user: User): string {
    const first = user.personalInfo?.firstName?.charAt(0) ?? ''
    const last  = user.personalInfo?.lastName?.charAt(0) ?? ''
    return (first + last).toUpperCase() || user.email?.charAt(0).toUpperCase() || '?'
  }

  getUserRole(user: User): string {
    if (!user.roles || user.roles.length === 0) return 'Sin rol'

    const roleMap: { [key: string]: string } = {
      admin: 'Administrador',
      doctor: 'Doctor',
      nurse: 'Enfermero/a',
      receptionist: 'Recepcionista',
      user: 'Usuario',
    }

    return roleMap[user.roles[0]] || user.roles[0]
  }

  navigateToNewUser() {
    this.router.navigate(['/dashboard/users/register'])
  }

  navigateToUsersList() {
    this.router.navigate(['/dashboard/users/list'])
  }

  viewUser(user: User) {
    // Navegar a vista de detalles cuando esté implementada
    this.router.navigate(['/dashboard/users/list'])
  }

  editUser(user: User) {
    this.router.navigate(['/dashboard/users/edit', user.id])
  }

  searchUsers() {
    if (!this.searchTerm.trim()) {
      return
    }
    this.router.navigate(['/dashboard/users/list'], {
      queryParams: { search: this.searchTerm },
    })
  }

  openSearch() {
    this.router.navigate(['/dashboard/users/list'])
  }
}
