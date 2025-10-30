import { CommonModule } from '@angular/common'
import { Component, OnInit, inject } from '@angular/core'
import {
  FormBuilder,
  FormGroup,
  FormsModule,
  ReactiveFormsModule,
  Validators,
} from '@angular/forms'
import { MatButtonModule } from '@angular/material/button'
import { MatCardModule } from '@angular/material/card'
import { MatChipsModule } from '@angular/material/chips'
import { MatFormFieldModule } from '@angular/material/form-field'
import { MatIconModule } from '@angular/material/icon'
import { MatInputModule } from '@angular/material/input'
import { MatPaginatorModule } from '@angular/material/paginator'
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner'
import { MatTableModule } from '@angular/material/table'
import { MatTooltipModule } from '@angular/material/tooltip'
import Swal from 'sweetalert2'
import { NotificationService } from '../../../../../shared/services/notification.service'
import { Role, RolesService } from '../../../services/roles.service'

@Component({
  selector: 'app-roles-management',
  standalone: true,
  imports: [
    CommonModule,
    FormsModule,
    ReactiveFormsModule,
    MatButtonModule,
    MatCardModule,
    MatFormFieldModule,
    MatInputModule,
    MatTableModule,
    MatIconModule,
    MatChipsModule,
    MatPaginatorModule,
    MatProgressSpinnerModule,
    MatTooltipModule,
  ],
  template: `
    <div
      class="min-h-screen bg-gradient-to-br from-blue-50 via-slate-50 to-blue-100 relative overflow-hidden p-8"
    >
      <div class="absolute inset-0 overflow-hidden pointer-events-none">
        <div
          class="absolute top-0 right-0 w-96 h-96 bg-blue-200 rounded-full mix-blend-multiply filter blur-xl opacity-20 animate-blob"
        ></div>
        <div
          class="absolute top-0 left-0 w-96 h-96 bg-indigo-200 rounded-full mix-blend-multiply filter blur-xl opacity-20 animate-blob animation-delay-2000"
        ></div>
        <div
          class="absolute bottom-0 left-1/2 w-96 h-96 bg-slate-200 rounded-full mix-blend-multiply filter blur-xl opacity-20 animate-blob animation-delay-4000"
        ></div>
      </div>

      <div class="relative z-10 roles-management-container">
        <div class="mb-8 text-center">
          <h1 class="text-4xl font-bold text-blue-900 mb-2">Gestión de Roles</h1>
          <div class="w-20 h-1 bg-blue-600 mx-auto rounded-full mb-3"></div>
          <p class="text-blue-600">Crea y administra los roles del sistema</p>
        </div>

        <div class="flex justify-end mb-6">
          <button
            mat-flat-button
            color="primary"
            (click)="openForm()"
            class="h-12 px-6 font-medium"
          >
            <mat-icon class="mr-2">add</mat-icon>
            Nuevo Rol
          </button>
        </div>

        <mat-card
          *ngIf="isFormVisible"
          class="mb-8 p-6 backdrop-blur-sm border border-blue-100 rounded-2xl shadow-lg"
        >
          <mat-card-title class="mb-4 text-blue-900">{{
            editingRoleId ? 'Editar Rol' : 'Crear Rol'
          }}</mat-card-title>
          <form [formGroup]="roleForm" (ngSubmit)="saveRole()" class="grid grid-cols-1 gap-4">
            <mat-form-field class="w-full">
              <mat-label>Nombre del Rol</mat-label>
              <input matInput formControlName="name" required />
            </mat-form-field>

            <mat-form-field class="w-full">
              <mat-label>Descripción</mat-label>
              <textarea matInput formControlName="description" rows="3"></textarea>
            </mat-form-field>

            <mat-form-field class="w-full">
              <mat-label>Permisos (separados por coma)</mat-label>
              <textarea
                matInput
                formControlName="permissions"
                rows="3"
                placeholder="crear, editar, eliminar"
              ></textarea>
            </mat-form-field>

            <div class="flex gap-2">
              <button
                mat-flat-button
                color="primary"
                type="submit"
                [disabled]="roleForm.invalid"
                class="h-12 px-6 font-medium"
              >
                Guardar
              </button>
              <button mat-stroked-button type="button" (click)="cancel()" class="h-12 px-6">
                Cancelar
              </button>
            </div>
          </form>
        </mat-card>

        <mat-card class="p-0 rounded-2xl shadow-lg backdrop-blur-sm border border-blue-100">
          <div *ngIf="isLoading" class="flex justify-center p-6">
            <mat-spinner diameter="50"></mat-spinner>
          </div>

          <table mat-table [dataSource]="roles" *ngIf="!isLoading" class="w-full">
            <ng-container matColumnDef="name">
              <th mat-header-cell *matHeaderCellDef>Nombre</th>
              <td mat-cell *matCellDef="let role">
                <div class="flex items-center gap-3">
                  <div class="avatar-circle"><mat-icon>verified_user</mat-icon></div>
                  <div>
                    <div class="text-blue-900 font-medium">{{ role.name }}</div>
                    <small class="text-gray-600 block" *ngIf="role.description">{{
                      role.description
                    }}</small>
                  </div>
                </div>
              </td>
            </ng-container>

            <ng-container matColumnDef="description">
              <th mat-header-cell *matHeaderCellDef>Descripción</th>
              <td mat-cell *matCellDef="let role">{{ role.description || '-' }}</td>
            </ng-container>

            <ng-container matColumnDef="status">
              <th mat-header-cell *matHeaderCellDef>Estado</th>
              <td mat-cell *matCellDef="let role">
                <span
                  class="status-badge"
                  [ngClass]="role.isActive ? 'status-active-badge' : 'status-inactive-badge'"
                >
                  <span
                    class="status-dot"
                    [ngClass]="role.isActive ? 'dot-active' : 'dot-inactive'"
                  ></span>
                  {{ role.isActive ? 'Activo' : 'Inactivo' }}
                </span>
              </td>
            </ng-container>

            <ng-container matColumnDef="actions">
              <th mat-header-cell *matHeaderCellDef>Acciones</th>
              <td mat-cell *matCellDef="let role" class="flex gap-2">
                <button
                  mat-icon-button
                  (click)="editRole(role)"
                  class="text-blue-600 hover:bg-blue-100 rounded-lg"
                  matTooltip="Editar"
                >
                  <mat-icon>edit</mat-icon>
                </button>
                <button
                  mat-icon-button
                  (click)="deleteRole(role)"
                  class="text-red-600 hover:bg-red-100 rounded-lg"
                  matTooltip="Eliminar"
                >
                  <mat-icon>delete</mat-icon>
                </button>
              </td>
            </ng-container>

            <tr mat-header-row *matHeaderRowDef="displayedColumns"></tr>
            <tr
              mat-row
              *matRowDef="let row; columns: displayedColumns"
              class="hover:bg-blue-50 transition-all duration-200"
            ></tr>
          </table>
        </mat-card>
      </div>
    </div>
  `,
  styles: [
    `
      .roles-management-container {
        max-width: 1200px;
        margin: 0 auto;
      }
      table {
        width: 100%;
      }
      :host ::ng-deep th.mat-mdc-header-cell {
        background-color: #2563eb;
        color: #fff;
        font-weight: 600;
      }
      .avatar-circle {
        width: 36px;
        height: 36px;
        border-radius: 9999px;
        background-color: #e6f0ff;
        color: #2563eb;
        display: flex;
        align-items: center;
        justify-content: center;
      }
      .avatar-circle .mat-icon {
        font-size: 20px;
        width: 20px;
        height: 20px;
      }
      .status-badge {
        display: inline-flex;
        align-items: center;
        gap: 8px;
        padding: 6px 10px;
        border-radius: 9999px;
        font-weight: 500;
        font-size: 12px;
      }
      .status-active-badge {
        background-color: #e8f5e9;
        color: #2e7d32;
      }
      .status-inactive-badge {
        background-color: #ffebee;
        color: #c62828;
      }
      .status-dot {
        width: 8px;
        height: 8px;
        border-radius: 50%;
      }
      .dot-active {
        background-color: #2e7d32;
      }
      .dot-inactive {
        background-color: #e53935;
      }
      @keyframes blob {
        0%,
        100% {
          transform: translate(0, 0) scale(1);
        }
        33% {
          transform: translate(30px, -50px) scale(1.1);
        }
        66% {
          transform: translate(-20px, 20px) scale(0.9);
        }
      }
      .animate-blob {
        animation: blob 7s infinite;
      }
      .animation-delay-2000 {
        animation-delay: 2s;
      }
      .animation-delay-4000 {
        animation-delay: 4s;
      }
    `,
  ],
})
export class RolesManagementComponent implements OnInit {
  private rolesService = inject(RolesService)
  private notificationService = inject(NotificationService)
  private fb = inject(FormBuilder)

  roles: Role[] = []
  isLoading = false
  isFormVisible = false
  editingRoleId: string | null = null

  displayedColumns = ['name', 'description', 'status', 'actions']

  roleForm: FormGroup = this.fb.group({
    name: ['', [Validators.required, Validators.minLength(2)]],
    description: [''],
    permissions: [''],
  })

  ngOnInit(): void {
    this.loadRoles()
  }

  loadRoles(): void {
    this.isLoading = true
    this.rolesService.findAll(true).subscribe({
      next: (roles: Role[]) => {
        this.roles = roles
        this.isLoading = false
      },
      error: () => {
        this.notificationService.error('Error al cargar roles')
        this.isLoading = false
      },
    })
  }

  openForm(): void {
    this.isFormVisible = true
    this.editingRoleId = null
    this.roleForm.reset()
  }

  editRole(role: Role): void {
    this.isFormVisible = true
    this.editingRoleId = role.id
    this.roleForm.patchValue({
      name: role.name,
      description: role.description,
      permissions: role.permissions?.join(', ') || '',
    })
  }

  saveRole(): void {
    if (this.roleForm.invalid) return

    const formValue = this.roleForm.value
    const payload = {
      name: formValue.name,
      description: formValue.description || undefined,
      permissions: formValue.permissions
        ? formValue.permissions
            .split(',')
            .map((p: string) => p.trim())
            .filter((p: string) => p)
        : [],
    }

    if (this.editingRoleId) {
      this.rolesService.update(this.editingRoleId, payload).subscribe({
        next: () => {
          this.notificationService.success('Rol actualizado')
          this.loadRoles()
          this.isFormVisible = false
        },
        error: () => {
          this.notificationService.error('Error al actualizar rol')
        },
      })
    } else {
      this.rolesService.create(payload).subscribe({
        next: () => {
          this.notificationService.success('Rol creado')
          this.loadRoles()
          this.isFormVisible = false
        },
        error: (err: any) => {
          if (err.error?.message?.includes('duplicate')) {
            this.notificationService.error('El rol ya existe')
          } else {
            this.notificationService.error('Error al crear rol')
          }
        },
      })
    }
  }

  deleteRole(role: Role): void {
    Swal.fire({
      title: '¿Eliminar rol?',
      text: `¿Estás seguro de que deseas eliminar el rol "${role.name}"?`,
      icon: 'warning',
      showCancelButton: true,
      confirmButtonText: 'Sí, eliminar',
      cancelButtonText: 'Cancelar',
      confirmButtonColor: '#d33',
    }).then(result => {
      if (result.isConfirmed) {
        this.rolesService.delete(role.id).subscribe({
          next: () => {
            this.notificationService.success('Rol eliminado')
            this.loadRoles()
          },
          error: () => {
            this.notificationService.error('Error al eliminar rol')
          },
        })
      }
    })
  }

  cancel(): void {
    this.isFormVisible = false
    this.roleForm.reset()
  }
}
