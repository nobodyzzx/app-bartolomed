import { UserRoles } from "./userRoles.enum";

export interface UserRoleItem {
  value: UserRoles;
  label: string;
  icon: string;
  description: string;
}