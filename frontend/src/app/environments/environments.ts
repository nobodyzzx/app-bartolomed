/**
 * `baseUrl` se arma con el host desde el que se cargó la página, no con
 * "localhost" fijo: así la app funciona igual abierta en el propio equipo que
 * desde otra máquina de la red o de la tailnet (`http://100.x.y.z:4200`), donde
 * "localhost" apuntaría al navegador del visitante y ninguna llamada al API
 * llegaría al backend.
 *
 * El puerto del backend sigue siendo 3000, el que publica `docker-compose.yml`.
 */
const apiHost = typeof window !== 'undefined' ? window.location.hostname : 'localhost';

export const environment = {
  production: false,
  baseUrl: `http://${apiHost}:3000/api`,
  // Vacío en dev a propósito: sin DSN, Sentry no se inicializa (ver main.ts).
  sentryDsn: '',
};
