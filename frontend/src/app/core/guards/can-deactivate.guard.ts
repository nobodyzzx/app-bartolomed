import { CanDeactivateFn } from '@angular/router'
import { AlertService } from '../services/alert.service'

/**
 * Contrato que cualquier componente que quiera proteger su navegación debe
 * implementar. Devuelve `true` cuando es seguro abandonar la vista (formulario
 * limpio o ya enviado) o `false` para mantener al usuario en la página.
 *
 * Devolver una Promise/Observable es válido si la decisión requiere I/O o
 * confirmación asíncrona; el guard espera el resultado.
 */
export interface CanComponentDeactivate {
  /** True → permitir salir. False → bloquear la navegación. */
  canDeactivate: () => boolean | Promise<boolean>
}

/**
 * Guard que delega al componente. Si el componente no implementa
 * `canDeactivate`, se permite salir (compat hacia atrás con vistas que no
 * necesitan protección).
 *
 * Patrón recomendado en el componente:
 *
 *   async canDeactivate(): Promise<boolean> {
 *     if (this.form.pristine || this.allowNavigationOnce) return true
 *     return confirmDiscardChanges(this.alert)
 *   }
 */
export const canDeactivateGuard: CanDeactivateFn<CanComponentDeactivate> = component => {
  if (!component?.canDeactivate) return true
  return component.canDeactivate()
}

/**
 * Helper compartido para que distintos formularios usen el mismo diálogo de
 * confirmación al descartar cambios. Devuelve true si el usuario confirma.
 *
 * Usa `AlertService.fire` con `showCancelButton`, que internamente abre el
 * `ConfirmDialogComponent` basado en MatDialog (consistente con el resto de
 * confirmaciones del sistema).
 */
export async function confirmDiscardChanges(alert: AlertService): Promise<boolean> {
  const result = await alert.fire({
    icon: 'warning',
    title: '¿Salir sin guardar?',
    text: 'Tienes cambios sin guardar. Se perderán si abandonas esta página.',
    showCancelButton: true,
    confirmButtonText: 'Salir sin guardar',
    cancelButtonText: 'Continuar editando',
  })
  return !!result?.isConfirmed
}
