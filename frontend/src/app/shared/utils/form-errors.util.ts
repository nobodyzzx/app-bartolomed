import { AbstractControl, FormGroup } from '@angular/forms'

/**
 * Cuenta los controles inválidos y touched de un FormGroup — usado para el badge de
 * errores en el header de cada tarjeta de sección. Solo cuenta controles de primer
 * nivel (no desciende a FormArray/FormGroup anidados) porque es lo que usan los
 * formularios del sistema hoy; si aparece un formulario con grupos anidados dentro
 * de una misma sección, extender acá.
 *
 * `fieldNames`: opcional — para formularios con un único FormGroup dividido en varias
 * tarjetas visuales de sección (a diferencia de patient-form, que usa un FormGroup por
 * sección), permite acotar el conteo a los controles de esa tarjeta puntual pasando sus
 * nombres. Sin este parámetro cuenta todos los controles de primer nivel del form, igual
 * que antes.
 */
export function countInvalidFields(form: FormGroup, fieldNames?: string[]): number {
  const controls: AbstractControl[] = fieldNames
    ? fieldNames.map(name => form.get(name)).filter((c): c is AbstractControl => !!c)
    : Object.values(form.controls)
  return controls.filter(c => c.invalid && c.touched).length
}

/**
 * Hace scroll + centra el primer campo inválido visible dentro de hostElement.
 * Se llama en requestAnimationFrame para esperar a que Angular termine de aplicar
 * las clases de estado (.mat-form-field-invalid) tras un markAllAsTouched().
 */
export function scrollToFirstInvalidField(hostElement: HTMLElement): void {
  requestAnimationFrame(() => {
    const invalid = hostElement.querySelector('.mat-form-field-invalid, .ng-invalid.ng-touched')
    if (invalid) {
      invalid.scrollIntoView({ behavior: 'smooth', block: 'center' })
    }
  })
}
