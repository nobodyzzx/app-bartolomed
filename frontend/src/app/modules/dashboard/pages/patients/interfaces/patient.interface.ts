export enum Gender {
  MALE = 'male',
  FEMALE = 'female', 
  OTHER = 'other'
}

export enum BloodType {
  A_POSITIVE = 'A+',
  A_NEGATIVE = 'A-',
  B_POSITIVE = 'B+',
  B_NEGATIVE = 'B-',
  AB_POSITIVE = 'AB+',
  AB_NEGATIVE = 'AB-',
  O_POSITIVE = 'O+',
  O_NEGATIVE = 'O-'
}

export enum MaritalStatus {
  SINGLE = 'single',
  MARRIED = 'married',
  DIVORCED = 'divorced',
  WIDOWED = 'widowed',
  OTHER = 'other'
}

export interface Patient {
  id: string;
  firstName: string;
  lastName: string;
  documentNumber: string;
  documentType?: string;
  birthDate: Date;
  gender: Gender;
  email?: string;
  phone?: string;
  address?: string;
  city?: string;
  state?: string;
  zipCode?: string;
  country?: string;
  bloodType?: BloodType;
  maritalStatus?: MaritalStatus;
  occupation?: string;
  emergencyContactName?: string;
  emergencyContactPhone?: string;
  emergencyContactRelationship?: string;
  allergies?: string;
  medications?: string;
  medicalHistory?: string;
  insuranceProvider?: string;
  insuranceNumber?: string;
  notes?: string;
  isActive: boolean;
  clinicId: string;
  clinic?: {
    id: string;
    name: string;
  };
  createdBy?: {
    id: string;
    firstName: string;
    lastName: string;
  };
  createdAt: Date;
  updatedAt: Date;
}

export interface CreatePatientDto {
  firstName: string;
  lastName: string;
  documentNumber: string;
  documentType?: string;
  birthDate: string;
  gender: Gender;
  email?: string;
  phone?: string;
  address?: string;
  city?: string;
  state?: string;
  zipCode?: string;
  country?: string;
  bloodType?: BloodType;
  maritalStatus?: MaritalStatus;
  occupation?: string;
  emergencyContactName?: string;
  emergencyContactPhone?: string;
  emergencyContactRelationship?: string;
  allergies?: string;
  medications?: string;
  medicalHistory?: string;
  insuranceProvider?: string;
  insuranceNumber?: string;
  notes?: string;
  clinicId: string;
}

export interface UpdatePatientDto extends Partial<CreatePatientDto> {
  isActive?: boolean;
}

export interface PatientStatistics {
  totalPatients: number;
  genderStats: {
    gender: Gender;
    count: number;
  }[];
  ageRanges: {
    ageRange: string;
    count: number;
  }[];
}
