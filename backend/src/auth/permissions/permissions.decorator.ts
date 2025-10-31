import { SetMetadata } from '@nestjs/common';

export const META_PERMISSIONS = 'permissions';
export const RequirePermissions = (...perms: string[]) => SetMetadata(META_PERMISSIONS, perms);
