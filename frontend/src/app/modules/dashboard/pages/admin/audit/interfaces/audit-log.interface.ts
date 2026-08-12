export type AuditAction = 'LOGIN' | 'LOGOUT' | 'REFRESH' | 'CREATE' | 'UPDATE' | 'DELETE' | 'VIEW';

export interface AuditLog {
  id: string;
  action: AuditAction;
  resource: string;
  resourceId?: string;
  userId?: string;
  userEmail?: string;
  userName?: string;
  clinicId?: string;
  details?: Record<string, unknown>;
  ipAddress?: string;
  method: string;
  path: string;
  statusCode: number;
  status: 'success' | 'failure';
  createdAt: string;
}

export interface AuditLogsResponse {
  items: AuditLog[];
  total: number;
  page: number;
  pageSize: number;
}

export interface AuditStats {
  totalToday: number;
  errorsToday: number;
  loginsToday: number;
  mutationsToday: number;
  failedLogins: number;
  topIp: { ip: string; count: number } | null;
  topUsers: { email: string; count: number }[];
  topResources: { resource: string; count: number }[];
}

export interface DailyActivity {
  date: string;
  total: number;
  errors: number;
}

export interface AuditFilters {
  page?: number;
  pageSize?: number;
  action?: string;
  resource?: string;
  status?: string;
  search?: string;
  startDate?: string;
  endDate?: string;
  /** Debe ser una de las columnas que el backend acepta en su lista blanca. */
  sortBy?: string;
  sortDir?: 'ASC' | 'DESC';
}

export interface AuditDistinctValues {
  resources: string[];
  actions: string[];
}
