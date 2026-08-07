import { SetMetadata } from '@nestjs/common';

export const META_CLINIC_ROLES = 'clinic_roles';
export const ClinicRoles = (...roles: string[]) => SetMetadata(META_CLINIC_ROLES, roles);

// Helper para resolver clinicId via rutas estándar
// NOTA: query param eliminado intencionalmente — aceptar clinicId en ?query
// permite que un usuario construya URLs apuntando a clínicas ajenas.
export const resolveClinicId = (req: any): string | undefined => {
  // 1) por parámetro de ruta
  if (req.params?.clinicId) return req.params.clinicId;
  if (req.params?.clinic_id) return req.params.clinic_id;
  // 2) por header (fuente principal desde el frontend)
  const header = req.headers['x-clinic-id'] || req.headers['x-clinic'];
  if (typeof header === 'string') return header;
  return undefined;
};
