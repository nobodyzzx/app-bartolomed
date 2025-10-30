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
    <div class="roles-management-container p-6">
      <div class="mb-6">
        <h1 class="text-3xl font-bold text-blue-900 mb-2">Gestión de Roles</h1>
        <p class="text-blue-600">Crea y administra los roles del sistema</p>
      </div>

      <button mat-raised-button color="primary" (click)="openForm()" class="mb-6">
        <mat-icon class="mr-2">add</mat-icon>
        Nuevo Rol
      </button>

      <mat-card *ngIf="isFormVisible" class="mb-6 p-6">
        <mat-card-title class="mb-4">{{
          editingRoleId ? 'Editar Rol' : 'Crear Rol'
        }}</mat-card-title>
        <form [formGroup]="roleForm" (ngSubmit)="saveRole()" class="space-y-4">
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
            <button mat-raised-button color="primary" type="submit" [disabled]="roleForm.invalid">
              Guardar
            </button>
            <button mat-raised-button type="button" (click)="cancel()">Cancelar</button>
          </div>
        </form>
      </mat-card>

      <mat-card class="p-0">
        <div *ngIf="isLoading" class="flex justify-center p-6">
          <mat-spinner diameter="50"></mat-spinner>
        </div>

        <table mat-table [dataSource]="roles" *ngIf="!isLoading" class="w-full">
          <ng-container matColumnDef="name">
            <th mat-header-cell *matHeaderCellDef>Nombre</th>
            <td mat-cell *matCellDef="let role">{{ role.name }}</td>
          </ng-container>

          <ng-container matColumnDef="description">
            <th mat-header-cell *matHeaderCellDef>Descripción</th>
            <td mat-cell *matCellDef="let role">{{ role.description || '-' }}</td>
          </ng-container>

          <ng-container matColumnDef="status">
            <th mat-header-cell *matHeaderCellDef>Estado</th>
            <td mat-cell *matCellDef="let role">
              <span
                [class]="role.isActive ? 'bg-green-100 text-green-800' : 'bg-red-100 text-red-800'"
                class="px-3 py-1 rounded-full text-sm"
              >
                {{ role.isActive ? 'Activo' : 'Inactivo' }}
              </span>
            </td>
          </ng-container>

          <ng-container matColumnDef="actions">
            <th mat-header-cell *matHeaderCellDef>Acciones</th>
            <td mat-cell *matCellDef="let role" class="flex gap-2">
              <button mat-icon-button color="primary" (click)="editRole(role)" matTooltip="Editar">
                <mat-icon>edit</mat-icon>
              </button>
              <button mat-icon-button color="warn" (click)="deleteRole(role)" matTooltip="Eliminar">
                <mat-icon>delete</mat-icon>
              </button>
            </td>
          </ng-container>

          <tr mat-header-row *matHeaderRowDef="displayedColumns" class="bg-blue-50"></tr>
          <tr mat-row *matRowDef="let row; columns: displayedColumns"></tr>
        </table>
      </mat-card>
    </div>
  `,
  styles: [
    `
      .roles-management-container {
        max-width: 1200px;
        margin: 0 auto;
      }
      mat-card {
        box-shadow: 0 2px 8px rgba(0, 0, 0, 0.1);
      }
      table {
        width: 100%;
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
