/**
 * Roles válidos del sistema.
 *
 * > **Duplicado de `src/auth/interfaces/valid-roles.enum.ts`.** Los dos enums
 * > tienen que coincidir valor por valor: `auth` gobierna los guards y este
 * > gobierna la validación de los DTO de usuarios (`@IsEnum`) y el seed. Al
 * > agregar un rol hay que tocarlos **los dos** — con el rol de estudios
 * > especiales solo se actualizó `auth`, y crear el usuario fallaba con
 * > "must be one of the following values" sin más pista.
 * >
 * > Unificarlos es la solución de fondo; mientras tanto, este aviso.
 */
export enum ValidRoles {
  SUPER_ADMIN = 'super-admin',
  ADMIN = 'admin',
  DOCTOR = 'doctor',
  NURSE = 'nurse',
  RECEPTIONIST = 'receptionist',
  PHARMACIST = 'pharmacist',
  LABORATORY = 'laboratory',
  SPECIAL_STUDIES = 'special-studies',
}
