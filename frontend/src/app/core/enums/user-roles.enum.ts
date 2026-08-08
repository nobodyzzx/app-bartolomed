export enum UserRoles {
  // Roles funcionales
  RECEPTIONIST = 'receptionist',
  PHARMACIST = 'pharmacist',
  NURSE = 'nurse',
  DOCTOR = 'doctor',
  LABORATORY = 'laboratory',
  /** Quien realiza los estudios especiales: ecografía, colonoscopia, ECG. */
  SPECIAL_STUDIES = 'special-studies',

  // Roles de administración
  ADMIN = 'admin',
  SUPER_ADMIN = 'super-admin',
}
