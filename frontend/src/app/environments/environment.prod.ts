export const environment = {
  production: true,
  // Usamos el mismo origen: Nginx proxy en el contenedor del frontend redirige /api -> backend interno
  baseUrl: '/api',
  // Vacío hasta configurar un proyecto Sentry real (sentry.io) y pegar su DSN aquí.
  // El DSN de Sentry no es secreto — está diseñado para ir embebido en bundles cliente.
  // Sin DSN, Sentry.init() no corre (ver main.ts) y el ErrorHandler solo loguea a consola.
  sentryDsn: '',
}
