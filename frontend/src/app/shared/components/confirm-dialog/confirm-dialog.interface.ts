export interface ConfirmDialogData {
  title: string;
  message: string;
  confirmText: string;
  cancelText: string;
  isDestructive?: boolean;
  // Modo prompt: si se define inputLabel, el diálogo muestra un textarea y
  // onConfirm() cierra con { confirmed: true, value } en vez de `true`.
  inputLabel?: string;
  inputPlaceholder?: string;
  inputRequired?: boolean;
}

export interface ConfirmDialogPromptResult {
  confirmed: true;
  value: string;
}
