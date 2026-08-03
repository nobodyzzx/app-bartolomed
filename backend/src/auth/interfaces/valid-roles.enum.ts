export enum ValidRoles {
  SUPER_ADMIN = 'super-admin',
  ADMIN = 'admin',
  DOCTOR = 'doctor',
  NURSE = 'nurse',
  RECEPTIONIST = 'receptionist',
  PHARMACIST = 'pharmacist',
  // Preparado para el futuro módulo de laboratorio (sin fecha, fuera de
  // alcance por ahora) — sin permisos ni pantalla asignados todavía, ver
  // role-permissions.map.ts.
  LABORATORY = 'laboratory',
  USER = 'user',
}
