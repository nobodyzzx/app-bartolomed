import { SetMetadata } from '@nestjs/common';

export const META_CLINIC_ROLES = 'clinic_roles';
export const ClinicRoles = (...roles: string[]) => SetMetadata(META_CLINIC_ROLES, roles);

// Helper para resolver clinicId via rutas estándar
export const resolveClinicId = (req: any): string | undefined => {
  // 1) por parámetro de ruta común
  if (req.params?.clinicId) return req.params.clinicId;
  if (req.params?.clinic_id) return req.params.clinic_id;
  // 2) por header
  const header = req.headers['x-clinic-id'] || req.headers['x-clinic'];
  if (typeof header === 'string') return header;
  // 3) por query
  if (req.query?.clinicId) return req.query.clinicId;
  return undefined;
};
