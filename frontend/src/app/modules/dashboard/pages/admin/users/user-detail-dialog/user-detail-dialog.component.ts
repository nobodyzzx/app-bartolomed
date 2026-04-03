import { Component, Inject } from '@angular/core'
import { MAT_DIALOG_DATA, MatDialogRef } from '@angular/material/dialog'
import { User } from '../../../../../auth/interfaces'

@Component({
  selector: 'app-user-detail-dialog',
  templateUrl: './user-detail-dialog.component.html',
})
export class UserDetailDialogComponent {
  readonly roleColors: Record<string, string> = {
    super_admin: 'bg-purple-100 text-purple-800',
    admin: 'bg-red-100 text-red-800',
    doctor: 'bg-blue-100 text-blue-800',
    nurse: 'bg-green-100 text-green-800',
    receptionist: 'bg-amber-100 text-amber-800',
    pharmacist: 'bg-teal-100 text-teal-800',
    user: 'bg-slate-100 text-slate-700',
  }

  constructor(
    public dialogRef: MatDialogRef<UserDetailDialogComponent>,
    @Inject(MAT_DIALOG_DATA) public user: User,
  ) {}

  get initials(): string {
    const f = this.user.personalInfo?.firstName?.charAt(0) ?? '?'
    const l = this.user.personalInfo?.lastName?.charAt(0) ?? ''
    return (f + l).toUpperCase()
  }

  get fullName(): string {
    const f = this.user.personalInfo?.firstName ?? ''
    const l = this.user.personalInfo?.lastName ?? ''
    return `${f} ${l}`.trim() || 'Sin nombre'
  }

  getRoleClass(role: string): string {
    return this.roleColors[role.toLowerCase()] ?? 'bg-blue-100 text-blue-800'
  }
}
