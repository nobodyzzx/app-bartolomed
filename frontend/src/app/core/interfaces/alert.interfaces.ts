export type AlertIcon = 'success' | 'error' | 'warning' | 'info' | 'question'

export interface AlertOptions {
  title?: string
  text?: string
  html?: string
  icon?: AlertIcon
  showCancelButton?: boolean
  confirmButtonText?: string
  cancelButtonText?: string
  isDestructive?: boolean
  reverseButtons?: boolean
  timer?: number
  showConfirmButton?: boolean
  toast?: boolean
  input?: 'text' | 'textarea' | 'email' | 'password' | 'number' | 'select' | 'radio' | 'checkbox' | 'file' | 'range'
  inputPlaceholder?: string
  showDenyButton?: boolean
  denyButtonText?: string
  confirmButtonColor?: string
  position?: 'top' | 'top-start' | 'top-end' | 'center' | 'center-start' | 'center-end' | 'bottom' | 'bottom-start' | 'bottom-end'
  timerProgressBar?: boolean
  allowOutsideClick?: boolean
  inputLabel?: string
  inputValidator?: (value: string) => string | null | Promise<string | null>
}

export interface AlertResult {
  isConfirmed: boolean
  isDenied?: boolean
  isDismissed?: boolean
  value?: string
}
