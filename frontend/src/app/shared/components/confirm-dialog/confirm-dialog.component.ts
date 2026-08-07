import { Component, Inject } from '@angular/core';
import { MAT_DIALOG_DATA, MatDialogRef } from '@angular/material/dialog';
import { ConfirmDialogData } from './confirm-dialog.interface';

@Component({
    selector: 'app-confirm-dialog',
    templateUrl: './confirm-dialog.component.html',
    styleUrl: './confirm-dialog.component.css',
    standalone: false
})
export class ConfirmDialogComponent {
  inputValue = '';
  inputError = '';

  constructor(
    public dialogRef: MatDialogRef<ConfirmDialogComponent>,
    @Inject(MAT_DIALOG_DATA) public data: ConfirmDialogData
  ) { }

  onCancel(): void {
    this.dialogRef.close(false);
  }

  onConfirm(): void {
    if (!this.data.inputLabel) {
      this.dialogRef.close(true);
      return;
    }

    const value = this.inputValue.trim();
    if (this.data.inputRequired && !value) {
      this.inputError = 'Este campo es requerido';
      return;
    }
    this.dialogRef.close({ confirmed: true, value });
  }
}
