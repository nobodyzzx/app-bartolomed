import { NextFunction, Request, Response } from 'express';
import { randomUUID } from 'crypto';

/** Tope conservador para evitar headers maliciosos arbitrariamente largos. */
const MAX_LENGTH = 128;

/**
 * Asigna un identificador único a cada request entrante para correlacionar
 * logs, errores y eventos posteriores.
 *
 * Respeta el header `X-Request-Id` enviado por upstream (Traefik, balancer u
 * otro servicio) si viene presente y dentro del tope de longitud; en otro caso
 * genera uno con `randomUUID()`. El id se devuelve siempre en el header
 * `X-Request-Id` de la respuesta para que el cliente pueda referenciarlo al
 * reportar incidencias.
 */
export function requestIdMiddleware(req: Request, res: Response, next: NextFunction): void {
  const incoming = req.headers['x-request-id'];
  const fromUpstream = Array.isArray(incoming) ? incoming[0] : incoming;
  const id = fromUpstream && fromUpstream.length <= MAX_LENGTH ? fromUpstream : randomUUID();
  (req as Request & { requestId: string }).requestId = id;
  res.setHeader('X-Request-Id', id);
  next();
}
