import { Component, inject } from '@angular/core'
import { MatDialogRef } from '@angular/material/dialog'
import { UserRoles } from '@core/enums/user-roles.enum'

interface RoleOption {
  value: UserRoles
  label: string
  icon: string
  selected: boolean
}

@Component({
  selector: 'app-role-simulator-dialog',
  templateUrl: './role-simulator-dialog.component.html',
  styleUrls: ['./role-simulator-dialog.component.scss'],
})
export class RoleSimulatorDialogComponent {
  private dialogRef = inject(MatDialogRef<RoleSimulatorDialogComponent>)

  roleOptions: RoleOption[] = [
    {
      value: UserRoles.RECEPTIONIST,
      label: 'Recepcionista',
      icon: 'person',
      selected: false,
    },
    {
      value: UserRoles.NURSE,
      label: 'Enfermera/o',
      icon: 'health_and_safety',
      selected: false,
    },
    {
      value: UserRoles.DOCTOR,
      label: 'Doctor/a',
      icon: 'monitor_heart',
      selected: false,
    },
    {
      value: UserRoles.PHARMACIST,
      label: 'Farmacéutico/a',
      icon: 'medication',
      selected: false,
    },
    {
      value: UserRoles.ADMIN,
      label: 'Administrador',
      icon: 'security',
      selected: false,
    },
    {
      value: UserRoles.SUPER_ADMIN,
      label: 'Super Administrador',
      icon: 'stars',
      selected: false,
    },
  ]

  get selectedRoles(): UserRoles[] {
    return this.roleOptions.filter(r => r.selected).map(r => r.value)
  }

  get hasSelection(): boolean {
    return this.selectedRoles.length > 0
  }

  onCancel(): void {
    this.dialogRef.close()
  }

  onApply(): void {
    if (this.hasSelection) {
      this.dialogRef.close(this.selectedRoles)
    }
  }

  toggleRole(role: RoleOption): void {
    role.selected = !role.selected
  }

  selectPreset(preset: 'doctor-pharma' | 'doctor-reception' | 'full-medical'): void {
    // Resetear todas
    this.roleOptions.forEach(r => (r.selected = false))

    // Aplicar preset
    switch (preset) {
      case 'doctor-pharma':
        this.setRoles([UserRoles.DOCTOR, UserRoles.PHARMACIST])
        break
      case 'doctor-reception':
        this.setRoles([UserRoles.DOCTOR, UserRoles.RECEPTIONIST])
        break
      case 'full-medical':
        this.setRoles([
          UserRoles.DOCTOR,
          UserRoles.NURSE,
          UserRoles.RECEPTIONIST,
          UserRoles.PHARMACIST,
        ])
        break
    }
  }

  private setRoles(roles: UserRoles[]): void {
    this.roleOptions.forEach(opt => {
      opt.selected = roles.includes(opt.value)
    })
  }
}
