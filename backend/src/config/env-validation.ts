/**
 * Validación de variables de entorno al arranque.
 *
 * Se invoca desde `ConfigModule.forRoot({ validate })`. Si retorna error,
 * Nest aborta el bootstrap antes de exponer el HTTP server, evitando que
 * la app levante con configuración inválida o secrets débiles.
 */

const MIN_SECRET_LENGTH = 32;

const REQUIRED = ['DB_HOST', 'DB_PORT', 'DB_NAME', 'DB_USER', 'DB_PASS', 'JWT_SECRET'];
const REQUIRED_IN_PRODUCTION = ['FRONTEND_DOMAIN'];

export function validateEnvironment(config: Record<string, unknown>): Record<string, unknown> {
  const errors: string[] = [];
  const isProduction = config.NODE_ENV === 'production';

  for (const key of REQUIRED) {
    if (!config[key]) errors.push(`${key} requerido`);
  }

  if (isProduction) {
    for (const key of REQUIRED_IN_PRODUCTION) {
      if (!config[key]) errors.push(`${key} requerido en producción`);
    }
  }

  const jwtSecret = config.JWT_SECRET as string | undefined;
  if (jwtSecret && jwtSecret.length < MIN_SECRET_LENGTH) {
    errors.push(
      `JWT_SECRET debe tener al menos ${MIN_SECRET_LENGTH} caracteres (actual: ${jwtSecret.length})`,
    );
  }

  const refreshSecret = config.JWT_REFRESH_SECRET as string | undefined;
  if (refreshSecret && refreshSecret.length < MIN_SECRET_LENGTH) {
    errors.push(
      `JWT_REFRESH_SECRET debe tener al menos ${MIN_SECRET_LENGTH} caracteres (actual: ${refreshSecret.length})`,
    );
  }

  if (isProduction && jwtSecret && refreshSecret && jwtSecret === refreshSecret) {
    errors.push('JWT_SECRET y JWT_REFRESH_SECRET deben ser diferentes en producción');
  }

  const port = config.DB_PORT as string | undefined;
  if (port && Number.isNaN(parseInt(port, 10))) {
    errors.push(`DB_PORT debe ser numérico (recibido: ${port})`);
  }

  if (errors.length > 0) {
    const message = [
      '',
      '╭─ Variables de entorno inválidas ──────────────────────────────╮',
      ...errors.map(e => `│  • ${e}`),
      '│',
      '│  Revisa `.env.example` para ver el formato esperado.',
      '╰───────────────────────────────────────────────────────────────╯',
      '',
    ].join('\n');
    throw new Error(message);
  }

  return config;
}
