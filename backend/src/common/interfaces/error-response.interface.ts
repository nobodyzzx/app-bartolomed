export interface ErrorResponse {
  statusCode: number;
  message: string | string[];
  error: string;
  path?: string;
  timestamp?: string;
  /** Identificador único del request (X-Request-Id) para correlacionar con logs. */
  requestId?: string;
}
