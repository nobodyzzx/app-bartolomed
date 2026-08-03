export enum UserRoles {
  // Roles funcionales
  RECEPTIONIST = 'receptionist',
  PHARMACIST = 'pharmacist',
  NURSE = 'nurse',
  DOCTOR = 'doctor',
  // Preparado para el futuro módulo de laboratorio (sin fecha, fuera de
  // alcance por ahora) — sin permisos ni pantalla asignados todavía, ver
  // role-permissions.map.ts. No se ofrece en assignable-roles.ts.
  LABORATORY = 'laboratory',

  // Roles de administración
  ADMIN = 'admin',
  SUPER_ADMIN = 'super-admin',
}
