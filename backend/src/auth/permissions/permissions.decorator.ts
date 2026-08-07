import { SetMetadata } from '@nestjs/common';
import { Permission } from './permissions.enum';

export const META_PERMISSIONS = 'permissions';
export const RequirePermissions = (...perms: Permission[]) => SetMetadata(META_PERMISSIONS, perms);
