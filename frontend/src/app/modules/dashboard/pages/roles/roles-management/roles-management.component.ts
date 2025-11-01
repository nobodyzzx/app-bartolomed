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
import { AlertService } from '@core/services/alert.service'
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
    <div class="min-h-screen bg-slate-50 p-8">
      <div class="max-w-7xl mx-auto">
        <!-- Header -->
        <div class="flex items-center justify-between mb-10">
          <div>
            <h1 class="text-3xl md:text-4xl font-bold text-slate-900 mb-0.5">Gestión de Roles</h1>
            <p class="text-slate-600">Administra los roles y permisos del sistema</p>
          </div>
          <button
            mat-raised-button
            color="primary"
            (click)="openForm()"
            class="rounded-full h-10 px-5"
          >
            <span class="flex items-center gap-2">
              <mat-icon class="!text-[18px]">add</mat-icon>
              Nuevo Rol
            </span>
          </button>
        </div>

        <!-- Formulario -->
        <div *ngIf="isFormVisible" class="bg-white rounded-xl shadow-md p-6 mb-8">
          <div class="flex items-center gap-3 mb-6">
            <div
              class="w-10 h-10 rounded-full bg-blue-50 text-blue-600 flex items-center justify-center shadow-sm"
            >
              <mat-icon class="!text-[20px]">verified_user</mat-icon>
            </div>
            <h3 class="text-xl font-semibold text-slate-900 m-0">
              {{ editingRoleId ? 'Editar Rol' : 'Crear Rol' }}
            </h3>
          </div>

          <form [formGroup]="roleForm" (ngSubmit)="saveRole()" class="grid grid-cols-1 gap-4">
            <div class="grid grid-cols-1 md:grid-cols-2 gap-4">
              <mat-form-field appearance="outline">
                <mat-label>Nombre del Rol</mat-label>
                <input matInput formControlName="name" placeholder="Ej: Administrador" />
                <mat-icon matSuffix>badge</mat-icon>
                <mat-error *ngIf="roleForm.get('name')?.hasError('required')">
                  El nombre es obligatorio
                </mat-error>
                <mat-error *ngIf="roleForm.get('name')?.hasError('minlength')">
                  Mínimo 2 caracteres
                </mat-error>
              </mat-form-field>

              <mat-form-field appearance="outline">
                <mat-label>Descripción</mat-label>
                <input matInput formControlName="description" placeholder="Descripción del rol" />
                <mat-icon matSuffix>description</mat-icon>
              </mat-form-field>
            </div>

            <mat-form-field appearance="outline">
              <mat-label>Permisos (separados por coma)</mat-label>
              <textarea
                matInput
                formControlName="permissions"
                rows="3"
                placeholder="crear, editar, eliminar, ver"
              ></textarea>
              <mat-icon matSuffix>lock</mat-icon>
            </mat-form-field>

            <div class="flex justify-end gap-4 pt-2">
              <button
                mat-stroked-button
                type="button"
                (click)="cancel()"
                class="rounded-full h-10 px-5 bg-slate-50 text-slate-700 border-slate-300 hover:bg-slate-100"
              >
                Cancelar
              </button>
              <button
                mat-raised-button
                color="primary"
                type="submit"
                [disabled]="roleForm.invalid"
                class="rounded-full h-10 px-5"
              >
                <span class="flex items-center gap-2">
                  <mat-icon class="!text-[18px]">save</mat-icon>
                  Guardar
                </span>
              </button>
            </div>
          </form>
        </div>

        <!-- Tabla de Roles -->
        <div class="bg-white rounded-xl shadow-md overflow-hidden">
          <div class="p-6 border-b border-slate-200">
            <h2 class="text-xl font-bold text-slate-900">Roles del Sistema</h2>
          </div>

          <div *ngIf="isLoading" class="flex justify-center p-12">
            <mat-spinner diameter="50"></mat-spinner>
          </div>

          <div class="overflow-x-auto" *ngIf="!isLoading">
            <table mat-table [dataSource]="roles" class="w-full bg-transparent">
              <!-- Columna Nombre -->
              <ng-container matColumnDef="name">
                <th
                  mat-header-cell
                  *matHeaderCellDef
                  class="bg-slate-100 text-slate-800 font-semibold p-4 text-left"
                >
                  <div class="flex items-center gap-2">
                    <mat-icon class="text-blue-600 !text-[18px]">verified_user</mat-icon>
                    Rol
                  </div>
                </th>
                <td mat-cell *matCellDef="let role" class="p-4">
                  <div class="flex items-center gap-3">
                    <div
                      class="w-10 h-10 rounded-full bg-blue-100 flex items-center justify-center flex-shrink-0"
                    >
                      <mat-icon class="text-blue-600 !text-[20px]">verified_user</mat-icon>
                    </div>
                    <div>
                      <div class="font-medium text-slate-900">{{ role.name }}</div>
                      <div class="text-sm text-slate-600" *ngIf="role.description">
                        {{ role.description }}
                      </div>
                    </div>
                  </div>
                </td>
              </ng-container>

              <!-- Columna Permisos -->
              <ng-container matColumnDef="permissions">
                <th
                  mat-header-cell
                  *matHeaderCellDef
                  class="bg-slate-100 text-slate-800 font-semibold p-4 text-left"
                >
                  <div class="flex items-center gap-2">
                    <mat-icon class="text-blue-600 !text-[18px]">lock</mat-icon>
                    Permisos
                  </div>
                </th>
                <td mat-cell *matCellDef="let role" class="p-4">
                  <div class="flex flex-wrap gap-2">
                    <span
                      *ngFor="let permission of role.permissions?.slice(0, 3)"
                      class="inline-flex items-center px-2 py-1 rounded-full text-xs font-medium bg-purple-100 text-purple-800 border border-purple-200"
                    >
                      {{ permission }}
                    </span>
                    <span
                      *ngIf="role.permissions?.length > 3"
                      class="inline-flex items-center px-2 py-1 rounded-full text-xs font-medium bg-slate-100 text-slate-800"
                    >
                      +{{ role.permissions.length - 3 }} más
                    </span>
                  </div>
                </td>
              </ng-container>

              <!-- Columna Estado -->
              <ng-container matColumnDef="status">
                <th
                  mat-header-cell
                  *matHeaderCellDef
                  class="bg-slate-100 text-slate-800 font-semibold p-4 text-left"
                >
                  <div class="flex items-center gap-2">
                    <mat-icon class="text-blue-600 !text-[18px]">toggle_on</mat-icon>
                    Estado
                  </div>
                </th>
                <td mat-cell *matCellDef="let role" class="p-4">
                  <span
                    class="inline-flex items-center gap-2 px-3 py-1 rounded-full text-xs font-medium border"
                    [ngClass]="
                      role.isActive
                        ? 'bg-green-100 text-green-800 border-green-200'
                        : 'bg-red-100 text-red-800 border-red-200'
                    "
                  >
                    <span
                      class="w-2 h-2 rounded-full"
                      [ngClass]="role.isActive ? 'bg-green-500' : 'bg-red-500'"
                    ></span>
                    {{ role.isActive ? 'Activo' : 'Inactivo' }}
                  </span>
                </td>
              </ng-container>

              <!-- Columna Acciones -->
              <ng-container matColumnDef="actions">
                <th
                  mat-header-cell
                  *matHeaderCellDef
                  class="bg-slate-100 text-slate-800 font-semibold p-4 text-left"
                >
                  <div class="flex items-center gap-2">
                    <mat-icon class="text-blue-600 !text-[18px]">settings</mat-icon>
                    Acciones
                  </div>
                </th>
                <td mat-cell *matCellDef="let role" class="p-4">
                  <div class="flex gap-2 items-center">
                    <button
                      mat-icon-button
                      (click)="editRole(role)"
                      class="w-9 h-9 text-amber-600 hover:bg-amber-50 rounded-lg transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-offset-1 focus-visible:ring-amber-200"
                      matTooltip="Editar rol"
                      aria-label="Editar rol"
                    >
                      <mat-icon class="!text-[20px] leading-none">edit</mat-icon>
                    </button>
                    <button
                      mat-icon-button
                      (click)="deleteRole(role)"
                      class="w-9 h-9 text-red-600 hover:bg-red-50 rounded-lg transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-offset-1 focus-visible:ring-red-200"
                      matTooltip="Eliminar rol"
                      aria-label="Eliminar rol"
                    >
                      <mat-icon class="!text-[20px] leading-none">delete</mat-icon>
                    </button>
                  </div>
                </td>
              </ng-container>

              <tr
                mat-header-row
                *matHeaderRowDef="displayedColumns"
                class="border-b-2 border-slate-200"
              ></tr>
              <tr
                mat-row
                *matRowDef="let row; columns: displayedColumns"
                class="border-b border-slate-100 hover:bg-slate-50 transition-colors"
              ></tr>
            </table>
          </div>

          <!-- Estado vacío -->
          <div *ngIf="!isLoading && roles.length === 0" class="text-center py-12 px-6">
            <mat-icon class="text-6xl text-slate-400 mb-4">verified_user</mat-icon>
            <p class="text-slate-500 mb-4">No hay roles registrados aún</p>
            <button
              mat-raised-button
              color="primary"
              (click)="openForm()"
              class="rounded-full h-10 px-5"
            >
              <span class="flex items-center gap-2">
                <mat-icon class="!text-[18px]">add</mat-icon>
                Crear Primer Rol
              </span>
            </button>
          </div>
        </div>
      </div>
    </div>
  `,
  styles: [],
})
export class RolesManagementComponent implements OnInit {
  private rolesService = inject(RolesService)
  private notificationService = inject(NotificationService)
  private fb = inject(FormBuilder)
  private alert = inject(AlertService)

  roles: Role[] = []
  isLoading = false
  isFormVisible = false
  editingRoleId: string | null = null

  displayedColumns = ['name', 'permissions', 'status', 'actions']

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
    this.alert
      .fire({
        title: '¿Eliminar rol?',
        text: `¿Estás seguro de que deseas eliminar el rol "${role.name}"?`,
        icon: 'warning',
        showCancelButton: true,
        confirmButtonText: 'Sí, eliminar',
        cancelButtonText: 'Cancelar',
      })
      .then(result => {
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
