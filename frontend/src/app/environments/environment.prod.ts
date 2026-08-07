export const environment = {
  production: true,
  // Mismo origen: el contenedor sirve los estáticos con `serve` y es Traefik
  // (Dokploy) quien enruta /api al backend. No hay Nginx de por medio, pese a
  // lo que decía este comentario.
  baseUrl: '/api',
  // Vacío hasta configurar un proyecto Sentry real (sentry.io) y pegar su DSN aquí.
  // El DSN de Sentry no es secreto — está diseñado para ir embebido en bundles cliente.
  // Sin DSN, Sentry.init() no corre (ver main.ts) y el ErrorHandler solo loguea a consola.
  sentryDsn: '',
}
