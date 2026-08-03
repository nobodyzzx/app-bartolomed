import { SetMetadata } from '@nestjs/common';

export const SKIP_AUTO_AUDIT_KEY = 'skipAutoAudit';

/**
 * El endpoint ya llama a AuditService.log() a mano (con before/after) —
 * sin esto, AuditInterceptor loguea una segunda fila genérica por la misma
 * mutación, inflando mutationsToday/topUsers/topResources.
 */
export const SkipAutoAudit = () => SetMetadata(SKIP_AUTO_AUDIT_KEY, true);
