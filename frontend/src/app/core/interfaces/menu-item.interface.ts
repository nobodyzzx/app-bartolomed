import { Permission } from '../enums/permission.enum'
import { UserRoles } from '../enums/user-roles.enum'

export interface MenuItem {
  label: string
  icon: string
  route?: string
  allowedRoles: UserRoles[]
  requiredPermissions?: Permission[]
  children?: MenuItem[]
}
