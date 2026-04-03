import { CommonModule } from '@angular/common'
import { Component, DestroyRef, OnInit, inject } from '@angular/core'
import { takeUntilDestroyed } from '@angular/core/rxjs-interop'
import {
  FormBuilder,
  FormControl,
  FormGroup,
  FormsModule,
  ReactiveFormsModule,
  Validators,
} from '@angular/forms'
import { COMMA, ENTER } from '@angular/cdk/keycodes'
import { MatAutocompleteModule, MatAutocompleteSelectedEvent } from '@angular/material/autocomplete'
import { MatButtonModule } from '@angular/material/button'
import { MatCardModule } from '@angular/material/card'
import { MatChipInputEvent, MatChipsModule } from '@angular/material/chips'
import { MatFormFieldModule } from '@angular/material/form-field'
import { MatIconModule } from '@angular/material/icon'
import { MatInputModule } from '@angular/material/input'
import { MatPaginatorModule } from '@angular/material/paginator'
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner'
import { MatTableModule } from '@angular/material/table'
import { MatTooltipModule } from '@angular/material/tooltip'
import { Observable } from 'rxjs'
import { map, startWith } from 'rxjs/operators'
import { AlertService } from '@core/services/alert.service'
import { PageHeaderComponent } from '../../../../../../shared/components/page-header/page-header.component'
import { SkeletonTableComponent } from '../../../../../../shared/components/skeleton-table/skeleton-table.component'
import { EmptyStateComponent } from '../../../../../../shared/components/empty-state/empty-state.component'
import { NotificationService } from '../../../../../../shared/services/notification.service'
import { Role, RolesService } from '../services/roles.service'

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
    MatAutocompleteModule,
    PageHeaderComponent,
    SkeletonTableComponent,
    EmptyStateComponent,
  ],
  template: `
    <div class="page-wrapper">
      <div class="page-inner">

        <app-page-header
          title="Gestión de Roles"
          subtitle="Administra los roles y permisos del sistema"
          [showBack]="false"
        >
          <ng-container actions>
            <button
              type="button"
              (click)="openForm()"
              class="inline-flex items-center gap-2 px-5 h-10 rounded-full font-medium bg-purple-600 text-white hover:bg-purple-700 shadow-md hover:shadow-lg transition-all border-0 text-sm"
            >
              <span class="material-symbols-outlined msz-18">add</span>
              Nuevo Rol
            </button>
          </ng-container>
        </app-page-header>

        <!-- Formulario -->
        <div *ngIf="isFormVisible" class="bg-white rounded-2xl shadow-sm border border-slate-200 overflow-hidden mb-6">
          <div class="flex items-center gap-4 px-6 py-4 bg-purple-50 border-b border-purple-100">
            <div class="w-10 h-10 rounded-full bg-purple-100 text-purple-600 flex items-center justify-center flex-shrink-0">
              <span class="material-symbols-outlined msz-20">verified_user</span>
            </div>
            <div>
              <h3 class="font-semibold text-slate-900 m-0 leading-tight">{{ editingRoleId ? 'Editar Rol' : 'Crear Nuevo Rol' }}</h3>
              <p class="text-sm text-slate-500 m-0">Complete los datos del rol</p>
            </div>
          </div>

          <form [formGroup]="roleForm" (ngSubmit)="saveRole()" class="p-6">
            <div class="grid grid-cols-1 md:grid-cols-2 gap-4 mb-4">
              <mat-form-field appearance="outline" class="w-full">
                <mat-label>Nombre del Rol</mat-label>
                <mat-icon matPrefix class="text-purple-400">badge</mat-icon>
                <input matInput formControlName="name" placeholder="Ej: Administrador" />
                <mat-error *ngIf="roleForm.get('name')?.hasError('required')">El nombre es obligatorio</mat-error>
                <mat-error *ngIf="roleForm.get('name')?.hasError('minlength')">Mínimo 2 caracteres</mat-error>
              </mat-form-field>

              <mat-form-field appearance="outline" class="w-full">
                <mat-label>Descripción</mat-label>
                <mat-icon matPrefix class="text-purple-400">notes</mat-icon>
                <input matInput formControlName="description" placeholder="Descripción del rol" />
              </mat-form-field>
            </div>

            <mat-form-field appearance="outline" class="w-full mb-4">
              <mat-label>Permisos</mat-label>
              <mat-icon matPrefix class="text-purple-400">lock</mat-icon>
              <mat-chip-grid #chipGrid>
                <mat-chip-row
                  *ngFor="let perm of selectedPermissions"
                  [removable]="true"
                  (removed)="removePermission(perm)"
                  class="!text-xs"
                  [ngClass]="getPermissionClass(perm)"
                >
                  {{ perm }}
                  <button matChipRemove>
                    <span class="material-symbols-outlined" style="font-size:14px">cancel</span>
                  </button>
                </mat-chip-row>
                <input
                  placeholder="Escribir o buscar permiso..."
                  [formControl]="permissionInput"
                  [matChipInputFor]="chipGrid"
                  [matChipInputSeparatorKeyCodes]="separatorKeysCodes"
                  [matAutocomplete]="permAuto"
                  (matChipInputTokenEnd)="addPermission($event)"
                />
              </mat-chip-grid>
              <mat-autocomplete #permAuto="matAutocomplete" (optionSelected)="selectPermission($event)">
                <mat-option *ngFor="let perm of filteredPermissions | async" [value]="perm">
                  <span class="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium mr-2"
                    [ngClass]="getPermissionClass(perm)">{{ perm }}</span>
                </mat-option>
              </mat-autocomplete>
              <mat-hint>Escribe un permiso y presiona Enter o coma para agregar</mat-hint>
            </mat-form-field>

            <div class="flex justify-end gap-3 pt-2 border-t border-slate-100">
              <button type="button" (click)="cancel()"
                class="inline-flex items-center gap-2 px-5 h-10 rounded-full font-medium text-slate-600 bg-slate-100 hover:bg-slate-200 transition-colors border-0 text-sm">
                <span class="material-symbols-outlined msz-18">close</span>
                Cancelar
              </button>
              <button type="submit" [disabled]="roleForm.invalid"
                class="inline-flex items-center gap-2 px-6 h-10 rounded-full font-medium bg-purple-600 text-white hover:bg-purple-700 shadow-md disabled:opacity-50 disabled:cursor-not-allowed transition-all border-0 text-sm">
                <span class="material-symbols-outlined msz-18">save</span>
                Guardar
              </button>
            </div>
          </form>
        </div>

        <!-- Tabla de Roles -->
        <div class="table-container">

          <div class="table-toolbar flex items-center justify-between">
            <span class="text-sm text-slate-600">
              <span class="font-semibold text-slate-800">{{ roles.length }}</span> roles registrados
            </span>
          </div>

          <app-skeleton-table *ngIf="isLoading" [rows]="5" [columns]="4" />

          <app-empty-state
            *ngIf="!isLoading && roles.length === 0"
            icon="verified_user"
            title="No hay roles registrados"
            subtitle="Crea el primer rol del sistema"
            actionLabel="Crear Primer Rol"
            (action)="openForm()"
          />

          <div class="overflow-x-auto" *ngIf="!isLoading && roles.length > 0">
            <table mat-table [dataSource]="roles" class="w-full bg-transparent">

              <ng-container matColumnDef="name">
                <th mat-header-cell *matHeaderCellDef class="bg-slate-100 px-6 py-4">
                  <span class="text-xs font-semibold text-slate-600 uppercase tracking-wide">Rol</span>
                </th>
                <td mat-cell *matCellDef="let role" class="px-6 py-4">
                  <div class="flex items-center gap-3">
                    <div class="w-9 h-9 rounded-full bg-purple-100 flex items-center justify-center flex-shrink-0">
                      <span class="material-symbols-outlined text-purple-600 msz-20">verified_user</span>
                    </div>
                    <div>
                      <div class="font-medium text-slate-900">{{ role.name }}</div>
                      <div class="text-xs text-slate-500" *ngIf="role.description">{{ role.description }}</div>
                    </div>
                  </div>
                </td>
              </ng-container>

              <ng-container matColumnDef="permissions">
                <th mat-header-cell *matHeaderCellDef class="bg-slate-100 px-6 py-4">
                  <span class="text-xs font-semibold text-slate-600 uppercase tracking-wide">Permisos</span>
                </th>
                <td mat-cell *matCellDef="let role" class="px-6 py-4">
                  <div class="flex flex-wrap gap-1.5">
                    <span *ngFor="let permission of role.permissions?.slice(0, 4)"
                      class="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium"
                      [ngClass]="getPermissionClass(permission)">
                      {{ permission }}
                    </span>
                    <span *ngIf="role.permissions?.length > 4"
                      class="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium bg-slate-100 text-slate-600 cursor-default"
                      [matTooltip]="role.permissions.slice(4).join(', ')"
                      matTooltipPosition="above">
                      +{{ role.permissions.length - 4 }} más
                    </span>
                  </div>
                </td>
              </ng-container>

              <ng-container matColumnDef="status">
                <th mat-header-cell *matHeaderCellDef class="bg-slate-100 px-6 py-4">
                  <span class="text-xs font-semibold text-slate-600 uppercase tracking-wide">Estado</span>
                </th>
                <td mat-cell *matCellDef="let role" class="px-6 py-4">
                  <button
                    type="button"
                    (click)="toggleRoleStatus(role)"
                    [matTooltip]="role.isActive ? 'Clic para desactivar' : 'Clic para activar'"
                    class="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium border-0 cursor-pointer transition-opacity hover:opacity-70"
                    [ngClass]="role.isActive ? 'bg-green-100 text-green-700' : 'bg-red-100 text-red-700'"
                  >
                    <span class="w-1.5 h-1.5 rounded-full" [ngClass]="role.isActive ? 'bg-green-500' : 'bg-red-500'"></span>
                    {{ role.isActive ? 'Activo' : 'Inactivo' }}
                  </button>
                </td>
              </ng-container>

              <ng-container matColumnDef="actions">
                <th mat-header-cell *matHeaderCellDef class="bg-slate-100 px-6 py-4 text-right">
                  <span class="text-xs font-semibold text-slate-600 uppercase tracking-wide">Acciones</span>
                </th>
                <td mat-cell *matCellDef="let role" class="px-6 py-4">
                  <div class="flex items-center justify-end gap-1">
                    <button type="button" (click)="editRole(role)" matTooltip="Editar rol"
                      class="inline-flex items-center justify-center w-9 h-9 rounded-lg text-slate-500 hover:bg-amber-50 hover:text-amber-600 transition-colors border-0">
                      <span class="material-symbols-outlined msz-18">edit</span>
                    </button>
                    <button type="button" (click)="deleteRole(role)" matTooltip="Eliminar rol"
                      class="inline-flex items-center justify-center w-9 h-9 rounded-lg text-slate-500 hover:bg-red-50 hover:text-red-600 transition-colors border-0">
                      <span class="material-symbols-outlined msz-18">delete</span>
                    </button>
                  </div>
                </td>
              </ng-container>

              <tr mat-header-row *matHeaderRowDef="displayedColumns" class="border-b border-slate-200"></tr>
              <tr mat-row *matRowDef="let row; columns: displayedColumns" class="table-row-hover"></tr>
            </table>
          </div>

        </div>

      </div>
    </div>
  `,
  styles: [],
})
export class RolesManagementComponent implements OnInit {
  private readonly destroyRef = inject(DestroyRef)
  private rolesService = inject(RolesService)
  private notificationService = inject(NotificationService)
  private fb = inject(FormBuilder)
  private alert = inject(AlertService)

  roles: Role[] = []
  isLoading = false
  isFormVisible = false
  editingRoleId: string | null = null

  displayedColumns = ['name', 'permissions', 'status', 'actions']

  selectedPermissions: string[] = []
  permissionInput = new FormControl('')
  separatorKeysCodes: number[] = [ENTER, COMMA]
  filteredPermissions!: Observable<string[]>

  roleForm: FormGroup = this.fb.group({
    name: ['', [Validators.required, Validators.minLength(2)]],
    description: [''],
  })

  ngOnInit(): void {
    this.loadRoles()
    this.filteredPermissions = this.permissionInput.valueChanges.pipe(
      startWith(''),
      map(value => this.filterPermissions(value ?? '')),
    )
  }

  get allKnownPermissions(): string[] {
    const perms = new Set<string>()
    this.roles.forEach(r => r.permissions?.forEach(p => perms.add(p)))
    return Array.from(perms).sort()
  }

  filterPermissions(value: string): string[] {
    const filter = value.toLowerCase()
    return this.allKnownPermissions
      .filter(p => !this.selectedPermissions.includes(p))
      .filter(p => p.toLowerCase().includes(filter))
  }

  addPermission(event: MatChipInputEvent): void {
    const value = (event.value ?? '').trim()
    if (value && !this.selectedPermissions.includes(value)) {
      this.selectedPermissions.push(value)
    }
    event.chipInput!.clear()
    this.permissionInput.setValue('')
  }

  removePermission(perm: string): void {
    this.selectedPermissions = this.selectedPermissions.filter(p => p !== perm)
    this.permissionInput.updateValueAndValidity()
  }

  selectPermission(event: MatAutocompleteSelectedEvent): void {
    if (!this.selectedPermissions.includes(event.option.value)) {
      this.selectedPermissions.push(event.option.value)
    }
    this.permissionInput.setValue('')
    event.option.deselect()
  }

  loadRoles(): void {
    this.isLoading = true
    this.rolesService.findAll(true).pipe(takeUntilDestroyed(this.destroyRef)).subscribe({
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
    this.selectedPermissions = []
    this.permissionInput.setValue('')
    this.roleForm.reset()
  }

  editRole(role: Role): void {
    this.isFormVisible = true
    this.editingRoleId = role.id
    this.selectedPermissions = role.permissions ? [...role.permissions] : []
    this.permissionInput.setValue('')
    this.roleForm.patchValue({
      name: role.name,
      description: role.description,
    })
  }

  saveRole(): void {
    if (this.roleForm.invalid) return

    const formValue = this.roleForm.value
    const payload = {
      name: formValue.name,
      description: formValue.description || undefined,
      permissions: this.selectedPermissions,
    }

    if (this.editingRoleId) {
      this.rolesService.update(this.editingRoleId, payload).pipe(takeUntilDestroyed(this.destroyRef)).subscribe({
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
      this.rolesService.create(payload).pipe(takeUntilDestroyed(this.destroyRef)).subscribe({
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
          this.rolesService.delete(role.id).pipe(takeUntilDestroyed(this.destroyRef)).subscribe({
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

  toggleRoleStatus(role: Role): void {
    const action = role.isActive ? 'desactivar' : 'activar'
    this.alert
      .fire({
        title: `¿${action.charAt(0).toUpperCase() + action.slice(1)} rol?`,
        text: `¿Deseas ${action} el rol "${role.name}"?`,
        icon: 'question',
        showCancelButton: true,
        confirmButtonText: `Sí, ${action}`,
        cancelButtonText: 'Cancelar',
        reverseButtons: true,
      })
      .then(result => {
        if (result.isConfirmed) {
          this.rolesService.update(role.id, { isActive: !role.isActive }).pipe(takeUntilDestroyed(this.destroyRef)).subscribe({
            next: () => {
              this.notificationService.success(`Rol ${role.isActive ? 'desactivado' : 'activado'}`)
              this.loadRoles()
            },
            error: () => this.notificationService.error(`Error al ${action} el rol`),
          })
        }
      })
  }

  getPermissionClass(permission: string): string {
    const p = permission.toLowerCase()
    if (p.startsWith('ver') || p.startsWith('read') || p.startsWith('list') || p.includes('_ver'))
      return 'bg-blue-100 text-blue-700'
    if (p.startsWith('crear') || p.startsWith('create') || p.includes('_crear'))
      return 'bg-green-100 text-green-700'
    if (p.startsWith('editar') || p.startsWith('edit') || p.startsWith('update') || p.includes('_editar'))
      return 'bg-amber-100 text-amber-700'
    if (p.startsWith('eliminar') || p.startsWith('delete') || p.startsWith('remove') || p.includes('_eliminar'))
      return 'bg-red-100 text-red-700'
    if (p.startsWith('gestionar') || p.startsWith('manage') || p.includes('_gestionar'))
      return 'bg-purple-100 text-purple-700'
    return 'bg-slate-100 text-slate-600'
  }

  cancel(): void {
    this.isFormVisible = false
    this.selectedPermissions = []
    this.permissionInput.setValue('')
    this.roleForm.reset()
  }
}
