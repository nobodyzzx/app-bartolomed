export interface User {
  email: string;
  id: string;
  personalInfo: {
    firstName: string;
    lastName: string;
  };
  isActive: boolean;
  roles: string[];
}
