export interface JwtPayload {
  id: string;
  jti?: string;
  /** IDs de clínicas a las que pertenece el usuario — embebidos en el token para evitar DB lookups en cada request */
  clinicIds?: string[];
}
