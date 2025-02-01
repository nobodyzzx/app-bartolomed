export type ErrorCode = 
  | 'DUPLICATE_EMAIL'
  | 'DUPLICATE_LICENSE'
  | 'INVALID_CREDENTIALS'
  | 'EXPIRED_TOKEN'
  | 'USER_NOT_FOUND'
  | 'INVALID_PASSWORD'
  | 'REQUIRED_FIELDS'
  | 'DEFAULT';

export type HttpStatusCode = 400 | 401 | 403 | 404 | 500 | 0;