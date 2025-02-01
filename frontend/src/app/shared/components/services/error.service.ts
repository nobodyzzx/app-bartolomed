import { Injectable } from '@angular/core';
import Swal from 'sweetalert2';
import { ErrorResponse } from '../../models/error.interface';

@Injectable({
  providedIn: 'root',
})
export class ErrorService {
  private readonly ERROR_MESSAGES = {
    COMMON: {
      DUPLICATE_EMAIL: 'Este correo electrónico ya está registrado',
      DUPLICATE_LICENSE: 'Este número de licencia ya está registrado',
      INVALID_CREDENTIALS: 'Credenciales incorrectas',
      EXPIRED_TOKEN: 'Su sesión ha expirado',
      USER_NOT_FOUND: 'Usuario no encontrado',
      INVALID_PASSWORD: 'La contraseña debe tener al menos 6 caracteres',
      REQUIRED_FIELDS: 'Por favor complete todos los campos requeridos',
      SERVER_ERROR: 'Error interno del servidor. Por favor, inténtelo más tarde',
      CONNECTION_ERROR: 'No se pudo conectar con el servidor. Verifique su conexión a internet',
      DEFAULT: 'Se produjo un error inesperado. Por favor, inténtelo nuevamente',
      INSUFFICIENT_PERMISSIONS: 'No tiene permisos suficientes para realizar esta acción',
      BAD_REQUEST: 'Error en la solicitud',
      DUPLICATE_FIELD: (field: string) => `El ${field} ya está registrado`
    },
    TITLES: {
      400: 'Error de Validación',
      401: 'Error de Autenticación',
      403: 'Error de Permisos',
      404: 'No Encontrado',
      500: 'Error del Servidor',
      0: 'Error de Conexión',
      DEFAULT: 'Error',
    }
  } as const;

  private getErrorTitle(statusCode: number): string {
    return this.ERROR_MESSAGES.TITLES[statusCode as keyof typeof this.ERROR_MESSAGES.TITLES] || 
           this.ERROR_MESSAGES.TITLES.DEFAULT;
  }

  handleError(error: any): void {
    console.error('Error original:', error);
    const errorMessage = this.getErrorMessage(error);
    const errorTitle = this.getErrorTitle(error.status || 0);
    
    this.showErrorAlert(errorTitle, errorMessage);
  }

  private showErrorAlert(title: string, message: string): void {
    Swal.fire({
  icon: 'error',
  title: title,
  html: `<div style="
      font-size: 16px; 
      color: #333; 
      text-align: center;
      padding: 10px;
  ">${message}</div>`,
  confirmButtonText: 'Aceptar',
  confirmButtonColor: '#3085d6',
  background: 'rgba(255, 255, 255, 0.95)',
  showClass: {
    popup: 'animate__animated animate__fadeInDown animate__faster'
  },
  hideClass: {
    popup: 'animate__animated animate__fadeOutUp animate__faster'
  },
  didOpen: () => {
    const popup = document.querySelector('.swal2-popup') as HTMLElement;
    if (popup) {
      popup.style.borderRadius = '12px';
      popup.style.padding = '20px';
      popup.style.boxShadow = '0px 4px 15px rgba(0, 0, 0, 0.2)';
    }

    const title = document.querySelector('.swal2-title') as HTMLElement;
    if (title) {
      title.style.fontSize = '20px';
      title.style.fontWeight = 'bold';
      title.style.color = '#d9534f';
    }

    const button = document.querySelector('.swal2-confirm') as HTMLElement;
    if (button) {
      button.style.fontSize = '16px';
      button.style.fontWeight = 'bold';
      button.style.padding = '10px 20px';
      button.style.borderRadius = '8px';
      button.style.transition = 'background 0.3s ease';
      button.onmouseover = () => button.style.background = '#2563eb';
      button.onmouseleave = () => button.style.background = '#3085d6';
    }
  }
});

    
  }

  private getErrorMessage(error: any): string {
    if (this.isNetworkError(error)) {
      return this.ERROR_MESSAGES.COMMON.CONNECTION_ERROR;
    }
    
    if (this.isBackendError(error)) {
      return this.handleBackendError(error.error);
    }

    return this.handleHttpError(error);
  }

  private isNetworkError(error: any): boolean {
    return error.status === 0;
  }

  private isBackendError(error: any): boolean {
    return error.error && this.isErrorResponse(error.error);
  }

  private isErrorResponse(error: any): error is ErrorResponse {
    return 'statusCode' in error && 'message' in error && 'error' in error;
  }

  private handleBackendError(error: ErrorResponse): string {
    if (Array.isArray(error.message)) {
      return error.message.join('\n');
    }
    return error.message || this.ERROR_MESSAGES.COMMON.DEFAULT;
  }

  private handleHttpError(error: any): string {
    switch (error.status) {
      case 400:
        return this.handleBadRequest(error.error);
      case 401:
        return this.handleUnauthorizedError(error.error);
      case 403:
        return this.ERROR_MESSAGES.COMMON.INSUFFICIENT_PERMISSIONS;
      case 404:
        return this.ERROR_MESSAGES.COMMON.USER_NOT_FOUND;
      case 500:
        return this.ERROR_MESSAGES.COMMON.SERVER_ERROR;
      default:
        return error.message || this.ERROR_MESSAGES.COMMON.DEFAULT;
    }
  }

  private handleUnauthorizedError(error: any): string {
    return error?.message === 'Token expired' 
      ? this.ERROR_MESSAGES.COMMON.EXPIRED_TOKEN 
      : this.ERROR_MESSAGES.COMMON.INVALID_CREDENTIALS;
  }

  private handleBadRequest(error: any): string {
    if (!error) return this.ERROR_MESSAGES.COMMON.BAD_REQUEST;

    const errorMessage = error.message?.toString() || '';
    
    if (errorMessage.includes('already exists') || 
        errorMessage.includes('duplicate key') ||
        errorMessage.includes('duplicado')) {
      return this.handleDuplicateError(errorMessage);
    }
    
    if (errorMessage.includes('invalid credentials')) {
      return this.ERROR_MESSAGES.COMMON.INVALID_CREDENTIALS;
    }

    if (errorMessage.includes('password')) {
      return this.ERROR_MESSAGES.COMMON.INVALID_PASSWORD;
    }

    if (errorMessage.includes('required')) {
      return this.ERROR_MESSAGES.COMMON.REQUIRED_FIELDS;
    }

    return error.message || this.ERROR_MESSAGES.COMMON.BAD_REQUEST;
  }

  private handleDuplicateError(message: string): string {
    const lowerMessage = message.toLowerCase();
    const fieldMatch = message.match(/\((\w+)\)/);
    const detectedField = fieldMatch ? fieldMatch[1] : null;

    // Casos específicos primero
    if (lowerMessage.includes('email')) return this.ERROR_MESSAGES.COMMON.DUPLICATE_EMAIL;
    if (lowerMessage.includes('license')) return this.ERROR_MESSAGES.COMMON.DUPLICATE_LICENSE;

    // Caso genérico con campo detectado
    if (detectedField) {
      return this.ERROR_MESSAGES.COMMON.DUPLICATE_FIELD(detectedField);
    }

    // Último recurso: mensaje genérico
    return this.ERROR_MESSAGES.COMMON.BAD_REQUEST;
  }
}