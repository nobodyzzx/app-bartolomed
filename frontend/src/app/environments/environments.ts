export const environment = {
  production: false,
  baseUrl: 'http://localhost:3000/api',
  // Vacío en dev a propósito: sin DSN, Sentry no se inicializa (ver main.ts).
  sentryDsn: '',
};
